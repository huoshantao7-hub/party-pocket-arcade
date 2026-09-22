$ErrorActionPreference = 'Stop'
$partyProject = Split-Path -Parent $MyInvocation.MyCommand.Path
$partyPort = 8770
if ($env:PARTY_PORT) {
    $partyParsedPort = 0
    if (-not [int]::TryParse($env:PARTY_PORT, [ref]$partyParsedPort) -or $partyParsedPort -lt 1 -or $partyParsedPort -gt 65535) {
        throw 'PARTY_PORT must be a port number between 1 and 65535.'
    }
    $partyPort = $partyParsedPort
}
$partyUrl = "http://127.0.0.1:$partyPort"
$partyHealth = $null
try { $partyHealth = Invoke-RestMethod -Uri "$partyUrl/api/health" -TimeoutSec 2 } catch { }
if ($partyHealth -and $partyHealth.service -ne 'party-pocket-arcade') {
    throw "Port $partyPort is occupied by another service."
}
if (-not $partyHealth) {
    $partyNodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $partyNodeCommand) {
        throw 'Install Node.js 20+ and make sure node is available on PATH.'
    }
    $partyNode = $partyNodeCommand.Source
    $partyVersion = & $partyNode --version
    if ($LASTEXITCODE -ne 0 -or $partyVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
        throw 'Node.js 20 or newer is required.'
    }
    $partyServer = Join-Path $partyProject 'server.mjs'
    if (-not (Test-Path -LiteralPath $partyServer -PathType Leaf)) {
        throw 'server.mjs is missing; extract the complete project folder first.'
    }
    $partyProcess = Start-Process -FilePath $partyNode -ArgumentList ('"' + $partyServer + '"') -WorkingDirectory $partyProject -WindowStyle Hidden -PassThru
    for ($partyAttempt = 0; $partyAttempt -lt 20 -and -not $partyHealth; $partyAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $partyHealth = Invoke-RestMethod -Uri "$partyUrl/api/health" -TimeoutSec 1 } catch { }
        if ($partyProcess.HasExited -and -not $partyHealth) { break }
    }
    if (-not $partyHealth -or $partyHealth.service -ne 'party-pocket-arcade') {
        throw "Game service could not start on port $partyPort. Try node server.mjs in a terminal for details."
    }
}
Start-Process $partyUrl
