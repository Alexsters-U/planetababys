# Planeta Baby's

Aplicación de comercio electrónico para productos de bebé, con catálogo, compras como invitado y administración de ventas web y presenciales.

El proyecto está en desarrollo y cuenta con un entorno de validación local. La publicación comercial requiere completar la configuración de infraestructura, pagos y operación del comercio.

## Funcionalidades

- Catálogo con búsqueda, categorías, disponibilidad y promociones.
- Carrito y revisión de precios antes de confirmar una compra.
- Cotización de envío y aceptación del total antes del pago.
- Integración con el checkout alojado de Wompi y confirmación de pagos desde el servidor.
- Administración de productos, imágenes, inventario, pedidos y entregas.
- Ventas del local en efectivo o transferencia, con cálculo de cambio e historial.
- Montos rápidos de efectivo, registro idempotente y anulación auditada de ventas presenciales.
- Inventario compartido entre ventas web y del local.
- Resumen de ventas con métricas y separación por canal.
- Interfaz adaptable a escritorio y móvil.

## Tecnologías

| Área | Tecnologías |
|---|---|
| Frontend | Next.js, React y TypeScript |
| Interfaz | Tailwind CSS y componentes SVG |
| API | Express y validación con Zod |
| Persistencia | PostgreSQL y Prisma |
| Servicios compartidos | Redis |
| Contenedores | Docker y Docker Compose |
| Verificación | Pruebas HTTP, de reglas de negocio y recorridos de navegador |

## Requisitos

- Docker con soporte para contenedores Linux y Docker Compose v2.
- Node.js 22.14 o superior para las herramientas locales de desarrollo y validación.
- Corepack y pnpm; la versión del gestor está fijada en `package.json`.

Los servicios de la aplicación pueden ejecutarse mediante Docker Compose. No es necesario instalar PostgreSQL o Redis directamente en el equipo para usar ese entorno.

## Instalación

Desde la raíz del repositorio:

```sh
corepack pnpm install --frozen-lockfile
```

Conserva el archivo de bloqueo y utiliza el gestor definido por el proyecto para mantener instalaciones reproducibles.

## Configuración

Utiliza `.env.example` como referencia de las variables necesarias y prepara un archivo de entorno privado para cada ambiente. Sustituye los valores de ejemplo antes de utilizarlo.

La configuración incluye:

- Conexiones a la base de datos y Redis.
- Secretos independientes para sesiones y acceso a pedidos.
- Origen público de la aplicación y configuración de cookies.
- Credenciales iniciales del administrador.
- Ambiente y credenciales de la pasarela de pagos.
- Datos públicos del comercio y condiciones de entrega.

Las credenciales se definen mediante variables de entorno. Este documento no proporciona usuarios, contraseñas ni llaves de acceso. Mantén los archivos de entorno y los respaldos fuera del control de versiones; cualquier plantilla pública debe contener exclusivamente valores ficticios o campos vacíos.

## Entorno local con Docker

Genera una configuración aislada de pruebas:

```sh
node scripts/setup-test-env.mjs
```

Construye e inicia sus servicios:

```sh
docker compose --env-file .env.test -p pbb-validation -f docker-compose.yml -f docker-compose.test.yml up -d --build
```

Inicializa los datos de demostración y consulta el estado:

```sh
docker compose --env-file .env.test -p pbb-validation -f docker-compose.yml -f docker-compose.test.yml --profile tools run --rm seed
docker compose --env-file .env.test -p pbb-validation -f docker-compose.yml -f docker-compose.test.yml ps
```

Consulta el acceso local y las credenciales en la configuración privada generada. Este entorno utiliza datos de demostración y no realiza cobros reales. Debe mantenerse separado del ambiente comercial.

Para detenerlo conservando los datos:

```sh
docker compose --env-file .env.test -p pbb-validation -f docker-compose.yml -f docker-compose.test.yml stop
```

## Pagos y ventas presenciales

Las compras web utilizan Wompi como proveedor externo. La confirmación de un pago corresponde al servidor; el regreso del navegador a la tienda no acredita por sí solo que el pago haya sido aprobado.

El registro de ventas del local documenta pagos ya recibidos en efectivo o por transferencia y actualiza el inventario compartido. Su historial permite anular una venta con motivo y devolución de unidades. La devolución del dinero se gestiona por separado.

Las pruebas de pago y los registros de demostración deben permanecer separados de las operaciones reales.

## Pruebas

Con el entorno aislado de pruebas disponible, ejecuta las comprobaciones necesarias de forma secuencial:

```sh
corepack pnpm typecheck
corepack pnpm build:api
corepack pnpm test:validators
corepack pnpm test:analytics
corepack pnpm test:shipping
corepack pnpm test:admin
corepack pnpm test:store-sales
corepack pnpm test:analytics:api
```

Las suites HTTP crean y retiran datos sintéticos. No deben ejecutarse sobre bases comerciales. Algunas regresiones históricas requieren una configuración de envío específica; revisa las condiciones de cada suite antes de ejecutarla.

Los recorridos Cypress requieren instalar su navegador de pruebas y tener los servicios correspondientes disponibles. Las comprobaciones locales no sustituyen la validación de la cuenta del proveedor ni la revisión del despliegue público.

## Despliegue

El proyecto incluye imágenes de frontend y API, servicios de PostgreSQL y Redis, migraciones y almacenamiento persistente mediante volúmenes.

Para preparar un ambiente público:

1. Define una configuración privada de producción, con secretos propios y credenciales administrativas diferentes de las de demostración.
2. Configura dominio, HTTPS y un proxy de entrada acorde al servidor.
3. Revisa y aplica las migraciones después de contar con un respaldo verificado.
4. Configura el proveedor de pagos y valida su funcionamiento en el ambiente correspondiente.
5. Verifica persistencia, restauración de respaldos y monitoreo antes de habilitar ventas.

La base de datos y los archivos guardados en volúmenes se administran por separado del código. Publicar el repositorio no traslada esos datos al servidor. Un despliegue en un único host tampoco proporciona redundancia entre servidores.

## Publicación del repositorio

Antes de crear un commit o publicar una versión, revisa el contenido que se incluirá. Conserva fuera del repositorio:

- Archivos de entorno con valores operativos y credenciales.
- Respaldos, bases de datos y archivos privados subidos por usuarios.
- Logs, exportaciones y capturas que contengan información personal o de operaciones.
- Rutas personales del equipo y datos de acceso a servidores.
- Dependencias instaladas, compilaciones y archivos temporales.

Verifica también las plantillas, la documentación complementaria y los archivos adjuntos. Actualizar este README no sustituye esa revisión ni elimina información que pudiera existir en un historial de Git.

## Recursos visuales

El catálogo de demostración incluye imágenes generadas con IA y recursos locales. Antes de usarlos comercialmente, sustituye o valida imágenes, descripciones, precios, existencias y derechos de uso según corresponda.
