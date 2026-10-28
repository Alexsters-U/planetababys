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
