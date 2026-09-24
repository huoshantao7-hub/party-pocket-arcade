import importlib.util
import json
from pathlib import Path
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server import ACTIONS, GameServer, LayaRuntime


class ControlledAgent:
    """Explicit unit-test double, never available through the live application."""
    def __init__(self):
        self.started = threading.Event()
        self.release = threading.Event()
    def predict(self, state, questions):
        self.started.set()
        self.release.wait(2)
        return {'model': 'unit-test-double', 'answers': {'action': {'type': 'choice', 'choice': 'right', 'confidence': .2, 'probabilities': {'right': 1}}}}


class RuntimeTests(unittest.TestCase):
    def configured(self):
        runtime = LayaRuntime()
        runtime.agent = ControlledAgent()
        runtime.state = 'ready'
        return runtime
    def wait_idle(self, runtime):
        until = time.monotonic() + 2
        while runtime.status()['busy'] and time.monotonic() < until:
            time.sleep(.01)
        self.assertFalse(runtime.status()['busy'])
    def test_unloaded_returns_no_action(self):
        runtime = LayaRuntime()
        code, data = runtime.decide('facts', 'not-loaded')
        self.assertEqual(code, 503)
        self.assertNotIn('action', data)
    def test_busy_rejects_without_queue_and_cancel_discards(self):
        runtime = self.configured()
        result = []
        thread = threading.Thread(target=lambda: result.append(runtime.decide('facts', 'first', 2000)))
        thread.start()
        try:
            self.assertTrue(runtime.agent.started.wait(1))
            self.assertEqual(runtime.decide('facts', 'second')[0], 429)
            self.assertTrue(runtime.cancel('first')['cancelled'])
            thread.join(1)
            self.assertEqual(result[0][0], 409)
            self.assertNotIn('action', result[0][1])
            self.assertTrue(runtime.status()['busy'])
        finally:
            runtime.agent.release.set()
            thread.join(2)
        self.wait_idle(runtime)
    def test_timeout_drops_late_answer_and_accepts_fresh_request(self):
        runtime = self.configured()
        try:
            code, data = runtime.decide('facts', 'expired', 20)
            self.assertEqual(code, 504)
            self.assertNotIn('action', data)
            self.assertTrue(runtime.status()['busy'])
        finally:
            runtime.agent.release.set()
        self.wait_idle(runtime)
        code, data = runtime.decide('new facts', 'fresh')
        self.assertEqual(code, 200)
        self.assertEqual(data['requestId'], 'fresh')
        self.assertIn(data['action'], ACTIONS)
    def test_binding_is_loopback_only(self):
        with self.assertRaises(ValueError):
            GameServer(('0.0.0.0', 0))


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runtime = LayaRuntime()
        runtime.source = runtime.model = None
        cls.server = GameServer(('127.0.0.1', 0), runtime)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(2)
    def call(self, path, payload=None, headers=None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(self.url + path, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
    def test_no_private_files_or_traversal(self):
        for path in ('/server.py', '/requirements-ai.txt', '/.env', '/qa/real-laya-smoke.json', '/%2e%2e/server.py', '/assets/%2e%2e/server.py'):
            self.assertEqual(self.call(path)[0], 403, path)
        self.assertEqual(self.call('/api/ai/status')[0], 200)
        self.assertEqual(self.call('/')[0], 200)
    def test_host_origin_and_invalid_observation_rejected(self):
        self.assertEqual(self.call('/api/ai/status', headers={'Host': 'unrelated.example'})[0], 403)
        self.assertEqual(self.call('/api/ai/load', {}, {'Origin': 'https://unrelated.example'})[0], 403)
        self.assertEqual(self.call('/api/ai/decision', {'observation': ''})[0], 400)
        self.assertEqual(self.call('/api/ai/decision', {'observation': 'x' * 7000})[0], 400)
        self.assertEqual(self.call('/api/ai/load', {})[0], 503)


if __name__ == '__main__':
    unittest.main(verbosity=2)
