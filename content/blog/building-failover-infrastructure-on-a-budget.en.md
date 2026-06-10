# Building Failover Infrastructure on a Budget

Most businesses assume high availability is expensive. They picture dedicated hardware, enterprise SLAs, and large operations teams. The reality is that with the right architecture and a provider like Hetzner, you can get enterprise-grade uptime at a fraction of the cost.

At GEMBA IT, our entire infrastructure — including GembaPay — runs on Hetzner servers in Germany. Here is how we achieve resilient, automated failover without paying enterprise prices.

## What "Failover" Actually Means

**Failover** is the automatic or manual switch from a failed component to a healthy backup. It applies at every layer: server, database, network, and application. A well-designed failover setup means that when something breaks — and it will — your system detects the failure and recovers before most users notice.

The goal is not to prevent failures. The goal is to reduce the time between failure and recovery.

## The Infrastructure Stack

Our setup uses three layers of redundancy:

1. **Two application servers** in an active-passive configuration behind a **floating IP**
2. **PostgreSQL streaming replication** with a hot standby
3. **Automated health checks** that trigger IP reassignment

Everything runs on Hetzner Cloud and Hetzner dedicated servers. For most workloads, two CX32 instances give you enough capacity to handle a primary failure with headroom to spare.

### Why Hetzner

Hetzner offers competitive pricing, solid network performance, and — critically — an API-controlled floating IP feature. A **floating IP** is an IP address you own and can reassign between servers via API in under a second. This is the core mechanism behind our failover: when the primary goes down, a script reassigns the floating IP to the standby, and traffic follows.

## Server-Level Failover

The primary and standby servers run the same application stack. We use **Ansible** to keep them in sync — any configuration change applied to the primary is applied to the standby automatically.

A lightweight health check script runs on the standby every 30 seconds. It attempts a TCP connection and an HTTP health endpoint against the primary. If both fail for two consecutive checks, the script calls the Hetzner API to reassign the floating IP:

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

The entire DNS-transparent switchover takes under three seconds. Applications connected to the floating IP reconnect automatically.

## Database Failover with PostgreSQL

The database layer uses **PostgreSQL streaming replication** in synchronous mode. The primary streams WAL records to the standby in real-time. If the primary fails, we promote the standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

We covered the full replication setup in our [PostgreSQL streaming replication post](/blog/postgresql-streaming-replication-high-availability). For the failover layer specifically, the health check script handles promotion automatically before reassigning the floating IP — the application sees a brief connection reset, reconnects to the same IP, and continues writing to the newly promoted primary.

### Replication Lag Monitoring

The standby is only useful as a failover target if it is actually in sync. We monitor `pg_stat_replication.replay_lag` via Prometheus and alert if lag exceeds five seconds. In practice, on a Hetzner private network, synchronous replication lag is under 10ms.

## Application-Level Resilience

Failover at the infrastructure level handles hardware and OS failures. But applications need to handle the brief reconnection window gracefully. A few practices we apply:

- **Retry logic** on database connections — three retries with 500ms backoff handles most reconnection scenarios
- **Connection pooling** via PgBouncer, which buffers client connections during the standby promotion window
- **Stateless application servers** — session state lives in the database, not in memory, so a primary switchover does not discard active sessions

## What This Costs

For reference, our production setup runs on:
- 2× Hetzner CX32 (4 vCPU, 8GB RAM) — €20/month each
- 1× Floating IP — €3.81/month
- Private network — free
- Backups — €4/month per server

Total: under €50/month for an architecture that handles primary failures automatically in seconds. A comparable managed HA setup from a major cloud provider starts at several hundred euros per month.

## What This Covers and What It Doesn't

This setup handles the most common failure scenarios: server crashes, hardware failures, and OS-level issues. It does not replace a full disaster recovery plan. If both servers are in the same Hetzner datacenter and that datacenter has an outage, your floating IP reassignment won't help.

For most businesses, the risk profile of a single-datacenter HA setup is acceptable. For workloads that require geographic redundancy, we add a cold standby in a second region — but that's a separate architectural decision with different cost trade-offs.

## Key Takeaways

Enterprise uptime does not require enterprise spending. A floating IP, a standby server, PostgreSQL replication, and a 50-line health check script cover the failure scenarios that actually happen most often.

At GEMBA IT, this architecture has delivered over 99.9% uptime across our production workloads. The investment is in the design, not in the billing.

---

*Building infrastructure that needs to stay up? [Talk to GEMBA IT](https://gembait.com/contact) — we design and manage high-availability systems for businesses that can't afford downtime.*
