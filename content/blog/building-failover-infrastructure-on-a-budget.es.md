# Construyendo infraestructura failover con bajo presupuesto

Mucha gente cree que la alta disponibilidad es cara. Se imaginan hardware dedicado, contratos corporativos caros y un equipo entero vigilándolo todo. La realidad es más amable: con la arquitectura adecuada y un proveedor como Hetzner, consigues uptime de nivel empresarial por una fracción del precio.

En GEMBA IT, toda nuestra infraestructura — incluido GembaPay — corre en servidores Hetzner en Alemania. Así es como logramos un failover sólido y automático sin pagar precios de empresa.

## Qué significa "failover" en la práctica

Cuando un componente falla, queremos que otro sano ocupe su lugar de inmediato. Eso es el **failover**: el cambio del componente roto a uno de respaldo que sí funciona, ya sea de forma automática o manual. Se aplica en cada capa: servidor, base de datos, red y aplicación.

El objetivo no es evitar todos los fallos — eso es imposible. Los fallos van a pasar. El objetivo es acortar el tiempo entre el momento en que algo se rompe y el momento en que el sistema se recupera, tanto que la mayoría de los usuarios ni se enteren.

## El stack de infraestructura

Nuestra configuración se apoya en tres capas de redundancia:

1. **Dos servidores de aplicación** en configuración active-passive detrás de una **floating IP**
2. **Replicación streaming de PostgreSQL** con un hot standby
3. **Health checks automatizados** que disparan la reasignación de IP

Todo corre en Hetzner Cloud y servidores dedicados de Hetzner. Para la mayoría de las cargas de trabajo, dos instancias CX32 absorben de sobra un fallo del primario.

### Por qué Hetzner

Hetzner ofrece buenos precios, buena red y — lo más importante para nosotros — una floating IP que se controla por API. Una **floating IP** es una dirección IP que es tuya y que puedes mover de un servidor a otro vía API en menos de un segundo. Ese es el corazón de nuestro failover: cuando el primario cae, un script mueve la floating IP al standby, y el tráfico se va con ella.

## Failover a nivel de servidor

Los servidores primario y standby ejecutan el mismo stack de aplicación. Los mantenemos sincronizados con **Ansible**, una herramienta que aplica la misma configuración a varias máquinas a la vez. Cualquier cambio que hagas en el primario se aplica solo también al standby.

En el standby corre un script ligero de health check, cada 30 segundos. Comprueba si el primario sigue vivo: intenta una conexión TCP y consulta un endpoint HTTP de salud. Si ambas cosas fallan en dos comprobaciones seguidas, el script llama a la API de Hetzner para mover la floating IP:

```bash
#!/bin/bash
FLOATING_IP_ID="tu-floating-ip-id"
STANDBY_SERVER_ID="tu-standby-server-id"
HETZNER_TOKEN="tu-api-token"

curl -s -X POST \
  -H "Authorization: Bearer $HETZNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"server\": $STANDBY_SERVER_ID}" \
  "https://api.hetzner.cloud/v1/floating_ips/$FLOATING_IP_ID/actions/assign"
```

Todo el cambio, sin tocar el DNS, tarda menos de tres segundos. Las aplicaciones conectadas a la floating IP se reconectan solas.

## Failover de base de datos con PostgreSQL

La base de datos usa **replicación streaming de PostgreSQL** en modo síncrono. El primario transmite los registros WAL al standby en tiempo real — es decir, cada cambio se copia al instante. Cuando el primario falla, promovemos el standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

La configuración completa de la replicación la explicamos en nuestro [artículo sobre replicación streaming de PostgreSQL](/blog/postgresql-streaming-replication-high-availability). Aquí, centrándonos en la capa de failover: el script de health check hace la promoción de forma automática antes de mover la floating IP. La aplicación ve un corte breve, se reconecta a la misma IP y sigue escribiendo, ahora en el nuevo primario.

### Monitorización del retraso de replicación

El standby solo sirve como respaldo si de verdad va al día con el primario. Por eso vigilamos `pg_stat_replication.replay_lag` con Prometheus y saltamos una alerta si el retraso pasa de cinco segundos. En la práctica, en la red privada de Hetzner, el retraso de replicación síncrona se queda por debajo de 10ms.

## Resiliencia a nivel de aplicación

El failover de infraestructura se ocupa de los fallos de hardware y del sistema operativo. Pero la propia aplicación tiene que sobrevivir al breve instante en que se reconecta. Estas son algunas cosas que hacemos:

- **Lógica de reintentos** en las conexiones a la base de datos — tres reintentos con 500ms de espera cubren la mayoría de los casos
- **Connection pooling** con PgBouncer, que retiene las conexiones de cliente mientras se promueve el standby
- **Servidores de aplicación sin estado** — los datos de sesión viven en la base de datos, no en memoria, así que cambiar de primario no echa a los usuarios activos

## Cuánto cuesta

Como referencia, nuestra configuración de producción corre en:
- 2× Hetzner CX32 (4 vCPU, 8GB RAM) — €20/mes cada uno
- 1× Floating IP — €3,81/mes
- Red privada — gratuito
- Copias de seguridad — €4/mes por servidor

Total: menos de €50/mes para una arquitectura que gestiona los fallos del primario sola, en segundos. Una configuración HA gestionada comparable de un proveedor cloud grande empieza en varios cientos de euros al mes.

## Qué cubre y qué no

Esta configuración resuelve los fallos más comunes: caídas de servidor, fallos de hardware y problemas a nivel de sistema operativo. No reemplaza un plan completo de disaster recovery. Si los dos servidores están en el mismo datacenter de Hetzner y ese datacenter se cae entero, mover la floating IP no te va a salvar.

Para la mayoría de los negocios, ese riesgo — HA en un solo datacenter — es perfectamente aceptable. Si tu carga de trabajo necesita redundancia geográfica, añadimos un cold standby en una segunda región. Pero esa ya es una decisión de arquitectura aparte, con otro compromiso de coste.

## Conclusiones clave

El uptime de empresa no exige un gasto de empresa. Una floating IP, un servidor standby, replicación PostgreSQL y un script de health check de 50 líneas cubren los fallos que ocurren con más frecuencia.

En GEMBA IT, esta arquitectura nos ha dado más del 99,9% de uptime en nuestras cargas de producción. La inversión está en el diseño, no en la factura.

---

*¿Construyendo infraestructura que necesita mantenerse activa? [Contacta con GEMBA IT](https://gembait.com/contact) — diseñamos y gestionamos sistemas de alta disponibilidad para negocios que no pueden permitirse el tiempo de inactividad.*
