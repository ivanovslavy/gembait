# PostgreSQL Streaming Replication for High Availability

Your database is down. Not slow — down. Every second counts, and if you have no standby ready, you are restoring from a backup instead of failing over in seconds. This is the difference between a two-minute interruption and a two-hour one.

**PostgreSQL streaming replication** is the backbone of any serious high-availability PostgreSQL setup. We use it across our infrastructure at GEMBA IT, including for GembaPay, where payment processing continuity is non-negotiable. Here is how it works and how to set it up.

## How Streaming Replication Works

PostgreSQL uses a mechanism called the **Write-Ahead Log (WAL)** to record every change made to the database before it is written to disk. Streaming replication works by continuously shipping WAL records from the **primary** server to one or more **standby** servers in near real-time.

The standby replays those WAL records against its own copy of the data, staying in sync with the primary. When the primary fails, the standby can be **promoted** — it stops replaying and starts accepting writes, becoming the new primary.

### Synchronous vs. Asynchronous

In **asynchronous** mode (the default), the primary does not wait for the standby to confirm receipt before acknowledging a transaction. This is fast but means you can lose a small amount of data if the primary crashes before the standby catches up.

In **synchronous** mode, the primary waits for at least one standby to confirm it has received the WAL before committing. Zero data loss, but a latency trade-off. For payment-critical data, synchronous is the right call.

## Setting Up the Primary

Start by enabling WAL archiving and replication on the primary. Edit `postgresql.conf`:

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

Then allow the standby to connect for replication in `pg_hba.conf`:

```conf
# pg_hba.conf (primary)
host  replication  replicator  10.0.0.2/32  scram-sha-256
```

Create a dedicated replication user:

```sql
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD 'strong_password_here';
```

Reload PostgreSQL to apply the changes:

```bash
sudo systemctl reload postgresql
```

## Setting Up the Standby

On the standby server, take a base backup from the primary using `pg_basebackup`:

```bash
sudo -u postgres pg_basebackup \
  -h 10.0.0.1 \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -P -Xs -R
```

The `-R` flag is important — it writes a `standby.signal` file and a `postgresql.auto.conf` with the replication connection details automatically.

Add any standby-specific settings to `postgresql.conf` on the standby:

```conf
# postgresql.conf (standby)
hot_standby = on
hot_standby_feedback = on
```

Start PostgreSQL on the standby and check that replication is active:

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

A `state` of `streaming` means everything is working. The `replication_lag_bytes` column is your most immediate health indicator — it should stay close to zero under normal load.

On the standby, confirm it is in recovery mode:

```sql
SELECT pg_is_in_recovery();
-- Returns: true
```

## Failover and Promotion

If the primary becomes unavailable, promote the standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

Or create a `trigger` file that the standby watches (configure the path in `recovery.conf` or `postgresql.auto.conf`). As of PostgreSQL 12+, promotion via `pg_ctl promote` or a trigger file are both supported cleanly.

After promotion, update your application's database connection string to point to the new primary. If you use **PgBouncer** or a virtual IP (we use both), this switch can happen transparently to the application.

### Automating Failover with Patroni

For production systems where manual failover is not acceptable, **Patroni** is the standard tool. It runs as a daemon on each PostgreSQL node, uses a distributed consensus store (etcd, Consul, or ZooKeeper) to elect a leader, and handles automatic failover and re-registration of old primaries as standbys.

The Patroni setup deserves its own post, but if you are running PostgreSQL at any meaningful scale, it is worth the investment.

## Monitoring Replication Lag

Replication lag is the metric to watch. A standby that is hours behind is not a useful failover target. Set up alerts on:

- `pg_stat_replication.replay_lag` (seconds) — built-in since PostgreSQL 10
- WAL receiver status on the standby via `pg_stat_wal_receiver`
- Disk usage on the primary's WAL directory — if the standby falls too far behind, WAL segments accumulate

A simple Prometheus query via `postgres_exporter` covers all of this. We run this on every PostgreSQL node we manage.

## Key Takeaways

Streaming replication is not complex to configure, but it does require deliberate decisions: synchronous vs. asynchronous, manual vs. automated failover, and how your application handles a primary switchover.

At GEMBA IT, we run PostgreSQL streaming replication with synchronous commit for transactional data, hot standby queries routed through PgBouncer, and Patroni handling automated promotion. The result is a setup where a primary failure results in a failover measured in seconds, not minutes.

If you are building on PostgreSQL and availability matters, start here.

---

*Need help designing or auditing your PostgreSQL replication setup? [Get in touch with GEMBA IT](https://gembait.com/contact) — database architecture is one of the things we do every day.*
