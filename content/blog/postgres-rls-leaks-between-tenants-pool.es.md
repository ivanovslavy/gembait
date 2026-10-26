# Por qué el RLS de Postgres filtra datos entre tenants

Imagina el ticket de soporte. Un cliente abre su registro de riesgos y ve tres filas que pertenecen a otra empresa. No es un error. Solo datos ajenos, ahí, como si siempre hubieran sido suyos.

Tienes activada la seguridad a nivel de fila — RLS, el mecanismo integrado de Postgres para ocultar filas a quien no tiene permiso de verlas. Cada petición fija el tenant antes de consultar. No puedes reproducirlo en tu portátil. Solo pasa bajo carga, y solo a veces.

Eso es lo que un desarrollador llevó a Stack Overflow en septiembre: una app Node multi-tenant sobre PostgreSQL 16, la librería `pg` (node-postgres), una política RLS de manual — y "un pequeño número de peticiones devuelve filas que pertenecen a otro tenant".

La parte incómoda: el código de la pregunta es correcto. La fuga viene de lo que el código *de alrededor* deja atrás en una conexión compartida.

## El problema

La política es lo más simple que permite RLS: muestra una fila solo cuando su `tenant_id` coincide con una variable de sesión llamada `app.current_tenant`.

```sql
CREATE POLICY tenant_isolation ON risks
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

Cada petición saca un cliente del pool, fija el tenant, consulta y devuelve el cliente:

```js
const client = await pool.connect();
try {
  await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
  const rows = await client.query('SELECT * FROM risks');
  return rows.rows;
} finally {
  client.release();
}
```

Esperado: cada petición ve solo su propio tenant. Real: bajo carga concurrente, algunas peticiones ven las filas de otro tenant.

El autor ya tenía una solución provisional — `SET LOCAL` dentro de una transacción explícita hacía desaparecer la fuga. Pero, en sus palabras: "Quería entender por qué falla la primera versión en lugar de simplemente cambiar." Buen instinto.

No es un caso aislado — ["Enforcing row-level security in a shared postgres pool"](https://stackoverflow.com/questions/77272972/enforcing-row-level-security-in-a-shared-postgres-pool) pregunta lo mismo. Laurenz Albe, core contributor de PostgreSQL, dejó el comentario clave: "Eso no puede pasar si todo el código de la petición se ejecuta en una sola sesión." Entonces — ¿por qué no era así?

## El baile de la depuración

Primer instinto: la política está mal. La ejecutas en `psql` como un usuario, un tenant. Aislamiento perfecto. No es la política.

Segunda hipótesis: el pool comparte un cliente entre dos peticiones. No lo hace — `pool.connect()` te da un cliente que nadie más puede tocar hasta que llamas a `release()`.

A estas alturas la prueba de carga ha corrido cuarenta veces y ha filtrado en seis. Stack Overflow está abierto en ocho pestañas. Una sugiere una conexión dedicada por tenant. El autor lo probó: funciona, hasta que hay unas decenas de tenants. Callejón sin salida.

Y entonces llega el pensamiento que te encoge el estómago. Una conexión de Postgres no es una tubería. Es una *sesión*, y una sesión tiene memoria. `SET` (y `set_config(..., false)`) tiene alcance de sesión — la documentación dice que el valor "persistirá hasta el final de la sesión, salvo que otro SET lo sobrescriba". El pool nunca termina la sesión cuando liberas un cliente. Entrega la misma sesión, todavía con el último tenant, al siguiente que la pida.

Así que el aislamiento solo se mantiene si **cada sentencia** que toca `risks` corre en una conexión cuyo tenant se fijó *en esa misma petición*. Rompe eso una vez, en cualquier sitio, y heredas el tenant de un desconocido.

La respuesta aceptada, de Zegarek, enumera dónde suele esconderse ese "una vez, en cualquier sitio":

- Un `pool.query()` en algún lugar en vez de `client.query()`. Cada llamada "es libre de acabar en una sesión completamente distinta, con otro tenant fijado".
- `SET LOCAL` fuera de una transacción. Postgres avisa `SET LOCAL can only be used in transaction blocks` — y luego no hace nada.
- Una unidad de trabajo que nunca fija el tenant, y se queda con "lo que otro worker le dejó".
- Un segundo pool debajo del tuyo — PgBouncer en modo transaction, pgpool-II — que cambia la conexión backend a mitad de petición.
- Un valor por defecto para `app.current_tenant` fijado con `ALTER DATABASE` o `ALTER ROLE`, que vuelve tras cada `RESET ALL`.

![Ilustración isométrica abstracta de una cápsula transparente que lleva una ficha luminosa por un segmento de tubería que se limpia solo después de su paso, en tonos turquesa y violeta](/images/blog/postgres-rls-leaks-between-tenants-pool/mid.webp)

## La solución

Tres capas.

**1. Limita el tenant a una transacción, no a una sesión.** El `true` de `set_config` significa "local", igual que `SET LOCAL`. Su efecto dura "solo hasta el final de la transacción actual, se confirme o no". Aunque la siguiente petición olvide fijar un tenant, no hereda nada.

```js
export async function withTenant(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await fn(client);   // every query uses *this* client
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

El helper también elimina la tentación de `pool.query()`: quien lo llama recibe `client`, no el pool. Con PgBouncer en modo transaction, el `BEGIN … COMMIT` explícito es además lo que fija tus sentencias a un único backend.

**2. Reinicia la sesión al devolverla.** Para atrapar estado sobrante de rutas de código más antiguas, limpia la conexión en el evento `release` de `pg-pool`:

```js
pool.on('release', (err, client) => {
  if (!err) client.query('ROLLBACK; RESET ALL; UNLISTEN *; SELECT pg_advisory_unlock_all();')
    .catch(() => client.release(true)); // destroy on failure
});
```

¿Por qué no `DISCARD ALL`? Funciona, pero como señala Franck Pachot en los comentarios, también descarta los planes en caché y la caché de secuencias, y no puede ejecutarse dentro de un bloque de transacción. `RESET ALL` es la parte que limpia los parámetros.

**3. Falla en cerrado.** Pasa `true` como segundo argumento de `current_setting()` para que un tenant ausente devuelva `NULL` — y `tenant_id = NULL` oculta todas las filas. Nunca le des un valor por defecto a `app.current_tenant`. Y revisa con qué rol te conectas: los propietarios de tablas y los superusuarios saltan el RLS salvo que hagas `ALTER TABLE risks FORCE ROW LEVEL SECURITY`.

## La lección

Un pool de conexiones te da uso exclusivo. No te da una hoja en blanco. Cada conexión del pool es una sesión con memoria, y todo lo que hagas con `SET` ahí es una nota que queda para el siguiente.

La regla que seguimos en los servicios multi-tenant con Node y PostgreSQL de GEMBA IT: el estado por petición está limitado a una transacción o se reinicia explícitamente — nunca ninguna de las dos. Ponlo detrás de un único helper y ejecuta una prueba concurrente que verifique el aislamiento entre tenants. Una fuga que aparece "a veces bajo carga" es el bug que una prueba de un solo usuario nunca encuentra.

## Créditos y lecturas recomendadas

> Este artículo se basa en un problema discutido originalmente en [este hilo de Stack Overflow](https://stackoverflow.com/questions/80003232/postgres-row-level-security-leaks-across-tenants-when-using-a-pooled-connection). Gracias a `@Muhammad Sufyan` por el caso de reproducción claro, a `@Zegarek` por el enfoque de la solución y a `@Franck Pachot`, `@Dunes` y `@Laurenz Albe` por los matices en los comentarios. Para profundizar, consulta la documentación oficial sobre [políticas de seguridad a nivel de fila](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [SET LOCAL](https://www.postgresql.org/docs/current/sql-set.html) y [DISCARD](https://www.postgresql.org/docs/current/sql-discard.html).

## Preguntas frecuentes

### ¿PgBouncer en modo transaction rompe esto?

Sí, salvo que cada sentencia que dependa del tenant corra dentro de una única transacción explícita. En modo transaction pooling, PgBouncer puede dar a cada *sentencia* una conexión backend distinta, así que un `SET` de sesión cae en un backend y tu `SELECT` en otro. Usa el helper `withTenant` (`set_config(..., true)` dentro de `BEGIN … COMMIT`) o cambia PgBouncer a modo session.

### ¿Debo ejecutar DISCARD ALL en cada release?

Es el reinicio completo más simple, pero muy contundente. Descarta prepared statements, planes en caché y cachés de secuencias, así que cada conexión reutilizada vuelve a pagar el coste de calentamiento — y falla dentro de un bloque de transacción. La limpieza más ligera del hilo es `ROLLBACK; RESET ALL; UNLISTEN *; SELECT pg_advisory_unlock_all();`. Si dependes de prepared statements, mueve las llamadas `PREPARE` al hook `onConnect` del pool.

### ¿Por qué no puedo escribir SET app.current_tenant = $1?

La pregunta original usaba exactamente eso, pero `SET` es un comando de utilidad y Postgres solo sustituye los placeholders `$1` en sentencias normales — `pg` recibe `syntax error at or near "$1"`. El equivalente parametrizado es `SELECT set_config('app.current_tenant', $1, true)`. Nunca concatenes el tenant como cadena dentro de `SET`; es un punto de inyección para cambiar de tenant.
