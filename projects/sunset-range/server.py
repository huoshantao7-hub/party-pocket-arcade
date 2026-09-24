"""Standard-library, loopback-only static server for Sunset Target Range."""
from __future__ import annotations
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
SERVICE = 'sunset-target-range'
PUBLIC_FILES = {
    'index.html': 'text/html; charset=utf-8',
    'style.css': 'text/css; charset=utf-8',
    'app.js': 'text/javascript; charset=utf-8',
    'renderer.js': 'text/javascript; charset=utf-8',
    'engine.js': 'text/javascript; charset=utf-8',
    'sound.js': 'text/javascript; charset=utf-8',
    'favicon.svg': 'image/svg+xml; charset=utf-8',
}


class RangeServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address=('127.0.0.1', 8786), root=ROOT):
        if address[0] != '127.0.0.1':
            raise ValueError('Only the loopback address 127.0.0.1 may be used.')
        self.root = Path(root).resolve()
        super().__init__(address, RangeHandler)


class RangeHandler(BaseHTTPRequestHandler):
    server_version = 'SunsetRange/1.0'
    def log_message(self, *args):
        pass

    def reply(self, status, body, mime='application/json; charset=utf-8'):
        if isinstance(body, dict):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        port = self.server.server_port
        if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
            self.reply(403, {'error': 'Loopback Host required'}); return
        route = urlsplit(self.path).path
        if route == '/api/health':
            self.reply(200, {'service': SERVICE}); return
        name = unquote(route).lstrip('/') or 'index.html'
        if name not in PUBLIC_FILES:
            self.reply(403, {'error': 'This path is not a public client asset'}); return
        file = (self.server.root / name).resolve()
        if not file.is_relative_to(self.server.root):
            self.reply(403, {'error': 'Asset must remain inside the project'}); return
        if not file.is_file():
            self.reply(404, {'error': 'Client asset not found'}); return
        self.reply(200, file.read_bytes(), PUBLIC_FILES[name])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8786)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    with RangeServer(('127.0.0.1', args.port)) as server:
        print(f'Sunset Target Range: http://127.0.0.1:{server.server_port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
