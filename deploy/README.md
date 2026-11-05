# Entrada pública y configuración de proxies

La cadena de referencia es Cloudflare como proxy público → Caddy en el host → Next.js en `127.0.0.1:3000` → API privada. Caddy confía en `CF-Connecting-IP` únicamente cuando el par de red pertenece a un rango oficial de Cloudflare; para conexiones directas usa la IP de la conexión. Sobrescribe `X-Real-IP` y `X-PBB-Ingress`. Revisa periódicamente los rangos en https://www.cloudflare.com/ips-v4/ y https://www.cloudflare.com/ips-v6/.

Exporta `DOMAIN` y `PROXY_SHARED_SECRET` al proceso de Caddy mediante su archivo de entorno privado. Usa exactamente el mismo secreto de proxy en el archivo privado de Docker Compose. No publiques ese archivo ni incluyas el secreto en una variable `NEXT_PUBLIC_`. Caddy puede validar sin arrancar el servidor:

```sh
caddy validate --config deploy/Caddyfile --adapter caddyfile
```

El frontend convierte la IP autenticada en un contexto HMAC de vida corta ligado a método y ruta. Tanto las solicitudes del navegador a `/api/*` como las consultas del catálogo renderizadas en servidor lo utilizan. La API rechaza contexto adulterado y mantiene `trust proxy=false`; no confía directamente en `X-Forwarded-For`. Las llamadas locales sin contexto se limitan por su conexión de red. Los healthchecks no requieren contexto de cliente.

Si utilizas Cloudflare Tunnel, el par de red que ve Caddy suele ser el proceso local de `cloudflared`, no una IP pública de Cloudflare. En ese caso prepara una entrada distinta, enlazada exclusivamente a loopback o una red privada aislada, y confía únicamente en la IP concreta del conector autorizado. No amplíes la confianza a todas las redes privadas ni abras la entrada de túnel a Internet. Una instalación con otro proxy requiere la misma revisión de dónde se sobrescribe la IP. La configuración de referencia no demuestra que el servidor remoto ya esté usando esa cadena.

Antes de sustituir la aplicación: respaldo verificado, configuración privada de frontend/API/proxy coordinada, migraciones aplicadas y comprobación de login, subidas, catálogo y pagos de prueba. La migración `20261028000000_reservation_reconciliation` solo añade un índice de reservas.

Para la demostración pública utiliza datos y credenciales administrativas propios de prueba, base separada, `APP_ENV=test`, `PAYMENT_MODE=test`, cookies Secure al publicar por HTTPS e `INDEXING_ENABLED=false`. El bloqueo externo de `/api/orders` que devolvía 503 debe revisarse al publicar esta versión: la simulación necesita crear pedidos de prueba y utilizar `/api/payments/simulate`. Solo se retira en ese ambiente aislado, después de comprobar las barreras de configuración; los pagos comerciales permanecen sujetos a Wompi.

La política de caché de imágenes y otros recursos estáticos se mantiene sin cambios por decisión del propietario.

## Comprobación de la IP firmada (obligatoria antes de publicar esta versión)

Con `APP_ENV=production` la API exige una IP de cliente firmada por la cadena Caddy → Next en todas las rutas con límite de peticiones. Sin ella responde 503 y registra `PROXY_CONTEXT_MISSING`, en lugar de agrupar a todos los clientes en un solo contador. En la demo (`APP_ENV=test`) el valor por defecto es `false`; actívalo con `PROXY_IP_REQUIRED=true` después de esta comprobación:

```sh
curl -sS https://DOMINIO/api/health/proxy
# Esperado: {"clientIpVerified":true}
```

Si responde `false`, el proxy que atiende el dominio no está enviando `X-PBB-Ingress` y `X-Real-IP` con el mismo `PROXY_SHARED_SECRET`. Corrígelo antes de activar la obligación o de desplegar con `APP_ENV=production`.

Para identificar un 503, lee el cuerpo: «La tienda no está disponible…» indica proxy sin IP firmada; «Servicio de protección…», Redis inaccesible; «Estamos definiendo la tarifa…», `SHIPPING_CONFIGURED=false`; una respuesta que no es JSON viene del proxy.

## Recursos y logs

Compose limita memoria por servicio (`DB_MEM_LIMIT`, `REDIS_MEM_LIMIT`, `BACKEND_MEM_LIMIT`, `FRONTEND_MEM_LIMIT`), procesos y logs (`json-file`, 3 archivos de 10 MB). Redis tiene `maxmemory 96mb` con `volatile-ttl`. Ajusta los límites a la memoria real del VPS y al resto de aplicaciones alojadas. Revisa el consumo con `docker stats --no-stream`.

## Respaldos cifrados, retención y copia externa

`scripts/backup.mjs` cifra la base y las imágenes con AES-256-GCM cuando `BACKUP_ENCRYPTION_KEY` tiene 64 caracteres hexadecimales (`openssl rand -hex 32`). Guarda la llave en un gestor de contraseñas fuera del VPS: sin ella no hay restauración. `BACKUP_KEEP` conserva los N respaldos locales más recientes.

Ejemplo de cron diario a las 03:17, con copia fuera del servidor mediante rclone (configura antes un destino propio):

```cron
17 3 * * * cd /ruta/planetababys && node scripts/backup.mjs .env.production planetababys >> backups/backup.log 2>&1 && rclone copy backups remoto:planetababys-backups --exclude backup.log
```

Restauración de prueba: descifra con `BACKUP_ENCRYPTION_KEY=... node scripts/backup-decrypt.mjs backups/FECHA/database.dump.enc` (y el `.tar.gz.enc`) y luego usa `scripts/verify-backup.mjs` contra el entorno aislado. Registra la evidencia en la bóveda.

## Migración `20261105000000_hardening_latency`

Es aditiva: agrega `payments.approvedAt` (rellenada con la fecha actual de los pagos aprobados), `orders.reconcileAttempts` y `orders.nextReconcileAt`, y crea la extensión `pg_trgm` con índices GIN para la búsqueda. Requiere que el usuario de PostgreSQL pueda crear extensiones; en la imagen oficial `postgres:16` el usuario del contenedor puede hacerlo. Haz un respaldo verificado antes de aplicarla.
