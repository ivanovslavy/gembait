Tu handler de webhook tiene buena pinta. Logueas el `event.id` de Stripe, miras si ya lo habías visto y, si no, procesas el pago. Los tests locales pasan. Los de integración también. Y entonces, un martes por la tarde, a un donante de Melbourne le cobran dos veces los mismos $50. Y te pasas las siguientes tres horas intentando convencerte de que el roto es Stripe.

Stripe no está roto. Lo que está roto es tu comprobación.

El patrón que casi seguro escribiste — un `SELECT`, y después, si no existe, un `INSERT` — parece una sola cosa, pero son dos. Y en cuanto pones esto en producción con más de un worker detrás de un load balancer, dos copias del mismo evento se cuelan por el huequito que queda entre esos dos pasos. Procesas la donación dos veces. Avisas en el canal de Slack dos veces. Mandas el email del recibo dos veces. Y tu monitorización no dice ni mu, porque cada petición HTTP, por separado, devolvió un `200 OK` la mar de feliz.

Esto no es un caso raro de esquina. Es lo que pasa por defecto con el patrón de tutorial más copiado de internet. El 11 de marzo de 2026 se abrió un issue público de prioridad P0 (un fallo grave, de los que hay que arreglar ya) en la plataforma de donaciones SwiftCause, describiendo exactamente esta race condition — esa "carrera" en la que dos procesos compiten por el mismo dato y el resultado depende de quién llegue primero — generando filas de donaciones duplicadas en Firestore. ¿Y la solución? No es un lock distribuido, ni Redis, ni una cola. Es una sola sentencia SQL que probablemente ya conoces.

## El problema, formulado con precisión

La propia documentación de Stripe te avisa de que esto puede pasar. De su guía de fiabilidad de webhooks: *"Endpoints occasionally receive the same event more than once."* Y también: *"We recommend guarding against duplicated event receipts by making your event processing idempotent."* Idempotente significa "seguro de ejecutar dos veces": puedes lanzar la misma operación repetida sin que la acción real ocurra dos veces. La [documentación de webhooks de Stripe](https://docs.stripe.com/webhooks) cuenta además cómo funcionan los reintentos — hasta tres días de exponential backoff (reintentos cada vez más espaciados) en modo live, y tres intentos en pocas horas en modo test — y te avisa de que el orden de llegada no está garantizado.

Que lleguen dos reintentos casi a la vez es lo normal, no la excepción. Mira la secuencia: Stripe entrega el evento. Tu endpoint tarda 4.9 segundos en responder porque hoy Postgres anda fino. Stripe espera hasta 5.0 segundos, se cansa y encola un reintento. Medio segundo después, el reintento sale disparado. Pero en ese medio segundo tu petición original también acaba de terminar. Resultado: dos POST HTTP casi idénticos volando a la vez contra tu cluster.

Aquí tienes el patrón que sale en todos los tutoriales de "handle Stripe webhooks in Node":

```js
// ❌ INCORRECTO — pinta bien, falla bajo entrega concurrente
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);

  const { rows } = await pg.query(
    'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (rows.length > 0) return res.sendStatus(200);

  await handleStripeEvent(event);   // envía email, crea donación, llama servicios externos
  await pg.query(
    'INSERT INTO webhook_events (stripe_event_id) VALUES ($1)',
    [event.id]
  );
  res.sendStatus(200);
});
```

Sigue lo que pasa paso a paso. El Worker A ejecuta el `SELECT` y no encuentra nada. Un milisegundo después, el Worker B ejecuta el mismo `SELECT` y tampoco encuentra nada. Los dos siguen adelante. Los dos llaman a `handleStripeEvent`. Los dos hacen el insert. Si `stripe_event_id` tiene un unique constraint, el segundo insert falla — pero ya es tarde, porque los efectos secundarios (el email, la donación) ya se han disparado. El issue de GitHub lo resume así: *"multiple workers can pass the idempotency check before an event is marked as processed, allowing the same event to execute multiple times."*

## La danza del debugging

Lo primero que piensas siempre es echarle la culpa a Stripe. Abres el dashboard de Events. Y sí: el evento se entregó dos veces. Caso cerrado... salvo que la documentación dice, con todas las letras, que esto va a pasar y que tú tienes que manejarlo. Así que Stripe no se equivoca. El que se equivoca eres tú.

Lo segundo que piensas es mover el procesado del webhook a una cola de fondo. BullMQ, SQS, RabbitMQ, lo que tengas a mano. Seguro que las colas arreglan esto, ¿no? Pues no. Una cola solo cambia de sitio la carrera: la mueve de la capa HTTP a la capa de workers. Dos workers siguen sacando dos copias del mismo evento (o una copia se reintenta mientras la primera todavía está a medio camino), y la misma comprobación no atómica vuelve a ejecutarse igual que antes.

Lo tercero que piensas — y aquí es donde se te van las horas — es tirar de un lock distribuido. Redis `SET NX`, o `SETNX` con expiración, o Redlock si te quieres poner elegante. Añades 50 líneas de código para adquirir el lock, eliges un timeout a ojo y lo despliegas. Hasta que un buen día tu primario de Redis hace failover durante un deploy, el que tenía el lock se cae sin soltar la clave, y el procesado de webhooks se queda colgado hasta que expire el TTL. Enhorabuena: ahora tienes dos problemas.

A estas alturas ya tienes 8 pestañas abiertas. Stack Overflow, el foro de la comunidad de Stripe, un post de Medium de 2021, otro de dev.to de 2023... y todos te recomiendan el mismo patrón equivocado. *"Just log the event ID and check before processing."* Nadie explica cómo loguearlo *de forma atómica*. Nadie menciona que `SELECT`-luego-`INSERT` son en realidad dos operaciones pegadas, no una.

Y cuando por fin llega la iluminación, da hasta un poco de vergüenza. La base de datos ya trae herramientas atómicas — operaciones que pasan enteras o no pasan, sin estados intermedios. Es literalmente para lo que está. No necesitas un lock. No necesitas una cola. No necesitas Redis. Necesitas un único `INSERT` que, de paso, te diga si de verdad insertó algo.

## La solución: un INSERT atómico

La idea es meter la pregunta "¿he visto este evento?" en la misma sentencia que la respuesta "pues anota que ya lo he visto". Ambas cosas, juntas, en un solo movimiento. Postgres trae justo la herramienta para esto.

```sql
CREATE TABLE webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
```

```js
// ✅ CORRECTO — una sola sentencia atómica, sin race
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);

  const claim = await pg.query(
    `INSERT INTO webhook_events (stripe_event_id, event_type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING stripe_event_id`,
    [event.id, event.type, event]
  );

  if (claim.rowCount === 0) {
    // Otro worker ya ha reclamado este evento. Confirma y sal.
    return res.sendStatus(200);
  }

  try {
    await handleStripeEvent(event);
    await pg.query(
      'UPDATE webhook_events SET processed_at = NOW() WHERE stripe_event_id = $1',
      [event.id]
    );
  } catch (err) {
    // Deja que Stripe reintente. La fila se queda con processed_at = NULL.
    return res.status(500).send('processing failed');
  }

  res.sendStatus(200);
});
```

Merece la pena entender por qué esto funciona de verdad, no solo copiarlo. `INSERT ... ON CONFLICT` es una única sentencia SQL, y la [documentación de Postgres](https://www.postgresql.org/docs/current/sql-insert.html) es clarísima sobre su atomicidad: *"`ON CONFLICT DO UPDATE` guarantees an atomic `INSERT` or `UPDATE` outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."* La misma garantía vale para `DO NOTHING`. Por dentro, Postgres pone un lock sobre la fila que entraría en conflicto, y solo una transacción gana la mano. El resto se queda con la fila que ya existía (en `DO UPDATE`) o con nada (en `DO NOTHING`).

La cláusula `RETURNING` es la otra mitad del truco. `RETURNING` sobre un `ON CONFLICT DO NOTHING` *solo te devuelve las filas que de verdad se insertaron*. ¿Perdiste la carrera? Entonces `rowCount === 0` y lo sabes al instante. ¿La ganaste? Te devuelve el event ID y sabes que te toca seguir. Sin una segunda consulta. Sin tabla de locks. Sin Redis.

Hay tres casos límite que conviene cubrir:

1. **El handler se cae a medio procesar.** Ya reclamaste el evento (la fila está insertada), pero `handleStripeEvent` petó antes de poner `processed_at`. Si devuelves un `500`, Stripe reintentará más tarde, pero la fila ya está ahí — así que el reintento no hará nada. La solución: barre periódicamente las filas con `processed_at IS NULL AND received_at < NOW() - INTERVAL '10 minutes'` y, o las reintentas, o disparas una alerta. Otra opción es borrar la fila en la rama del catch (cambias una pequeña ventana de procesado duplicado por recuperación automática).
2. **Los efectos secundarios del handler no son transaccionales.** Mandar un email o llamar a un API externo no se pueden deshacer con un rollback. Si ese es tu caso, el patrón de dos pasos de arriba es justo lo que necesitas. Si todos tus efectos secundarios son SQL contra tu propia base de datos, envuélvelo todo en una sola transacción y mantenlo simple.
3. **La firma se verifica primero.** No verifiques la firma de Stripe *dentro* de la transacción — hazlo antes de tocar la base de datos. Si no, te montas un vector de denegación de servicio: cualquiera puede llenarte la tabla webhook_events con eventos falsos.

## La lección

La regla de fondo va mucho más allá de los webhooks de Stripe. Cualquier patrón de "comprueba, y luego haz" que escribas contra estado compartido en un sistema concurrente tiene una ventana de carrera. Y la solución casi nunca es un lock. La solución es meter la comprobación dentro de la misma operación atómica que la escritura.

- `INSERT ... ON CONFLICT DO NOTHING RETURNING` — "reclama esto o dime que ya lo tiene otro"
- `UPDATE ... WHERE status = 'pending' RETURNING` — "transiciona esto solo si todavía no ha transicionado"
- `SELECT ... FOR UPDATE SKIP LOCKED` — "dame una fila en la que nadie más esté trabajando"

Las tres convierten una operación que lógicamente tiene dos pasos en un único paso atómico. Cada vez que te pilles escribiendo un `SELECT` seguido de un `INSERT` o `UPDATE` condicional sobre filas compartidas, enciende la bandera roja. La carrera te encontrará en producción — normalmente un martes.

## Crédito y lectura adicional

Este artículo se basa en el [issue #525 de la plataforma de donaciones SwiftCause](https://github.com/YNVSolutions/SwiftCause_Web/issues/525), presentado el 11 de marzo de 2026, que documenta la race check-then-mark en términos concretos P0. Para la referencia autoritativa, consulta la [documentación de fiabilidad de webhooks de Stripe](https://docs.stripe.com/webhooks) y la [documentación de `INSERT` de Postgres](https://www.postgresql.org/docs/current/sql-insert.html) sobre la semántica de `ON CONFLICT`.

## Preguntas frecuentes

### ¿Necesito una PRIMARY KEY o sirve cualquier UNIQUE constraint?

Sirve cualquier unique constraint. `ON CONFLICT (column_name)` puede apuntar a cualquier columna o conjunto de columnas que tenga un índice único, no solo a la primary key. Un patrón común es mantener una primary key entera para identidad de fila y añadir `UNIQUE (stripe_event_id)` aparte. La garantía de atomicidad es idéntica en ambos casos — Postgres adquiere el lock de índice apropiado y solo una transacción pasa. Usa primary key si `stripe_event_id` es el identificador natural de la fila; si no, un índice único separado va de fábula. La diferencia de coste en producción es despreciable.

### ¿Funciona este patrón en MySQL o SQLite?

Sí, con sintaxis diferente. El `INSERT ... ON DUPLICATE KEY UPDATE` de MySQL y el `INSERT ... ON CONFLICT DO NOTHING` de SQLite ofrecen los dos la misma atomicidad. Lo peliagudo en MySQL es saber qué lado ganó — `ROW_COUNT()` devuelve `1` para un insert nuevo y `2` para un update, una rareza histórica que conviene leer antes de desplegar. En SQLite la semántica está más cerca de Postgres, pero las escrituras concurrentes se serializan de todos modos, así que la ventana de carrera ya es más pequeña de entrada. Si estás en otra base de datos, la regla de fondo sigue valiendo: busca la primitiva atómica de upsert que tenga esa base y úsala.

### ¿Por qué no meter el handler entero dentro de una sola transacción de base de datos?

Puedes, y deberías — si todos los efectos secundarios del handler son escrituras a la misma instancia Postgres. Envuelve `INSERT ... ON CONFLICT` y todas las escrituras posteriores en `BEGIN` / `COMMIT`. Si la transacción hace rollback, la reclamación también desaparece, y el reintento de Stripe recibe un lienzo limpio. La razón por la que el artículo muestra un patrón de dos pasos es que la mayoría de handlers de webhooks hacen algo fuera de la base de datos: enviar un email, llamar a otro API, encolar un job en background. Esas acciones no se pueden deshacer con un rollback, así que el registro de idempotencia tiene que sobrevivirlas.

### ¿Debo verificar la firma de Stripe antes o después de la comprobación de idempotencia?

Antes. Siempre antes. La verificación de firma es barata (una comparación HMAC), y saltársela deja tu tabla de idempotencia expuesta a cualquier atacante que pueda enviar peticiones HTTP a tu endpoint. Sin verificación, un evento falsificado con un `event.id` elegido a propósito puede o llenarte la tabla de basura o, peor todavía, pre-reclamar un event ID real para que el webhook genuino haga no-op cuando llegue. El orden correcto es: lee el body crudo, verifica la firma, parsea el evento y luego ejecuta la reclamación atómica.

### ¿Es lo mismo el header `Idempotency-Key` que provee Stripe?

No, y este lío de nombres le cuesta horas a la gente. El header `Idempotency-Key` de Stripe es para *tus* llamadas API salientes hacia Stripe — para que, si reintentas crear un cargo, no acabes cobrando dos veces al cliente. El patrón de este artículo es la imagen en el espejo: los eventos de Stripe entrando a tu endpoint, donde *tú* eres quien tiene que lidiar con la entrega duplicada. Las dos cosas son idempotencia, las dos usan una clave de string, pero apuntan en direcciones opuestas. La mayoría de aplicaciones necesitan ambas.
