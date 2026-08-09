Imagina que escribiste una transacción. Tiene exactamente la pinta de cualquier tutorial que hayas leído: `BEGIN`, dos `UPDATE`, `COMMIT`. Los tests pasan. Staging pasa. Y entonces, dos meses después, en producción, una cuenta termina con un débito pero sin el crédito que le tocaba. Dinero perdido. Libros descuadrados. Un ticket de soporte abierto. Lees el código tres veces. La lógica es correcta. El SQL es correcto. La transacción *está ahí*.

Y sí, la transacción está ahí. El problema es que no hace lo que tú crees que hace.

Sobre esto exactamente te advierte la documentación de node-postgres en una sola frase — *do not use transactions with the pool.query method* — y es justo la parte que nadie se toma en serio hasta que le toca sufrirla. Déjame explicarte qué pasa de verdad. Cuando llamas a `pool.query('BEGIN')`, luego a `pool.query('UPDATE …')` y luego a `pool.query('COMMIT')`, tú piensas que estás ejecutando una transacción. No es así. Estás ejecutando tres consultas independientes, y cada una puede caer (o no) sobre la misma conexión a la base de datos. Una "conexión" aquí es simplemente el cable telefónico que une tu app con Postgres. Con poca carga, las tres consultas casualmente usan el mismo cable. Con carga real, no. Y ahí es cuando tu dinero desaparece.

Este artículo es la versión larga de esa única frase de advertencia. Vamos a ver por qué pasa, cómo se ve el fallo en los logs (spoiler: normalmente no deja ninguno) y el patrón de cuatro líneas que es la única forma correcta de hacerlo.

## El problema, formulado con precisión

Abre la documentación oficial de node-postgres y busca la [página sobre transacciones](https://node-postgres.com/features/transactions). A media página, en texto plano, te lo dicen: *"You **must** use the same client instance for all statements within a transaction. PostgreSQL isolates a transaction to individual clients."* Y justo después llega la advertencia en negrita: *"This means if you initialize or use transactions with the pool.query method you **will** have problems. Do not use transactions with the pool.query method."*

Fíjate en ese `must` y en ese `will`. No son casuales. El estado de una transacción de Postgres — el `BEGIN` que has abierto, los locks (bloqueos que reservan filas para que nadie más las toque a la vez), las filas que sólo tú puedes ver — vive atado a una única conexión TCP dentro del servidor. Una conexión TCP es ese cable telefónico del que hablábamos. Si abres una transacción en un cable y luego ejecutas un `UPDATE` en otro distinto, ese `UPDATE` se ejecuta en modo autocommit (es decir, se guarda solo, al instante y para siempre) sobre la tabla pelada. Postgres no tiene ni idea de que tu aplicación *piensa* que esas dos sentencias van juntas.

Ahora mete el pool en la ecuación. Un pool es como una centralita con varios cables ya conectados, lista para prestarte uno cuando lo pidas. Cada vez que llamas a `pool.query()`, le pides a la centralita cualquier cable que esté libre. Si no hay concurrencia, la centralita te da siempre el mismo cable, porque sólo hay uno y la consulta anterior acaba de soltarlo. Por eso tus tests pasan. Pero en cuanto hay varias peticiones a la vez, la centralita te entrega lo que tenga libre en ese momento. El `BEGIN` cae en el Cliente A. Mientras tu código espera (`await`) a que se resuelva ese paso, el Cliente A se libera y otra petición lo agarra, así que tu `UPDATE` acaba cayendo en el Cliente B.

Y aquí está la parte cruel: nada salta. Nada da error. A Postgres le da igual. Tu `BEGIN` abre una transacción en el Cliente A, y esa transacción se queda abierta hasta que el Cliente A se reutilice para otra cosa (momento en que se hace `ROLLBACK` por reset sin avisar, o simplemente se queda ahí en idle). Tu `UPDATE` corre en autocommit en el Cliente B y queda guardado para siempre. Y tu `COMMIT` corre en el Cliente C contra una transacción que no existe, así que no hace absolutamente nada.

Tres sentencias. Tres clientes. Cero atomicidad. Y un CFO furioso.

## La danza del debugging

No vas a dar con la respuesta a la primera. Nadie lo hace. Cuando ves en producción una transacción aplicada a medias, tu primer instinto es pensar que tu `try/catch` está mal. Relees la ruta de error. Metes un `console.log` antes del `ROLLBACK`. Intentas reproducirlo en local — y, claro, en local funciona, porque `npm test` lanza las peticiones de una en una y la centralita, obediente, te da siempre el mismo cable.

Así que pasas al segundo instinto: "será un bug de concurrencia en algún sitio más arriba". Compruebas si dos peticiones pueden pelearse por la misma fila. Añades un `SELECT … FOR UPDATE`. Metes un índice único, por si acaso. Y el bug sigue ahí, porque el bug no está en la fila: está en la conexión. Estás bloqueando con un cliente y actualizando con otro, y el lock que reservaste vive en una conexión que se libera antes de que llegues siquiera a usarla.

Tercer instinto: la culpa es del tamaño del pool. *"El pool se queda corto, tenemos reutilización rara."* Subes `max` de 10 a 50. El bug se vuelve menos frecuente — porque ahora hay más cables y es más probable que dos llamadas seguidas a `pool.query` caigan en el mismo — y lo despliegas a producción cantando victoria. Y vuelve la próxima vez que el tráfico se duplica.

Llegados a este punto tienes Stack Overflow abierto en ocho pestañas, todas variantes de *"node-postgres transaction not rolling back"*, y empiezas a desconfiar de la propia librería. Abres el [issue tracker de brianc/node-postgres](https://github.com/brianc/node-postgres/issues/35) y te encuentras una pregunta de 2011 — *"Long-running transaction within a pooled client"* — que pregunta básicamente lo mismo que tú ahora: cuando uso un pool, ¿tengo garantizado que se mantiene la misma conexión entre consultas? La respuesta, repartida por ese hilo y por una docena más, es *no, nunca, tienes que mantener tú mismo el cliente*.

El momento de iluminación es pequeño y un poco vergonzoso. No estabas manteniendo el cliente. Estabas llamando a `pool.query` tres veces y la centralita hacía exactamente lo que anuncia: darte cualquier cable libre, cada vez, sin recordar lo que habías ejecutado un milisegundo antes. Tu transacción era una ilusión montada sobre tres viajes de ida y vuelta a la base de datos que no tenían nada que ver entre sí.

![Visualización isométrica abstracta de una transacción fragmentándose entre tres slots de conexión distintos, con arcos rotos y un símbolo de candado punteado sobre el slot equivocado.](/images/blog/node-postgres-pool-begin-transaction-race/mid.webp)

## La solución

Hay exactamente un patrón correcto, y vale la pena que se te quede en la memoria muscular. Pide prestado un cliente, usa esa *misma* variable de cliente para el `BEGIN`, para cada consulta dentro de la transacción y para el `COMMIT` o el `ROLLBACK`, y al final libéralo en el bloque `finally`. Cualquier otra cosa es ponerte una pistola apuntando al pie.

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

Que esto funcione es exactamente la otra cara de por qué la versión rota no funciona. `pool.connect()` saca un cliente del pool y te lo *reserva* para ti mientras lo retengas. Mientras lo tienes en la mano, ninguna otra petición puede recibir ese mismo cliente. Cuando llamas a `client.query`, hablas por esa única conexión TCP. El `BEGIN` abre una transacción en el lado del servidor de esa conexión. Cada `client.query` que viene después viaja por la misma conexión, dentro de la misma transacción. El `COMMIT` la cierra. Y `client.release()` devuelve la conexión al pool — limpia, lista y sin restos de transacción.

Hay un par de detalles poco obvios que merece la pena que te apuntes en la pared:

**El `finally` no se negocia.** Si `client.release()` no se ejecuta en todas y cada una de las rutas posibles del código, ese cliente se queda "fugado" a ojos del pool: como si lo hubieras pedido prestado y nunca lo devolvieras. Tras `max` fugas, la siguiente llamada a `pool.connect()` se queda esperando para siempre (o cae en `connectionTimeoutMillis` y suelta un error desconcertante). La forma `try / catch / finally` de arriba es la correcta; resiste la tentación de "simplificarla" metiendo el release dentro del `try`.

**El `ROLLBACK` también puede lanzar excepción por su cuenta.** Si la conexión se murió a mitad de la transacción, el `ROLLBACK` fallará con un `"Client was closed and is not queryable"` o algo parecido. Tragarte ese error con `.catch(() => {})` es algo que hacemos a propósito: la transacción ya está perdida pase lo que pase, y lo que tú quieres es que el error *original* le llegue a quien llamó a la función, no el error secundario del rollback. Este patrón aparece una y otra vez en el issue tracker de brianc/node-postgres precisamente porque la gente se lía sobre qué error debe propagar.

**No reutilices el nombre de la variable.** Una variante muy típica de este bug es tener `pool` y `client` en el mismo scope y, sin darte cuenta, escribir `pool.query('UPDATE …')` en lugar de `client.query('UPDATE …')` dentro del cuerpo de la transacción. Esa diferencia de una sola letra compila, se ejecuta y rompe la transacción en silencio. El linter no lo pilla. La revisión de código a duras penas lo pilla. La única defensa de verdad es una función envoltorio que esconda el pool por completo.

Ese envoltorio merece la pena escribirlo una vez y usarlo en todas partes:

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

En cuanto `pool` deja de estar accesible dentro del callback, el typo de `pool.query` se vuelve directamente imposible. Cada transacción de tu base de código pasa a verse idéntica. Y los recién llegados no pueden meter la pata el primer día, sencillamente porque sólo hay una forma de copiar el patrón.

## La lección

Los pools de conexiones son una comodidad pensada para trabajo sin estado. Las transacciones, en cambio, son puro estado. Esos dos mundos sólo se encuentran en una llamada concreta de la API — `pool.connect()` — y cualquier código que intente esquivar esa llamada está, por construcción, roto en cuanto hay concurrencia. Pasará los tests. Pasará la code review hecha por gente a la que esto todavía no le ha mordido. Funcionará durante meses en staging. Y entonces, el día más ocupado del año, dos peticiones se pelearán por el mismo cliente y tus invariantes se vendrán abajo sin hacer ruido.

El principio de fondo es este: cuando una API te ofrece "cualquier trabajador disponible" y otra parte del sistema necesita "el mismo trabajador para las próximas N llamadas", no puedes cerrar la distancia entre esas dos formas de pensar a base de buenos deseos. Necesitas una primitiva que ate la una a la otra, y necesitas envolver esa atadura en una función que haga imposible saltársela. `pool.connect()` más un ayudante `withTransaction` es justo ese envoltorio. Cualquier cosa más laxa es un incidente futuro esperando su turno en el calendario.

## Crédito y lectura adicional

Este artículo es una recreación profunda de un problema discutido en [el issue #35 de brianc/node-postgres — *Long-running transaction within a pooled client*](https://github.com/brianc/node-postgres/issues/35) y revisitado muchas veces desde entonces (notablemente [#2852 — *Hard to handle idle-in-transaction errors*](https://github.com/brianc/node-postgres/issues/2852) y [#2512 — *Client was closed and is not queryable*](https://github.com/brianc/node-postgres/issues/2512)). Gracias al maintainer `@brianc` por el [gist canónico de transacciones](https://gist.github.com/brianc/5547726) que ha sido referencia de facto durante más de una década. Para la documentación autoritativa, consulta [node-postgres — Transactions](https://node-postgres.com/features/transactions). Nuestra pasarela de liquidación directa GembaPay ejecuta toda escritura multi-fila a través de un envoltorio `withTransaction` exactamente por la razón descrita arriba.

## Preguntas frecuentes

### ¿Por qué mi suite de tests nunca pilla esto?

Porque tus tests se ejecutan uno detrás de otro. Con una sola petición en vuelo, el pool te da el mismo cliente en cada llamada — tu `BEGIN`, tu `UPDATE` y tu `COMMIT` caen por casualidad en la misma conexión, y la transacción funciona "de chiripa". El bug sólo asoma cuando hay dos o más peticiones en vuelo a la vez y el pool empieza a repartir clientes distintos entre tus awaits. Para reproducirlo de forma fiable hace falta una prueba de carga o un test concurrente montado a propósito: lanza 100 transferencias en paralelo contra un pool pequeño (`max: 2` o `max: 4`) y verás transacciones partidas al instante. La mayoría de pipelines de CI no hacen esto, y por eso el patrón sobrevive en bases de código de producción durante años.

### ¿Me protege un ORM como Prisma o TypeORM de esto?

En general sí, pero sólo si usas la API de transacciones del propio ORM. Tanto `prisma.$transaction(async (tx) => …)` de Prisma como `dataSource.transaction(async (manager) => …)` de TypeORM sacan por debajo un cliente dedicado y te pasan una interfaz de consulta envuelta y atada a ese cliente. La trampa está en mezclar las dos cosas: llamar a `prisma.user.update(…)` directamente dentro del callback de `prisma.$transaction(async (tx) => …)` usa el pool, no el cliente de la transacción, y reproduce el mismo bug de transacción partida a un nivel más alto. La regla se generaliza fácil: usa siempre el objeto ligado a la transacción que el ORM te entrega, y nunca tires del pool global dentro del callback.

### ¿Está `idleTimeoutMillis` relacionado con este bug?

De forma indirecta. El idle timeout controla cuánto tiempo aguanta en el pool un cliente sin usar antes de que lo destruyan; no es lo que hace que las transacciones se partan. Pero sí provoca un fallo emparentado e igual de confuso: un cliente que está a mitad de transacción puede ser eliminado por `idle_in_transaction_session_timeout` desde el lado de Postgres si tu código se queda esperando algo lento entre consultas (una API externa, la lectura de un archivo grande). La transacción queda entonces rota, y tu siguiente `client.query` lanza el famoso `"Client was closed and is not queryable"`. La solución tiene la misma forma de siempre: agárrate al cliente con firmeza, no esperes operaciones externas largas mientras tengas una transacción abierta, y confía en el patrón `try/finally/release` para que un cliente muerto se devuelva igualmente limpio al pool.

### ¿Y `pool.query` con un único string SQL que contenga `BEGIN; UPDATE; COMMIT`?

Esto sí funciona, porque Postgres parsea el string con varias sentencias como un único mensaje por el cable y lo ejecuta entero sobre el cliente que el pool haya elegido — de forma atómica, en una sola conexión. Pero trae sus propios problemas: no puedes vincular parámetros entre las sentencias de forma segura, no puedes hacer un `ROLLBACK` condicional según el resultado de una de las sentencias internas, y has escondido una transacción dentro de un literal de string donde a nadie se le va a ocurrir mirar. Es un truco de salón, no un patrón de verdad. Usa `pool.connect()` y un cliente retenido; te lo agradecerás a ti mismo la primera vez que necesites meter un `CASE` en la ruta de rollback.

### ¿Por qué pg-pool no detecta un `BEGIN` y fija el cliente automáticamente?

Porque fijar un cliente a base de parsear el SQL es muy frágil: `BEGIN`, `START TRANSACTION`, `BEGIN ISOLATION LEVEL …` y los savepoints arrancan todos un estado parecido a una transacción, y parsear cada variante de forma fiable dentro de un driver es prácticamente otro proyecto aparte. Auto-fijar el cliente también escondería el coste: la gente escribiría llamadas a `pool.query` con pinta inofensiva que en realidad estarían reteniendo una conexión fuera del pool hasta mucho después. El `pool.connect()` explícito hace visible cuánto vive cada cliente y saca a la luz las fugas enseguida — agotas el pool a toda prisa en cuanto te olvidas de liberar. El verdadero footgun es que toda esta advertencia vive en una única frase de la documentación, facilísima de pasar por alto.
