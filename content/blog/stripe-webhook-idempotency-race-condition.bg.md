Webhook handler-ът ви изглежда наред. Логвате Stripe `event.id`, проверявате дали сте го виждали преди, и ако не — обработвате плащането. Всеки локален тест минава. Всеки интеграционен тест минава. После, един вторник следобед, дарител в Мелбърн е таксуван два пъти за същото дарение от $50, и прекарвате следващите три часа в опити да убедите себе си, че Stripe е счупен.

Stripe не е счупен. Проверката ви е.

Pattern-ът, който почти сигурно сте написали — `SELECT`, после ако-не-съществува `INSERT` — не е една операция. Той е две. И на всяко production deployment с повече от един worker зад load balancer, две копия на същия event могат да се промъкнат през пролуката между тях. Обработвате дарението два пъти. Звъните в webhook Slack канала два пъти. Изпращате email с разписка два пъти. И мониторингът ви мълчи, защото всяка отделна HTTP заявка е върнала `200 OK`.

Това не е рядък edge case. Това е default резултатът на най-популярния tutorial pattern в интернет. На 11 март 2026 г. публичен P0 issue беше подаден на платформата за дарения SwiftCause, описвайки точно тази race condition, произвеждаща дублиращи се редове за дарения във Firestore. Поправката не е distributed lock или Redis или queue. Това е едно SQL изречение, което вероятно вече знаете.

## Проблемът, формулиран точно

Документацията на самия Stripe ви казва, че това може да се случи. От webhook reliability guide: *"Endpoints occasionally receive the same event more than once."* И: *"We recommend guarding against duplicated event receipts by making your event processing idempotent."* [Документацията за webhook на Stripe](https://docs.stripe.com/webhooks) също описва политиката на retry — до три дни exponential backoff в live режим, три опита в рамките на няколко часа в test режим — и предупреждава, че редът на доставка не е гарантиран.

Два retry-а почти едновременно е често срещаният случай. Stripe доставя event-а. Endpoint-ът ви се бави 4.9 секунди да отговори, защото Postgres е бавен днес. Stripe-овата страна прави timeout на 5.0 секунди и нарежда retry. Половин секунда по-късно retry-ът се пуска. През тази половин секунда оригиналната ви заявка също завършва. Сега две почти идентични HTTP POST-а са в полет срещу клъстера ви.

Ето pattern-а, който идва във всеки tutorial "handle Stripe webhooks in Node":

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

Worker A изпълнява `SELECT` — нищо не намерено. Worker B изпълнява същия `SELECT` милисекунда по-късно — също нищо не намерено. И двата продължават. И двата извикват `handleStripeEvent`. И двата вмъкват. Ако `stripe_event_id` има unique constraint, второто вмъкване се проваля — но едва след като страничните ефекти вече са се случили. Както GitHub issue-то го казва: *"multiple workers can pass the idempotency check before an event is marked as processed, allowing the same event to execute multiple times."*

## Танцът на debugging-а

Първият инстинкт винаги е да обвините Stripe. Отваряте Events dashboard-а. Да, event-ът е доставен два пъти. Случаят е затворен — освен че документацията буквално казва, че това ще се случи и от вас се очаква да го обработите. Така че Stripe не греши. Вие грешите.

Вторият инстинкт е да преместите webhook обработката в background queue. BullMQ, SQS, RabbitMQ, каквото е под ръка. Сигурно queue-овете оправят това. Не оправят. Queue просто мести race-а от HTTP слоя към worker слоя. Двама worker-а пак pop-ват две копия на същия event (или едно копие се retry-ва докато първото е по средата на изпълнение), и същата неатомарна проверка се пуска отново.

Третият инстинкт, и тук изчезват часове, е да посегнете към distributed lock. Redis `SET NX`, или `SETNX` с expiry, или Redlock ако сте префинени. Добавяте 50 реда код за придобиване на lock, избирате timeout и пускате в production. До деня, в който Redis primary прави failover по време на deploy, lock holder-ът се сгромолясва държейки ключа и webhook обработката виси, докато TTL изтече. Сега имате два проблема.

В този момент са отворени 8 таба. Stack Overflow, Stripe community форум, Medium пост от 2021, dev.to пост от 2023, всичките препоръчващи същия грешен pattern. *"Просто log-ни event ID-то и провери преди обработка."* Никой не казва как да го log-неш *атомарно*. Никой не споменава, че `SELECT`-после-`INSERT` е съставна операция.

Прозрението, когато дойде, е почти неловко. Базата данни вече има атомарни примитиви. Това е цялата ѝ работа. Не ви трябва lock. Не ви трябва queue. Не ви трябва Redis. Трябва ви едно `INSERT` изречение, което също ви казва дали реално е вмъкнало.

## Решението: едно атомарно INSERT

Поправката е да наблъскате проверката "виждал ли съм този event?" в същото изречение като записа "запомни, че съм го видял". Postgres доставя точно инструмента за това.

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

Защо това всъщност работи си струва да се разбере, не просто да се копира. `INSERT ... ON CONFLICT` е едно SQL изречение, и [Postgres документацията](https://www.postgresql.org/docs/current/sql-insert.html) е експлицитна за атомарността му: *"`ON CONFLICT DO UPDATE` guarantees an atomic `INSERT` or `UPDATE` outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."* Същата гаранция важи за `DO NOTHING`. Вътре в Postgres, машината взима tuple-level lock върху бъдещо-конфликтиращия ред, и само една транзакция печели. Всички останали или получават съществуващия ред (с `DO UPDATE`), или нищо (с `DO NOTHING`).

`RETURNING` клаузата е втората половина на трика. `RETURNING` върху `ON CONFLICT DO NOTHING` *връща само редове, които реално са били вмъкнати*. Ако сте загубили race-а, `rowCount === 0` и го знаете. Ако сте спечелили, получавате обратно event ID-то и знаете да продължите. Без втора заявка. Без таблица за lock-ове. Без Redis.

Трите edge case-а, които си струва да защитите:

1. **Handler-ът се сгромолясва по средата на обработката.** Claim-нали сте event-а (редът е вмъкнат), но `handleStripeEvent` е гръмнал преди `processed_at` да бъде сетнато. Връщането на `500` оставя Stripe да retry-не по-късно, но редът вече е там — така че retry-ят би бил no-op. Решение: чистете `processed_at IS NULL AND received_at < NOW() - INTERVAL '10 minutes'` и или retry-вайте, или alert-вайте. Или изтривайте реда в catch клона (разменяте малък прозорец за дублирана обработка срещу автоматично възстановяване).
2. **Страничните ефекти на handler-а не са транзакционни.** Изпращане на email или извикване на външен API не може да се rollback-не. Ако това е вашият случай, двустъпковият pattern по-горе е правилният отговор. Ако всички странични ефекти са SQL в собствената ви база данни, обвийте всичко в една транзакция и го дръжте просто.
3. **Проверката на сигнатурата трябва да се случи първа.** Не верифицирайте Stripe сигнатурата вътре в транзакцията — верифицирайте я преди да докоснете базата данни. Иначе сте построили denial-of-service вектор, където фалшифицирани event-и пълнят webhook_events таблицата ви.

## Урокът

Общото правило е по-голямо от Stripe webhook-овете. Всеки "провери, после действай" pattern, който пишете срещу споделено състояние в concurrent система, има race window. Поправката почти никога не е lock. Поправката е да наблъскате проверката в същата атомарна операция като записа.

- `INSERT ... ON CONFLICT DO NOTHING RETURNING` — "claim това или ми кажи, че някой друг вече го е claim-нал"
- `UPDATE ... WHERE status = 'pending' RETURNING` — "премини това състояние само ако още не е преминало"
- `SELECT ... FOR UPDATE SKIP LOCKED` — "дай ми ред, върху който никой друг не работи"

И трите превръщат двустъпкова логическа операция в едностъпкова атомарна. Винаги, когато се хванете да пишете `SELECT`, последван от условен `INSERT` или `UPDATE` срещу споделени редове, третирайте го като red flag. Race-ът ще ви намери в production, обикновено във вторник.

## Кредит и допълнително четене

Тази статия е базирана на [issue #525 на платформата за дарения SwiftCause](https://github.com/YNVSolutions/SwiftCause_Web/issues/525), подаден на 11 март 2026 г., който документира check-then-mark race-а в конкретни P0 термини. За официална референция, виж [документацията за webhook reliability на Stripe](https://docs.stripe.com/webhooks) и [документацията на Postgres за `INSERT`](https://www.postgresql.org/docs/current/sql-insert.html) относно `ON CONFLICT` семантиката.

## Често задавани въпроси

### Трябва ли ми PRIMARY KEY, или какъвто и да е UNIQUE constraint ще свърши работа?

Какъвто и да е unique constraint върши работа. `ON CONFLICT (column_name)` може да таргетира колона или група от колони, която има unique индекс — не само primary key. Често срещан pattern е да държите цяло число primary key за идентичност на реда и да добавите `UNIQUE (stripe_event_id)` отделно. Гаранцията за атомарност е идентична и в двата случая — Postgres придобива подходящия index lock и само една транзакция преминава. Използвайте primary key, ако `stripe_event_id` е естественият идентификатор за реда; иначе отделен unique индекс е добре. Разликата в цената в production е незначителна.

### Работи ли този pattern в MySQL или SQLite?

Да, с различен синтаксис. MySQL-ското `INSERT ... ON DUPLICATE KEY UPDATE` и SQLite-овото `INSERT ... ON CONFLICT DO NOTHING` и двете предлагат същата атомарност. Сложната част в MySQL е да откриете коя страна е спечелила — `ROW_COUNT()` връща `1` за свеж insert и `2` за update, което е историческа странност, която си струва да прочетете преди да пуснете в production. В SQLite семантиката е по-близо до Postgres, но concurrent записите така или иначе се сериализират, така че race window-ът е по-малък за начало. Ако сте на различна база данни, общото правило все още важи: намерете атомарния upsert примитив на тази база данни и го използвайте.

### Защо не сложим целия handler в една database транзакция?

Можете и трябва — ако всеки страничен ефект на handler-а е database write в същата Postgres инстанция. Обвийте `INSERT ... ON CONFLICT` и всички следващи writes в `BEGIN` / `COMMIT`. Ако транзакцията се rollback-не, claim-ът също изчезва, и retry-ят на Stripe получава чист лист. Причината, поради която статията показва двустъпков pattern, е че повечето webhook handler-и правят нещо извън базата данни: изпращат email, извикват друг API, нареждат background job. Тези действия не могат да се rollback-нат, така че idempotency record-ът трябва да преживее по-дълго от тях.

### Трябва ли да верифицирам Stripe сигнатурата преди или след idempotency check-а?

Преди. Винаги преди. Верификацията на сигнатура е евтина (HMAC сравнение), и пропускането ѝ излага idempotency таблицата ви на всеки нападател, който може да изпрати HTTP заявки до endpoint-а ви. Без верификация, фалшифициран event с избран `event.id` може или да напълни таблицата ви със боклук, или, по-лошо, предварително да claim-не реален event ID, така че истинският webhook да направи no-op, когато пристигне. Правилният ред е: четете raw body-то, верифицирайте сигнатурата, парсвайте event-а, после изпълнете атомарния claim.

### Stripe-предоставеният `Idempotency-Key` header същото нещо ли е?

Не, и объркването с името струва на хората часове. Stripe-овият `Idempotency-Key` header е за *вашите* API извиквания, които отиват към Stripe — така че retry на създаване на charge да не таксува клиента два пъти. Pattern-ът, описан в тази статия, е огледалното изображение: event-ите на Stripe идват към вашия endpoint, където *вие* сте този, който обработва дубликатна доставка. И двете са идемпотентност, и двете използват string ключ, но сочат в противоположни посоки. Повечето приложения имат нужда от двете.
