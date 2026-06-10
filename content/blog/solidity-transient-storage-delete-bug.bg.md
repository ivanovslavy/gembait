# Бъгът delete в transient storage на Solidity

Пуснахте vault контракт миналото тримесечие. Одитът мина. Тестовете са зелени. Държи TVL без инциденти от месеци. После, в спокоен вторник, потребител извиква `deposit()` — рутинна входна точка, която bump-ва reentrancy guard в transient storage и връща. Транзакцията се потвърждава. Газът е нормален. Без revert.

Три блока по-късно, различен адрес извиква `initialize()`. Функция, която трябваше да ревъртне преди четири месеца, защото vault-ът вече беше инициализиран. Този път, успява. Атакуващият сега е owner-а. Vault-ът се източва за минути.

Какво се случи? Компилаторът ви е написал `sstore` там, където трябваше да напише `tstore`, и е нулирал `_owner` слота вместо вашия transient reentrancy guard. Тестовете не го хванаха. Одитът не го хвана. Верифицираният bytecode на Etherscan все още изглежда наред. И до **февруари 2026 г.**, никой не знаеше, че този клас бъгове съществува в Solidity.

Това е **SOL-2026-1**, Transient Storage Clearing Helper Collision. Засяга контракти, компилирани с `--via-ir` на solc версии **0.8.28 до 0.8.33**, които използват `delete` върху transient state променлива заедно с подходящ persistent-storage clear. Ако това сте вие, обновете до 0.8.34 и продължете да четете — механизмът си струва да се разбере.

## Проблемът

Бъгът е cache-key collision вътре в Yul IR code generator-а на Solidity.

- Компилаторът генерира преизползваем Yul helper за всяка различна "нулирай този тип" операция.
- Helper-ът е keyed по име на тип — напр. `storage_set_to_zero_t_address`.
- Ключът **не включва** storage домейна. Persistent (`sstore`) и transient (`tstore`) споделят същото име на функция.
- Който clear path компилаторът обработи първи, печели кеша. Всеки последващ clear на този тип преизползва кешираното тяло — с грешния опкод.

Поправката в 0.8.34 е едноредов patch: префиксирайте ключа с `transient_`, когато локацията е transient, съответствайки на това, което съседният `updateStorageValueFunction` вече правеше.

От собствения release пост на екипа на Solidity:

> "Fixed a bug in Yul IR Code Generation that could result in clearing a storage variable instead of a transient storage variable at the same position in the layout (and vice-versa)."

С прости думи: **кодът ви казва "изчисти временния guard", а компилаторът емитира "изчисти slot 0 на persistent storage."** Без предупреждение. Без revert. Bytecode-ът изглежда наред.

Контракт е изложен само ако и трите условия важат:

1. Компилиран е с `--via-ir` (или `settings.viaIR: true` в Standard JSON)
2. Използва `delete` върху transient state променлива (EIP-1153 ключовата дума `transient`, появила се в solc 0.8.28)
3. Същата компилационна единица също изчиства persistent storage на **съответстващ value type**

Това трето условие е коварното. "Съответстващ value type" включва cross-type collapses — когато компилаторът чисти storage масиви, той маршрутизира всеки sub-32-byte елемент тип през `uint256`. Така че `bool[]`, който се скъсява чрез `.pop()`, може да се сблъска с `delete` на `uint256 transient` променлива, въпреки че на ниво източник двете не приличат на нищо общо.

## Танцът на debugging-а

Представете си, че сте инженерът, чийто vault току-що беше източен. Извличате trace-а. Първият инстинкт е очевидният: **reentrancy guard-ът е счупен.** Препрочитате модификатора. Логиката е правилна. `require(_txSender == address(0), "reentrant");`, set-ва sender-а, изпълнява тялото, `delete _txSender;`. Чисто.

Втора догадка: **storage layout drift от proxy upgrade.** Сравнявате имплементациите. Layout-ите съвпадат. `_owner` е на slot 0 и в двете версии. `_txSender` е transient променлива — даже не е в persistent layout-а. Не могат да се сблъскат. Освен… чакай.

Трета догадка, защото вече е 2 сутринта и Stack Overflow е отворен в 8 таба: **reorg е изял state root.** Не. State root-ът на този блок е това, което archive node казва. `_owner` наистина е бил нула, когато `initialize()` е извикан.

Ето тази част, която кара хората да хлопнат лаптопите: никой от стандартните ви инструменти не може да види това. Unit тестовете ви вероятно даже не минават през `--via-ir` — повечето repos default-ват към legacy evmasm пайплайна в CI, а този пайплайн не е засегнат. Formal verification tooling-ът ви третира компилатора като trusted transformation слой; доказва, че Solidity-то ви е безопасно и приема, че компилаторът го превежда правилно. On-chain мониторингът ви търси аномални state промени — но легитимен `delete` на storage slot изглежда напълно легитимно. Атакуващият никога не е писал в `_owner`. Компилаторът е.

Моментът на просветление идва, когато някой — в случая, екипът на Hexens по време на compiler-source одит на 11 февруари 2026 г. — отваря генерирания Yul IR и grep-ва за `storage_set_to_zero_`. Виждат **един** helper там, където би трябвало да има два: единствена функция, използваща `sstore`, извиквана и от persistent `delete` path-а, **и** от transient `delete` path-а.

Оттам са 30 минути четене на `storageSetToZeroFunction` в compiler source-а и осъзнаване, че cache key-ът е `"storage_set_to_zero_" + _type.identifier()` — без storage-domain суфикс. Сравнете със съседния `updateStorageValueFunction`, който го прави правилно:

```cpp
std::string const functionName =
    "update_" +
    (_location == VariableDeclaration::Location::Transient ? "transient_s" : "") +
    "storage_value_" + ...;
```

Един helper в компилатора помни своя storage домейн. Този до него — не. Това е целият бъг — осемнадесет символа липсваща string concatenation.

## Решението

Три действия, в ред на спешност.

**1. Обновете.** solc 0.8.34 е single-issue bugfix release. Бъмпнете `pragma`-та си или версията на компилатора в toolchain-а, рекомпилирайте, redeploy-нете. Във Foundry: обновете `solc_version = "0.8.34"` в `foundry.toml` и пуснете `forge build --via-ir`. В Hardhat: обновете `solc.version` в `hardhat.config.ts` и рекомпилирайте.

**2. Докажете, че рекомпилираният ви код е чист.** Diff-нете Yul IR-а преди и след:

```bash
solc --ir --via-ir MyContract.sol > after.yul
diff before.yul after.yul | grep -E "storage_set_to_zero|transient_storage"
```

Ако новият IR съдържа два различни helper-а — `storage_set_to_zero_t_address`, използващ `sstore`, и `transient_storage_set_to_zero_t_address`, използващ `tstore` — сте в безопасност. Ако старият IR имаше само първия и беше извикван и от двата path-а, бяхте отровени.

**3. Ако още не можете да обновите, неутрализирайте тригера.** Един ред inline assembly заменя отровения helper:

```solidity
address transient _txSender;

function _clearGuard() internal {
    assembly { tstore(_txSender.slot, 0) }
}
```

Това байпасва Yul helper пайплайна изцяло и емитира `tstore` директно. Компилаторът не може да закеширва грешно това, което сте написали ръчно. Приложете същия pattern на persistent страната, ако transient path-ът е този, който се компилира грешно — независимо в коя посока тече колизията, едната страна може да бъде ръчно написана, за да излезе от опасност.

Едно нещо, което **не** трябва да правите: не се опитвайте да "поправите" това, преименувайки transient променливата си или премествайки я на различен слот. Бъгът не е за слотове. Той е за споделения Yul helper. Две различни променливи от същия value type са достатъчни, за да се сблъскат, независимо от storage layout-а.

За контракти зад upgradeable proxy, замяна на имплементацията е достатъчна. За non-upgradeable контракти, които вече са live с уязвимостта, ви трябва migration план — и вероятно пауза на withdrawals, докато го изпълните.

## Урокът

Transient storage е на осемнадесет месеца. EIP-1153 излезе в Dencun (март 2024); Solidity добави ключовата дума `transient` в 0.8.28 (октомври 2024). Функцията беше стабилна, опкодът беше стабилен — но компилаторният path, който ги слепва, беше чисто нов код, споделящ helper функция с осемнадесет-годишна codepath (persistent storage clearing), която никога не беше проектирана за два storage домейна.

Това е генерализуемият урок: **нова езикова функция е нова compiler surface.** Ако сте един от първите екипи, използващи `transient`, `tstore`, `tload`, или каквото и да е друго, което наскоро е получило Solidity-level абстракция, threat model-ът ви трябва да включва компилаторни бъгове от този клас. Това значи pin-нете точна solc версия, пускайте CI със същия пайплайн, който ship-вате в production (`--via-ir`, ако това deploy-вате), bookmark-нете Solidity known-bugs списъка и security-alerts блога, и subscribe-нете към release канала на компилатора. По-добре да прочетете там, отколкото изследовател като Hexens да прочете в кодовата ви база.

Коректността е stack. Компилаторът седи под одита ви.

## Кредит и допълнително четене

Тази статия е базирана на детайлния compiler-source анализ, публикуван от [Hexens на 18 февруари 2026 г.](https://hexens.io/research/solidity-compiler-bug-tstore-poison) и съпътстващото официално advisory от екипа на Solidity на [soliditylang.org](https://www.soliditylang.org/blog/2026/02/18/transient-storage-clearing-helper-collision-bug/). Благодарности на изследователския екип на Hexens за ясните репродукции и на Solidity/Argot maintainer-ите за бързата реакция на [solc 0.8.34](https://www.soliditylang.org/blog/2026/02/18/solidity-0.8.34-release-announcement/). По-дълбоко четене: [List of Known Bugs](https://docs.soliditylang.org/en/latest/bugs.html) (entry `SOL-2026-1`, `TransientStorageClearingHelperCollision`) и [EIP-1153 transient storage спецификация](https://eips.ethereum.org/EIPS/eip-1153).

## Често задавани въпроси

**В: Как да проверя дали вече deploy-натият ми контракт е засегнат?**

О: Извлечете верифицирания source на deployment-а си и рекомпилирайте локално с точната solc версия и настройки, които сте използвали (Etherscan-овият verified-metadata панел ви казва и двете). Генерирайте Yul IR с `solc --ir --via-ir YourContract.sol` и търсете `storage_set_to_zero_`. Ако единичен helper се извиква и от persistent, и от transient clear path, сте уязвими. Ако не използвате `--via-ir` или контрактът ви няма `transient` state променлива, сте в безопасност независимо от компилаторната версия.

**В: Обнових до 0.8.34, но не съм re-deploy-нал. Покрит ли съм?**

О: Не. Поправката живее в компилатора, така че старият bytecode остава бъгав. Трябва да рекомпилирате и redeploy-нете implementation контракта. За upgradeable proxies, това е стандартна implementation замяна. За non-upgradeable контракти, ви трябва migration — обикновено паузиране на нови депозити, изтегляне на state-а към нов deployment, и пренасочване на frontend-а.

**В: Засяга ли legacy compilation pipeline-а?**

О: Не. Бъгът живее само в Yul IR пайплайна. Ако компилирате без `--via-ir` (все още default в много конфигурации към 0.8.33), persistent-storage clearing-ът минава през различен code path и helper колизията не може да се случи. Ето защо много проекти случайно избягнаха бъга — техните CI използват legacy пайплайна. Дали това е добра новина зависи от това дали и *production* build-ът ви също използва legacy пайплайна.

**В: Защо отне осемнадесет месеца да бъде намерен?**

О: `delete` върху transient state променлива е истински niche pattern — EVM-овия `tstore` опкод вече auto-clear-ва в края на транзакция, така че повечето разработчици никога не пишат `delete _transientGuard;`, защото нямат нужда. Hexens сканирането през 20M+ deploy-нати контракта намери приблизително 500,000 компилирани със засегнати версии плюс `--via-ir`, но само четири проекта, удрящи специфичния тригерен pattern. Тесен blast radius плюс нуждата да се чете генериран Yul IR, за да се забележи miscompilation-а — бъгът се криеше на видно място.

**В: Засегнати ли са transient mappings или arrays?**

О: solc 0.8.33 не поддържа transient mappings, transient arrays или transient structs — само value-type transient променливи. Така че attack surface-а е ограничен до scalar transients (`address transient`, `uint256 transient` и т.н.), сблъскващи се с persistent clear-ове на същия скаларен тип. Ако сте писали свой собствен assembly-based transient mapping, така или иначе сте писали `tstore` ръчно и miscompilation-ът не се прилага.

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
