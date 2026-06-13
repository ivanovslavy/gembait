# Replicación Streaming de PostgreSQL para Alta Disponibilidad

Tu base de datos está caída. No lenta — caída. Cada segundo cuenta. Y si no tienes un standby listo para tomar el relevo, en lugar de cambiar en segundos te encuentras restaurando desde un backup durante horas. Esa es la diferencia entre un tropiezo de dos minutos y una caída de dos horas que todos recuerdan.

La **replicación streaming de PostgreSQL** es la columna vertebral de cualquier configuración seria de alta disponibilidad con PostgreSQL. (Alta disponibilidad sólo significa que el sistema sigue atendiendo a los usuarios incluso cuando una máquina muere.) La usamos en toda nuestra infraestructura en GEMBA IT — incluyendo GembaPay, donde el procesamiento de pagos no puede detenerse. Así es como funciona y cómo configurarla.

## Cómo Funciona la Replicación Streaming

PostgreSQL lleva una especie de diario de cada cambio antes de que toque los archivos de datos en sí. Ese diario es el **Write-Ahead Log (WAL)**. La replicación streaming funciona enviando continuamente esos registros WAL desde el servidor **primary** (el que recibe las escrituras) hacia uno o más servidores **standby** en tiempo casi real.

Cada standby reaplica esos registros WAL sobre su propia copia de los datos, manteniéndose al ritmo del primary. Cuando el primary falla, un standby puede ser **promovido** — deja de reaplicar y comienza a aceptar escrituras, convirtiéndose en el nuevo primary.

Piénsalo como un escribano que lee en voz alta cada edición del original, y un segundo escribano que anota cada palabra a medida que se pronuncia. Si el primer escribano se desploma, el segundo ya tiene una copia al día y puede tomar la pluma.

### Síncrono vs. Asíncrono

En modo **asíncrono** (el predeterminado), el primary no espera a que el standby confirme que recibió el cambio antes de decirle al cliente "listo". Es rápido, pero significa que puedes perder una pequeña cantidad de datos si el primary cae antes de que el standby se haya puesto al día.

En modo **síncrono**, el primary espera a que al menos un standby confirme que tiene el WAL antes de finalizar la transacción. Cero pérdida de datos, pero lo pagas con un poco de latencia en cada escritura. Para datos críticos de pagos, el modo síncrono es la decisión correcta.

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

Luego permite que el standby se conecte para replicación en `pg_hba.conf` (el archivo que controla quién tiene permiso para conectarse):

```conf
# pg_hba.conf (primary)
host  replication  replicator  10.0.0.2/32  scram-sha-256
```

Crea un usuario dedicado sólo para la replicación:

```sql
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD 'strong_password_here';
```

Recarga PostgreSQL para aplicar los cambios:

```bash
sudo systemctl reload postgresql
```

## Configuración del Standby

En el servidor standby, toma una copia completa del primary usando `pg_basebackup` (la herramienta que clona una base de datos en marcha):

```bash
sudo -u postgres pg_basebackup \
  -h 10.0.0.1 \
  -U replicator \
  -D /var/lib/postgresql/16/main \
  -P -Xs -R
```

El flag `-R` es el que debes recordar — escribe automáticamente un archivo `standby.signal` y un `postgresql.auto.conf` con los datos de conexión para la replicación, así no tienes que hacerlo tú.

Añade configuraciones específicas del standby en `postgresql.conf`:

```conf
# postgresql.conf (standby)
hot_standby = on
hot_standby_feedback = on
```

Inicia PostgreSQL en el standby y verifica que la replicación esté funcionando:

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

Un `state` de `streaming` significa que todo funciona. La columna `replication_lag_bytes` es tu indicador de salud más inmediato — te dice cuánto se ha quedado atrás el standby, y debe mantenerse cercano a cero bajo carga normal.

En el standby, confirma que está en modo recovery (reaplicando, todavía no es un primary):

```sql
SELECT pg_is_in_recovery();
-- Devuelve: true
```

## Failover y Promoción

Si el primary desaparece, promueve el standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

O crea un archivo trigger que el standby vigila (configura la ruta en `recovery.conf` o `postgresql.auto.conf`). Desde PostgreSQL 12 en adelante, tanto `pg_ctl promote` como un archivo trigger funcionan limpiamente.

Tras la promoción, apunta el connection string de tu aplicación al nuevo primary. Si usas **PgBouncer** (un pool de conexiones que se sitúa delante de la base de datos) o una IP virtual — nosotros usamos ambos — el cambio puede ocurrir sin que la aplicación se entere siquiera.

### Automatizando el Failover con Patroni

Para sistemas en producción donde hacer el failover a mano no es aceptable, **Patroni** es la herramienta estándar. Funciona como un proceso en segundo plano en cada nodo PostgreSQL, usa un almacén compartido de consenso (etcd, Consul o ZooKeeper) para que los nodos puedan ponerse de acuerdo sobre quién es el líder, y gestiona el failover automático y el re-registro de un primary antiguo como standby cuando vuelve.

Configurar Patroni merece su propio artículo, pero si gestionas PostgreSQL a cualquier escala significativa, vale la inversión.

## Monitorizando el Replication Lag

El replication lag — cuánto se ha quedado atrás el standby — es la métrica a vigilar. Un standby que lleva horas de retraso no es algo útil a lo que hacer failover. Configura alertas sobre:

- `pg_stat_replication.replay_lag` (segundos) — incorporado desde PostgreSQL 10
- Estado del WAL receiver en el standby mediante `pg_stat_wal_receiver`
- Uso de disco en el directorio WAL del primary — si el standby se queda muy atrás, los segmentos WAL se acumulan y se comen el disco

Una query simple de Prometheus via `postgres_exporter` cubre todo esto. La ejecutamos en cada nodo PostgreSQL que gestionamos.

## Conclusiones Clave

La replicación streaming no es compleja de configurar, pero sí te pide tomar unas cuantas decisiones deliberadas: síncrono vs. asíncrono, failover manual vs. automatizado, y cómo tu aplicación afronta que el primary cambie bajo sus pies.

En GEMBA IT, ejecutamos replicación streaming de PostgreSQL con synchronous commit para datos transaccionales, consultas hot standby enrutadas a través de PgBouncer, y Patroni gestionando la promoción automatizada. El resultado es una configuración donde un fallo del primary produce un failover medido en segundos, no en minutos.

Si estás construyendo sobre PostgreSQL y la disponibilidad importa — empieza aquí.

---

*¿Necesitas ayuda para diseñar o auditar tu configuración de replicación PostgreSQL? [Ponte en contacto con GEMBA IT](https://gembait.com/contact) — la arquitectura de bases de datos es algo que hacemos cada día.*
