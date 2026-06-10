# Construyendo infraestructura failover con bajo presupuesto

La mayoría de los negocios asumen que la alta disponibilidad es cara. Se imaginan hardware dedicado, SLAs corporativos y grandes equipos de operaciones. La realidad es que con la arquitectura correcta y un proveedor como Hetzner, puedes lograr uptime empresarial a una fracción del coste.

En GEMBA IT, toda nuestra infraestructura — incluyendo GembaPay — corre en servidores Hetzner en Alemania. Así es como logramos failover resiliente y automatizado sin pagar precios de empresa.

## Qué significa "failover" en la práctica

**Failover** es el cambio automático o manual de un componente fallido a uno de respaldo funcional. Se aplica en cada capa: servidor, base de datos, red y aplicación. Un sistema de failover bien diseñado significa que cuando algo falla — y fallará — el sistema detecta el problema y se recupera antes de que la mayoría de los usuarios lo noten.

El objetivo no es prevenir los fallos. El objetivo es reducir el tiempo entre el fallo y la recuperación.

## El stack de infraestructura

Nuestra configuración utiliza tres capas de redundancia:

1. **Dos servidores de aplicación** en configuración active-passive detrás de una **floating IP**
2. **Replicación streaming de PostgreSQL** con un hot standby
3. **Health checks automatizados** que disparan la reasignación de IP

Todo corre en Hetzner Cloud y servidores dedicados Hetzner. Para la mayoría de las cargas de trabajo, dos instancias CX32 ofrecen capacidad suficiente para manejar un fallo del primario con margen.

### Por qué Hetzner

Hetzner ofrece precios competitivos, buen rendimiento de red y — crucialmente — una funcionalidad de floating IP controlada por API. Una **floating IP** es una dirección IP que posees y puedes reasignar entre servidores via API en menos de un segundo. Este es el mecanismo central de nuestro failover: cuando el primario cae, un script reasigna la floating IP al standby, y el tráfico le sigue.

## Failover a nivel de servidor

Los servidores primario y standby ejecutan el mismo stack de aplicación. Usamos **Ansible** para mantenerlos sincronizados — cualquier cambio de configuración aplicado al primario se aplica automáticamente al standby.

Un script ligero de health check se ejecuta en el standby cada 30 segundos. Intenta una conexión TCP y un endpoint HTTP de salud contra el primario. Si ambos fallan en dos comprobaciones consecutivas, el script llama a la API de Hetzner para reasignar la floating IP:

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

Todo el cambio transparente a DNS tarda menos de tres segundos. Las aplicaciones conectadas a la floating IP se reconectan automáticamente.

## Failover de base de datos con PostgreSQL

La capa de base de datos usa **replicación streaming de PostgreSQL** en modo síncrono. El primario transmite registros WAL al standby en tiempo real. Cuando el primario falla, promovemos el standby:

```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
```

Cubrimos la configuración completa de replicación en nuestro [artículo sobre replicación streaming de PostgreSQL](/blog/postgresql-streaming-replication-high-availability). Para la capa de failover específicamente, el script de health check gestiona la promoción automáticamente antes de reasignar la floating IP — la aplicación ve un breve restablecimiento de conexión, se reconecta a la misma IP y continúa escribiendo al nuevo primario.

### Monitorización del retraso de replicación

El standby solo es útil como objetivo de failover si realmente está sincronizado. Monitorizamos `pg_stat_replication.replay_lag` vía Prometheus y alertamos si el retraso supera los cinco segundos. En la práctica, en una red privada de Hetzner, el retraso de replicación síncrona es inferior a 10ms.

## Resiliencia a nivel de aplicación

El failover a nivel de infraestructura gestiona los fallos de hardware y del sistema operativo. Pero las aplicaciones necesitan manejar correctamente la breve ventana de reconexión. Algunas prácticas que aplicamos:

- **Lógica de reintentos** en conexiones a la base de datos — tres reintentos con 500ms de espera cubre la mayoría de los escenarios
- **Connection pooling** mediante PgBouncer, que almacena en búfer las conexiones de cliente durante la ventana de promoción del standby
- **Servidores de aplicación sin estado** — el estado de sesión vive en la base de datos, no en memoria, por lo que un cambio de primario no descarta las sesiones activas

## Cuánto cuesta

Como referencia, nuestra configuración de producción corre en:
- 2× Hetzner CX32 (4 vCPU, 8GB RAM) — €20/mes cada uno
- 1× Floating IP — €3,81/mes
- Red privada — gratuito
- Copias de seguridad — €4/mes por servidor

Total: menos de €50/mes para una arquitectura que gestiona los fallos del primario automáticamente en segundos. Una configuración HA gestionada comparable de un proveedor cloud importante empieza en varios cientos de euros al mes.

## Qué cubre y qué no

Esta configuración gestiona los escenarios de fallo más comunes: caídas de servidor, fallos de hardware y problemas a nivel de sistema operativo. No reemplaza un plan completo de disaster recovery. Si ambos servidores están en el mismo datacenter de Hetzner y ese datacenter sufre una interrupción, la reasignación de floating IP no ayudará.

Para la mayoría de los negocios, el perfil de riesgo de una configuración HA en un solo datacenter es aceptable. Para cargas de trabajo que requieren redundancia geográfica, añadimos un cold standby en una segunda región — pero esa es una decisión arquitectónica independiente con diferentes compromisos de coste.

## Conclusiones clave

El uptime empresarial no requiere gasto empresarial. Una floating IP, un servidor standby, replicación PostgreSQL y un script de health check de 50 líneas cubren los escenarios de fallo que ocurren con más frecuencia.

En GEMBA IT, esta arquitectura ha entregado más del 99,9% de uptime en nuestras cargas de trabajo de producción. La inversión está en el diseño, no en la factura.

---

*¿Construyendo infraestructura que necesita mantenerse activa? [Contacta con GEMBA IT](https://gembait.com/contact) — diseñamos y gestionamos sistemas de alta disponibilidad para negocios que no pueden permitirse el tiempo de inactividad.*
