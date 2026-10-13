param(
    [switch]$WithAI,
    [ValidateRange(1024,65535)][int]$Port = 3000
)
$ErrorActionPreference = 'Stop'
$worknoteRoot = Split-Path $PSScriptRoot -Parent
$worknotePreviousPort = $env:PORT
$worknotePreviousKey = $env:OPENAI_API_KEY
$worknoteSecret = $null
Push-Location $worknoteRoot
try {
    $worknoteNodeVersion = & node --version
    if ($worknoteNodeVersion -notmatch '^v24\.' -or [version]($worknoteNodeVersion.TrimStart('v')) -lt [version]'24.19.0') { throw 'Node.js 24.19.0 or later in the 24.x series is required.' }
    $env:PORT = [string]$Port
    if ($WithAI -and -not $env:OPENAI_API_KEY) {
        $worknoteSecret = Read-Host 'OpenAI API key (not displayed)' -AsSecureString
        $env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $worknoteSecret).Password
    }
    Write-Host "Open http://127.0.0.1:$Port in your browser. Ctrl+C stops the local server."
    & npm.cmd start
    if ($LASTEXITCODE -ne 0) { throw 'Application exited with an error.' }
} finally {
    if ($null -eq $worknotePreviousPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $worknotePreviousPort }
    if ($null -eq $worknotePreviousKey) { Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue } else { $env:OPENAI_API_KEY = $worknotePreviousKey }
    if ($null -ne $worknoteSecret) { $worknoteSecret.Dispose() }
    Pop-Location
}
