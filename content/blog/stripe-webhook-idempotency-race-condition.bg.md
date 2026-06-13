Webhook handler-ът ти изглежда наред. Логваш Stripe `event.id`, проверяваш дали вече си го виждал, и ако не — обработваш плащането. Изглежда чисто. Всеки локален тест минава. Всеки интеграционен тест минава. И после, един вторник следобед, дарител в Мелбърн е таксуван два пъти за едно и също дарение от $50. Ти прекарваш следващите три часа в опити да убедиш себе си, че Stripe е счупен.

Stripe не е счупен. Твоята проверка е.

Pattern-ът, който почти сигурно си написал — `SELECT`, после "ако го няма, `INSERT`" — изглежда като едно нещо, но всъщност са две. Първо питаш базата, после ѝ казваш да запише. А на всеки production сървър, който върти повече от един worker зад load balancer, две копия на същия event могат да се промъкнат точно в пролуката между тези две стъпки. Резултатът: обработваш дарението два пъти. Звъниш в webhook Slack канала два пъти. Изпращаш email с разписка два пъти. И мониторингът ти мълчи, защото всяка отделна HTTP заявка си е върнала чисто `200 OK`.

Това не е някакъв рядък edge case, който се случва веднъж на милион. Това е *default* резултатът от най-популярния tutorial pattern в интернет. На 11 март 2026 г. публичен P0 issue беше подаден на платформата за дарения SwiftCause, описвайки точно тази race condition — два worker-а се надбягват за един и същи ред — която произвежда дублиращи се дарения във Firestore. А поправката не е distributed lock, нито Redis, нито queue. Едно SQL изречение е, което вероятно вече знаеш.

## Проблемът, формулиран точно

Документацията на самия Stripe ти казва открито, че това може да се случи. От webhook reliability guide-а им: *"Endpoints occasionally receive the same event more than once."* И: *"We recommend guarding against duplicated event receipts by making your event processing idempotent."* Идемпотентно тук значи: безопасно е да го изпълниш два пъти, без да направи нещото два пъти. [Документацията за webhook на Stripe](https://docs.stripe.com/webhooks) описва и политиката на retry — до три дни exponential backoff в live режим, три опита в рамките на няколко часа в test режим — и предупреждава, че редът на доставка не е гарантиран.

Случаят, в който два retry-а пристигат почти едновременно, изобщо не е екзотичен. Ето как се случва. Stripe доставя event-а. Endpoint-ът ти се бави 4.9 секунди да отговори, защото Postgres е бавен днес. От страната на Stripe правят timeout на 5.0 секунди — само 0.1 секунда по-късно — и нареждат retry. Половин секунда след това retry-ят тръгва. Но точно през тази половин секунда оригиналната ти заявка също завършва. И сега имаш два почти идентични HTTP POST-а, които летят едновременно срещу клъстера ти.

Ето pattern-а, който ще намериш буквално във всеки tutorial "handle Stripe webhooks in Node":

```js
// ❌ ГРЕШНО — изглежда добре, проваля се при concurrent доставка
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);

  const { rows } = await pg.query(
    'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (rows.length > 0) return res.sendStatus(200);

  await handleStripeEvent(event);   // изпраща email, създава дарение, прави външни извиквания
  await pg.query(
    'INSERT INTO webhook_events (stripe_event_id) VALUES ($1)',
    [event.id]
  );
  res.sendStatus(200);
});
```

Виж какво се случва. Worker A изпълнява `SELECT` — нищо не намира. Worker B изпълнява същия `SELECT` милисекунда по-късно — също не намира нищо, защото A още не е записал. И двамата мислят, че event-ът е нов. И двамата извикват `handleStripeEvent`. И двамата вмъкват. Ако `stripe_event_id` има unique constraint, второто вмъкване ще се провали — но чак след като страничните ефекти вече са се случили, тоест след като email-ът вече е тръгнал и дарението вече е създадено. Точно както го казва GitHub issue-то: *"multiple workers can pass the idempotency check before an event is marked as processed, allowing the same event to execute multiple times."*

## Танцът на debugging-а

Първият инстинкт винаги е да обвиниш Stripe. Отваряш Events dashboard-а. И да — event-ът наистина е доставен два пъти. Случаят е затворен… освен че документацията буквално казва, че това *ще* се случи и че от теб се очаква да го обработиш. Значи Stripe не греши. Ти грешиш.

Вторият инстинкт е да преместиш webhook обработката в background queue. BullMQ, SQS, RabbitMQ — каквото е под ръка. Queue-овете със сигурност оправят това, нали? Не. Queue просто мести race-а от HTTP слоя към worker слоя. Двама worker-а пак вадят (pop-ват) две копия на същия event — или едно копие се retry-ва, докато първото е по средата на изпълнение — и същата неатомарна проверка пак се пуска. Преместил си проблема, не си го решил.

Третият инстинкт, и точно тук изчезват часовете, е да посегнеш към distributed lock. Redis `SET NX`, или `SETNX` с expiry, или Redlock, ако си от префинените. Добавяш 50 реда код за придобиване на lock, избираш timeout и пускаш в production. Всичко е наред — до деня, в който Redis primary прави failover по време на deploy. Lock holder-ът се сгромолясва, държейки ключа, и webhook обработката увисва, докато TTL изтече. Сега вече имаш два проблема вместо един.

В този момент имаш отворени 8 таба. Stack Overflow, Stripe community форумът, Medium пост от 2021, dev.to пост от 2023 — всичките препоръчват същия грешен pattern. *"Просто log-ни event ID-то и провери преди обработка."* Никой не казва как да го log-неш *атомарно* — тоест като една неделима стъпка. Никой не споменава, че `SELECT`-после-`INSERT` всъщност са две операции, не една.

Прозрението, когато най-после дойде, е почти неловко колко е просто. Базата данни *вече* има атомарни примитиви. Това ѝ е цялата работа. Не ти трябва lock. Не ти трябва queue. Не ти трябва Redis. Трябва ти едно-единствено `INSERT` изречение, което при това ти казва дали реално е вмъкнало нещо.

## Решението: едно атомарно INSERT

Идеята е да наблъскаш проверката "виждал ли съм този event?" в същото изречение, в което записваш "запомни, че съм го видял". Едно нещо вместо две. Postgres ти дава точно инструмента за това.

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
// ✅ ПРАВИЛНО — едно атомарно изречение, без race
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
    // Друг worker вече е claim-нал този event. Потвърди и излез.
    return res.sendStatus(200);
  }

  try {
    await handleStripeEvent(event);
    await pg.query(
      'UPDATE webhook_events SET processed_at = NOW() WHERE stripe_event_id = $1',
      [event.id]
    );
  } catch (err) {
    // Остави Stripe да retry-не. Редът остава с processed_at = NULL.
    return res.status(500).send('processing failed');
  }

  res.sendStatus(200);
});
```

Струва си да разбереш *защо* това работи, а не просто да го копираш. `INSERT ... ON CONFLICT` е едно SQL изречение, и [Postgres документацията](https://www.postgresql.org/docs/current/sql-insert.html) е напълно ясна за атомарността му: *"`ON CONFLICT DO UPDATE` guarantees an atomic `INSERT` or `UPDATE` outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."* Същата гаранция важи и за `DO NOTHING`. Зад кулисите Postgres взима tuple-level lock върху реда, който би влязъл в конфликт — нещо като да си вдигнеш ръката пръв и да кажеш "този ред е мой" — и само една транзакция печели. Всички останали или получават съществуващия ред (с `DO UPDATE`), или нищо (с `DO NOTHING`).

`RETURNING` клаузата е втората половина на трика, и тя е красивата част. `RETURNING` върху `ON CONFLICT DO NOTHING` *връща само редовете, които реално са били вмъкнати*. Тоест ако си загубил race-а, `rowCount === 0` — и ти го знаеш веднага. Ако си спечелил, получаваш обратно event ID-то и знаеш да продължиш. Без втора заявка. Без таблица за lock-ове. Без Redis.

Три edge case-а, които си струва да защитиш:

1. **Handler-ът се сгромолясва по средата на обработката.** Claim-нал си event-а (редът е вмъкнат), но `handleStripeEvent` е гръмнал, преди `processed_at` да бъде сетнато. Връщаш `500`, оставяш Stripe да retry-не по-късно — но редът вече е там, така че retry-ят би бил no-op (нищо ново няма да се случи). Решение: периодично преглеждай редовете с `processed_at IS NULL AND received_at < NOW() - INTERVAL '10 minutes'` и или ги retry-вай, или вдигай alert. Друг вариант — изтривай реда в catch клона (така разменяш малък прозорец за дублирана обработка срещу автоматично възстановяване).
2. **Страничните ефекти на handler-а не са транзакционни.** Изпратен email или извикан външен API не може да се rollback-не — пратеното си е пратено. Ако това е твоят случай, двустъпковият pattern по-горе е правилният отговор. Но ако всички странични ефекти са SQL в собствената ти база данни, обвий всичко в една транзакция и го дръж просто.
3. **Проверката на сигнатурата трябва да стане първа.** Не верифицирай Stripe сигнатурата вътре в транзакцията — верифицирай я преди изобщо да докоснеш базата данни. Иначе си построил denial-of-service вектор, при който фалшифицирани event-и пълнят webhook_events таблицата ти.

## Урокът

Общото правило е по-голямо от Stripe webhook-овете. Всеки "провери, после действай" pattern, който пишеш срещу споделено състояние в concurrent система, има race window — пролука, в която две неща се промъкват едновременно. И поправката почти никога не е lock. Поправката е да наблъскаш проверката в същата атомарна операция като записа.

- `INSERT ... ON CONFLICT DO NOTHING RETURNING` — "claim това или ми кажи, че някой друг вече го е claim-нал"
- `UPDATE ... WHERE status = 'pending' RETURNING` — "премини това състояние само ако още не е преминало"
- `SELECT ... FOR UPDATE SKIP LOCKED` — "дай ми ред, върху който никой друг не работи"

И трите превръщат двустъпкова логическа операция в едностъпкова атомарна. Всеки път, когато се хванеш да пишеш `SELECT`, последван от условен `INSERT` или `UPDATE` срещу споделени редове, третирай го като червен флаг. Race-ът ще те намери в production — обикновено във вторник.

## Кредит и допълнително четене

Тази статия е базирана на [issue #525 на платформата за дарения SwiftCause](https://github.com/YNVSolutions/SwiftCause_Web/issues/525), подаден на 11 март 2026 г., който документира check-then-mark race-а в конкретни P0 термини. За официална референция виж [документацията за webhook reliability на Stripe](https://docs.stripe.com/webhooks) и [документацията на Postgres за `INSERT`](https://www.postgresql.org/docs/current/sql-insert.html) относно `ON CONFLICT` семантиката.

## Често задавани въпроси

### Трябва ли ми PRIMARY KEY, или какъвто и да е UNIQUE constraint ще свърши работа?

Какъвто и да е unique constraint върши работа. `ON CONFLICT (column_name)` може да таргетира колона или група от колони, която има unique индекс — не само primary key. Често срещан pattern е да държиш цяло число за primary key (идентичност на реда) и да добавиш `UNIQUE (stripe_event_id)` отделно. Гаранцията за атомарност е една и съща в двата случая — Postgres придобива подходящия index lock и само една транзакция преминава. Използвай primary key, ако `stripe_event_id` е естественият идентификатор за реда; иначе отделен unique индекс е напълно ОК. Разликата в цената в production е незначителна.

### Работи ли този pattern в MySQL или SQLite?

Да, само със различен синтаксис. MySQL-ското `INSERT ... ON DUPLICATE KEY UPDATE` и SQLite-овото `INSERT ... ON CONFLICT DO NOTHING` и двете дават същата атомарност. Сложната част в MySQL е да разбереш коя страна е спечелила — `ROW_COUNT()` връща `1` за свеж insert и `2` за update, което е историческа странност, която си струва да прочетеш, преди да пуснеш в production. В SQLite семантиката е по-близка до Postgres, но concurrent записите така или иначе се сериализират (изпълняват се един след друг), така че race window-ът е по-малък за начало. А ако си на съвсем друга база данни, общото правило пак важи: намери атомарния upsert примитив на тази база данни и го използвай.

### Защо не сложим целия handler в една database транзакция?

Можеш — и трябва — ако всеки страничен ефект на handler-а е database write в същата Postgres инстанция. Обвий `INSERT ... ON CONFLICT` и всички следващи writes в `BEGIN` / `COMMIT`. Ако транзакцията се rollback-не, claim-ът също изчезва, и retry-ят на Stripe получава чист лист. Причината, поради която статията показва двустъпков pattern, е че повечето webhook handler-и правят нещо *извън* базата данни: пращат email, викат друг API, нареждат background job. Тези действия не могат да се rollback-нат, така че idempotency record-ът трябва да преживее по-дълго от тях.

### Трябва ли да верифицирам Stripe сигнатурата преди или след idempotency check-а?

Преди. Винаги преди. Верификацията на сигнатура е евтина (просто HMAC сравнение), а ако я пропуснеш, излагаш idempotency таблицата си на всеки нападател, който може да изпрати HTTP заявки до endpoint-а ти. Без верификация фалшифициран event с избран `event.id` може или да напълни таблицата ти с боклук, или — по-лошо — предварително да claim-не реален event ID, така че истинският webhook да направи no-op, когато пристигне. Правилният ред е: четеш raw body-то, верифицираш сигнатурата, парсваш event-а, и чак тогава изпълняваш атомарния claim.

### Stripe-предоставеният `Idempotency-Key` header същото нещо ли е?

Не — и объркването с името струва на хората часове. Stripe-овият `Idempotency-Key` header е за *твоите* API извиквания, които отиват *към* Stripe — така че retry на създаване на charge да не таксува клиента два пъти. Pattern-ът в тази статия е огледалното изображение: event-ите на Stripe идват *към* твоя endpoint, и тук *ти* си този, който трябва да се справи с дубликатна доставка. И двете са идемпотентност, и двете използват string ключ, но сочат в противоположни посоки. Повечето приложения имат нужда и от двете.
