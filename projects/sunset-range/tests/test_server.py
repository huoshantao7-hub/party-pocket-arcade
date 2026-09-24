import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import PUBLIC_FILES, RangeServer


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / 'index.html').write_text('<h1>range fixture</h1>', encoding='utf-8')
        (cls.root / 'server.py').write_text('not public', encoding='utf-8')
        (cls.root / 'app.js').write_text('export const fixture = true;', encoding='utf-8')
        cls.server = RangeServer(('127.0.0.1', 0), cls.root)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join(2)
        cls.temp.cleanup()
    def request(self, path, headers=None, method=None):
        req = urllib.request.Request(self.url + path, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=2) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers
    def test_loopback_only(self):
        with self.assertRaises(ValueError):
            RangeServer(('0.0.0.0', 0), self.root)
    def test_health_and_public_files(self):
        status, body, _ = self.request('/api/health')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'service': 'sunset-target-range'})
        self.assertEqual(self.request('/')[1], b'<h1>range fixture</h1>')
        status, _, headers = self.request('/app.js?v=1')
        self.assertEqual(status, 200)
        self.assertIn('javascript', headers['Content-Type'])
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(self.request('/sound.js')[0], 404)
    def test_private_paths_and_directory_listing_rejected(self):
        for path in ('/server.py', '/launch.py', '/.env', '/qa/', '/tests/', '/../server.py', '/%2e%2e/server.py', '/%2e%2e%2findex.html', '/other/index.html'):
            self.assertEqual(self.request(path)[0], 403, path)
    def test_host_head_and_no_write_api(self):
        self.assertEqual(self.request('/api/health', {'Host': 'unrelated.example'})[0], 403)
        self.assertEqual(self.request('/', method='HEAD')[1], b'')
        self.assertEqual(self.request('/api/health', method='POST')[0], 501)


if __name__ == '__main__':
    unittest.main(verbosity=2)
