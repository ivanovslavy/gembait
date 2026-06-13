You set up logical replication six months ago. (Logical replication is the way one PostgreSQL database copies specific tables, row by row, into another one.) The publisher lives on your reporting cluster; the subscriber lives on your analytics warehouse. It just works. Every few weeks an engineer adds a table to the publication, runs `ALTER SUBSCRIPTION my_sub REFRESH PUBLICATION` on the analytics side, and gets on with their day.

Then on May 14th, 2026, the PostgreSQL release announcement landed in your inbox. Eleven CVEs (a CVE is a publicly tracked security flaw with an official ID). Among the eight "smaller" ones, this line:

> SQL injection in PostgreSQL logical replication `ALTER SUBSCRIPTION ... REFRESH PUBLICATION` allows a subscriber table creator to execute arbitrary SQL with the subscription's publication-side credentials.

Wait. The subscriber can run SQL on the publisher? Through a `REFRESH PUBLICATION`?

That's CVE-2026-6638. Its severity score is 3.7 out of 10, so the trackers won't yell at you, but the implication is uncomfortable. For three years, every `REFRESH PUBLICATION` on a Postgres 16 / 17 / 18 cluster was glueing a SQL command together out of the subscriber's table names, sending it to the publisher, and trusting that nobody on the subscriber side had ever created a table with an apostrophe in the name.

This is a story about a trust boundary — a line where one side stops trusting input from the other — that nobody told us existed. Here's how it works, and what to do about it.

## The Problem

Logical replication has two sides. The publisher owns the truth. The subscriber pulls changes. The simple mental picture: data flows publisher → subscriber. Authority flows the same way. The subscriber connects with a login that the publisher's `pg_hba.conf` (the file that says who's allowed to connect) recognises. The publisher decides what's allowed.

What the docs don't spell out is that `REFRESH PUBLICATION` quietly reverses that flow. When the subscriber decides "let me sync my list of replicated tables", it doesn't just receive a list. It builds a query, sends it to the publisher, and the publisher runs it using the subscription's login on the publisher side.

That query, until commit `cb35d7306`, looked roughly like this:

```sql
SELECT ...
FROM pg_publication_tables
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND ...
```

The bug, in the words of the release note:

> `ALTER SUBSCRIPTION ... REFRESH PUBLICATION` interpolated schema and relation names into SQL commands without quoting them, allowing execution of arbitrary SQL on the publisher.

The table names came from the *subscriber's* own catalog. A subscriber-side user who's allowed to create tables in any schema could create one named, in the test case Noah Misch added, `tab'le`. The apostrophe ends the text string in the publisher's query early. Anything you type after it gets read as live SQL — that's a SQL injection, where attacker text smuggles itself in as commands.

This has been quietly true since PostgreSQL 16, where commit `875693019053b8897ec3983e292acbb439b088c3` first pasted those names in without quoting them. Three years.

How realistic is it in the wild? The score of 3.7 breaks down as: it's tricky to pull off, you need only low privileges, and a human has to take an action for it to fire. Translation: the attacker needs a foothold on the subscriber, and someone needs to run `REFRESH PUBLICATION` after the malicious table is created. This is not a remote, no-login worm. But it's the kind of bug that punches straight through careful least-privilege design. You gave the analytics warehouse a low-privilege account. You scoped the publisher role narrowly. And the subscriber can *still* drive arbitrary SQL on the publisher, because the subscriber gets to write part of the query text.

## The Debugging Dance

If you've never read the replication code on the subscriber side, your first reaction is flat disbelief. `REFRESH PUBLICATION` is a *read*. It can't possibly do anything sketchy. Stack Overflow opens. Three tabs of `pg_publication_tables`, two tabs of `subscription` docs, one tab of the release notes.

Re-read the description. "Subscriber table creator." So you, on the subscriber side, just create a table with whatever name you want. Then you run `REFRESH PUBLICATION`. Then the publisher does *what* exactly?

You go find the commit. It's in `src/backend/commands/subscriptioncmds.c`, in a function called `check_publications_origin()`. Before the fix, the query builder did the C equivalent of this:

```c
appendStringInfo(&cmd,
    "... AND N.nspname = '%s' AND C.relname = '%s' ...",
    schemaname, relname);
```

That's a `printf` dropping a raw name straight into a SQL command. No quoting helper. No prepared statement. The table name comes in from a list that was gathered earlier from the subscriber's own catalog and walked through during the `REFRESH PUBLICATION` operation.

So the flow, top to bottom, is:

1. Engineer on the subscriber side runs `CREATE TABLE "tab'le" (...)` in any schema they're allowed to create in.
2. Later — minutes, weeks, months — someone on the same cluster runs `ALTER SUBSCRIPTION s REFRESH PUBLICATION`.
3. The walker hits `"tab'le"`, builds a `WHERE C.relname = 'tab'le'` clause, and ships it to the publisher.
4. On the publisher, `'tab'le'` reads as `'tab'` followed by `le'`. That `le'` is the start of injected SQL. The attacker can tack on `; CREATE EXTENSION ...; --` or any other command the publication role is allowed to run.

The "aha" moment is realising that, for this whole code path, the subscriber's catalog gets treated as if it were the publisher's own data. The name checks happen on the subscriber. Nobody reflexively assumes that data flowing *from* subscriber *to* publisher needs the same suspicion as text typed into a web form.

If the publication-side role is replication-only, the damage stays small. But plenty of shops grant that same role broader powers, because publisher and subscriber both run on hardware they own, and locking everything down gets tiring. If that role can also create functions or load an extension, you're now exploitable from the subscriber-side foothold.

The second "aha" is that you can't catch this by reading your own application code. No application code is involved. The injection point is a system table filled in by a `CREATE TABLE`, then harvested by a backend function that builds SQL with `printf`. Scanning your own repo tells you nothing.

![Abstract isometric visualisation of an SQL identifier being protectively wrapped in quotation marks, glowing brackets enclosing a translucent crystal shape, cool teal and violet gradient, no text](/images/blog/postgresql-refresh-publication-sql-injection/mid.webp)

## The Solution

**Step one: upgrade.**

PostgreSQL 18.4, 17.10, and 16.14, released 2026-05-14, contain the fix. The patch wraps the names in `quote_literal_cstr()`, which escapes apostrophes the same way every other safe query layer in the database always has:

```c
appendStringInfo(&cmd,
    "... AND N.nspname = %s AND C.relname = %s ...",
    quote_literal_cstr(schemaname),
    quote_literal_cstr(relname));
```

The test added in the same commit (`src/test/subscription/t/030_origin.pl`) creates a table called `tab'le` and runs `REFRESH PUBLICATION` to confirm the apostrophe makes the round trip harmlessly.

**Step two: tighten the publication-side role.**

Even on a patched cluster, the subscription connects with a login that *can* do things. The role the publisher accepts that connection as should hold `REPLICATION` and nothing more. If you've been carrying broader grants on that role for convenience, this CVE is a good nudge to walk them back:

```sql
\du replicator
```

If it shows `Superuser`, `Create role`, or membership in `pg_read_server_files` / `pg_write_server_files`, those grants widen the blast radius of any future bug in this code path. Replication itself doesn't need them.

**Step three: lock down `CREATE` on the subscriber.**

The CVE only works for users who can create tables on the subscriber. If your subscriber cluster's `public` schema is still wide open — PostgreSQL 15+ closed this by default, but clusters that were `pg_upgrade`'d up from older versions may still carry the loose grant — take it away:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

Good hygiene whether or not this CVE existed.

**Step four: audit for names someone already planted.**

If you run a shared subscriber where users create their own tables, do a one-time check before the upgrade lands:

```sql
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname  ~ $$['"`\\]$$
   OR n.nspname ~ $$['"`\\]$$;
```

Any hit on a subscriber that takes part in logical replication is worth a manual look. A table whose name contains an apostrophe is rare enough in production that finding one actually means something.

The fix itself is small. The hygiene around it is the real work — and it's the same hygiene you should already be doing: minimum privileges, locked-down schemas, and a genuine review of which roles the database trusts. The CVE just puts a number on the cost of skipping that review.

## The Lesson

Two takeaways.

The first is mechanical. Table and schema names are an injection vector, even when nothing in your application code ever touches them. Any time a system component builds SQL by formatting strings, treat every input as hostile — no matter where in the architecture it came from. PostgreSQL itself knows this. This one code path just slipped through.

The second is structural. Trust boundaries in replication don't always run the direction your mental model says they do. When data flows publisher → subscriber, it feels natural to draw the trust arrow the same way: publisher trusted, subscriber not. But protocol-level chatter needs its own trust analysis. `REFRESH PUBLICATION` is started *by* the subscriber, and the query text it produces is partly *written* by the subscriber. That makes the subscriber, for that one moment, an untrusted input on the publisher side. Nobody designed it that way on purpose — it grew out of a `printf`-style string build that was technically fine for clean ASCII names and quietly wrong for everything else.

## Credit & Further Reading

This article is based on **CVE-2026-6638**, reported and authored by Pavel Kohout (Aisle Research). Reviewed by Nathan Bossart, committed by Noah Misch on 2026-05-11. Thanks to Christophe Pettus (PGX) for the [eleven-CVE breakdown](https://thebuild.com/blog/2026/05/14/eleven-cves-walk-into-a-release/) that surfaced the issue beyond the security mailing list. For deeper reading, see the [official CVE page](https://www.postgresql.org/support/security/CVE-2026-6638/) and the [PostgreSQL 18.4 release notes](https://www.postgresql.org/docs/18/release-18-4.html).

## Frequently Asked Questions

### Do I need to act if I don't use logical replication?

No. The bug lives entirely inside the `ALTER SUBSCRIPTION ... REFRESH PUBLICATION` code path. If your cluster has no `CREATE SUBSCRIPTION` objects, `check_publications_origin()` never runs and there's nothing to exploit. Streaming (physical) replication is unaffected — it never queries the subscriber's catalog at all. You should still upgrade for the other ten CVEs in the same release (three of them scored 8.8 with practical attack paths, including a `pg_dump` stack-overwrite from a hostile server), but for this specific issue you can sleep through it.

### My subscriber's `public` schema is open. Is that the actual risk?

Mostly, yes. The exploit needs someone to create a table on the subscriber with a hostile name. Anyone allowed to create tables in any schema can do that — `public` is the easy one because pre-15 clusters left it writable for everyone by default. On 15+ clusters, `public` is locked down by default unless someone explicitly re-opened it. Run `\dn+ public` and check. If you have application roles that legitimately need to create tables in their own schemas, those roles stay a vector, but the attacker still has to wait for a privileged user to run `REFRESH PUBLICATION` afterwards.

### Why is the severity only 3.7 if it's SQL injection on the publisher?

Three reasons. The attacker needs a logged-in account on the subscriber that can create tables. A second person has to run `REFRESH PUBLICATION` after the bad table exists — pure waiting-on-a-human. And the injected SQL runs as the subscription's publisher-side role, which in a well-configured setup is replication-only and can't do much beyond read. Realistic worst case: privilege escalation in a shared setup where the subscription role was granted more power than it needed. Bad, but a long way from "remote, no-login, full takeover".

### Is `pg_createsubscriber` affected too?

Yes, separately. CVE-2026-6476 (scored 7.2) covers a SQL injection in `pg_createsubscriber` where the subscription name is pasted in unsafely and runs as superuser when the tool executes. It only affects PostgreSQL 17 and 18 (16 doesn't ship `pg_createsubscriber`). The same upgrade — 18.4 / 17.10 — patches both. If you build new subscribers from base backups using that tool, treat this one as the more urgent of the pair.

### Can I detect past exploitation?

Partially. The `pg_stat_activity` view from when `REFRESH PUBLICATION` ran would have shown the injected query in its `query` column, but only if you happened to be sampling at that exact second. Server-side `log_statement = 'ddl'` or `'all'` would have caught it in the server log, and you can grep historical logs for odd statements running under the subscription's role. If you don't log DDL today, you can't reconstruct what happened — but turning on DDL logging on the publisher is cheap and worth doing regardless.
