You wrote a transaction. It looks like every transaction tutorial you've ever read. `BEGIN`, two `UPDATE`s, `COMMIT`. Tests pass. Staging passes. Two months into production, an account ends up with money taken out and nothing put back — books unbalanced, support ticket open, someone's actual money missing. You read the code three times. The logic is right. The SQL is right. The transaction *is there*.

The transaction is there. It just isn't doing what you think it's doing.

Here's the warning the node-postgres docs give in a single sentence — *do not use transactions with the pool.query method* — and the part nobody really takes in until it bites them. (A transaction is a group of database changes that should all succeed together or all undo together — like a bank transfer where the withdrawal and the deposit must both happen, or neither.) When you call `pool.query('BEGIN')`, then `pool.query('UPDATE …')`, then `pool.query('COMMIT')`, you are not running a transaction. You're running three separate queries that may or may not land on the same database connection. When traffic is light, they happen to. When traffic is real, they don't. And then your money goes missing.

This post is the long version of that one-sentence warning. Why it happens, what the failure looks like in the logs (usually it leaves none), and the four-line pattern that's the only correct way to do this.

## The problem, stated precisely

Open the official node-postgres documentation and find the [transactions page](https://node-postgres.com/features/transactions). Halfway down, in plain words: *"You **must** use the same client instance for all statements within a transaction. PostgreSQL isolates a transaction to individual clients."* And then the bold warning: *"This means if you initialize or use transactions with the pool.query method you **will** have problems. Do not use transactions with the pool.query method."*

That `must` and that `will` are carrying a lot of weight. Postgres' transaction state — the open `BEGIN`, the locks it's holding, the rows only this transaction can see — is tied to a single connection to the server. (A connection here is one open line between your app and the database.) If you start a transaction on one connection and run an `UPDATE` on a different one, that `UPDATE` runs on its own, against the plain table, with no transaction wrapped around it. Postgres has no idea your app *thinks* the two statements belong together.

Now bring in the pool. A pool is a small set of ready-made connections your app shares, so it doesn't pay to open a fresh one for every query. Every `pool.query()` call asks the pool for any free connection. When nothing else is happening, the pool hands you the same one every time — there's only one, and the last query just freed it. So your tests pass. Under real load, the pool hands you whatever happens to be free. The `BEGIN` lands on Connection A. By the time your next `await` finishes, Connection A has been handed off to another request, and your `UPDATE` lands on Connection B.

Here's the cruel part: nothing errors. Postgres doesn't mind. Your `BEGIN` opens a transaction on Connection A, and that transaction just sits there open until Connection A gets reused for something else (which quietly throws it away or keeps it idling). Your `UPDATE` runs on Connection B with no transaction around it, and it's saved for good. Your `COMMIT` runs on Connection C, where there's no open transaction at all, so it does nothing.

Three statements. Three connections. Zero safety. One angry CFO.

## The Debugging Dance

You don't land on the right answer first. Nobody does. The first instinct, when you see a half-finished transaction in production, is to blame your `try/catch`. You re-read the error path. You add a `console.log` before the `ROLLBACK`. You try to reproduce it locally — and of course it works locally, because `npm test` runs one request at a time and the pool keeps handing you the same connection.

So the second instinct is "there's a concurrency bug somewhere upstream." (Concurrency just means several requests running at the same time.) You check whether two requests can collide on the same row. You add a `SELECT … FOR UPDATE`. You add a unique index to be safe. The bug doesn't go away, because the bug isn't on the row — it's on the connection. You're locking with one connection and updating with another, and the lock you took is on a connection that gets freed before you ever use it.

Third instinct: blame the pool size. *"The pool must be too small. We're getting weird reuse."* You bump `max` from 10 to 50. The bug gets rarer — because with more connections around, two back-to-back `pool.query` calls are more likely to land on the same one — so you ship that and call it fixed. It comes back the next time traffic doubles.

By now Stack Overflow is open in eight tabs, all versions of *"node-postgres transaction not rolling back"*, and you're starting to suspect the library itself. You open the [issues tracker on brianc/node-postgres](https://github.com/brianc/node-postgres/issues/35) and find a question from 2011 — *"Long-running transaction within a pooled client"* — asking basically what you're asking now: when I use a pool, am I guaranteed to keep the same connection between queries? The answer, scattered across that thread and a dozen others, is *no, never — you have to hold the connection yourself*.

The aha moment is small and a little embarrassing. You weren't holding the connection. You were calling `pool.query` three times, and the pool was doing exactly what it says on the tin: handing you any free connection, every time, with no memory of what you ran a millisecond ago. Your transaction was an illusion stitched together from three unrelated trips to the database.

![Abstract isometric visualization of one transaction fragmenting across three different connection slots, with broken arcs and a dashed lock symbol on the wrong slot.](/images/blog/node-postgres-pool-begin-transaction-race/mid.webp)

## The Solution

There's exactly one correct pattern, and it's worth committing to memory. Grab one connection, use that *same* connection for `BEGIN`, for every query inside the transaction, and for `COMMIT` or `ROLLBACK`, then hand it back in `finally`. Anything else is a trap waiting to spring.

```js
// ✅ CORRECT — one client, held for the whole transaction
async function transferFunds(pool, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId],
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

Why this works is exactly why the broken version doesn't. `pool.connect()` checks one client out of the pool and *promises* it to you for as long as you hold it. While you hold it, no other request can be handed that same client. When you call `client.query`, you go straight to that one connection. `BEGIN` opens a transaction on that connection. Every later `client.query` runs on the same connection, in the same transaction. `COMMIT` closes it. `client.release()` hands the connection back to the pool — clean, ready, with no leftover transaction state.

The non-obvious bits worth pinning to the wall:

**`finally` is non-negotiable.** If `client.release()` doesn't run on every path through the code, that client is, as far as the pool is concerned, lost. After `max` of them are lost, the next `pool.connect()` waits forever (or hits `connectionTimeoutMillis` and throws a misleading error). The `try / catch / finally` shape above is correct; resist the urge to "tidy it up" by moving release into the `try`.

**`ROLLBACK` itself can throw.** If the connection died mid-transaction, the `ROLLBACK` will fail with `"Client was closed and is not queryable"` or something like it. Swallowing that with `.catch(() => {})` is on purpose — the transaction is gone either way, and you want the *original* error to reach your caller, not the rollback's secondary error. This pattern shows up in the brianc/node-postgres issue tracker again and again, because people get confused about which error to surface.

**Don't reuse the variable name.** A common version of this bug is having both `pool` and `client` in scope and accidentally writing `pool.query('UPDATE …')` instead of `client.query('UPDATE …')` inside the transaction body. That one-letter difference compiles, runs, and quietly breaks the transaction. Linting won't catch it. Code review barely catches it. The only real defence is a wrapper function that hides the pool entirely.

That wrapper is worth writing once and using everywhere:

```js
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Usage — pool is invisible, only `client` is in scope inside `fn`:
await withTransaction(pool, async (client) => {
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
});
```

Once `pool` isn't in scope inside the callback, the `pool.query` typo is impossible. Every transaction in your codebase looks the same. New hires can't get this wrong on day one, because there's only one shape to copy.

## The Lesson

Connection pools are a convenience for work that doesn't carry state. Transactions are state. The two only meet at one specific call — `pool.connect()` — and any code that takes a shortcut around that call is, by its very design, broken under concurrency. It'll pass tests. It'll pass code review by people who haven't been burned yet. It'll run for months in staging. And then, on the busiest day of your year, two requests will race for the same connection and the rules you counted on will quietly fall apart.

The bigger principle: when one part of your system hands you "any free worker" and another part needs "the same worker for the next few calls," you can't bridge that gap with hope. You need something that pins one to the other, and you need to wrap that pin in a function that makes it impossible to skip. `pool.connect()` plus a `withTransaction` helper is that wrap. Anything looser is a future incident with a date already on the calendar.

## Credit & Further Reading

This article is a deep retelling of a problem discussed in [brianc/node-postgres issue #35 — *Long-running transaction within a pooled client*](https://github.com/brianc/node-postgres/issues/35) and revisited many times since (notably [#2852 — *Hard to handle idle-in-transaction errors*](https://github.com/brianc/node-postgres/issues/2852) and [#2512 — *Client was closed and is not queryable*](https://github.com/brianc/node-postgres/issues/2512)). Thanks to maintainer `@brianc` for the [canonical transaction gist](https://gist.github.com/brianc/5547726) that has been the de-facto reference for over a decade. For the authoritative documentation, see [node-postgres — Transactions](https://node-postgres.com/features/transactions). Our GembaPay non-custodial gateway runs every multi-row write through a `withTransaction` wrapper for exactly the reason described above.

## Frequently Asked Questions

### Why does my test suite never catch this?

Because your tests run sequentially. With one request in flight, the pool hands you the same client every call — your `BEGIN`, your `UPDATE`, and your `COMMIT` all happen to land on the same connection, and the transaction works "by accident." The bug only appears when two or more requests are in flight simultaneously and the pool starts handing out different clients between your awaits. Reproducing it deterministically requires a load test or a deliberately crafted concurrent test — fire 100 transfers in parallel against a small pool (`max: 2` or `max: 4`) and you'll see split transactions immediately. Most CI pipelines don't do this, which is why the pattern survives in production codebases for years.

### Does an ORM like Prisma or TypeORM protect me from this?

Mostly yes, but only when you use the ORM's transaction API. Prisma's `prisma.$transaction(async (tx) => …)` and TypeORM's `dataSource.transaction(async (manager) => …)` both check out a dedicated client under the hood and pass you a wrapped query interface scoped to that client. The trap is mixing the two — calling `prisma.user.update(…)` directly inside a `prisma.$transaction(async (tx) => …)` callback uses the pool, not the transaction client, and reproduces the same split-transaction bug at a higher level. The rule generalises: use the transaction-scoped object the ORM hands you, and never close over the global pool inside the callback.

### Is `idleTimeoutMillis` related to this bug?

Indirectly. Idle timeout governs how long an unused client sits in the pool before being destroyed; it doesn't cause transactions to split. But it produces a related, equally confusing class of failure — a client mid-transaction can be killed by `idle_in_transaction_session_timeout` on the Postgres side if your application code awaits something slow between queries (an external API, a long file read). The transaction is then broken, and your next `client.query` throws `"Client was closed and is not queryable"`. The fix is the same shape: hold the client tightly, do not await long external operations inside an open transaction, and rely on the `try/finally/release` pattern so a dead client still gets returned to the pool cleanly.

### What about `pool.query` with a single SQL string containing `BEGIN; UPDATE; COMMIT`?

This works because Postgres parses the multi-statement string as a single message on the wire and executes the whole thing on whichever client the pool picked — atomically, on one connection. But it has its own problems: you can't bind parameters across statements safely, you can't conditionally `ROLLBACK` based on the result of one of the inner statements, and you've now hidden a transaction inside a string literal where nobody will think to look. It's a parlour trick, not a pattern. Use `pool.connect()` and a held client; you'll thank yourself the first time you need to add a `CASE` to the rollback path.

### Why doesn't pg-pool just detect a `BEGIN` and pin the client automatically?

Pinning a client based on SQL parsing is fragile — `BEGIN`, `START TRANSACTION`, `BEGIN ISOLATION LEVEL …`, and savepoints all start transaction-like state, and reliably parsing every variant in a driver is a different project. Auto-pinning would also hide the cost: people would write apparently innocent `pool.query` calls that quietly hold a connection out of the pool until much later. Explicit `pool.connect()` makes the lifetime visible and surfaces leaks fast — you exhaust the pool quickly when you forget to release. The footgun is that the warning sits in one sentence of the docs, easy to skip past.
