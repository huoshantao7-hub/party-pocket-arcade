"""Discover an optional local Laya installation; otherwise start manual-play server."""
from pathlib import Path
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
ROOT = Path(__file__).resolve().parent
runtime = os.environ.copy()
# This relative legacy-project discovery is optional; no user-specific absolute paths.
for home in (ROOT / '.local' / 'laya', ROOT.parent / 'laya_asteroid_benchmark'):
    if (home / 'upstream' / 'laya').is_dir() and (home / 'model-cache' / 'laya' / 'model.safetensors').is_file():
        runtime.setdefault('LAYA_SOURCE_PATH', str(home / 'upstream'))
        runtime.setdefault('LAYA_MODEL_PATH', str(home / 'model-cache' / 'laya'))
        candidate = home / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        if candidate.is_file():
            runtime.setdefault('LAYA_PYTHON', str(candidate))
        break
runtime['PYTHONDONTWRITEBYTECODE'] = '1'
python = runtime.get('LAYA_PYTHON', sys.executable)
url = 'http://127.0.0.1:8785'
try:
    import json
    with urllib.request.urlopen(url + '/api/ai/status', timeout=2) as response:
        if json.load(response).get('service') != 'laya-cloud-platformer':
            raise SystemExit('Port 8785 belongs to another service.')
except (OSError, ValueError):
    process = subprocess.Popen([python, '-B', '-X', 'utf8', str(ROOT / 'server.py')], cwd=ROOT, env=runtime,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    for _ in range(40):
        try:
            with urllib.request.urlopen(url + '/api/ai/status', timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            if process.poll() is not None:
                raise SystemExit('Server failed to start. Run server.py in a terminal for details.')
            time.sleep(.15)
    else:
        raise SystemExit('The local game service did not become ready.')
if '--no-browser' not in sys.argv:
    webbrowser.open(url)
print(url)
