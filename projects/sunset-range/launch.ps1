param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$rangeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rangePython = $env:TARGET_RANGE_PYTHON
if (-not $rangePython) {
    foreach ($candidate in @((Join-Path $rangeRoot '.venv\Scripts\python.exe'), (Join-Path (Split-Path -Parent $rangeRoot) 'laya_asteroid_benchmark\.venv\Scripts\python.exe'))) {
        if (Test-Path -LiteralPath $candidate) { $rangePython = $candidate; break }
    }
}
if (-not $rangePython) {
    $available = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($available) { $rangePython = $available.Source }
}
if (-not $rangePython) { throw 'Install Python 3.10+ or set TARGET_RANGE_PYTHON.' }
$rangeArgs = @('-B', '-X', 'utf8', (Join-Path $rangeRoot 'launch.py'))
if ($NoBrowser) { $rangeArgs += '--no-browser' }
& $rangePython @rangeArgs
if ($LASTEXITCODE -ne 0) { throw 'The local range could not start.' }
