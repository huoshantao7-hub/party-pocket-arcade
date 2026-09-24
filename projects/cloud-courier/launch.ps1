$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonCommand = $env:LAYA_PYTHON
if (-not $pythonCommand) {
    $knownRuntime = Join-Path (Split-Path -Parent $gameRoot) 'laya_asteroid_benchmark\.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $knownRuntime) { $pythonCommand = $knownRuntime }
}
if (-not $pythonCommand) {
    $installed = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installed) { $pythonCommand = $installed.Source }
}
if (-not $pythonCommand) { throw 'Install Python 3.12+ or set LAYA_PYTHON first.' }
& $pythonCommand -B -X utf8 (Join-Path $gameRoot 'launch.py')
