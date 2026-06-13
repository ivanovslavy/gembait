Your webhook handler looks fine. (A webhook is just an HTTP request Stripe sends your server when something happens — a payment, a refund.) You log the Stripe `event.id`, check whether you've seen it before, and if not, you process the payment. Every local test passes. Every integration test passes. Then, on a Tuesday afternoon, a donor in Melbourne gets charged twice for the same $50 donation — and you spend the next three hours trying to convince yourself that Stripe is broken.

Stripe isn't broken. Your check is.

The pattern you almost certainly wrote — `SELECT`, then if-not-exists `INSERT` — isn't one operation. It's two. And once you have more than one worker running behind a load balancer (the box that spreads traffic across several copies of your app), two copies of the same event can slip through the gap between those two steps. So you process the donation twice. You ping the webhook Slack channel twice. You send the receipt email twice. And your monitoring stays silent, because every single HTTP request returned `200 OK`.

This isn't a rare edge case. It's the default outcome of the most popular tutorial pattern on the internet. On March 11, 2026, a public P0 issue (the highest-priority "this is on fire" label) was filed on the SwiftCause donations platform describing this exact race condition producing duplicate donation rows in Firestore. The fix isn't a distributed lock or Redis or a queue. It's a single SQL statement you probably already know.

## The problem, stated precisely

Stripe's own docs warn you this can happen. From the webhook reliability guide: *"Endpoints occasionally receive the same event more than once."* And: *"We recommend guarding against duplicated event receipts by making your event processing idempotent."* ("Idempotent" just means handling the same event twice has the same effect as handling it once.) [Stripe's webhook docs](https://docs.stripe.com/webhooks) also spell out the retry policy — up to three days of exponential backoff in live mode, three attempts within a few hours in test mode — and warn that delivery order isn't guaranteed.

Two retries arriving almost at the same time is the common case. Here's how: Stripe delivers the event. Your endpoint takes 4.9 seconds to respond because Postgres is slow today. Stripe times out at 5.0 seconds and queues a retry. Half a second later that retry fires. In that same half-second, your original request also finishes. Now two nearly-identical HTTP POSTs are in flight against your cluster.

Here's the pattern that ships in every "handle Stripe webhooks in Node" tutorial:

```js
// ❌ WRONG — looks fine, fails under concurrent delivery
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);

  const { rows } = await pg.query(
    'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (rows.length > 0) return res.sendStatus(200);

  await handleStripeEvent(event);   // sends email, creates donation, calls out
  await pg.query(
    'INSERT INTO webhook_events (stripe_event_id) VALUES ($1)',
    [event.id]
  );
  res.sendStatus(200);
});
```

Worker A runs the `SELECT` — nothing found. Worker B runs the same `SELECT` a millisecond later — also nothing found. Both go ahead. Both call `handleStripeEvent`. Both insert. If `stripe_event_id` has a unique constraint, the second insert fails — but only *after* the side effects already fired. As the GitHub issue put it, *"multiple workers can pass the idempotency check before an event is marked as processed, allowing the same event to execute multiple times."*

## The debugging dance

The first instinct is always to blame Stripe. Open the Events dashboard. Yep, the event was delivered twice. Case closed — except the docs literally say this will happen, and you're supposed to handle it. So Stripe isn't wrong. You are.

The second instinct is to move webhook processing into a background queue. BullMQ, SQS, RabbitMQ, whatever's in the kitchen. Surely queues fix this. They don't. A queue just moves the race from the HTTP layer to the worker layer. Two workers still pop two copies of the same event (or one copy gets retried while the first is mid-flight), and the same non-atomic check runs all over again.

The third instinct — and this is where the hours vanish — is to reach for a distributed lock. Redis `SET NX`, or `SETNX` with an expiry, or Redlock if you're feeling fancy. You add 50 lines of lock-acquisition code, pick a timeout, and ship it. Until the day your Redis primary fails over during a deploy, the lock holder crashes while holding the key, and webhook processing hangs until the TTL expires. Now you have two problems.

By this point the 8 tabs are open. Stack Overflow, Stripe's community forum, a 2021 Medium post, a 2023 dev.to post — all of them recommending the same wrong pattern. *"Just log the event ID and check before processing."* Nobody says how to log it *atomically*. Nobody mentions that `SELECT`-then-`INSERT` is a compound operation.

The realization, when it finally lands, is almost embarrassing. The database already has atomic primitives — that's its entire job. You don't need a lock. You don't need a queue. You don't need Redis. You need one `INSERT` statement that also tells you whether it actually inserted anything.

## The solution: one atomic INSERT

The fix is to fold the "have I seen this event?" check into the very same statement as the "remember that I saw it" write. Postgres ships exactly the tool for this.

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
// ✅ CORRECT — one atomic statement, no race
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
    // Another worker already claimed this event. Acknowledge and exit.
    return res.sendStatus(200);
  }

  try {
    await handleStripeEvent(event);
    await pg.query(
      'UPDATE webhook_events SET processed_at = NOW() WHERE stripe_event_id = $1',
      [event.id]
    );
  } catch (err) {
    // Let Stripe retry. The row stays with processed_at = NULL.
    return res.status(500).send('processing failed');
  }

  res.sendStatus(200);
});
```

It's worth understanding *why* this works, not just copying it. `INSERT ... ON CONFLICT` is a single SQL statement, and the [Postgres docs](https://www.postgresql.org/docs/current/sql-insert.html) are explicit about its atomicity: *"`ON CONFLICT DO UPDATE` guarantees an atomic `INSERT` or `UPDATE` outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."* The same guarantee applies to `DO NOTHING`. Under the hood, Postgres takes a row-level lock on the would-be conflicting row, and only one transaction wins the race. Everybody else either gets the existing row (with `DO UPDATE`) or nothing (with `DO NOTHING`). Think of it like a single turnstile: only one person gets through per slot, and the database decides who.

The `RETURNING` clause is the second half of the trick. `RETURNING` on an `ON CONFLICT DO NOTHING` statement *only hands back rows that were actually inserted*. If you lost the race, `rowCount === 0` and you know it. If you won, you get back the event ID and you know to proceed. No second query. No lock table. No Redis.

Three edge cases worth guarding against:

1. **The handler crashes mid-processing.** You've claimed the event (the row is inserted) but `handleStripeEvent` blew up before `processed_at` got set. Returning `500` lets Stripe retry later — but the row is already there, so the retry would do nothing. Fix: sweep for `processed_at IS NULL AND received_at < NOW() - INTERVAL '10 minutes'` and either retry or alert. Or delete the row on the catch branch (you trade a tiny duplicate-processing window for automatic recovery).
2. **The handler's side effects aren't transactional.** Sending an email or calling an external API can't be rolled back. If that's your case, the two-step pattern above is the right answer. If every side effect is SQL in your own database, wrap everything in a single transaction and keep it simple.
3. **The signature check must happen first.** Don't verify the Stripe signature inside the transaction — verify it before you touch the database. Otherwise you've just built a denial-of-service vector where forged events fill your webhook_events table.

## The lesson

The general rule is bigger than Stripe webhooks. Any "check, then do" pattern you write against shared state in a concurrent system has a race window. The fix is almost never a lock. The fix is to push the check into the same atomic operation as the write.

- `INSERT ... ON CONFLICT DO NOTHING RETURNING` — "claim this or tell me someone else has"
- `UPDATE ... WHERE status = 'pending' RETURNING` — "transition this only if it hasn't transitioned yet"
- `SELECT ... FOR UPDATE SKIP LOCKED` — "give me a row nobody else is working on"

All three turn a two-step logical operation into a one-step atomic one. Any time you catch yourself writing `SELECT` followed by a conditional `INSERT` or `UPDATE` against shared rows, treat it as a red flag. The race will find you in production, usually on a Tuesday.

## Credit and further reading

This article is based on [issue #525 on the SwiftCause donations platform](https://github.com/YNVSolutions/SwiftCause_Web/issues/525), filed March 11, 2026, which documents the check-then-mark race in concrete P0 terms. For the authoritative reference, see [Stripe's webhook reliability documentation](https://docs.stripe.com/webhooks) and the [Postgres `INSERT` documentation](https://www.postgresql.org/docs/current/sql-insert.html) on `ON CONFLICT` semantics.

## Frequently Asked Questions

### Do I need a PRIMARY KEY, or will any UNIQUE constraint work?

Any unique constraint works. `ON CONFLICT (column_name)` can target any column or set of columns that has a unique index, not just the primary key. A common pattern is to keep an integer primary key for row identity and add `UNIQUE (stripe_event_id)` separately. The atomicity guarantee is identical either way — Postgres takes the appropriate index lock and only one transaction gets through. Use a primary key if `stripe_event_id` is the natural identifier for the row; otherwise a separate unique index is fine. The cost difference in production is negligible.

### Does this pattern work in MySQL or SQLite?

Yes, with different syntax. MySQL's `INSERT ... ON DUPLICATE KEY UPDATE` and SQLite's `INSERT ... ON CONFLICT DO NOTHING` both offer the same atomicity. The tricky part in MySQL is detecting which side won — `ROW_COUNT()` returns `1` for a fresh insert and `2` for an update, which is a historical quirk worth reading about before you ship. In SQLite the semantics are closer to Postgres, but concurrent writes get serialized anyway, so the race window is smaller to begin with. If you're on a different database, the general rule still holds: find that database's atomic upsert primitive and use it.

### Why not put the entire handler inside a single database transaction?

You can, and you should — if every side effect of the handler is a database write in the same Postgres instance. Wrap the `INSERT ... ON CONFLICT` and all downstream writes in `BEGIN` / `COMMIT`. If the transaction rolls back, the claim disappears too, and Stripe's retry gets a clean slate. The reason the article shows a two-step pattern is that most webhook handlers do something outside the database: send an email, call another API, enqueue a background job. Those actions can't be rolled back, so the idempotency record has to outlive them.

### Should I verify the Stripe signature before or after the idempotency check?

Before. Always before. Signature verification is cheap (an HMAC comparison), and skipping it exposes your idempotency table to any attacker who can send HTTP requests to your endpoint. Without verification, a forged event with a chosen `event.id` can either fill your table with junk or, worse, pre-claim a real event ID so the genuine webhook does nothing when it arrives. The correct order is: read the raw body, verify the signature, parse the event, then run the atomic claim.

### Is the Stripe-provided `Idempotency-Key` header the same thing?

No, and the naming confusion costs people hours. Stripe's `Idempotency-Key` header is for *your* API calls going out to Stripe — so that retrying a charge creation doesn't double-charge the customer. The pattern in this article is the mirror image: Stripe's events coming in to your endpoint, where *you* are the one handling duplicate delivery. Both are idempotency, both use a string key, but they point in opposite directions. Most applications need both.
