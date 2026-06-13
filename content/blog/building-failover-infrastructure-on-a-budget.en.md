# Building Failover Infrastructure on a Budget

Most businesses assume staying online costs a fortune. They picture dedicated hardware, expensive contracts, and a big operations team. The truth is simpler: with the right setup and a provider like Hetzner, you can get rock-solid uptime for very little money.

At GEMBA IT, all of our infrastructure — including GembaPay — runs on Hetzner servers in Germany. Here's how we keep things running through a failure, automatically, without paying enterprise prices.

## What "Failover" Actually Means

Failover is just the switch from a broken part to a healthy backup — done automatically or by hand. It applies everywhere: the server, the database, the network, the app. Think of it like a spare tire that mounts itself the moment one goes flat. When something breaks — and it will — a good setup spots the problem and recovers before most people notice.

The goal isn't to stop failures from happening. The goal is to shrink the gap between "it broke" and "it's working again."

## The Infrastructure Stack

Our setup leans on three layers of backup:

1. **Two application servers** in an active-passive setup (one live, one waiting) behind a **floating IP**
2. **PostgreSQL streaming replication** with a hot standby — a second database kept in step with the first
3. **Automated health checks** that trigger the IP switch

Everything runs on Hetzner Cloud and Hetzner dedicated servers. For most workloads, two CX32 instances give you plenty of room to absorb a failure on the main server with capacity to spare.

### Why Hetzner

Hetzner is cheap, the network is fast, and — this is the key part — it lets you control a floating IP through an API. A **floating IP** is an internet address you own and can move between servers with a single API call in under a second. That's the heart of our failover: when the main server dies, a script points the floating IP at the standby, and traffic follows along.

## Server-Level Failover

The main and standby servers run the exact same app. We use **Ansible** (a tool that pushes config changes to many servers at once) to keep them identical — any change made to the main server lands on the standby too.

A small health check script runs on the standby every 30 seconds. It tries to open a connection to the main server and check its health page. If both fail twice in a row, the script calls the Hetzner API and moves the floating IP over:

```bash
#!/bin/bash
FLOATING_IP_ID="your-floating-ip-id"
STANDBY_SERVER_ID="your-standby-server-id"
HETZNER_TOKEN="your-api-token"

curl -s -X POST \
  -H "Authorization: Bearer $HETZNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"server\": $STANDBY_SERVER_ID}" \
  "https://api.hetzner.cloud/v1/floating_ips/$FLOATING_IP_ID/actions/assign"
```

The whole switch takes under three seconds, and nobody has to touch DNS. Apps talking to the floating IP just reconnect on their own.

## Database Failover with PostgreSQL

The database layer uses **PostgreSQL streaming replication** in synchronous mode. In plain terms: the main database copies every change to the standby in real time, and waits for the standby to confirm before calling a write done. If the main one dies, we promote the standby to take over:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

We walked through the full replication setup in our [PostgreSQL streaming replication post](/blog/postgresql-streaming-replication-high-availability). For failover specifically, the health check script handles the promotion automatically before it moves the floating IP — the app sees a quick blip on its connection, reconnects to the same IP, and goes right back to writing, now to the freshly promoted main database.

### Replication Lag Monitoring

A standby is only a useful backup if it's actually keeping up. We watch `pg_stat_replication.replay_lag` with Prometheus (a monitoring tool) and raise an alert if the standby falls more than five seconds behind. In practice, on a Hetzner private network, that lag stays under 10ms.

## Application-Level Resilience

Failover at the infrastructure level handles hardware and OS crashes. But the app itself has to ride out that brief reconnect window without choking. A few things we do:

- **Retry logic** on database connections — three tries with a 500ms pause between them handles most reconnects
- **Connection pooling** via PgBouncer, which holds client connections steady while the standby is being promoted
- **Stateless application servers** — session data lives in the database, not in memory, so switching servers doesn't log anyone out

## What This Costs

For reference, our production setup runs on:
- 2× Hetzner CX32 (4 vCPU, 8GB RAM) — €20/month each
- 1× Floating IP — €3.81/month
- Private network — free
- Backups — €4/month per server

Total: under €50/month for a setup that survives a main-server failure on its own, in seconds. A comparable managed high-availability setup from a big cloud provider starts at several hundred euros a month.

## What This Covers and What It Doesn't

This setup handles the failures that actually happen most: server crashes, hardware faults, and OS-level trouble. It is not a full disaster recovery plan. If both servers sit in the same Hetzner datacenter and that whole datacenter goes dark, moving the floating IP won't save you.

For most businesses, that single-datacenter risk is fine to live with. If you truly need to survive losing a whole region, we add a cold standby in a second location — but that's a separate design choice with its own cost trade-offs.

## Key Takeaways

Great uptime doesn't require a great budget. A floating IP, a standby server, PostgreSQL replication, and a 50-line health check script cover the failures you'll actually run into.

At GEMBA IT, this setup has delivered over 99.9% uptime across our production workloads. The money goes into the design, not the monthly bill.

---

*Building infrastructure that needs to stay up? [Talk to GEMBA IT](https://gembait.com/contact) — we design and manage high-availability systems for businesses that can't afford downtime.*
