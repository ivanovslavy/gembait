# Por qué stripe-node se cuelga tras un reintento

Tu script hace una sola cosa: obtener un cliente de Stripe, imprimirlo, salir. Imprime el cliente. Y luego… se queda ahí. Sin error. Sin promesa pendiente. El cursor parpadea 80 segundos y solo entonces recuperas el prompt.

Lo ejecutas de nuevo y sale al instante. Una tercera vez: 80 segundos. No has cambiado ni una línea.

Ese es el bug reportado en el repositorio de stripe-node el 15 de octubre de 2026, y de nuevo por una segunda persona seis días después. El trabajo está hecho. Algo en el SDK se niega a dejar morir el proceso de Node, y el detonante es lo último que sospecharías: un reintento que *tuvo éxito*.

Aquí está la cuestión: este bug nació de una corrección. En agosto, Stripe cerró un problema más feo en el que ese mismo timeout no funcionaba en absoluto.

## El problema

El autor del reporte, `KevinDeLaTorre`, lo dijo claro en el [issue #2897 de stripe-node](https://github.com/stripe/stripe-node/issues/2897): *"Desde 22.6.0, una petición reintentada deja armado el temporizador de `timeout` del intento fallido. La llamada tiene éxito, pero con el timeout por defecto de 80 s, un proceso de vida corta sigue vivo 80 segundos después de terminar su trabajo."*

Algo de contexto. stripe-node es la librería oficial de Stripe para Node.js. Cuando una llamada falla con un 5xx o un 409, el SDK la reintenta automáticamente (`maxNetworkRetries` vale 1 por defecto). Cada llamada tiene además un `timeout` — 80 000 ms por defecto — aplicado mediante un `setTimeout` que aborta la petición si tarda demasiado.

La matriz de pruebas del autor es lo que convence: el mismo script en ocho versiones del SDK. De 18.5.0 a 22.5.0 salen en milisegundos. De 22.6.0 a 23.1.0-beta.1 dejan un temporizador y esperan el timeout completo. Una ejecución de control sin el 500 sale limpia en todas.

Seis días después, `hnoble5` abrió [#2908](https://github.com/stripe/stripe-node/issues/2908) desde otro stack (código para Cloudflare Workers bajo pruebas) con el mismo síntoma: *"el proceso de Node se quedó abierto unos 80 segundos después de que terminaran los tests."*

Ambos reportes usan `Stripe.createFetchHttpClient()`, el transporte del SDK basado en fetch. Guarda ese dato.

## El baile de la depuración

Primer instinto: un handle abierto, algo que sigue escuchando. Añades `process._getActiveHandles()`. Un `Timeout`. ¿De quién? Node no lo dice.

Segunda apuesta: tu propio código. Buscas `setTimeout`. Nada que no limpies. Reduces el script a la única llamada a Stripe. Siguen siendo 80 segundos.

Ahora el número empieza a molestar. 80 segundos es extrañamente específico. Pones `timeout: 5000` en el cliente de Stripe y el cuelgue baja a 5 segundos. Así que el temporizador es el timeout de petición del SDK — pero la petición *terminó*. ¿Por qué una petición terminada seguiría teniendo un temporizador?

El desvío equivocado que tiene sentido: bajar una versión menor cada vez hasta que el cuelgue desaparezca. Eso hizo el autor del reporte. Funciona; solo cuesta una tarde. La respuesta es 22.6.0, publicada el 26 de agosto.

Su changelog tiene una línea que parece no tener relación: *"correctly throw connection errors if the server drops while sending the HTTP response body"* ([PR #2815](https://github.com/stripe/stripe-node/pull/2815)). Corrigió el [issue #2814](https://github.com/stripe/stripe-node/issues/2814): una conexión estancada podía colgar stripe-node para siempre, porque el timeout se limpiaba en cuanto llegaban las *cabeceras* de la respuesta y nunca cubría el *cuerpo*.

El momento "ajá" es leer esa corrección. Ahora el temporizador sigue armado después de llegar las cabeceras, y quien lea el cuerpo debe liberarlo:

```ts
// src/net/FetchHttpClient.ts (22.6.0+)
async toJSON(): Promise<any> {
  try {
    text = await this._requestTimeout.guard(this._res.text());
  } finally {
    this._requestTimeout.release();   // el único sitio donde muere el temporizador
  }
  return this._parseResponseBody(text);
}
```

Ahora piensa en lo que hace la ruta de reintento de `RequestSender` con un 500: llama a `retryRequest(...)` y descarta la respuesta *sin leer el cuerpo*. Nadie llama a `release()`. El `setTimeout` sigue vivo, el event loop de Node ve un temporizador activo, y el proceso espera 80 segundos a un temporizador que, cuando por fin se dispara, aborta una petición que terminó hace una eternidad.

![Ilustración isométrica abstracta de un interruptor que corta un hilo luminoso entre un sobre descartado y un temporizador en marcha](/images/blog/stripe-node-hangs-after-retry-timeout/mid.webp)

## La solución

La corrección, [PR #2895](https://github.com/stripe/stripe-node/pull/2895) de `jar-stripe`, salió en **stripe-node 23.0.1 el 22 de octubre de 2026**. Si estás en 22.6.0 o posterior con el cliente fetch, actualiza:

```bash
npm install stripe@latest   # ≥ 23.0.1
```

El cambio es pequeño. Las respuestas ganaron un método opcional `dispose()`, y la ruta de reintento lo llama antes de descartar una respuesta:

```ts
// src/RequestSender.ts (23.0.1)
if (RequestSender._shouldRetry(res, requestRetries, maxRetries)) {
  res.dispose?.();
  return retryRequest(makeRequest, apiVersion, headers, requestRetries + 1);
}
```

```ts
// src/net/FetchHttpClient.ts (23.0.1)
dispose(): void {
  this._requestTimeout.release();
  this._requestTimeout.abort?.();
  const body = this._res.body;
  if (body && typeof body.cancel === 'function' && !body.locked) {
    body.cancel().catch(() => {});
  } else if (body && typeof body.destroy === 'function') {
    body.destroy();
  }
}
```

¿Por qué tres pasos? Limpiar el temporizador hace que el proceso deje de esperar. Abortar el controlador le dice a fetch que la respuesta está muerta. Cancelar el cuerpo cierra el stream sin leer para que el socket vuelva al pool. El autor lo confirmó en la rama de la corrección: cero temporizadores filtrados, salida en 506 ms.

Lo que se les escapa a los novatos: **esto es solo para el cliente fetch.** El `NodeHttpClient` por defecto usa `req.setTimeout()` sobre el propio socket, así que su timeout muere con la petición. Te encuentras con este bug cuando optas por `createFetchHttpClient()`.

Si aún no puedes actualizar, baja `timeout` a algo razonable para tu carga; eso limita cuánto vive el temporizador fantasma. No pongas `maxNetworkRetries: 0` para esquivarlo — cambiarías un cuelgue cosmético por pagos fallidos de verdad.

## La lección

Todo recurso tiene un dueño, y el dueño cambia cuando cambia la ruta del código. Antes de 22.6.0 el dueño del temporizador era la llamada a fetch: llegaban las cabeceras, se limpiaba el temporizador, listo. La corrección de agosto movió la propiedad a "quien lea el cuerpo". Fue la decisión correcta — cerró un cuelgue real. Pero creó una regla nueva, y la ruta de reintento nunca se enteró, porque la ruta de reintento no lee cuerpos.

La conclusión: cuando un cambio mueve la limpieza de "automática" a "alguien debe llamar a X", busca cada sitio que descarta el recurso sin llamar a X — returns tempranos, bucles de reintento, ramas de error. Ahí es donde los temporizadores se van a vivir para siempre.

## Créditos y lecturas adicionales

Este artículo se basa en un problema discutido originalmente en [stripe/stripe-node issue #2897](https://github.com/stripe/stripe-node/issues/2897). Gracias a `@KevinDeLaTorre` por la reproducción versión por versión, a `@hnoble5` por la confirmación independiente en [#2908](https://github.com/stripe/stripe-node/issues/2908), a `@pouyashahrdami` por el reporte original del timeout del cuerpo en [#2814](https://github.com/stripe/stripe-node/issues/2814) y a `@jar-stripe` por la corrección en [#2895](https://github.com/stripe/stripe-node/pull/2895). Para las opciones oficiales, consulta el README de stripe-node sobre [network retries](https://github.com/stripe/stripe-node#network-retries) y [configuring timeout](https://github.com/stripe/stripe-node#configuring-timeout).

La integración de GembaPay con Stripe Connect corre sobre Node, y por eso un bug sobre reintentos en procesos de vida corta llamó nuestra atención.

## Preguntas frecuentes

### ¿Afecta esto al cliente HTTP de Node por defecto?

No. Ambos reportes usan `Stripe.createFetchHttpClient()`. El `NodeHttpClient` por defecto aplica el timeout con `req.setTimeout()` sobre el objeto de la petición y llama a `req.destroy()` cuando se dispara, así que el temporizador está atado al socket y desaparece con la petición. Estás expuesto en Deno, Cloudflare Workers o Bun, donde el cliente fetch es la elección habitual, o si pasaste `httpClient: Stripe.createFetchHttpClient()` en Node.

### ¿Qué versiones están afectadas y cuáles lo corrigen?

Afectadas: de 22.6.0 a 23.0.0, más las prelanzamientos de 23.1.0 anteriores a la corrección, al usar el cliente fetch. La regresión llegó con el PR #2815 en 22.6.0 (26 de agosto de 2026). La corrección es el PR #2895, publicada en 23.0.1 el 22 de octubre de 2026 e incluida en 23.1.0 y posteriores. La matriz del autor confirmó que de 18.5.0 a 22.5.0 están limpias — aunque esas versiones aún tienen el cuelgue más antiguo del timeout del cuerpo de #2814.

### Mis tests de Deno fallan con un temporizador filtrado — ¿es el mismo bug?

Muy probablemente, si una llamada a Stripe en ese test fue reintentada. El sanitizador de tests de Deno se niega a aprobar un test que deja un temporizador pendiente, y eso es exactamente lo que hace una respuesta de reintento descartada en 22.6.0–23.0.0. Actualiza a 23.0.1 o posterior y el sanitizador debería callarse. Si sigue quejándose, asegúrate de que tu fetch simulado devuelve un `Response` real con cuerpo, porque la corrección funciona cancelando ese stream del cuerpo.
