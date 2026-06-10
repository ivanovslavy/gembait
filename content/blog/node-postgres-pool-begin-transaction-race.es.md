---
title: "Por qué pool.query('BEGIN') corrompe tus datos"
slug: "node-postgres-pool-begin-transaction-race"
date: "2026-04-27"
lastUpdated: "2026-04-27"
author: "GEMBA IT team"
cluster: "backend-infrastructure"
tags:
  - node-js
  - postgresql
  - node-postgres
  - transactions
  - race-conditions
  - connection-pool
readingTime: 9
excerpt: "Una transacción pool.query('BEGIN') / pool.query('COMMIT') pasa todos los tests y se propaga silenciosamente entre dos clientes en producción. Aquí está la race condition y la solución de una línea que la documentación de node-postgres esconde en una sola frase."
hero: "/images/blog/node-postgres-pool-begin-transaction-race/hero.webp"
heroRetina: "/images/blog/node-postgres-pool-begin-transaction-race/hero@2x.webp"
midImage: "/images/blog/node-postgres-pool-begin-transaction-race/mid.webp"
midImageRetina: "/images/blog/node-postgres-pool-begin-transaction-race/mid@2x.webp"
---

Escribiste una transacción. Tiene exactamente la pinta de cualquier tutorial de transacciones que hayas leído. `BEGIN`, dos `UPDATE`, `COMMIT`. Los tests pasan. Staging pasa. Dos meses en producción, una cuenta acaba con un débito y sin el crédito correspondiente — dinero perdido, libros descuadrados, ticket de soporte abierto. Lees el código tres veces. La lógica es correcta. El SQL es correcto. La transacción *existe*.

La transacción existe. Sólo que no está haciendo lo que crees que hace.

Esta es la parte sobre la que la documentación de node-postgres advierte en una sola frase — *do not use transactions with the pool.query method* — y la parte que nadie internaliza hasta que le muerde: cuando llamas a `pool.query('BEGIN')`, luego `pool.query('UPDATE …')`, luego `pool.query('COMMIT')`, no estás ejecutando una transacción. Estás ejecutando tres consultas independientes que pueden o no caer sobre la misma conexión a la base de datos. Bajo carga baja, casualmente lo hacen. Bajo carga real, no. Y entonces tu dinero desaparece.

Este artículo es la versión larga de esa única frase de advertencia. Por qué ocurre, cómo se ve el fallo en los logs (normalmente no deja ninguno) y el patrón de cuatro líneas que es la única forma correcta de hacerlo.

## El problema, formulado con precisión

Abre la documentación oficial de node-postgres y busca la [página sobre transacciones](https://node-postgres.com/features/transactions). A media página, en texto plano: *"You **must** use the same client instance for all statements within a transaction. PostgreSQL isolates a transaction to individual clients."* Y a continuación, la advertencia en negrita: *"This means if you initialize or use transactions with the pool.query method you **will** have problems. Do not use transactions with the pool.query method."*

Ese `must` y ese `will` cargan mucho peso. El estado de transacción de Postgres — el `BEGIN` abierto, los locks retenidos, las filas visibles sólo para esta transacción — está atado a una única conexión TCP en el servidor. Si inicias una transacción en una conexión y ejecutas un `UPDATE` en otra distinta, el `UPDATE` ocurre en modo autocommit contra la tabla pelada. Postgres no tiene idea de que tu aplicación *cree* que las dos sentencias están relacionadas.

Ahora añade pg-pool. Cada llamada a `pool.query()` le pide al pool cualquier cliente libre. Sin concurrencia, el pool te entrega el mismo cliente cada vez, porque sólo hay uno y la consulta anterior acaba de soltarlo. Tus tests pasan. Bajo concurrencia, el pool te entrega lo que esté libre. El `BEGIN` cae en el Cliente A. Para cuando el siguiente `await` se resuelve, el Cliente A ha sido liberado y agarrado por otra petición, y tu `UPDATE` cae en el Cliente B.

La parte cruda: nada da error. A Postgres le da igual. Tu `BEGIN` abre una transacción en el Cliente A y esa transacción queda abierta hasta que el Cliente A se reutilice para otra cosa (lo que silenciosamente hace `ROLLBACK` por reset, o simplemente sigue en idle). Tu `UPDATE` corre en autocommit en el Cliente B y queda commiteado de forma permanente. Tu `COMMIT` corre en el Cliente C contra ninguna transacción abierta y es un no-op.

Tres sentencias. Tres clientes. Cero atomicidad. Un CFO furioso.

## La danza del debugging

No llegas a la respuesta correcta a la primera. Nadie llega. El primer instinto, cuando ves una transacción a medio aplicar en producción, es asumir que tu `try/catch` está mal. Relees la ruta de error. Añades un `console.log` antes del `ROLLBACK`. Lo reproduces localmente — y por supuesto funciona localmente, porque `npm test` ejecuta una petición a la vez y el pool obediente te entrega el mismo cliente una y otra vez.

Así que el segundo instinto es "bug de concurrencia en algún sitio aguas arriba". Compruebas si dos peticiones pueden competir por la misma fila. Añades un `SELECT … FOR UPDATE`. Añades un índice único por si acaso. El bug no desaparece, porque el bug no está en la fila — está en la conexión. Estás bloqueando con un cliente y actualizando con otro, y el lock que tomaste está en una conexión que se libera antes de que llegues a usarla.

Tercer instinto: culpas al tamaño del pool. *"El pool debe ser demasiado pequeño. Tenemos una reutilización rara."* Subes `max` de 10 a 50. El bug se vuelve menos frecuente — porque ahora hay más clientes y la probabilidad de que dos llamadas consecutivas a `pool.query` caigan en el mismo es mayor — y lo despliegas a producción como solucionado. Vuelve la próxima vez que el tráfico se duplica.

Llegado este punto Stack Overflow está abierto en ocho pestañas, todas variantes de *"node-postgres transaction not rolling back"*, y empiezas a sospechar de la librería. Abres el [issue tracker de brianc/node-postgres](https://github.com/brianc/node-postgres/issues/35) y encuentras una pregunta de 2011 — *"Long-running transaction within a pooled client"* — que pregunta esencialmente lo mismo que tú estás preguntando ahora: cuando uso un pool, ¿se me garantiza que mantengo la misma conexión entre consultas? La respuesta, repartida por ese hilo y por una docena más, es *no, nunca, debes mantener tú mismo el cliente*.

El momento de iluminación es pequeño y vergonzoso. No estabas manteniendo el cliente. Estabas llamando a `pool.query` tres veces y el pool estaba haciendo lo que anuncia: dándote cualquier cliente libre, cada vez, sin memoria de lo que hubieras ejecutado un milisegundo antes. Tu transacción era una ilusión construida sobre tres viajes ida y vuelta no relacionados a la base de datos.

![Visualización isométrica abstracta de una transacción fragmentándose entre tres slots de conexión distintos, con arcos rotos y un símbolo de candado punteado sobre el slot equivocado.](/images/blog/node-postgres-pool-begin-transaction-race/mid.webp)

## La solución

Hay exactamente un patrón correcto. Grábatelo en la memoria muscular. Adquiere un cliente, usa esa *misma* variable de cliente para `BEGIN`, cada consulta dentro de la transacción y `COMMIT` o `ROLLBACK`, y luego libéralo en `finally`. Cualquier otra cosa es un footgun.

```js
// ✅ CORRECTO — un cliente, mantenido durante toda la transacción
async function transferFunds(pool, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId],
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

Por qué esto funciona es exactamente por qué la versión rota no funciona. `pool.connect()` saca un cliente del pool y te lo *promete* mientras lo retengas. Mientras lo retienes, ninguna otra petición puede recibir ese mismo cliente. Cuando llamas a `client.query`, vas a esa única conexión TCP. `BEGIN` abre una transacción en el lado del servidor de esa conexión. Cada `client.query` posterior va por la misma conexión, en la misma transacción. `COMMIT` la cierra. `client.release()` devuelve la conexión al pool — limpia, lista, sin estado de transacción residual.

Los detalles no obvios que merece la pena fijar en la pared:

**`finally` es innegociable.** Si `client.release()` no se ejecuta en cada ruta de código, ese cliente queda fugado desde la perspectiva del pool. Tras `max` fugas, el siguiente `pool.connect()` espera para siempre (o cae en `connectionTimeoutMillis` y emite un error confuso). La forma `try / catch / finally` de arriba es correcta; resiste la tentación de "simplificarla" moviendo el release dentro del `try`.

**`ROLLBACK` puede lanzar excepción él solo.** Si la conexión murió a mitad de la transacción, el `ROLLBACK` fallará con `"Client was closed and is not queryable"` o algo similar. Tragarse eso con `.catch(() => {})` es intencional — la transacción está perdida en cualquier caso, y quieres que el error *original* burbujee al llamador, no el error secundario del rollback. Este patrón aparece repetidamente en el issue tracker de brianc/node-postgres porque la gente se confunde sobre qué error sacar.

**No reutilices el nombre de la variable.** Una variante común de este bug es tener `pool` y `client` en el mismo scope y escribir accidentalmente `pool.query('UPDATE …')` en vez de `client.query('UPDATE …')` dentro del cuerpo de la transacción. La diferencia de una sola letra compila, ejecuta y rompe silenciosamente la transacción. El linter no lo pilla. La revisión de código apenas lo pilla. La única defensa es una función envoltorio que oculte el pool por completo.

El envoltorio merece la pena escribirlo una vez y usarlo en todas partes:

```js
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Uso — pool es invisible, sólo `client` está en scope dentro de `fn`:
await withTransaction(pool, async (client) => {
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
});
```

Una vez que `pool` no está en scope dentro del callback, el typo de `pool.query` es imposible. Cada transacción de tu base de código se ve idéntica. Los nuevos contratados no pueden equivocarse el primer día porque sólo hay una forma para copiar.

## La lección

Los pools de conexiones son comodidad para trabajo sin estado. Las transacciones son estado. Las dos se encuentran sólo en una llamada de API específica — `pool.connect()` — y cualquier código que tome un atajo alrededor de esa llamada está, por construcción, roto bajo concurrencia. Pasará tests. Pasará code review hecho por gente que aún no ha sido mordida. Funcionará durante meses en staging. Y entonces, en el día más ocupado del año, dos peticiones competirán por el mismo cliente y tus invariantes se desmoronarán silenciosamente.

El principio general: cuando un API te entrega "cualquier worker disponible" y otra parte del sistema necesita "el mismo worker para las próximas N llamadas", no puedes salvar la distancia entre ambas semánticas con esperanza. Necesitas una primitiva que ate uno al otro, y necesitas envolver esa atadura en una función que haga imposible saltársela. `pool.connect()` más un helper `withTransaction` es ese envoltorio. Cualquier cosa más laxa es un futuro incidente esperando en el calendario.

## Crédito y lectura adicional

Este artículo es una recreación profunda de un problema discutido en [el issue #35 de brianc/node-postgres — *Long-running transaction within a pooled client*](https://github.com/brianc/node-postgres/issues/35) y revisitado muchas veces desde entonces (notablemente [#2852 — *Hard to handle idle-in-transaction errors*](https://github.com/brianc/node-postgres/issues/2852) y [#2512 — *Client was closed and is not queryable*](https://github.com/brianc/node-postgres/issues/2512)). Gracias al maintainer `@brianc` por el [gist canónico de transacciones](https://gist.github.com/brianc/5547726) que ha sido referencia de facto durante más de una década. Para la documentación autoritativa, consulta [node-postgres — Transactions](https://node-postgres.com/features/transactions). Nuestra pasarela non-custodial GembaPay ejecuta toda escritura multi-fila a través de un envoltorio `withTransaction` exactamente por la razón descrita arriba.

## Preguntas frecuentes

### ¿Por qué mi suite de tests nunca pilla esto?

Porque tus tests se ejecutan secuencialmente. Con una petición en vuelo, el pool te entrega el mismo cliente cada llamada — tu `BEGIN`, tu `UPDATE` y tu `COMMIT` caen casualmente en la misma conexión, y la transacción funciona "por accidente". El bug sólo aparece cuando dos o más peticiones están en vuelo simultáneamente y el pool empieza a entregar clientes distintos entre tus awaits. Reproducirlo de forma determinista exige una prueba de carga o un test concurrente fabricado a propósito — lanza 100 transferencias en paralelo contra un pool pequeño (`max: 2` o `max: 4`) y verás transacciones partidas inmediatamente. La mayoría de pipelines de CI no hacen esto, lo cual explica por qué el patrón sobrevive en bases de código de producción durante años.

### ¿Me protege un ORM como Prisma o TypeORM de esto?

Sobre todo sí, pero sólo cuando usas el API de transacciones del ORM. Tanto `prisma.$transaction(async (tx) => …)` de Prisma como `dataSource.transaction(async (manager) => …)` de TypeORM sacan un cliente dedicado bajo el capó y te pasan un interfaz de consulta envuelto, ligado a ese cliente. La trampa es mezclar las dos cosas — llamar `prisma.user.update(…)` directamente dentro del callback de `prisma.$transaction(async (tx) => …)` usa el pool, no el cliente de la transacción, y reproduce el mismo bug de transacción partida a más alto nivel. La regla generaliza: usa el objeto ligado a la transacción que el ORM te entrega, y nunca cierres sobre el pool global dentro del callback.

### ¿Está `idleTimeoutMillis` relacionado con este bug?

Indirectamente. El idle timeout gobierna cuánto tiempo un cliente sin uso permanece en el pool antes de ser destruido; no causa que las transacciones se partan. Pero produce una clase de fallo relacionada e igualmente confusa — un cliente a mitad de transacción puede ser matado por `idle_in_transaction_session_timeout` desde el lado de Postgres si el código de tu aplicación espera algo lento entre consultas (un API externo, una lectura larga de archivo). La transacción queda entonces rota, y tu siguiente `client.query` lanza `"Client was closed and is not queryable"`. La solución tiene la misma forma: retén el cliente con firmeza, no esperes operaciones externas largas dentro de una transacción abierta y confía en el patrón `try/finally/release` para que un cliente muerto siga devolviéndose limpiamente al pool.

### ¿Y `pool.query` con un único string SQL conteniendo `BEGIN; UPDATE; COMMIT`?

Esto funciona porque Postgres parsea el string multi-sentencia como un único mensaje en el cable y ejecuta todo entero sobre el cliente que el pool haya elegido — atómicamente, en una sola conexión. Pero tiene sus propios problemas: no puedes vincular parámetros entre las sentencias de forma segura, no puedes hacer `ROLLBACK` condicional según el resultado de una de las sentencias internas, y has escondido una transacción dentro de un literal de string donde nadie pensará en mirar. Es un truco de salón, no un patrón. Usa `pool.connect()` y un cliente retenido; te lo agradecerás la primera vez que necesites añadir un `CASE` a la ruta de rollback.

### ¿Por qué pg-pool no detecta un `BEGIN` y fija el cliente automáticamente?

Fijar un cliente basándose en parsear SQL es frágil — `BEGIN`, `START TRANSACTION`, `BEGIN ISOLATION LEVEL …` y los savepoints todos inician estado parecido a una transacción, y parsear cada variante de manera fiable en un driver es un proyecto distinto. Auto-fijar también ocultaría el coste: la gente escribiría llamadas aparentemente inocentes a `pool.query` que silenciosamente retendrían una conexión fuera del pool hasta mucho después. El `pool.connect()` explícito hace visible el tiempo de vida y saca a la luz las fugas rápido — agotas el pool deprisa cuando olvidas liberar. El footgun es que la advertencia vive en una sola frase de la documentación, fácil de saltarse.
