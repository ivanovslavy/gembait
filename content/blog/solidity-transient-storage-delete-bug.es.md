# El bug de delete en transient storage de Solidity

Desplegaste un contrato vault el trimestre pasado. La auditoría pasó. Los tests en verde. Lleva meses guardando TVL sin incidentes. Entonces, un martes tranquilo, un usuario llama a `deposit()` — un punto de entrada rutinario que incrementa un reentrancy guard en transient storage y retorna. La transacción confirma. El gas es normal. Sin revert.

Tres bloques después, una dirección distinta llama a `initialize()`. Una función que debería haber hecho revert hace cuatro meses porque el vault ya estaba inicializado. Esta vez, tiene éxito. El atacante es ahora el owner. El vault se vacía en minutos.

¿Qué pasó? Tu compilador escribió `sstore` donde debió escribir `tstore`, y puso a cero el slot `_owner` en lugar de tu reentrancy guard transient. Los tests no lo pillaron. La auditoría no lo pilló. El bytecode verificado en Etherscan sigue pareciendo correcto. Y hasta **febrero de 2026**, nadie sabía que esta clase de bug existía en Solidity.

Este es **SOL-2026-1**, la Transient Storage Clearing Helper Collision. Afecta a contratos compilados con `--via-ir` en versiones de solc **0.8.28 hasta 0.8.33** que usan `delete` sobre una variable de estado transient junto a un clear correspondiente de persistent storage. Si eres tú, actualiza a 0.8.34 y sigue leyendo — el mecanismo merece la pena entenderlo.

## El problema

El bug es una colisión de cache-key dentro del generador de código Yul IR de Solidity.

- El compilador genera un helper Yul reutilizable para cada operación distinta de "pon a cero este tipo".
- El helper se indexa por nombre de tipo — p. ej. `storage_set_to_zero_t_address`.
- La clave **no incluye** el dominio de almacenamiento. Persistent (`sstore`) y transient (`tstore`) comparten el mismo nombre de función.
- El primer clear path que el compilador procese gana la caché. Cada clear posterior de ese tipo reutiliza el cuerpo cacheado — con el opcode equivocado.

La solución en 0.8.34 es un parche de una línea: prefija la clave con `transient_` cuando la ubicación es transient, igualando lo que el `updateStorageValueFunction` hermano ya hacía.

Del propio post de release del equipo de Solidity:

> "Fixed a bug in Yul IR Code Generation that could result in clearing a storage variable instead of a transient storage variable at the same position in the layout (and vice-versa)."

En palabras llanas: **tu código dijo "borra el guard temporal" y el compilador emitió "borra el slot 0 de persistent storage."** Sin advertencia. Sin revert. El bytecode parece correcto.

Un contrato sólo está expuesto si se cumplen las tres condiciones:

1. Está compilado con `--via-ir` (o `settings.viaIR: true` en Standard JSON)
2. Usa `delete` sobre una variable de estado transient (la palabra clave `transient` de EIP-1153, llegada en solc 0.8.28)
3. La misma unidad de compilación también borra persistent storage de un **value type coincidente**

Esa tercera condición es la traicionera. "Value type coincidente" incluye colapsos cross-type — cuando el compilador limpia arrays de storage, encamina cada elemento sub-32-bytes a través de `uint256`. Así que un `bool[]` que se acorta vía `.pop()` puede colisionar con el `delete` de una variable `uint256 transient`, aunque a nivel de fuente las dos no se parezcan en nada.

## La danza del debugging

Imagina que eres el ingeniero cuyo vault acaba de ser drenado. Sacas el trace. El primer instinto es el obvio: **el reentrancy guard está roto.** Relees el modificador. La lógica es correcta. `require(_txSender == address(0), "reentrant");`, establece el sender, ejecuta el cuerpo, `delete _txSender;`. Limpio.

Segunda hipótesis: **drift de storage layout por upgrade del proxy.** Comparas las implementaciones. Los layouts coinciden. `_owner` está en slot 0 en ambas versiones. `_txSender` es una variable transient — ni siquiera está en el persistent layout. No pueden colisionar. Excepto… espera.

Tercera hipótesis, porque ya son las 2 de la madrugada y Stack Overflow está abierto en 8 pestañas: **un reorg se comió un state root.** No. El state root en ese bloque es el que dice el archive node. `_owner` realmente era cero cuando se llamó a `initialize()`.

Aquí va la parte que hace que la gente cierre los portátiles de golpe: ninguna de tus herramientas estándar puede ver esto. Tus tests unitarios probablemente ni siquiera se ejecutan a través de `--via-ir` — la mayoría de repos van por defecto al pipeline legacy de evmasm en CI, y ese pipeline no está afectado. Tu herramienta de verificación formal trata al compilador como una capa de transformación confiable; demuestra que tu Solidity es seguro y asume que el compilador lo traduce correctamente. Tu monitorización on-chain busca cambios de estado anómalos — pero un `delete` legítimo sobre un slot de storage parece completamente legítimo. El atacante nunca escribió en `_owner`. El compilador sí.

El momento de iluminación llega cuando alguien — en este caso, el equipo de Hexens durante una auditoría del compiler-source el 11 de febrero de 2026 — abre el Yul IR generado y hace grep por `storage_set_to_zero_`. Ven **un** helper donde debería haber dos: una única función, usando `sstore`, llamada tanto desde el path de `delete` persistent **como** desde el de transient.

A partir de ahí son 30 minutos de leer `storageSetToZeroFunction` en el código del compilador y darse cuenta de que la cache key es `"storage_set_to_zero_" + _type.identifier()` — sin sufijo de dominio de almacenamiento. Compáralo con el `updateStorageValueFunction` vecino, que sí lo hace bien:

```cpp
std::string const functionName =
    "update_" +
    (_location == VariableDeclaration::Location::Transient ? "transient_s" : "") +
    "storage_value_" + ...;
```

Un helper en el compilador recuerda su dominio de almacenamiento. El de al lado, no. Eso es el bug entero — dieciocho caracteres de concatenación de string que faltan.

## La solución

Tres acciones, en orden de urgencia.

**1. Actualiza.** solc 0.8.34 es un release de bugfix de un solo issue. Sube tu `pragma` o la versión de compilador de tu toolchain, recompila, redespliega. En Foundry: actualiza `solc_version = "0.8.34"` en `foundry.toml` y ejecuta `forge build --via-ir`. En Hardhat: actualiza `solc.version` en `hardhat.config.ts` y recompila.

**2. Demuestra que tu recompilación es limpia.** Diffea el Yul IR antes y después:

```bash
solc --ir --via-ir MyContract.sol > after.yul
diff before.yul after.yul | grep -E "storage_set_to_zero|transient_storage"
```

Si el nuevo IR contiene dos helpers distintos — `storage_set_to_zero_t_address` usando `sstore` y `transient_storage_set_to_zero_t_address` usando `tstore` — estás a salvo. Si el viejo IR sólo tenía el primero, y se llamaba desde ambos paths, estabas envenenado.

**3. Si todavía no puedes actualizar, neutraliza el disparador.** Una sola línea de inline assembly reemplaza el helper envenenado:

```solidity
address transient _txSender;

function _clearGuard() internal {
    assembly { tstore(_txSender.slot, 0) }
}
```

Esto bypassa el pipeline de helper Yul por completo y emite `tstore` directamente. El compilador no puede miscachear lo que escribes a mano. Aplica el mismo patrón en el lado persistent si es el path transient el que se compila mal — en cualquier dirección que vaya la colisión, un lado puede escribirse a mano para sacarlo del peligro.

Una cosa que **no** debes hacer: no intentes "arreglarlo" renombrando tu variable transient o moviéndola a otro slot. El bug no es sobre slots. Es sobre el helper Yul compartido. Dos variables distintas del mismo value type bastan para colisionar, independientemente del storage layout.

Para contratos detrás de un proxy upgradable, intercambiar la implementación es suficiente. Para contratos no upgradables ya en vivo con la vulnerabilidad, necesitas un plan de migración — y probablemente una pausa en los retiros mientras lo ejecutas.

## La lección

El transient storage tiene dieciocho meses. EIP-1153 llegó en Dencun (marzo 2024); Solidity añadió la palabra clave `transient` en 0.8.28 (octubre 2024). La feature era estable, el opcode era estable — pero el path del compilador que pegaba ambos era código nuevo de cero, compartiendo una función helper con un codepath de dieciocho años (persistent storage clearing) que nunca fue diseñado para dos dominios de almacenamiento.

Esa es la lección generalizable: **una nueva feature de lenguaje es una nueva superficie de compilador.** Si eres uno de los primeros equipos usando `transient`, `tstore`, `tload` o cualquier cosa que recientemente haya ganado una abstracción a nivel Solidity, tu modelo de amenazas tiene que incluir bugs de compilador de esta clase. Eso significa pin-ar una versión exacta de solc, ejecutar CI con el mismo pipeline que despliegas a producción (`--via-ir` si eso es lo que despliega), guardar la lista de bugs conocidos de Solidity y el blog de security-alerts, y suscribirte al canal de releases del compilador. Mejor que lo leas ahí a que un investigador como Hexens lo lea en tu base de código.

La corrección es un stack. El compilador se sienta debajo de tu auditoría.

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
