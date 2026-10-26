---
title: "Why Postgres RLS Leaks Between Tenants"
slug: "postgres-rls-leaks-between-tenants-pool"
date: "2026-10-26"
lastUpdated: "2026-10-26"
author: "GEMBA IT team"
cluster: "backend-infrastructure"
tags: ["postgresql", "row-level-security", "node-postgres", "multi-tenant", "connection-pool", "node-js"]
readingTime: 6
excerpt: "Postgres row-level security showed one tenant another tenant's rows under load. The policy was fine — the connection pool was handing out sessions with memory."
hero: "/images/blog/postgres-rls-leaks-between-tenants-pool/hero.webp"
heroRetina: "/images/blog/postgres-rls-leaks-between-tenants-pool/hero@2x.webp"
midImage: "/images/blog/postgres-rls-leaks-between-tenants-pool/mid.webp"
midImageRetina: "/images/blog/postgres-rls-leaks-between-tenants-pool/mid@2x.webp"
---

# Why Postgres RLS Leaks Between Tenants

Picture the support ticket. A customer opens their risk register and sees three rows that belong to another company. Not an error. Just someone else's data, sitting there as if it had always been theirs.

You have row-level security switched on — RLS, Postgres's built-in way of hiding rows from anyone who isn't allowed to see them. Every request sets the tenant before it queries. You can't reproduce it on your laptop. It only happens under load, and only sometimes.

That's what one developer brought to Stack Overflow in September: a multi-tenant Node app on PostgreSQL 16, the `pg` library (node-postgres), a textbook RLS policy — and "a small number of requests return rows belonging to a different tenant."

The uncomfortable part: the code in the question is correct. The leak comes from what the code *around* it leaves behind on a shared connection.

## The problem

The policy is as simple as RLS gets: show a row only when its `tenant_id` matches a session variable called `app.current_tenant`.

```sql
CREATE POLICY tenant_isolation ON risks
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

Each request checks a client out of the pool, sets the tenant, queries, and gives the client back:

```js
const client = await pool.connect();
try {
  await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
  const rows = await client.query('SELECT * FROM risks');
  return rows.rows;
} finally {
  client.release();
}
```

Expected: each request sees only its own tenant. Actual: under concurrent load, a few requests see another tenant's rows.

The asker had a workaround — `SET LOCAL` inside an explicit transaction made the leak disappear. But, in their words, "I wanted to understand why the first version fails rather than just switching." Good instinct.

It isn't a one-off — ["Enforcing row-level security in a shared postgres pool"](https://stackoverflow.com/questions/77272972/enforcing-row-level-security-in-a-shared-postgres-pool) asks the same thing. Laurenz Albe, a PostgreSQL core contributor, left the key comment: "That cannot happen if the whole per-request code runs in a single session." So — why wasn't it?

## The debugging dance

First instinct: the policy is wrong. Run it in `psql` as one user, one tenant. Perfect isolation. Not the policy.

Second guess: the pool is sharing one client between two requests. It isn't — `pool.connect()` gives you a client nobody else can touch until you call `release()`.

By now the load test has run forty times and leaked in six. Stack Overflow is open in eight tabs. One tab suggests a dedicated connection per tenant. The asker tried it: works, until a few dozen tenants. Dead end.

Then the thought that makes your stomach drop. A Postgres connection isn't a pipe. It's a *session*, and a session has memory. `SET` (and `set_config(..., false)`) is session-scoped — the docs say the value "will persist until the end of the session, unless overridden by another SET." The pool never ends the session when you release a client. It hands the same session, still carrying the last tenant, to the next caller.

So isolation only holds if **every statement** touching `risks` runs on a connection whose tenant was set *in that same request*. Break that once, anywhere, and you inherit a stranger's tenant.

The accepted answer, from Zegarek, lists where that "once, anywhere" usually hides:

- A `pool.query()` somewhere instead of `client.query()`. Each call "is free to end up in a completely different session, with a different tenant set."
- `SET LOCAL` outside a transaction. Postgres warns `SET LOCAL can only be used in transaction blocks` — then does nothing.
- A unit of work that never sets the tenant, so it keeps "whatever some other worker left it."
- A second pool underneath yours — PgBouncer in transaction mode, pgpool-II — swapping the backend connection mid-request.
- A default for `app.current_tenant` set via `ALTER DATABASE` or `ALTER ROLE`, which returns after every `RESET ALL`.

![Abstract isometric illustration of a transparent capsule carrying a glowing token through one segment of a pipeline that clears itself after the capsule passes, teal and violet](/images/blog/postgres-rls-leaks-between-tenants-pool/mid.webp)

## The fix

Three layers.

**1. Scope the tenant to a transaction, not a session.** The `true` in `set_config` means "local", same as `SET LOCAL`. Its effect lasts "only till the end of the current transaction, whether committed or not." Even if the next request forgets to set a tenant, it inherits nothing.

```js
export async function withTenant(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await fn(client);   // every query uses *this* client
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

The helper also removes the `pool.query()` temptation: callers get `client`, not the pool. With PgBouncer in transaction mode, the explicit `BEGIN … COMMIT` is also what pins your statements to one backend.

**2. Reset the session on the way back.** To catch leftover state from older code paths, clean the connection on `pg-pool`'s `release` event:

```js
pool.on('release', (err, client) => {
  if (!err) client.query('ROLLBACK; RESET ALL; UNLISTEN *; SELECT pg_advisory_unlock_all();')
    .catch(() => client.release(true)); // destroy on failure
});
```

Why not `DISCARD ALL`? It works, but as Franck Pachot notes in the comments, it also throws away cached plans and the sequence cache, and it can't run inside a transaction block. `RESET ALL` is the part that clears parameters.

**3. Fail closed.** Pass `true` as the second argument to `current_setting()` so a missing tenant returns `NULL` — and `tenant_id = NULL` hides every row. Never give `app.current_tenant` a default. And check who you connect as: table owners and superusers bypass RLS unless you `ALTER TABLE risks FORCE ROW LEVEL SECURITY`.

## The lesson

A connection pool gives you exclusive use. It does not give you a clean slate. Every pooled connection is a session with a memory, and anything you `SET` there is a note left for the next caller.

The rule we follow on the multi-tenant Node and PostgreSQL services at GEMBA IT: per-request state is either transaction-scoped or explicitly reset — never neither. Put it behind one helper, and run a concurrent test that asserts tenant isolation. A leak that shows up "sometimes under load" is the bug a single-user test never finds.

## Credit & further reading

> This article is based on a problem originally discussed in [this Stack Overflow thread](https://stackoverflow.com/questions/80003232/postgres-row-level-security-leaks-across-tenants-when-using-a-pooled-connection). Thanks to `@Muhammad Sufyan` for the clear reproduction case, `@Zegarek` for the solution approach, and `@Franck Pachot`, `@Dunes` and `@Laurenz Albe` for the nuance in the comments. For deeper reading, see the official docs on [row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [SET LOCAL](https://www.postgresql.org/docs/current/sql-set.html) and [DISCARD](https://www.postgresql.org/docs/current/sql-discard.html).

## Frequently Asked Questions

### Does PgBouncer in transaction mode break this?

Yes, unless every tenant-dependent statement runs inside one explicit transaction. In transaction pooling mode, PgBouncer can give each *statement* a different backend connection, so a session-level `SET` lands on one backend and your `SELECT` on another. Use the `withTenant` helper (`set_config(..., true)` inside `BEGIN … COMMIT`), or switch PgBouncer to session mode.

### Should I run DISCARD ALL on every release?

It's the simplest full reset, but a blunt one. It drops prepared statements, cached plans and sequence caches, so each reused connection pays a warm-up cost again — and it fails inside a transaction block. The leaner cleanup from the thread is `ROLLBACK; RESET ALL; UNLISTEN *; SELECT pg_advisory_unlock_all();`. If you rely on prepared statements, move the `PREPARE` calls into the pool's `onConnect` hook.

### Why can't I write SET app.current_tenant = $1?

The original question used exactly that, but `SET` is a utility command and Postgres only substitutes `$1` placeholders in regular statements — `pg` gets back `syntax error at or near "$1"`. The parameterised equivalent is `SELECT set_config('app.current_tenant', $1, true)`. Never string-concatenate the tenant into `SET`; that's an injection point for switching tenants.
