# Replicación Streaming de PostgreSQL para Alta Disponibilidad

La base de datos está caída. No lenta — caída por completo. Cada segundo cuenta, y si no tienes un standby listo, en lugar de un failover en segundos te encuentras restaurando desde un backup durante horas. Esa es la diferencia entre una interrupción de dos minutos y una de dos horas.

La **replicación streaming de PostgreSQL** es la columna vertebral de cualquier configuración seria de alta disponibilidad con PostgreSQL. La usamos en toda nuestra infraestructura en GEMBA IT — incluyendo GembaPay, donde la continuidad del procesamiento de pagos no es negociable. Así es como funciona y cómo configurarla.

## Cómo Funciona la Replicación Streaming

PostgreSQL utiliza un mecanismo llamado **Write-Ahead Log (WAL)** para registrar cada cambio en la base de datos antes de escribirlo en disco. La replicación streaming funciona enviando continuamente registros WAL desde el servidor **primary** hacia uno o más servidores **standby** en tiempo casi real.

El standby aplica esos registros WAL sobre su propia copia de los datos, manteniéndose sincronizado con el primary. Cuando el primary falla, el standby puede ser **promovido** — deja de aplicar registros y comienza a aceptar escrituras, convirtiéndose en el nuevo primary.

### Síncrono vs. Asíncrono

En modo **asíncrono** (el predeterminado), el primary no espera a que el standby confirme la recepción antes de confirmar una transacción. Es rápido, pero significa que puedes perder una pequeña cantidad de datos si el primary cae antes de que el standby se actualice.

En modo **síncrono**, el primary espera a que al menos un standby confirme haber recibido el WAL antes de hacer commit. Cero pérdida de datos, pero con una compensación en latencia. Para datos críticos de pagos, el modo síncrono es la decisión correcta.

## Configuración del Primary

Comienza habilitando el archivado WAL y la replicación en el primary. Edita `postgresql.conf`:

```conf
# postgresql.conf (primary)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 512MB
listen_addresses = '*'

# Para replicación síncrona (recomendado para datos críticos)
synchronous_commit = on
synchronous_standby_names = 'standby01'
```

Luego permite que el standby se conecte para replicación en `pg_hba.conf`:

```conf
# pg_hba.conf (primary)
host  replication  replicator  10.0.0.2/32  scram-sha-256
```

Crea un usuario dedicado para la replicación:

```sql
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD 'strong_password_here';
```

Recarga PostgreSQL para aplicar los cambios:

```bash
sudo systemctl reload postgresql
```

## Configuración del Standby

En el servidor standby, toma un backup base desde el primary usando `pg_basebackup`:

```bash
sudo -u postgres pg_basebackup \
  -h 10.0.0.1 \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -P -Xs -R
```

El flag `-R` es importante — escribe automáticamente un archivo `standby.signal` y un `postgresql.auto.conf` con los detalles de la conexión de replicación.

Añade configuraciones específicas del standby en `postgresql.conf`:

```conf
# postgresql.conf (standby)
hot_standby = on
hot_standby_feedback = on
```

Inicia PostgreSQL en el standby y verifica que la replicación esté activa:

```bash
sudo systemctl start postgresql
```

## Verificando la Replicación

En el primary, consulta la vista `pg_stat_replication` para confirmar que el standby está conectado y haciendo streaming:

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

Un `state` de `streaming` significa que todo funciona. La columna `replication_lag_bytes` es tu indicador de salud más inmediato — debe mantenerse cercano a cero bajo carga normal.

En el standby, confirma que está en modo recovery:

```sql
SELECT pg_is_in_recovery();
-- Devuelve: true
```

## Failover y Promoción

Si el primary queda inaccesible, promueve el standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

O crea un archivo trigger que el standby monitorea (configura la ruta en `recovery.conf` o `postgresql.auto.conf`). Desde PostgreSQL 12 en adelante, ambos métodos funcionan correctamente.

Tras la promoción, actualiza el connection string de tu aplicación para apuntar al nuevo primary. Si usas **PgBouncer** o una IP virtual (nosotros usamos ambos), el cambio puede ocurrir de forma transparente para la aplicación.

### Automatizando el Failover con Patroni

Para sistemas en producción donde el failover manual no es aceptable, **Patroni** es la herramienta estándar. Funciona como un daemon en cada nodo PostgreSQL, usa un almacén de consenso distribuido (etcd, Consul o ZooKeeper) para elegir un líder, y gestiona el failover automático y el re-registro de primaries antiguos como standbys.

La configuración de Patroni merece su propio artículo, pero si gestionas PostgreSQL a cualquier escala significativa, vale la inversión.

## Monitorizando el Replication Lag

El replication lag es la métrica a vigilar. Un standby que lleva horas de retraso no es un objetivo de failover útil. Configura alertas sobre:

- `pg_stat_replication.replay_lag` (segundos) — incorporado desde PostgreSQL 10
- Estado del WAL receiver en el standby mediante `pg_stat_wal_receiver`
- Uso de disco en el directorio WAL del primary — si el standby se queda muy atrás, los segmentos WAL se acumulan

Una query simple de Prometheus via `postgres_exporter` cubre todo esto. La ejecutamos en cada nodo PostgreSQL que gestionamos.

## Conclusiones Clave

La replicación streaming no es compleja de configurar, pero requiere decisiones deliberadas: síncrono vs. asíncrono, failover manual vs. automatizado, y cómo tu aplicación maneja el cambio de primary.

En GEMBA IT, ejecutamos replicación streaming de PostgreSQL con synchronous commit para datos transaccionales, consultas hot standby enrutadas a través de PgBouncer, y Patroni gestionando la promoción automatizada. El resultado es una configuración donde un fallo del primary produce un failover medido en segundos, no en minutos.

Si estás construyendo sobre PostgreSQL y la disponibilidad importa — empieza aquí.

---

*¿Necesitas ayuda para diseñar o auditar tu configuración de replicación PostgreSQL? [Ponte en contacto con GEMBA IT](https://gembait.com/contact) — la arquitectura de bases de datos es algo que hacemos cada día.*
