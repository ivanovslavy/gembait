# El bug de delete en transient storage de Solidity

Imagina la escena. El trimestre pasado desplegaste un contrato vault — una bóveda que custodia los fondos de tus usuarios. La auditoría pasó. Los tests, todos en verde. Lleva meses guardando dinero sin un solo incidente. Y entonces, un martes cualquiera, un usuario llama a `deposit()`. Es una función rutinaria: incrementa un *reentrancy guard* (un pequeño cerrojo que impide que alguien vuelva a entrar en mitad de una operación) que vive en *transient storage* (una memoria temporal que se borra sola al acabar la transacción) y retorna. La transacción confirma. El gas, normal. Ningún error.

Tres bloques más tarde, una dirección distinta llama a `initialize()`. Esa función tendría que haber fallado hace cuatro meses, porque el vault ya estaba inicializado. Pero esta vez no falla. Funciona. Y ahora el atacante es el dueño del vault. En cuestión de minutos, lo vacía.

¿Qué ha pasado aquí? Pues que tu compilador escribió `sstore` donde tenía que escribir `tstore`, y eso puso a cero el slot `_owner` — el que guarda quién es el dueño — en lugar de tu reentrancy guard temporal. Los tests no lo vieron. La auditoría tampoco. El bytecode verificado en Etherscan sigue pareciendo perfecto. Y hasta **febrero de 2026**, nadie en el mundo sabía siquiera que este tipo de bug existía en Solidity.

Esto es **SOL-2026-1**, la Transient Storage Clearing Helper Collision. Afecta a contratos compilados con `--via-ir` en versiones de solc **0.8.28 hasta 0.8.33** que usan `delete` sobre una variable de estado transient junto a un clear correspondiente de persistent storage. Si ese eres tú, actualiza a 0.8.34 y sigue leyendo — porque entender cómo ocurre vale mucho la pena.

## El problema

En el fondo, el bug es una colisión de claves de caché dentro del generador de código Yul IR de Solidity. Vamos por partes.

- El compilador, para no repetir trabajo, crea una pequeña función auxiliar (un *helper*) reutilizable por cada operación distinta de "pon a cero este tipo de dato".
- Ese helper se guarda y se busca por el nombre del tipo — por ejemplo, `storage_set_to_zero_t_address`.
- Y aquí está el fallo: esa clave **no incluye** de qué tipo de almacenamiento hablamos. Persistent (`sstore`) y transient (`tstore`) acaban compartiendo el mismo nombre de función.
- ¿Quién gana? El primer clear que el compilador procesa se queda con la caché. Y a partir de ahí, cada clear posterior de ese mismo tipo reutiliza el cuerpo cacheado — con el opcode equivocado.

La solución en 0.8.34 es un parche de una sola línea: añade el prefijo `transient_` a la clave cuando el dato es transient, justo lo que el helper hermano `updateStorageValueFunction` ya hacía.

Lo dice el propio post de release del equipo de Solidity:

> "Fixed a bug in Yul IR Code Generation that could result in clearing a storage variable instead of a transient storage variable at the same position in the layout (and vice-versa)."

Traducido al lenguaje de andar por casa: **tu código dijo "borra el cerrojo temporal" y el compilador entendió "borra el slot 0 de persistent storage".** Sin avisar. Sin fallar. Y con un bytecode que parece correcto.

Tu contrato solo está en peligro si se cumplen las tres cosas a la vez:

1. Está compilado con `--via-ir` (o `settings.viaIR: true` en Standard JSON)
2. Usa `delete` sobre una variable de estado transient (la palabra clave `transient` de EIP-1153, que llegó en solc 0.8.28)
3. La misma unidad de compilación también borra persistent storage de un **value type coincidente**

Esa tercera condición es la traicionera, la que se cuela por sorpresa. "Value type coincidente" incluye casos en los que dos tipos distintos terminan tratándose igual — cuando el compilador limpia arrays de storage, encamina cada elemento de menos de 32 bytes a través de `uint256`. Así que un `bool[]` que se acorta con `.pop()` puede colisionar con el `delete` de una variable `uint256 transient`, aunque mirando el código fuente las dos cosas no tengan absolutamente nada que ver.

## La danza del debugging

Ponte en la piel del ingeniero al que le acaban de vaciar el vault. Sacas el trace de la transacción. El primer pensamiento es el más lógico: **el reentrancy guard está roto.** Relees el modificador línea a línea. La lógica es impecable. `require(_txSender == address(0), "reentrant");`, fija el sender, ejecuta el cuerpo, `delete _txSender;`. Limpio como una patena.

Segunda teoría: **algo se desalineó en el storage layout al actualizar el proxy.** Comparas las dos implementaciones. Los layouts coinciden. `_owner` está en el slot 0 en ambas versiones. Y `_txSender` es una variable transient — ni siquiera aparece en el layout persistent. Es imposible que choquen. Excepto que… espera un momento.

Tercera teoría, porque ya son las 2 de la madrugada y tienes Stack Overflow abierto en 8 pestañas: **un reorg se ha comido un state root.** No. El state root de ese bloque es exactamente el que dice el archive node. `_owner` era cero de verdad cuando se llamó a `initialize()`.

Y aquí viene la parte que hace que la gente cierre el portátil de golpe: ninguna de tus herramientas de siempre puede ver esto. Tus tests unitarios probablemente ni siquiera se ejecutan con `--via-ir` — la mayoría de repos usan por defecto el pipeline legacy de evmasm en CI, y ese pipeline no está afectado. Tu herramienta de verificación formal se fía del compilador como si fuera una capa de traducción de confianza; demuestra que tu Solidity es seguro y da por hecho que el compilador lo traduce bien. Y tu monitorización on-chain busca cambios de estado raros — pero un `delete` legítimo sobre un slot de storage parece de lo más normal. Es que el atacante nunca tocó `_owner`. Lo tocó el compilador.

El momento "¡ajá!" llega cuando alguien — en este caso, el equipo de Hexens, durante una auditoría del propio código del compilador el 11 de febrero de 2026 — abre el Yul IR generado y hace grep por `storage_set_to_zero_`. Y ven **un** helper donde tendría que haber dos: una única función, que usa `sstore`, llamada tanto desde el path del `delete` persistent **como** desde el del transient.

A partir de ahí son 30 minutos de leer `storageSetToZeroFunction` en el código del compilador y caer en la cuenta de que la cache key es `"storage_set_to_zero_" + _type.identifier()` — sin ningún sufijo que indique el tipo de almacenamiento. Compáralo con el `updateStorageValueFunction` de al lado, que sí lo hace bien:

```cpp
std::string const functionName =
    "update_" +
    (_location == VariableDeclaration::Location::Transient ? "transient_s" : "") +
    "storage_value_" + ...;
```

Un helper del compilador se acuerda de su tipo de almacenamiento. El de al lado, no. Y eso es el bug entero — dieciocho caracteres de concatenación de string que faltan.

## La solución

Tres pasos, en orden de urgencia.

**1. Actualiza.** solc 0.8.34 es un release de bugfix que arregla un único problema. Sube tu `pragma` o la versión del compilador de tu toolchain, recompila y vuelve a desplegar. En Foundry: actualiza `solc_version = "0.8.34"` en `foundry.toml` y ejecuta `forge build --via-ir`. En Hardhat: actualiza `solc.version` en `hardhat.config.ts` y recompila.

**2. Comprueba que tu recompilación está limpia.** Compara el Yul IR antes y después:

```bash
solc --ir --via-ir MyContract.sol > after.yul
diff before.yul after.yul | grep -E "storage_set_to_zero|transient_storage"
```

Si el nuevo IR tiene dos helpers distintos — `storage_set_to_zero_t_address` usando `sstore` y `transient_storage_set_to_zero_t_address` usando `tstore` — estás a salvo. Si el IR viejo solo tenía el primero, y se llamaba desde los dos paths, estabas envenenado.

**3. Si todavía no puedes actualizar, desactiva el disparador.** Una sola línea de inline assembly reemplaza al helper envenenado:

```solidity
address transient _txSender;

function _clearGuard() internal {
    assembly { tstore(_txSender.slot, 0) }
}
```

Esto se salta por completo el sistema de helpers de Yul y emite `tstore` directamente. El compilador no puede cachear mal lo que tú escribes a mano. Aplica el mismo truco en el lado persistent si resulta que es el path transient el que se compila mal — vaya en la dirección que vaya la colisión, siempre puedes escribir un lado a mano para sacarlo del peligro.

Una cosa que **no** debes hacer: no intentes "arreglarlo" renombrando tu variable transient o moviéndola a otro slot. El bug no va de slots. Va del helper Yul compartido. Con dos variables distintas del mismo value type ya basta para que colisionen, sin importar el storage layout.

Si tu contrato está detrás de un proxy actualizable, basta con intercambiar la implementación. Si es un contrato no actualizable que ya está en vivo con la vulnerabilidad, necesitas un plan de migración — y probablemente pausar los retiros mientras lo llevas a cabo.

## La lección

El transient storage tiene apenas dieciocho meses de vida. EIP-1153 llegó con Dencun (marzo de 2024); Solidity añadió la palabra clave `transient` en 0.8.28 (octubre de 2024). La feature era estable, el opcode era estable — pero el trozo del compilador que unía las dos cosas era código recién escrito, y compartía una función helper con un codepath de dieciocho años (el de borrar persistent storage) que nunca se pensó para manejar dos tipos de almacenamiento.

Y esa es la lección que sirve para todo: **una nueva feature de lenguaje es también una nueva superficie de ataque en el compilador.** Si eres de los primeros equipos en usar `transient`, `tstore`, `tload` o cualquier cosa que acabe de estrenar una abstracción a nivel de Solidity, tu modelo de amenazas tiene que contar con bugs de compilador de este estilo. Eso significa: fijar una versión exacta de solc, ejecutar el CI con el mismo pipeline que despliegas en producción (`--via-ir` si es eso lo que despliegas), seguir la lista de bugs conocidos de Solidity y el blog de security-alerts, y suscribirte al canal de releases del compilador. Más vale que lo leas ahí tú primero a que un investigador como Hexens lo lea en tu propio código.

La seguridad es un stack, una pila de capas. Y el compilador está justo debajo de tu auditoría.

## Crédito y lectura adicional

Este artículo está basado en el análisis detallado del compiler-source publicado por [Hexens el 18 de febrero de 2026](https://hexens.io/research/solidity-compiler-bug-tstore-poison) y el aviso oficial acompañante del equipo de Solidity en [soliditylang.org](https://www.soliditylang.org/blog/2026/02/18/transient-storage-clearing-helper-collision-bug/). Gracias al equipo de investigación de Hexens por los casos de reproducción claros y a los maintainers de Solidity/Argot por la rápida respuesta con [solc 0.8.34](https://www.soliditylang.org/blog/2026/02/18/solidity-0.8.34-release-announcement/). Lectura más profunda: la [List of Known Bugs](https://docs.soliditylang.org/en/latest/bugs.html) (entrada `SOL-2026-1`, `TransientStorageClearingHelperCollision`) y la [especificación EIP-1153 de transient storage](https://eips.ethereum.org/EIPS/eip-1153).

## Preguntas frecuentes

**P: ¿Cómo compruebo si mi contrato ya desplegado está afectado?**

R: Saca el código fuente verificado de tu despliegue y recompílalo localmente con la versión exacta de solc y los settings que usaste (el panel de verified-metadata de Etherscan te dice ambos). Genera el Yul IR con `solc --ir --via-ir YourContract.sol` y busca `storage_set_to_zero_`. Si un único helper se invoca tanto desde un path de clear persistent como transient, eres vulnerable. Si no usas `--via-ir` o tu contrato no tiene variable de estado `transient`, estás a salvo independientemente de la versión de compilador.

**P: Actualicé a 0.8.34 pero no he redesplegado. ¿Estoy cubierto?**

R: No. La solución vive en el compilador, así que el bytecode antiguo sigue con el bug. Tienes que recompilar y redesplegar el contrato de implementación. Para proxies upgradables, eso es un intercambio de implementación estándar. Para contratos no upgradables, necesitas una migración — normalmente pausar nuevos depósitos, drenar el estado a un nuevo despliegue y redirigir el frontend.

**P: ¿Afecta al pipeline de compilación legacy?**

R: No. El bug vive sólo en el pipeline de Yul IR. Si compilas sin `--via-ir` (todavía el default en muchas configuraciones a partir de 0.8.33), el persistent-storage clearing pasa por un code path distinto y la colisión de helpers no puede ocurrir. Por eso muchos proyectos esquivaron el bug por accidente — sus CIs usan el pipeline legacy. Si esa es buena noticia depende de si tu build de *producción* también usa el pipeline legacy.

**P: ¿Por qué tardaron dieciocho meses en encontrarlo?**

R: `delete` sobre una variable de estado transient es un patrón genuinamente nicho — el opcode `tstore` del EVM ya auto-limpia al final de la transacción, así que la mayoría de desarrolladores nunca escriben `delete _transientGuard;` porque no lo necesitan. El barrido de Hexens a través de más de 20M de contratos desplegados encontró aproximadamente 500.000 compilados con versiones afectadas más `--via-ir`, pero sólo cuatro proyectos pegando contra el patrón disparador específico. Blast radius estrecho más la necesidad de leer Yul IR generado para detectar la miscompilación — el bug se escondió a plena vista.

**P: ¿Están afectados los transient mappings o arrays?**

R: solc 0.8.33 no soporta transient mappings, transient arrays ni transient structs — sólo variables transient de tipo valor. Así que la superficie de ataque está limitada a transients escalares (`address transient`, `uint256 transient`, etc.) colisionando con clears persistent del mismo tipo escalar. Si estabas haciendo a mano un transient mapping basado en assembly, estabas escribiendo `tstore` a mano de todos modos y la miscompilación no aplica.

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I check whether my already-deployed contract is affected by SOL-2026-1?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Pull your deployment's verified source and recompile locally with the exact solc version and settings you used. Generate the Yul IR with solc --ir --via-ir YourContract.sol and search for storage_set_to_zero_. If a single helper is invoked from both a persistent and a transient clear path, you are vulnerable. If you don't use --via-ir or your contract has no transient state variable, you're safe regardless of compiler version."
      }
    },
    {
      "@type": "Question",
      "name": "I upgraded to solc 0.8.34 but haven't redeployed. Am I covered?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The fix lives in the compiler, so old bytecode stays bugged. You have to recompile and redeploy the implementation contract. For upgradeable proxies, that's a standard implementation swap. For non-upgradeable contracts, you need a migration — usually pausing new deposits, draining state to a new deployment, and redirecting the frontend."
      }
    },
    {
      "@type": "Question",
      "name": "Does the Transient Storage Clearing Helper Collision bug affect the legacy compilation pipeline?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The bug lives only in the Yul IR pipeline. If you compile without --via-ir, persistent-storage clearing goes through a different code path and the helper collision can't happen. Many projects dodged the bug because their CI uses the legacy pipeline, but check your production build too."
      }
    },
    {
      "@type": "Question",
      "name": "Why did SOL-2026-1 take eighteen months to find?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Delete on a transient state variable is a genuinely niche pattern — the EVM's tstore opcode already auto-clears at end of transaction, so most developers never write delete _transientGuard. A Hexens scan across 20M+ deployed contracts found roughly 500,000 compiled with affected versions plus --via-ir, but only four hitting the specific trigger pattern. Narrow blast radius plus the need to read generated Yul IR to spot the miscompilation meant the bug hid in plain sight."
      }
    },
    {
      "@type": "Question",
      "name": "Are transient mappings or arrays affected by SOL-2026-1?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "solc 0.8.33 doesn't support transient mappings, transient arrays, or transient structs — only value-type transient variables. So the attack surface is limited to scalar transients (address transient, uint256 transient) colliding with persistent clears of the same scalar type. Custom assembly-based transient mapping implementations emit tstore directly and are not affected by the helper miscompilation."
      }
    }
  ]
}
</script>
