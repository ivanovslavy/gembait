# PostgreSQL Streaming Replication for High Availability

Your database is down. Not slow — down. Every second counts. And if you don't have a standby ready to take over, you're restoring from a backup instead of switching over in seconds. That's the difference between a two-minute hiccup and a two-hour outage that everyone remembers.

**PostgreSQL streaming replication** is the backbone of any serious high-availability PostgreSQL setup. (High availability just means the system keeps serving users even when one machine dies.) We use it across our infrastructure at GEMBA IT, including for GembaPay, where payment processing can't be allowed to stop. Here's how it works and how to set it up.

## How Streaming Replication Works

PostgreSQL keeps a running diary of every change before it touches the actual data files. That diary is the **Write-Ahead Log (WAL)**. Streaming replication works by continuously shipping those WAL records from the **primary** server (the one taking writes) to one or more **standby** servers in near real-time.

Each standby replays those WAL records against its own copy of the data, staying in step with the primary. When the primary fails, a standby can be **promoted** — it stops replaying and starts accepting writes, becoming the new primary.

Think of it like a scribe reading the original's every edit out loud, and a second scribe copying each one down as it's spoken. If the first scribe collapses, the second already has an up-to-date copy and can pick up the pen.

### Synchronous vs. Asynchronous

In **asynchronous** mode (the default), the primary doesn't wait for the standby to confirm it got the change before telling the client "done". This is fast, but it means you can lose a small amount of data if the primary crashes before the standby has caught up.

In **synchronous** mode, the primary waits for at least one standby to confirm it has the WAL before finalising the transaction. Zero data loss, but you pay for it in a little latency on every write. For payment-critical data, synchronous is the right call.

## Setting Up the Primary

Start by turning on WAL archiving and replication on the primary. Edit `postgresql.conf`:

```conf
# postgresql.conf (primary)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 512MB
listen_addresses = '*'

# For synchronous replication (optional but recommended for critical data)
synchronous_commit = on
synchronous_standby_names = 'standby01'
```

Then let the standby connect for replication in `pg_hba.conf` (the file that controls who's allowed to connect):

```conf
# pg_hba.conf (primary)
host  replication  replicator  10.0.0.2/32  scram-sha-256
```

Create a dedicated user just for replication:

```sql
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD 'strong_password_here';
```

Reload PostgreSQL to apply the changes:

```bash
sudo systemctl reload postgresql
```

## Setting Up the Standby

On the standby server, grab a full copy of the primary using `pg_basebackup` (the tool that clones a running database):

```bash
sudo -u postgres pg_basebackup \
  -h 10.0.0.1 \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -P -Xs -R
```

The `-R` flag is the one to remember — it automatically writes a `standby.signal` file and a `postgresql.auto.conf` with the connection details for replication, so you don't have to.

Add any standby-specific settings to `postgresql.conf` on the standby:

```conf
# postgresql.conf (standby)
hot_standby = on
hot_standby_feedback = on
```

Start PostgreSQL on the standby and check that replication is running:

```bash
sudo systemctl start postgresql
```

## Verifying Replication

On the primary, query the `pg_stat_replication` view to confirm the standby is connected and streaming:

```sql
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  (sent_lsn - replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
```

A `state` of `streaming` means everything is working. The `replication_lag_bytes` column is your most immediate health check — it tells you how far behind the standby is, and it should stay close to zero under normal load.

On the standby, confirm it's in recovery mode (replaying, not yet a primary):

```sql
SELECT pg_is_in_recovery();
-- Returns: true
```

## Failover and Promotion

If the primary goes away, promote the standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

Or create a `trigger` file that the standby watches for (you configure the path in `recovery.conf` or `postgresql.auto.conf`). As of PostgreSQL 12+, both `pg_ctl promote` and a trigger file work cleanly.

After promotion, point your application's database connection string at the new primary. If you use **PgBouncer** (a connection pooler that sits in front of the database) or a virtual IP — we use both — this switch can happen without the application even noticing.

### Automating Failover with Patroni

For production systems where doing failover by hand isn't acceptable, **Patroni** is the standard tool. It runs as a background process on each PostgreSQL node, uses a shared agreement store (etcd, Consul, or ZooKeeper) so the nodes can agree on who's leader, and handles automatic failover and re-registering an old primary as a standby once it comes back.

Setting up Patroni deserves its own post, but if you're running PostgreSQL at any meaningful scale, it's worth the investment.

## Monitoring Replication Lag

Replication lag — how far behind the standby is — is the metric to watch. A standby that's hours behind isn't a useful thing to fail over to. Set up alerts on:

- `pg_stat_replication.replay_lag` (seconds) — built-in since PostgreSQL 10
- WAL receiver status on the standby via `pg_stat_wal_receiver`
- Disk usage on the primary's WAL directory — if the standby falls too far behind, WAL segments pile up and eat the disk

A simple Prometheus query via `postgres_exporter` covers all of this. We run it on every PostgreSQL node we manage.

## Key Takeaways

Streaming replication isn't hard to set up, but it does ask you to make a few deliberate choices: synchronous vs. asynchronous, manual vs. automated failover, and how your application copes when the primary switches under it.

At GEMBA IT, we run PostgreSQL streaming replication with synchronous commit for transactional data, hot standby queries routed through PgBouncer, and Patroni handling automated promotion. The result is a setup where a primary failure means a failover measured in seconds, not minutes.

If you're building on PostgreSQL and availability matters, start here.

---

*Need help designing or auditing your PostgreSQL replication setup? [Get in touch with GEMBA IT](https://gembait.com/contact) — database architecture is one of the things we do every day.*
