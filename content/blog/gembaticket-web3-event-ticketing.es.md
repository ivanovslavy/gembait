# Lanzamos GembaTicket

Empezaré con la contradicción que lo moldeó todo.

Amo el blockchain. Lo amo desde antes de que estuviera de moda y mucho después de que dejara de estarlo — la idea de que puedes probar que algo ocurrió sin pedirle a nadie que confíe en ti. Pero cada vez que veía a una persona normal intentar *usar* de verdad un producto web3, sentía el mismo estremecimiento: conecta una cartera, aprueba una red, firma una transacción, paga gas en un token que primero tuviste que comprar. Construimos catedrales de criptografía y luego hicimos que la gente rellenara un formulario de aduana para cruzar la puerta.

Así que me impuse una regla que suena casi hostil hacia la tecnología que amo: **construye algo sobre blockchain que una persona que nunca ha oído la palabra "cartera" pueda usar sin aprenderla jamás.** No ocultar el valor — ocultar la maquinaria. Y eso es exactamente lo que hicimos.

Este mes, tras quince meses de trabajo, **GembaTicket** — una plataforma web3 moderna para la venta de entradas a eventos — está en su fase final antes del lanzamiento. GEMBA IT está a un paso de encenderla de verdad, y decidí que era hora de dejar de construir en silencio y contaros qué es.

## Quince meses, y cada uno ganado

Empecé esto en abril de 2025. Lo que tengo hoy apenas se parece a lo que esbocé entonces — cambió de forma más veces de las que puedo contar, porque la versión honesta de "construimos una plataforma" es "construimos varias, tiramos la mayoría y conservamos lo que sobrevivió al contacto con la realidad".

Por el camino hablé con muchos desarrolladores independientes. Más de uno me dijo, amablemente, que lo que describía era un problema difícil — que las costuras entre los pagos, una capa on-chain, un sistema de acceso en vivo y una UX para persona normal son justo donde proyectos como este se desmoronan. No se equivocaban. Hubo semanas en que dejé de lanzar funciones por completo y me senté con un solo nudo arquitectónico — cómo hacer que las acciones on-chain se sintieran instantáneas, cómo hacer un QR que no se pudiera capturar y revender, cómo dejar que un escáner en la puerta funcionara sin conexión — hasta que se soltó. Luego empezaba de nuevo.

No me rendí. No es un alarde de personalidad; es la única razón por la que esto existe. Y ahora que funciona, quiero compartirlo todo.

## Qué es GembaTicket en realidad

Una plataforma moderna para vender entradas a eventos, con **cero comisiones de plataforma** para organizadores *y* asistentes — y un blockchain debajo que nadie tiene que ver.

Para el **organizador**, es un panel completo. Crea un evento, añade categorías de entradas, asígnalas a zonas de acceso y programa cuándo salen a la venta — por fecha o por agotamiento, para que tu Early-Bird ceda el testigo a la Entrada General automáticamente, y el día del evento solo quede un nivel Last-Chance más caro. Emite entradas promocionales gratuitas para amigos, socios y prensa. Provisiona tantos dispositivos escáner como puertas necesites, cada uno bloqueado a las zonas que puede admitir. El registro es gratuito y abierto; lo único que necesitas para empezar a cobrar de verdad es una cuenta de GembaPay.

Para el **asistente**, es casi agresivamente simple. Sin cuenta. Sin app. Sin cartera. Compras una entrada solo con una dirección de correo, y la entrada llega a tu bandeja en el instante en que se confirma el pago. La abres y hay un QR en vivo que se refresca cada 30 segundos — así que una captura de pantalla no sirve segundos después. Si quieres, puedes reclamar un recuerdo NFT gratuito y multipágina del evento a tu propia cartera — pero eso es un regalo, nunca un requisito, y no te cuesta nada, ni siquiera gas.

![La página de un evento en GembaTicket: la dirección del contrato inteligente on-chain, estadísticas en vivo de ventas y accesos, a un clic de escáneres y zonas](/images/blog/gembaticket-web3-event-ticketing/mid.webp)

## Lo difícil fue que pareciera fácil

Todo el producto es un truco de magia, y el truco es que la ingeniería interesante es la parte que nunca notas.

**El blockchain es invisible.** GembaTicket funciona sobre **GembaBlockchain** — nuestro propio Layer-1 compatible con EVM con gas prácticamente cero — y el backend hace la firma y el relay en nombre del usuario. Comprar una entrada no toca ninguna cartera. Reclamar el NFT es una única firma gratuita y sin gas, y el coleccionable simplemente aparece. Cada evento es un contrato on-chain real, cada entrada es verificable, y el asistente no experimenta nada de ello. Esa inversión — garantías criptográficas reales, cero fricción criptográfica — fue lo más difícil de lograr, y es de lo que más orgulloso estoy.

**El sistema de acceso está hecho para puertas reales.** El QR no es un código estático que puedas repartir; es una credencial rotatoria y firmada que cambia cada 30 segundos. Los escáneres están vinculados a zonas — un lector VIP admite VIP y Escenario pero no General, un lector de puerta principal admite a todos — y todo escala desde una sola puerta hasta un festival de tres días con varias entradas. Como la API del escáner es agnóstica al dispositivo, la misma puerta puede funcionar en un teléfono, una tableta o una Raspberry Pi barata conectada a un lector 2D profesional y un relé — lo que importa mucho para recintos fijos que no quieren repartir tabletas.

**El dinero se mueve como debe.** Aquí un detalle que los organizadores notan de inmediato: la mayoría de las plataformas de entradas retienen tu dinero hasta después del evento y luego lo transfieren dos a seis semanas más tarde, menos su comisión. GembaTicket no. Los pagos pasan por **GembaPay**, y el saldo del organizador se acredita **en el momento en que se vende una entrada** — flujo de caja fresco por adelantado, no un pago diferido. Sin comisiones de plataforma encima.

## El stack, para los curiosos

Para quien lee este blog por la ingeniería: un backend en Node y Prisma, apps React para la tienda y el panel del organizador, PostgreSQL y Redis, nuestro propio Layer-1 EVM (**GembaBlockchain**, ~0 gas) para los contratos de los eventos, IPFS para los metadatos NFT y el arte multipágina de la entrada, **GembaPay** para los pagos (tarjetas y PayPal), y una PWA escáner independiente para el personal de puerta — más el lector headless de Raspberry Pi para recintos que prefieren hardware. La plataforma ha pasado por varias auditorías de seguridad internas; lo único que queda antes del lanzamiento es el pulido final, las pruebas finales y una última auditoría.

## ¿No es esto ya un problema resuelto?

Pregunta justa. Hay otras plataformas de entradas — y sí, un par de ellas han probado el ángulo de las "entradas NFT". En todo el mercado, los intentos serios de venta de entradas web3 se cuentan con los dedos de una mano.

Pero ninguno es del todo el mismo animal, y la diferencia es toda la tesis. La mayoría de los proyectos web3 de entradas hicieron del blockchain el *producto* — impusieron carteras, cripto y jerga a aficionados que nunca lo pidieron, y la mayoría ya no están. Nosotros hicimos lo contrario: el blockchain es una capa silenciosa que el cliente nunca nota, así que comprar un GembaTicket se siente como comprar cualquier entrada — solo más barato, más rápido y sin papel. Añade las dos cosas que nadie más combina — **cero comisiones de blockchain para los usuarios** y **dinero que llega al saldo del organizador al instante** — y la diferencia deja de ser cosmética.

Y el verdadero foso es que somos dueños de toda la vía. Como **GembaBlockchain** y **GembaTicket** están construidos por la misma casa, las integraciones son triviales donde todos los demás negocian: sin cadena de terceros, sin mercados de gas, sin peaje por transacción trasladado al asistente. Esa integración vertical es una ventaja que un competidor que alquila infraestructura simplemente no puede copiar.

## Buscamos un cofundador

Aquí la brecha honesta. Soy el fundador técnico — todo el stack, el blockchain, el backend, el sistema de escáner, las auditorías son míos. Lo que GembaTicket necesita ahora no es más ingeniería; es alguien que abra el mercado.

Así que busco un **cofundador comercial** con experiencia — alguien con una red real entre organizadores de eventos, promotores y recintos, capaz de captar organizadores y liderar la salida al mercado en la **UE y EE. UU.** (con gusto trabajaría con dos, uno por mercado). Si eres tú, o conoces a esa persona, puse toda la historia en un breve deck: **[el pitch para cofundador (PDF)](https://gembaticket.com/gembaticket-cofounder-pitch.pdf)**.

Puedes contactarme a través del [formulario de contacto de GembaTicket](https://gembaticket.com/contact), ver el producto en [gembaticket.com](https://gembaticket.com), la vía de pagos en [gembapay.com](https://gembapay.com), y a mí en [slavy.gembait.com](https://slavy.gembait.com).

## La versión corta

- **GembaTicket** es una plataforma web3 moderna para entradas de eventos, en su fase final antes del lanzamiento — quince meses de trabajo, iniciada en abril de 2025.
- **Cero comisiones de plataforma** para organizadores y asistentes. Los compradores solo necesitan un correo — sin cuenta, sin app, sin cartera.
- El blockchain es **invisible**: nuestro propio **GembaBlockchain** (≈0 gas), firmado y relayado por el backend, contratos on-chain reales, un recuerdo NFT gratuito y opcional.
- Acceso con QR rotatorio de 30 segundos, escáneres conscientes de zonas y lectores hardware (Raspberry Pi) para recintos fijos.
- Los organizadores cobran **en el momento en que se vende una entrada** vía GembaPay — no semanas después del evento.
- Buscamos un **cofundador comercial** para la UE/EE. UU. [Lee el pitch.](https://gembaticket.com/gembaticket-cofounder-pitch.pdf)

## Preguntas frecuentes

### ¿Necesito una cartera cripto para comprar un GembaTicket?

No. Ese es todo el punto. Compras una entrada solo con una dirección de correo — sin cuenta, sin app, sin cartera, sin ningún conocimiento de cripto. La entrada llega a tu bandeja en el momento en que se confirma el pago, y se abre directamente desde el correo con un QR de acceso en vivo. El blockchain está debajo, haciendo verificable cada entrada, pero el backend se encarga de todo por ti. Reclamar el recuerdo NFT opcional más tarde es una única firma gratuita y sin gas — pero incluso eso nunca es obligatorio.

### ¿En qué se diferencia GembaTicket de otras plataformas de entradas NFT?

La mayoría de las plataformas web3 de entradas hicieron del blockchain el producto — obligando a los aficionados a instalar carteras, comprar cripto y pagar gas. GembaTicket convierte el blockchain en una capa invisible: los compradores usan correo, los organizadores usan un panel normal, y nadie lidia con carteras ni gas. Además, GembaTicket no cobra comisiones de plataforma y paga a los organizadores al instante — el saldo se acredita en el momento en que se vende una entrada, en vez de semanas después del evento. Como GembaTicket funciona sobre nuestro propio GembaBlockchain, no hay comisiones de cadena de terceros trasladadas a los usuarios, una ventaja que las plataformas que alquilan infraestructura externa no pueden igualar.

### ¿Cuánto cuesta a organizadores y asistentes?

GembaTicket no cobra comisiones de plataforma a ninguna de las partes. Los asistentes pagan exactamente el precio mostrado — sin cargos sorpresa al pagar. La única deducción es la comisión estándar de procesamiento de pagos sobre la venta (vía las vías de tarjeta y PayPal de GembaPay), que sale de los ingresos del organizador; el uso del blockchain en sí es gratuito, porque GembaBlockchain tiene gas prácticamente cero. Los organizadores se registran gratis y reciben sus ingresos al instante en su saldo.

### ¿Cuándo puedo usar GembaTicket?

Está en su fase final — la plataforma está construida y ha pasado por varias auditorías de seguridad internas; lo que queda es el pulido final, las pruebas finales y una última auditoría antes del lanzamiento público. Si eres organizador de eventos y quieres acceso anticipado, o un socio comercial interesado en la oportunidad de cofundador, escríbenos a través del formulario de contacto en gembaticket.com/contact.

## Créditos y lecturas adicionales

GembaTicket está construido por **GEMBA IT**, la división tecnológica de GEMBA Team EOOD en Varna, Bulgaria — el mismo equipo detrás de [GembaPay](https://gembapay.com) (nuestra plataforma de pagos no custodial) y los sistemas que este blog suele desmenuzar. Ve el producto en [gembaticket.com](https://gembaticket.com), el pitch para cofundador en [el deck (PDF)](https://gembaticket.com/gembaticket-cofounder-pitch.pdf), y más de lo que ponemos en producción en [gembait.com](https://gembait.com).
