# Run from PowerShell on the user's Windows PC. No administrator privileges required.
$ErrorActionPreference = 'Stop'
$worknoteRoot = Split-Path $PSScriptRoot -Parent
Push-Location $worknoteRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24.19.0 first.' }
    $worknoteNodeVersion = & node --version
    if ($worknoteNodeVersion -notmatch '^v24\.' -or [version]($worknoteNodeVersion.TrimStart('v')) -lt [version]'24.19.0') { throw 'Node.js 24.19.0 or later in the 24.x series is required. Recommended: 24.19.0.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd run verify
    if ($LASTEXITCODE -ne 0) { throw 'Repository verification failed.' }
    Write-Host 'Repository setup verified. Use start-windows.ps1 to launch.'
} finally {
    Pop-Location
}
