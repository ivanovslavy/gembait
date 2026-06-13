Tu handler de webhook tiene buena pinta. Logueas el `event.id` de Stripe, compruebas si lo has visto antes y, si no, procesas el pago. Cada test local pasa. Cada test de integración pasa. Entonces, un martes por la tarde, un donante en Melbourne es cobrado dos veces por la misma donación de $50, y pasas las siguientes tres horas tratando de convencerte a ti mismo de que Stripe está roto.

Stripe no está roto. Tu comprobación lo está.

El patrón que casi seguro escribiste — `SELECT`, después si-no-existe `INSERT` — no es una operación. Son dos. Y en cualquier despliegue de producción con más de un worker tras un load balancer, dos copias del mismo evento pueden colarse por el hueco entre ellas. Procesas la donación dos veces. Toca el canal de Slack de webhooks dos veces. Envía el email del recibo dos veces. Y tu monitorización está en silencio, porque cada petición HTTP individual devolvió `200 OK`.

Esto no es un caso límite raro. Es el resultado por defecto del patrón de tutorial más popular en internet. El 11 de marzo de 2026, se presentó un issue P0 público en la plataforma de donaciones SwiftCause describiendo exactamente esta race condition produciendo filas duplicadas de donaciones en Firestore. La solución no es un lock distribuido ni Redis ni una cola. Es una sola sentencia SQL que probablemente ya conoces.

## El problema, formulado con precisión

La propia documentación de Stripe te dice que esto puede ocurrir. De la guía de fiabilidad de webhooks: *"Endpoints occasionally receive the same event more than once."* Y: *"We recommend guarding against duplicated event receipts by making your event processing idempotent."* La [documentación de webhooks de Stripe](https://docs.stripe.com/webhooks) también detalla la política de reintentos — hasta tres días de exponential backoff en modo live, tres intentos en pocas horas en modo test — y advierte que el orden de entrega no está garantizado.

Dos reintentos casi simultáneos es el caso común. Stripe entrega el evento. Tu endpoint tarda 4.9 segundos en responder porque Postgres va lento hoy. El lado de Stripe hace timeout a los 5.0 segundos y encola un reintento. Medio segundo después se dispara el reintento. En ese medio segundo tu petición original también termina. Ahora dos POST HTTP casi idénticos están en vuelo contra tu cluster.

Aquí va el patrón que aparece en cada tutorial de "handle Stripe webhooks in Node":

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

El Worker A ejecuta el `SELECT` — no encuentra nada. El Worker B ejecuta el mismo `SELECT` un milisegundo después — tampoco encuentra nada. Ambos siguen. Ambos llaman a `handleStripeEvent`. Ambos hacen insert. Si `stripe_event_id` tiene un unique constraint, el segundo insert falla — pero sólo después de que los efectos secundarios ya se hayan disparado. Como lo planteó el issue de GitHub: *"multiple workers can pass the idempotency check before an event is marked as processed, allowing the same event to execute multiple times."*

## La danza del debugging

El primer instinto siempre es culpar a Stripe. Abres el dashboard de Events. Sí, el evento se entregó dos veces. Caso cerrado — salvo que la documentación literalmente dice que esto va a pasar y se supone que tú lo manejes. Así que Stripe no está mal. Tú sí.

El segundo instinto es mover el procesado del webhook a una cola de fondo. BullMQ, SQS, RabbitMQ, lo que tengas en la cocina. Seguro que las colas arreglan esto. No lo arreglan. Una cola simplemente mueve la race de la capa HTTP a la capa de workers. Dos workers siguen sacando dos copias del mismo evento (o una copia se reintenta mientras la primera está a medio vuelo), y la misma comprobación no atómica se ejecuta de nuevo.

El tercer instinto, y aquí desaparecen las horas, es ir a por un lock distribuido. Redis `SET NX`, o `SETNX` con expiración, o Redlock si te pones elegante. Añades 50 líneas de código de adquisición de lock, eliges un timeout y lo despliegas. Hasta que un día tu primario de Redis hace failover durante un deploy, el holder del lock se cae sosteniendo la clave, y el procesado de webhooks se queda colgado hasta que expire el TTL. Ahora tienes dos problemas.

Llegado este punto las 8 pestañas están abiertas. Stack Overflow, foro de la comunidad de Stripe, un post de Medium de 2021, un post de dev.to de 2023, todos ellos recomendando el mismo patrón equivocado. *"Just log the event ID and check before processing."* Nadie dice cómo loguearlo *de forma atómica*. Nadie menciona que `SELECT`-luego-`INSERT` es una operación compuesta.

La iluminación, cuando llega, es casi vergonzosa. La base de datos ya tiene primitivas atómicas. Es literalmente su trabajo. No necesitas un lock. No necesitas una cola. No necesitas Redis. Necesitas una única sentencia `INSERT` que también te diga si realmente insertó.

## La solución: un INSERT atómico

La solución es meter la comprobación "¿he visto este evento?" en la misma sentencia que la escritura "recuerda que lo he visto". Postgres trae exactamente la herramienta para esto.

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

Por qué funciona esto realmente merece la pena entenderlo, no sólo copiarlo. `INSERT ... ON CONFLICT` es una sola sentencia SQL, y la [documentación de Postgres](https://www.postgresql.org/docs/current/sql-insert.html) es explícita sobre su atomicidad: *"`ON CONFLICT DO UPDATE` guarantees an atomic `INSERT` or `UPDATE` outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."* La misma garantía se aplica a `DO NOTHING`. Dentro de Postgres, el motor toma un lock a nivel de tupla sobre la fila que conflictaría, y sólo una transacción gana. Todas las demás reciben la fila existente (con `DO UPDATE`) o nada (con `DO NOTHING`).

La cláusula `RETURNING` es la segunda mitad del truco. `RETURNING` sobre una sentencia `ON CONFLICT DO NOTHING` *sólo devuelve filas que se insertaron realmente*. Si perdiste la race, `rowCount === 0` y lo sabes. Si ganaste, recuperas el event ID y sabes que debes proceder. Sin segunda consulta. Sin tabla de locks. Sin Redis.

Los tres casos límite que merece la pena cubrir:

1. **El handler se cae a mitad de procesar.** Has reclamado el evento (fila insertada) pero `handleStripeEvent` reventó antes de que `processed_at` se estableciera. Devolver `500` deja que Stripe reintente más tarde, pero la fila ya está ahí — así que el reintento no hará nada. Solución: barre `processed_at IS NULL AND received_at < NOW() - INTERVAL '10 minutes'` y o bien reintenta o bien alerta. O borra la fila en la rama del catch (intercambias una pequeña ventana de procesado duplicado por recuperación automática).
2. **Los efectos secundarios del handler no son transaccionales.** Enviar un email o llamar a un API externo no se pueden rollback-ar. Si ese es tu caso, el patrón de dos pasos de arriba es la respuesta correcta. Si todos los efectos secundarios son SQL en tu propia base de datos, envuelve todo en una sola transacción y mantenlo simple.
3. **La verificación de la firma debe pasar primero.** No verifiques la firma de Stripe dentro de la transacción — verifícala antes de tocar la base de datos. De lo contrario habrás construido un vector de denegación de servicio donde eventos falsificados llenan tu tabla webhook_events.

## La lección

La regla general es más grande que los webhooks de Stripe. Cualquier patrón "comprueba, luego haz" que escribas contra estado compartido en un sistema concurrente tiene una ventana de race. La solución casi nunca es un lock. La solución es meter la comprobación en la misma operación atómica que la escritura.

- `INSERT ... ON CONFLICT DO NOTHING RETURNING` — "reclama esto o dime que ya lo tiene otro"
- `UPDATE ... WHERE status = 'pending' RETURNING` — "transiciona esto sólo si todavía no ha transicionado"
- `SELECT ... FOR UPDATE SKIP LOCKED` — "dame una fila en la que nadie más esté trabajando"

Las tres convierten una operación lógica de dos pasos en una atómica de un paso. Cada vez que te pilles escribiendo `SELECT` seguido de un `INSERT` o `UPDATE` condicional contra filas compartidas, trátalo como una bandera roja. La race te encontrará en producción, normalmente un martes.

## Crédito y lectura adicional

Este artículo se basa en el [issue #525 de la plataforma de donaciones SwiftCause](https://github.com/YNVSolutions/SwiftCause_Web/issues/525), presentado el 11 de marzo de 2026, que documenta la race check-then-mark en términos concretos P0. Para la referencia autoritativa, consulta la [documentación de fiabilidad de webhooks de Stripe](https://docs.stripe.com/webhooks) y la [documentación de `INSERT` de Postgres](https://www.postgresql.org/docs/current/sql-insert.html) sobre la semántica de `ON CONFLICT`.

## Preguntas frecuentes

### ¿Necesito una PRIMARY KEY o sirve cualquier UNIQUE constraint?

Sirve cualquier unique constraint. `ON CONFLICT (column_name)` puede apuntar a cualquier columna o conjunto de columnas que tenga un índice único, no sólo a la primary key. Un patrón común es mantener una primary key entera para identidad de fila y añadir `UNIQUE (stripe_event_id)` aparte. La garantía de atomicidad es idéntica en ambos casos — Postgres adquiere el lock de índice apropiado y sólo una transacción pasa. Usa primary key si `stripe_event_id` es el identificador natural de la fila; en caso contrario un índice único separado va bien. La diferencia de coste en producción es despreciable.

### ¿Funciona este patrón en MySQL o SQLite?

Sí, con sintaxis diferente. El `INSERT ... ON DUPLICATE KEY UPDATE` de MySQL y el `INSERT ... ON CONFLICT DO NOTHING` de SQLite ofrecen ambos la misma atomicidad. La parte complicada en MySQL es detectar qué lado ganó — `ROW_COUNT()` devuelve `1` para un insert nuevo y `2` para un update, lo cual es una rareza histórica que conviene leer antes de desplegar. En SQLite la semántica está más cerca de Postgres, pero las escrituras concurrentes se serializan de todos modos, así que la ventana de race es más pequeña de entrada. Si estás en otra base de datos, la regla general sigue aplicando: encuentra la primitiva atómica de upsert de esa base y úsala.

### ¿Por qué no meter el handler entero dentro de una sola transacción de base de datos?

Puedes, y deberías — si todos los efectos secundarios del handler son escrituras a la misma instancia Postgres. Envuelve `INSERT ... ON CONFLICT` y todas las escrituras posteriores en `BEGIN` / `COMMIT`. Si la transacción hace rollback, la reclamación también desaparece, y el reintento de Stripe recibe un lienzo limpio. La razón por la que el artículo muestra un patrón de dos pasos es que la mayoría de handlers de webhooks hacen algo fuera de la base de datos: enviar un email, llamar a otro API, encolar un job en background. Esas acciones no se pueden rollback-ar, así que el registro de idempotencia tiene que sobrevivirlas.

### ¿Debo verificar la firma de Stripe antes o después de la comprobación de idempotencia?

Antes. Siempre antes. La verificación de firma es barata (una comparación HMAC), y saltársela expone tu tabla de idempotencia a cualquier atacante que pueda enviar peticiones HTTP a tu endpoint. Sin verificación, un evento falsificado con un `event.id` elegido puede o llenar tu tabla de basura o, peor, pre-reclamar un event ID real para que el webhook genuino haga no-op cuando llegue. El orden correcto es: lee el body crudo, verifica la firma, parsea el evento y luego ejecuta la reclamación atómica.

### ¿Es lo mismo el header `Idempotency-Key` que provee Stripe?

No, y la confusión de nombres cuesta horas a la gente. El header `Idempotency-Key` de Stripe es para *tus* llamadas API salientes hacia Stripe — para que reintentar una creación de cargo no cobre dos veces al cliente. El patrón descrito en este artículo es la imagen especular: los eventos de Stripe entrando a tu endpoint, donde *tú* eres el que maneja la entrega duplicada. Ambos son idempotencia, ambos usan una clave de string, pero apuntan en direcciones opuestas. La mayoría de aplicaciones necesitan ambos.
