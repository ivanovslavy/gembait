---
title: "PostgreSQL REFRESH PUBLICATION SQL Injection"
slug: "postgresql-refresh-publication-sql-injection"
date: "2026-05-18"
lastUpdated: "2026-05-18"
author: "GEMBA IT team"
cluster: "backend-infrastructure"
tags:
  - postgresql
  - logical-replication
  - cve-2026-6638
  - sql-injection
  - security
  - alter-subscription
readingTime: 9
excerpt: "CVE-2026-6638: until PostgreSQL 18.4, REFRESH PUBLICATION built SQL from subscriber table names without quoting them. Here is how the trust boundary slipped, and what to do."
hero: "/images/blog/postgresql-refresh-publication-sql-injection/hero.webp"
heroRetina: "/images/blog/postgresql-refresh-publication-sql-injection/hero@2x.webp"
midImage: "/images/blog/postgresql-refresh-publication-sql-injection/mid.webp"
midImageRetina: "/images/blog/postgresql-refresh-publication-sql-injection/mid@2x.webp"
---

You set up logical replication six months ago. Publisher on the reporting cluster, subscriber on the analytics warehouse. It just works. Every few weeks an engineer adds a table to the publication, runs `ALTER SUBSCRIPTION my_sub REFRESH PUBLICATION` on the analytics side, and life moves on.

Then on May 14th, 2026, the PostgreSQL release announcement landed in your inbox. Eleven CVEs. Among the eight "smaller" ones, this line:

> SQL injection in PostgreSQL logical replication `ALTER SUBSCRIPTION ... REFRESH PUBLICATION` allows a subscriber table creator to execute arbitrary SQL with the subscription's publication-side credentials.

Wait. The subscriber can run SQL on the publisher? Through a `REFRESH PUBLICATION`?

That's CVE-2026-6638. CVSS 3.7, so the trackers won't yell at you, but the implication is uncomfortable. For three years, every `REFRESH PUBLICATION` on a Postgres 16 / 17 / 18 cluster was building a SQL string from the subscriber's table names, sending it to the publisher, and trusting that nobody on the subscriber side had ever created a table with an apostrophe in the name.

This is a story about a trust boundary that nobody told us existed. Here's how it works, and what to do about it.

## The Problem

Logical replication has two sides. The publisher owns the truth. The subscriber pulls changes. Mental model: data flows publisher → subscriber. Authority flows the same direction. The subscriber connects with a role that the publisher's `pg_hba.conf` recognises. The publisher decides what's allowed.

What the docs don't spell out is that `REFRESH PUBLICATION` quietly reverses that flow. When the subscriber decides "let me sync my list of replicated tables", it doesn't just receive a list. It builds a query, sends it to the publisher, and the publisher executes it under the subscription's publication-side credentials.

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

The relation names came from the *subscriber's* `pg_class`. A subscriber-side user with `CREATE` privilege on any schema could create a table named, in the test case Noah Misch added, `tab'le`. The apostrophe ends the string literal in the publisher's query. Anything after it parses as SQL.

This has been quietly true since PostgreSQL 16, where commit `875693019053b8897ec3983e292acbb439b088c3` introduced the unquoted interpolation. Three years.

How realistic is it in the wild? CVSS gave it 3.7 — Attack Complexity High, Privileges Required Low, User Interaction Required. Translation: the attacker needs a foothold on the subscriber, and someone needs to run `REFRESH PUBLICATION` after the malicious table is created. Not a remote unauthenticated worm. But it is the kind of bug that pierces straight through least-privilege design: you carefully gave the analytics warehouse a low-privilege account, you scoped the publisher role narrowly, and the subscriber can still drive arbitrary SQL on the publisher because the subscriber gets to author part of the query text.

## The Debugging Dance

If you've never read the logical-replication code path on the subscriber side, your first instinct is disbelief. `REFRESH PUBLICATION` is a *read*. It can't possibly do anything sketchy. Stack Overflow opens. Three tabs of `pg_publication_tables`, two tabs of `subscription` docs, one tab of the release notes.

Re-read the description. "Subscriber table creator." So you, on the subscriber side, just create a table with whatever name you want. Then you run `REFRESH PUBLICATION`. Then the publisher does *what* exactly?

You go find the commit. `src/backend/commands/subscriptioncmds.c`, function `check_publications_origin()`. Before the fix, the query builder used the C equivalent of:

```c
appendStringInfo(&cmd,
    "... AND N.nspname = '%s' AND C.relname = '%s' ...",
    schemaname, relname);
```

That's a `printf` into a SQL command. No `quote_literal_cstr`. No prepared statement. The relation name comes in from a `List *` that was assembled earlier from `pg_class` on the subscriber side, walked through during the `REFRESH PUBLICATION` operation.

So the flow, top to bottom, is:

1. Engineer on the subscriber side runs `CREATE TABLE "tab'le" (...)` in any schema they have `CREATE` on.
2. Later — minutes, weeks, months — someone on the same cluster runs `ALTER SUBSCRIPTION s REFRESH PUBLICATION`.
3. The walker hits `"tab'le"`, builds a `WHERE C.relname = 'tab'le'` clause, and ships it to the publisher.
4. On the publisher, `'tab'le'` parses as `'tab'` followed by `le'`. The `le'` is the start of injected SQL. The attacker can append `; CREATE EXTENSION ...; --` or any DDL the publication role can execute.

The "aha" moment is the realisation that for this whole code path, the subscriber's catalog is treated as if it were the publisher's own data. Identifier checks happen on the subscriber. Nobody reflexively assumes that data going *from* subscriber *to* publisher needs the same paranoia as data coming from a web form.

If the publication-side role is `REPLICATION`-only, the blast radius stays small. But many shops grant the same role broader privileges, because publisher and subscriber both run on infrastructure they own and least-privilege fatigue is real. If that role can also `CREATE FUNCTION` or call an arbitrary extension, you're now exploitable from the subscriber-side foothold.

The second "aha" is that you can't detect this by reading your own application code. No application code is involved. The injection point is a system table populated by a `CREATE TABLE` statement, harvested by a backend function that builds SQL with `printf`. Static analysis on your repo will tell you nothing.

![Abstract isometric visualisation of an SQL identifier being protectively wrapped in quotation marks, glowing brackets enclosing a translucent crystal shape, cool teal and violet gradient, no text](/images/blog/postgresql-refresh-publication-sql-injection/mid.webp)

## The Solution

**Step one: upgrade.**

PostgreSQL 18.4, 17.10, and 16.14, released 2026-05-14, contain the fix. The patch wraps the identifiers in `quote_literal_cstr()`, which escapes apostrophes the way every parameterised layer in the database has always done:

```c
appendStringInfo(&cmd,
    "... AND N.nspname = %s AND C.relname = %s ...",
    quote_literal_cstr(schemaname),
    quote_literal_cstr(relname));
```

The test added in the same commit (`src/test/subscription/t/030_origin.pl`) creates a table called `tab'le` and runs `REFRESH PUBLICATION` to confirm the apostrophe round-trips harmlessly.

**Step two: tighten the publication-side role.**

Even on a patched cluster, the subscription connects with credentials that *can* do things. The role the publisher accepts the subscription connection as should hold `REPLICATION` and nothing else. If you've been carrying broader grants on that role for convenience, this CVE is a useful prompt to walk them back:

```sql
\du replicator
```

If it has `Superuser`, `Create role`, or membership in `pg_read_server_files` / `pg_write_server_files`, those grants extend the impact of any future bug in this code path. They aren't needed for replication itself.

**Step three: lock down `CREATE` on the subscriber.**

The CVE is exploitable only by users who can create tables on the subscriber. If your subscriber cluster's `public` schema is still wide-open — PostgreSQL 15+ closed this by default, but clusters that were `pg_upgrade`'d from older majors may carry the loose grants forward — revoke `CREATE` from `PUBLIC`:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

Good hygiene independent of the CVE.

**Step four: audit for already-planted names.**

If you operate a multi-tenant subscriber where users create their own tables, run a one-time check before the upgrade lands:

```sql
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname  ~ $$['"`\\]$$
   OR n.nspname ~ $$['"`\\]$$;
```

Any hit on a subscriber that participates in logical replication is worth a manual look. A table whose name contains an apostrophe is rare enough in production that finding one is meaningful.

The fix itself is small. The hygiene around it is the real work, and it's the same hygiene you should already be doing: minimum privileges, locked-down schemas, and an actual review of which roles the database trusts. The CVE just makes the cost of skipping that review concrete.

## The Lesson

Two takeaways.

The first is mechanical. Identifiers are an injection vector, even when nothing in your application code touches them. Any time a system component builds SQL by formatting strings, every input is hostile — no matter where in the architecture it came from. PostgreSQL itself knows this. The code path just slipped through.

The second is structural. Trust boundaries in replication don't run in the direction your mental model says they do. When data flows publisher → subscriber, it's natural to draw the trust arrow the same way: publisher trusted, subscriber not. Protocol-level interactions need their own trust analysis. `REFRESH PUBLICATION` is initiated *by* the subscriber, and the resulting query text is partly *authored* by the subscriber. That makes the subscriber, for that one moment, a trust input on the publisher side. Nobody designed it that way intentionally — it emerged from a `printf`-style string build that was technically correct for ASCII-clean inputs and quietly wrong for everything else.

## Credit & Further Reading

This article is based on **CVE-2026-6638**, reported and authored by Pavel Kohout (Aisle Research). Reviewed by Nathan Bossart, committed by Noah Misch on 2026-05-11. Thanks to Christophe Pettus (PGX) for the [eleven-CVE breakdown](https://thebuild.com/blog/2026/05/14/eleven-cves-walk-into-a-release/) that surfaced the issue beyond the security mailing list. For deeper reading, see the [official CVE page](https://www.postgresql.org/support/security/CVE-2026-6638/) and the [PostgreSQL 18.4 release notes](https://www.postgresql.org/docs/18/release-18-4.html).

## Frequently Asked Questions

### Do I need to act if I don't use logical replication?

No. The bug lives entirely inside the `ALTER SUBSCRIPTION ... REFRESH PUBLICATION` code path. If your cluster has no `CREATE SUBSCRIPTION` objects, `check_publications_origin()` never runs and there is nothing exploitable. Streaming (physical) replication is unaffected — it doesn't query the subscriber's catalog at all. You should still upgrade for the other ten CVEs in the same release (three of them CVSS 8.8 with practical exploitation paths, including a `pg_dump` stack-overwrite from a hostile server), but for this specific issue you can sleep through it.

### My subscriber's `public` schema is open. Is that the actual risk?

Mostly, yes. The exploit requires creating a table on the subscriber with a hostile name. Anyone with `CREATE` on any schema can do that — `public` is the easy one because pre-15 clusters defaulted it to writable for `PUBLIC`. On 15+ clusters, `public` is locked down by default unless someone explicitly re-granted it. Run `\dn+ public` and verify. If you have application roles that legitimately need `CREATE` in their own schemas, those roles remain a vector, but the attacker still has to wait for a privileged user to run `REFRESH PUBLICATION` afterwards.

### Why is the CVSS only 3.7 if it's SQL injection on the publisher?

Three reasons. The attacker needs an authenticated account on the subscriber that can create tables. A second party has to run `REFRESH PUBLICATION` after the bad table is created — pure user-interaction-required. And the injected SQL runs as the subscription's publication-side role, which in a well-configured setup is `REPLICATION`-only and can't do much beyond read. Realistic worst case: privilege escalation in a multi-tenant setup where the subscription role was granted broader privileges than it needed. Bad, but a long way from "remote unauthenticated RCE".

### Is `pg_createsubscriber` affected too?

Yes, separately. CVE-2026-6476 (CVSS 7.2) covers an SQL injection in `pg_createsubscriber` where the subscription name parameter is interpolated unsafely and runs as superuser when the tool executes. It only affects PostgreSQL 17 and 18 (16 doesn't ship `pg_createsubscriber`). The same upgrade — 18.4 / 17.10 — patches both. If you build new subscribers from base backups using that tool, treat this one as the more urgent of the pair.

### Can I detect past exploitation?

Partially. The `pg_stat_activity` view from when `REFRESH PUBLICATION` ran would have logged the injected query in `query`, but only if you happened to be sampling at that exact second. Server-side `log_statement = 'ddl'` or `'all'` would have caught it in the server log, and you can grep historical logs for unusual statements running under the subscription's role. If you don't log DDL today, you can't reconstruct what happened — but enabling DDL logging on the publisher is cheap and worth turning on regardless.
