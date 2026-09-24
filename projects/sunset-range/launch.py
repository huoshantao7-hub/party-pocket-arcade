"""Start the local range without opening a console window for its server."""
from pathlib import Path
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8786'
SERVICE = 'sunset-target-range'


def healthy():
    try:
        with urllib.request.urlopen(URL + '/api/health', timeout=1) as response:
            if json.load(response).get('service') != SERVICE:
                raise RuntimeError('Port 8786 is occupied by another service.')
            return True
    except urllib.error.HTTPError:
        raise RuntimeError('Port 8786 is occupied by another service.')
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return False
    except (json.JSONDecodeError, AttributeError):
        raise RuntimeError('Port 8786 returned an unexpected response.')


def main():
    if not healthy():
        python = os.environ.get('TARGET_RANGE_PYTHON')
        if not python:
            executable = 'Scripts/python.exe' if os.name == 'nt' else 'bin/python'
            for folder in (ROOT / '.venv', ROOT.parent / 'laya_asteroid_benchmark' / '.venv'):
                candidate = folder / executable
                if candidate.is_file():
                    python = str(candidate)
                    break
        python = python or sys.executable
        process = subprocess.Popen([python, '-B', '-X', 'utf8', str(ROOT / 'server.py')], cwd=ROOT,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(35):
            if healthy():
                break
            if process.poll() is not None:
                raise RuntimeError('Server could not start. Run python server.py in a terminal for details.')
            time.sleep(.15)
        else:
            raise RuntimeError('The local range did not become ready.')
    if '--no-browser' not in sys.argv:
        webbrowser.open(URL)
    print(URL)


if __name__ == '__main__':
    main()
