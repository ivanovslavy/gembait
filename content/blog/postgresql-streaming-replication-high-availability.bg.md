# PostgreSQL стрийминг репликация за висока наличност

Базата данни е спряла. Не е бавна — спряла е напълно. Всяка секунда е важна, и ако нямате готов standby, вместо failover за секунди се оказвате в ситуация на възстановяване от backup за часове. Точно това е разликата между двуминутно и двучасово прекъсване.

**PostgreSQL стрийминг репликацията** е основата на всеки сериозен setup за висока наличност с PostgreSQL. Използваме я в цялата ни инфраструктура в GEMBA IT — включително за GembaPay, където непрекъснатостта на обработката на плащания не е опция. Ето как работи и как се конфигурира.

## Как работи стрийминг репликацията

PostgreSQL използва механизъм, наречен **Write-Ahead Log (WAL)** — всяка промяна в базата данни се записва там преди да бъде приложена на диска. Стрийминг репликацията работи, като непрекъснато изпраща WAL записи от **primary** сървъра към един или повече **standby** сървъри почти в реално време.

Standby-ът прилага тези WAL записи върху свое собствено копие на данните и остава синхронизиран с primary-а. При отказ на primary-а, standby-ът може да бъде **промоциран** — спира да прилага записи и започва да приема записвания, ставайки новия primary.

### Синхронен срещу асинхронен режим

В **асинхронен** режим (по подразбиране) primary-ът не чака standby-ът да потвърди получаването преди да потвърди транзакцията. Това е бързо, но означава, че при срив може да изгубите малко данни, ако standby-ят не е наваксал.

В **синхронен** режим primary-ът изчаква поне един standby да потвърди получаването на WAL преди да commit-не. Нулева загуба на данни, но с компромис по латентност. За данни, свързани с плащания, синхронният режим е правилният избор.

## Конфигуриране на primary-а

Започнете с активиране на WAL archiving и репликация на primary-а. Редактирайте `postgresql.conf`:

```conf
# postgresql.conf (primary)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 512MB
listen_addresses = '*'

# За синхронна репликация (препоръчително за критични данни)
synchronous_commit = on
synchronous_standby_names = 'standby01'
```

После позволете на standby-а да се свързва за репликация в `pg_hba.conf`:

```conf
# pg_hba.conf (primary)
host  replication  replicator  10.0.0.2/32  scram-sha-256
```

Създайте специален потребител за репликация:

```sql
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD 'strong_password_here';
```

Презаредете PostgreSQL за да приложите промените:

```bash
sudo systemctl reload postgresql
```

## Конфигуриране на standby-а

На standby сървъра направете базов backup от primary-а с `pg_basebackup`:

```bash
sudo -u postgres pg_basebackup \
  -h 10.0.0.1 \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -P -Xs -R
```

Флагът `-R` е важен — той автоматично записва файл `standby.signal` и `postgresql.auto.conf` с данните за репликационната връзка.

Добавете специфични настройки за standby-а в `postgresql.conf`:

```conf
# postgresql.conf (standby)
hot_standby = on
hot_standby_feedback = on
```

Стартирайте PostgreSQL на standby-а и проверете дали репликацията работи:

```bash
sudo systemctl start postgresql
```

## Проверка на репликацията

На primary-а направете заявка към `pg_stat_replication`, за да потвърдите, че standby-ът е свързан и стриймва:

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

`state` равно на `streaming` означава, че всичко работи. Колоната `replication_lag_bytes` е най-непосредственият ви здравен индикатор — при нормално натоварване трябва да остава близо до нула.

На standby-а потвърдете, че е в режим recovery:

```sql
SELECT pg_is_in_recovery();
-- Връща: true
```

## Failover и промоция

Ако primary-ът стане недостъпен, промоцирайте standby-а:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

Или използвайте trigger файл, който standby-ят следи (конфигурирайте пътя в `recovery.conf` или `postgresql.auto.conf`). От PostgreSQL 12 насам и двата метода работят добре.

След промоцията обновете connection string-а на приложението ви, за да сочи към новия primary. Ако използвате **PgBouncer** или виртуален IP (ние използваме и двете), превключването може да стане прозрачно за приложението.

### Автоматизиране на failover с Patroni

За production системи, при които ръчен failover не е приемлив, **Patroni** е стандартният инструмент. Работи като daemon на всеки PostgreSQL нод, използва distributed consensus store (etcd, Consul или ZooKeeper) за избор на лидер и управлява автоматичния failover и повторната регистрация на стари primary-и като standby-и.

Настройката на Patroni заслужава отделна статия, но ако управлявате PostgreSQL в по-голям мащаб, инвестицията си заслужава.

## Мониторинг на репликационното изоставане

Репликационното изоставане (replication lag) е метриката, която трябва да следите. Standby, който изостава с часове, не е полезна цел за failover. Настройте alerts за:

- `pg_stat_replication.replay_lag` (секунди) — вградено от PostgreSQL 10 насам
- Статус на WAL receiver на standby-а чрез `pg_stat_wal_receiver`
- Използване на диск в WAL директорията на primary-а — ако standby-ят изостане твърде много, WAL сегментите се натрупват

Прост Prometheus query чрез `postgres_exporter` покрива всичко това. Ние го изпълняваме на всеки PostgreSQL нод, който управляваме.

## Ключови изводи

Стрийминг репликацията не е сложна за конфигуриране, но изисква обмислени решения: синхронен или асинхронен режим, ръчен или автоматизиран failover и как приложението ви се справя с превключването на primary.

В GEMBA IT работим с PostgreSQL стрийминг репликация със synchronous commit за транзакционни данни, hot standby заявки, маршрутизирани през PgBouncer, и Patroni за автоматизирана промоция. Резултатът е setup, при който отказ на primary-а води до failover, измерван в секунди, а не в минути.

Ако изграждате върху PostgreSQL и наличността е важна за вас — започнете оттук.

---

*Имате нужда от помощ при проектиране или одит на вашата PostgreSQL репликационна среда? [Свържете се с GEMBA IT](https://gembait.com/contact) — базовата архитектура е нещо, с което се занимаваме всеки ден.*
