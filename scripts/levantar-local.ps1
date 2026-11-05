# Levanta el entorno local aislado de Planeta Baby's (base planetababys_test, pagos simulados).
# Uso, desde la raíz del proyecto:  powershell -ExecutionPolicy Bypass -File scripts\levantar-local.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$compose = @("--env-file", ".env.test", "-p", "pbb-validation", "-f", "docker-compose.yml", "-f", "docker-compose.test.yml")

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Magenta }
function Revisar($accion) { if ($LASTEXITCODE -ne 0) { throw "Falló: $accion (código $LASTEXITCODE)" } }

Paso "Comprobando Docker"
docker info --format "{{.ServerVersion}}" | Out-Null; Revisar "Docker no responde. Abre Docker Desktop y espera a que diga Running"

Paso "Configuración de prueba (.env.test se conserva si ya existe)"
node scripts/setup-test-env.mjs; Revisar "setup-test-env"

Paso "Construyendo e iniciando servicios (incluye migraciones)"
docker compose @compose up -d --build; Revisar "docker compose up"

Paso "Datos de demostración (idempotente: no cambia credenciales existentes)"
docker compose @compose --profile tools run --rm seed; Revisar "seed"

Paso "Esperando a que la tienda responda"
$listo = $false
for ($i = 0; $i -lt 60; $i++) {
  try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:3100/api/health").StatusCode -eq 200) { $listo = $true; break } } catch {}
  Start-Sleep -Seconds 3
}
docker compose @compose ps
if (-not $listo) { throw "La tienda no respondió en 3 minutos. Revisa: docker compose $($compose -join ' ') logs --tail 80 backend frontend" }

Write-Host "`nListo: tienda en http://localhost:3100  ·  panel en http://localhost:3100/admin" -ForegroundColor Green
Write-Host "Credenciales: SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD de .env.test. Pagos simulados, sin cobros reales."
Write-Host "Para detener sin borrar datos: docker compose $($compose -join ' ') stop"
Start-Process "http://localhost:3100"
