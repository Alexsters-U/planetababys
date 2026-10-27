param([string]$StateDirectory = "$env:LOCALAPPDATA/Temp/planetababys-reunion-20261005")
$processFile = Join-Path $StateDirectory 'processes.json'
if (!(Test-Path -LiteralPath $processFile)) { throw 'No se encontró el registro de esta demostración.' }
$record = Get-Content -Raw -LiteralPath $processFile | ConvertFrom-Json
foreach ($role in @('tunnelPid', 'proxyPid')) {
    $targetId = [int]$record.$role
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $targetId"
    if (!$processInfo) { continue }
    $line = ([string]$processInfo.CommandLine).Replace('\','/').ToLowerInvariant()
    $matchesPreview = if ($role -eq 'tunnelPid') {
        $processInfo.Name -eq 'cloudflared.exe' -and $line.Contains('--url http://127.0.0.1:3105')
    } else {
        $processInfo.Name -eq 'node.exe' -and $line.Contains('scripts/meeting-preview-proxy.mjs') -and $line.Contains($StateDirectory.Replace('\','/').ToLowerInvariant()+'/config.json')
    }
    if (!$matchesPreview) { throw "El proceso $targetId ya no corresponde a esta reunión; no se detuvo." }
    Stop-Process -Id $targetId -ErrorAction Stop
    Write-Output "Proceso de demostración detenido: $targetId ($role)"
}
# Conserva contenedores, volúmenes y configuración local del comercio.
