# Run from PowerShell on the user's Windows PC. No administrator privileges required.
$ErrorActionPreference = 'Stop'
$worknoteRoot = Split-Path $PSScriptRoot -Parent
Push-Location $worknoteRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24.19.0 first.' }
    $worknoteNodeVersion = & node --version
    if ($worknoteNodeVersion -notmatch '^v24\.' -or [version]($worknoteNodeVersion.TrimStart('v')) -lt [version]'24.19.0') { throw 'Node.js 24.19.0 or later in the 24.x series is required. Recommended: 24.19.0.' }
    $worknotePython = if ($env:WORKNOTE_PYTHON) { $env:WORKNOTE_PYTHON } else { 'python' }
    if (-not (Get-Command $worknotePython -ErrorAction SilentlyContinue)) { throw 'Install Python 3.10 or later and add it to PATH, or set WORKNOTE_PYTHON to python.exe.' }
    & $worknotePython -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.10 or later is required.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd run verify
    if ($LASTEXITCODE -ne 0) { throw 'Repository verification failed.' }
    Write-Host 'Repository setup verified. Use start-windows.ps1 to launch.'
} finally {
    Pop-Location
}
