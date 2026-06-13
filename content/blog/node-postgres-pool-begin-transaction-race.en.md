You wrote a transaction. It looks like every transaction tutorial you've ever read. `BEGIN`, two `UPDATE`s, `COMMIT`. Tests pass. Staging passes. Two months in production, an account ends up with a debit and no matching credit — money missing, books unbalanced, support ticket open. You read the code three times. The logic is correct. The SQL is correct. The transaction *exists*.

The transaction exists. It just isn't doing what you think it's doing.

Here's the part the node-postgres docs warn about in a single sentence — *do not use transactions with the pool.query method* — and the part nobody internalizes until it bites them: when you call `pool.query('BEGIN')`, then `pool.query('UPDATE …')`, then `pool.query('COMMIT')`, you are not running a transaction. You are running three independent queries that may or may not land on the same database connection. Under low load they happen to. Under real load they don't. And then your money goes missing.

This post is the long version of that one-sentence warning. Why it happens, what the failure looks like in the logs (it usually leaves none), and the four-line pattern that is the only correct way to do this.

## The problem, stated precisely

Open the official node-postgres documentation and find the [transactions page](https://node-postgres.com/features/transactions). Halfway down, in plain prose: *"You **must** use the same client instance for all statements within a transaction. PostgreSQL isolates a transaction to individual clients."* And then the bolded warning: *"This means if you initialize or use transactions with the pool.query method you **will** have problems. Do not use transactions with the pool.query method."*

That `must` and that `will` are doing a lot of work. Postgres' transaction state — the open `BEGIN`, the locks held, the rows visible only to this transaction — is bound to a single TCP connection on the server. If you start a transaction on one connection and run an `UPDATE` on a different one, the `UPDATE` happens in autocommit mode against the bare table. Postgres has no idea your application *thinks* the two statements are related.

Now layer in pg-pool. Every `pool.query()` call asks the pool for any free client. Under no concurrency, the pool hands you the same client every time, because there's only one and the previous query just released it. Your tests pass. Under concurrency, the pool hands you whatever is free. The `BEGIN` lands on Client A. By the time the next `await` resolves, Client A has been released and grabbed by another request, and your `UPDATE` lands on Client B.

The brutal part: nothing errors. Postgres doesn't care. Your `BEGIN` opens a transaction on Client A and that transaction sits open until Client A is reused for something else (which silently `ROLLBACK`s by reset, or just keeps idling). Your `UPDATE` runs in autocommit on Client B and is permanently committed. Your `COMMIT` runs on Client C against no open transaction and is a no-op.

Three statements. Three clients. Zero atomicity. One angry CFO.

## The Debugging Dance

You don't reach the right answer first. Nobody does. The first instinct, when you see a half-applied transaction in production, is to assume your `try/catch` is wrong. You re-read the error path. You add a `console.log` before the `ROLLBACK`. You reproduce locally — and of course it works locally, because `npm test` runs one request at a time and the pool dutifully hands you the same client over and over.

So the second instinct is "concurrency bug somewhere upstream." You check whether two requests can race on the same row. You add a `SELECT … FOR UPDATE`. You add a unique index to be safe. The bug doesn't go away, because the bug isn't on the row — it's on the connection. You're locking with one client and updating with another, and the lock you took is on a connection that gets released before you ever use it.

Third instinct: blame the pool sizing. *"The pool must be too small. We're getting weird reuse."* You bump `max` from 10 to 50. The bug gets less frequent — because there are now more clients, the chance two consecutive `pool.query` calls land on the same one is higher — and you ship that and call it solved. It comes back the next time traffic doubles.

At this point Stack Overflow is open in eight tabs, all variants of *"node-postgres transaction not rolling back"*, and you're starting to suspect the library. You open the [issues tracker on brianc/node-postgres](https://github.com/brianc/node-postgres/issues/35) and find a question from 2011 — *"Long-running transaction within a pooled client"* — that asks essentially what you're asking now: when I use a pool, am I guaranteed to keep the same connection between queries? The answer, scattered across that thread and a dozen others, is *no, never, you must hold the client yourself*.

The aha moment is small and embarrassing. You weren't holding the client. You were calling `pool.query` three times and the pool was doing what it advertises: giving you any free client, every time, with no memory of what you ran a millisecond ago. Your transaction was an illusion built on top of three unrelated round-trips to the database.

![Abstract isometric visualization of one transaction fragmenting across three different connection slots, with broken arcs and a dashed lock symbol on the wrong slot.](/images/blog/node-postgres-pool-begin-transaction-race/mid.webp)

## The Solution

There is exactly one correct pattern. Burn it into muscle memory. Acquire a client, use that *same* client variable for `BEGIN`, every query inside the transaction, and `COMMIT` or `ROLLBACK`, then release it in `finally`. Anything else is a footgun.

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

Why this works is exactly why the broken version doesn't. `pool.connect()` checks one client out of the pool and *promises* it to you for as long as you hold it. While you hold it, no other request can be handed the same client. When you call `client.query`, you go to that one TCP connection. `BEGIN` opens a transaction on the server side of that connection. Every subsequent `client.query` is on the same connection, in the same transaction. `COMMIT` closes it. `client.release()` returns the connection to the pool — clean, ready, no transaction state left behind.

The non-obvious bits worth pinning to the wall:

**`finally` is non-negotiable.** If `client.release()` doesn't run on every code path, that client is leaked from the pool's perspective. After `max` leaks, the next `pool.connect()` waits forever (or hits `connectionTimeoutMillis` and surfaces a misleading error). The `try / catch / finally` shape above is correct; resist the urge to "simplify" by moving release into the `try`.

**`ROLLBACK` itself can throw.** If the connection died mid-transaction, the `ROLLBACK` will fail with `"Client was closed and is not queryable"` or similar. Swallowing that with `.catch(() => {})` is intentional — the transaction is gone either way, and you want the *original* error to bubble up to your caller, not the rollback's secondary error. This pattern shows up in the brianc/node-postgres issue tracker repeatedly because people get confused about which error to surface.

**Don't reuse the variable name.** A common variant of this bug is having both `pool` and `client` in scope and accidentally writing `pool.query('UPDATE …')` instead of `client.query('UPDATE …')` inside the transaction body. The single-letter difference compiles, runs, and silently breaks the transaction. Linting won't catch it. Code review barely catches it. The only defence is a wrapper function that hides the pool entirely.

The wrapper is worth writing once and using everywhere:

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

Once `pool` isn't in scope inside the callback, the `pool.query` typo is impossible. Every transaction in your codebase looks identical. New hires can't get this wrong on day one because there's only one shape to copy.

## The Lesson

Connection pools are convenience for stateless work. Transactions are state. The two only meet at one specific API call — `pool.connect()` — and any code that takes a shortcut around that call is, by construction, broken under concurrency. It will pass tests. It will pass code review by people who haven't been bitten yet. It will run for months in staging. And then, on the busiest day of your year, two requests will race for the same client and your invariants will quietly come apart.

The general principle: when an API hands you "any available worker" and another part of your system needs "the same worker for the next N calls," you cannot bridge those two semantics with hope. You need a primitive that pins one to the other, and you need to wrap the pin in a function that makes it impossible to skip. `pool.connect()` plus a `withTransaction` helper is that wrap. Anything looser is a future incident waiting on a calendar.

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
