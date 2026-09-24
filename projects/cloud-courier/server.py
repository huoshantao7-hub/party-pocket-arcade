"""Loopback-only platform game server and genuine offline Laya inference adapter."""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
import mimetypes
import os
from pathlib import Path
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
MODEL_LABEL = 'convaiinnovations/laya · 421M · local CPU'
ACTIONS = ('left', 'right', 'jump_left', 'jump_right', 'wait')
QUESTIONS = {'action': {
    'type': 'choice',
    'instructions': 'Choose one immediate action for this side-scrolling platform game using only the observed geometry and motion. Reach the exit to the right while avoiding pits and enemies. The action remains active until the next decision. A jump action means directional movement plus repeated fixed jump-key pulses; the model does not predict their timing.',
    'criteria': {
        'left': 'Move left along safe ground to retreat or reposition; do not jump.',
        'right': 'Move right along safe ground toward the exit; do not jump.',
        'jump_left': 'Jump and move left to reach a platform or escape danger.',
        'jump_right': 'Jump and move right over a gap, wall, block, or enemy toward the exit.',
        'wait': 'Release movement and jumping because waiting is currently safer or the level is finished.'
    }
}}
STATIC = {name: ROOT / name for name in ('index.html', 'style.css', 'app.js', 'engine.js', 'levels.js', 'renderer.js', 'sound.js', 'favicon.svg')}
STATIC[''] = ROOT / 'index.html'
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.woff2'}


class LayaRuntime:
    def __init__(self):
        self.lock = threading.Lock()
        self.agent = None
        self.state = 'unloaded'
        self.error = None
        self.loading_ms = None
        self.job = None
        self.completed = 0
        self.source = Path(os.environ['LAYA_SOURCE_PATH']).expanduser().resolve() if os.environ.get('LAYA_SOURCE_PATH') else None
        self.model = Path(os.environ['LAYA_MODEL_PATH']).expanduser().resolve() if os.environ.get('LAYA_MODEL_PATH') else None

    def configuration_available(self):
        return bool(self.source and self.model and (self.source / 'laya' / '__init__.py').is_file()
                    and all((self.model / item).is_file() for item in ('model.safetensors', 'rl_agent_config.json', 'tokenizer/tokenizer_config.json', 'encoder/config.json')))

    def status(self):
        with self.lock:
            return {'service': 'laya-cloud-platformer', 'state': self.state,
                    'available': self.configuration_available(), 'busy': self.job is not None or self.state == 'loading',
                    'model': MODEL_LABEL, 'device': 'cpu', 'provider': 'laya_local', 'error': self.error,
                    'loadMs': self.loading_ms, 'completedDecisions': self.completed,
                    'measured': True, 'networkInference': False, 'actions': list(ACTIONS)}

    def load(self):
        with self.lock:
            if self.state == 'ready':
                return 200, {'state': 'ready', 'model': MODEL_LABEL}
            if self.state == 'loading':
                return 202, {'state': 'loading', 'model': MODEL_LABEL}
            if not self.configuration_available():
                self.error = '缺少完整本地模型或 Laya 源码，请配置 LAYA_MODEL_PATH 与 LAYA_SOURCE_PATH。未下载或调用云服务。'
                self.state = 'error'
                return 503, {'error': self.error, 'code': 'model_unavailable'}
            self.state, self.error = 'loading', None
        threading.Thread(target=self._load, daemon=True, name='laya-load').start()
        return 202, {'state': 'loading', 'model': MODEL_LABEL}

    def _load(self):
        started = time.perf_counter()
        try:
            # Enforce offline, credential-free loading from explicitly supplied local paths.
            os.environ['HF_HUB_OFFLINE'] = '1'
            os.environ['TRANSFORMERS_OFFLINE'] = '1'
            os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
            os.environ['TOKENIZERS_PARALLELISM'] = 'false'
            os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
            config = json.loads((self.model / 'tokenizer' / 'tokenizer_config.json').read_text(encoding='utf-8'))
            if config.get('tokenizer_class') in (None, 'TokenizersBackend') or isinstance(config.get('extra_special_tokens'), list):
                raise ValueError('Local tokenizer metadata requires compatibility repair; existing model files are read-only.')
            sys.path.insert(0, str(self.source))
            import torch
            import laya
            torch.set_num_threads(min(4, os.cpu_count() or 1))
            try:
                torch.set_num_interop_threads(1)
            except RuntimeError:
                pass
            agent = laya.load(str(self.model), device='cpu')
            with self.lock:
                self.agent = agent
                self.state = 'ready'
                self.loading_ms = round((time.perf_counter() - started) * 1000, 3)
        except Exception as exc:
            with self.lock:
                self.state = 'error'
                self.error = f'本地模型加载失败（{type(exc).__name__}）。请检查离线模型完整性及 requirements-ai.txt；没有使用替代决策或云服务。'

    def decide(self, observation, request_id, timeout_ms=8000):
        with self.lock:
            if self.state != 'ready' or self.agent is None:
                return 503, {'code': 'model_not_ready', 'error': '请先加载本地 Laya 模型。', 'requestId': request_id}
            if self.job is not None:
                return 429, {'code': 'busy', 'error': '上一条推理仍在运行；没有将本次请求排队。', 'requestId': request_id}
            job = {'id': request_id, 'done': threading.Event(), 'cancelled': False, 'result': None, 'error': None}
            self.job = job
        threading.Thread(target=self._predict, args=(job, observation), daemon=True, name='laya-predict').start()
        if not job['done'].wait(timeout_ms / 1000):
            with self.lock:
                job['cancelled'] = True
            return 504, {'code': 'timeout', 'error': '模型请求超时，迟到结果将丢弃。', 'requestId': request_id}
        if job['cancelled']:
            return 409, {'code': 'cancelled', 'error': '本次模型动作已取消并丢弃。', 'requestId': request_id}
        if job['error']:
            return 500, {'code': 'inference_failed', 'error': job['error'], 'requestId': request_id}
        return 200, job['result']

    def _predict(self, job, observation):
        try:
            started = time.perf_counter()
            prediction = self.agent.predict(observation, QUESTIONS)
            elapsed = (time.perf_counter() - started) * 1000
            answer = prediction['answers']['action']
            if answer.get('type') != 'choice' or answer.get('choice') not in ACTIONS:
                raise ValueError('Invalid typed model action')
            confidence = answer.get('confidence')
            if confidence is not None and (not isinstance(confidence, (int, float)) or not math.isfinite(confidence)):
                raise ValueError('Invalid model confidence')
            payload = {'action': answer['choice'], 'latencyMs': round(elapsed, 3), 'confidence': confidence,
                       'probabilities': answer.get('probabilities', {}), 'requestId': job['id'], 'model': MODEL_LABEL,
                       'engineModel': prediction.get('model'), 'device': 'cpu', 'provider': 'laya_local', 'measured': True,
                       'simulated': False, 'inputTokens': prediction.get('usage', {}).get('input_tokens')}
            with self.lock:
                self.completed += 1
                if not job['cancelled']:
                    job['result'] = payload
        except Exception as exc:
            with self.lock:
                job['error'] = f'真实模型推理失败（{type(exc).__name__}）；未返回规则替代动作。'
        finally:
            with self.lock:
                if self.job is job:
                    self.job = None
                job['done'].set()

    def cancel(self, request_id):
        with self.lock:
            cancelled = self.job is not None and self.job['id'] == request_id
            if cancelled:
                self.job['cancelled'] = True
                self.job['done'].set()
            return {'cancelled': cancelled, 'requestId': request_id, 'busy': self.job is not None,
                    'note': '取消只丢弃动作；已开始的 CPU 前向计算不能安全强杀，结束前拒绝新请求。'}


class GameServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, runtime=None):
        if address[0] != '127.0.0.1':
            raise ValueError('This service may only bind to 127.0.0.1')
        self.runtime = runtime or LayaRuntime()
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server_version = 'LocalPlatformer/1.0'
    def log_message(self, *args):
        pass

    def allowed_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}')

    def send_json(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_bytes(code, data, 'application/json; charset=utf-8')

    def send_bytes(self, code, data, content_type):
        try:
            self.send_response(code)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.allowed_host():
            self.send_json(403, {'error': 'Loopback Host required'}); return
        url = urlsplit(self.path)
        if url.path == '/api/ai/status':
            self.send_json(200, self.server.runtime.status()); return
        name = unquote(url.path).lstrip('/')
        file = STATIC.get(name)
        if file is None and name.startswith('assets/') and Path(name).suffix.lower() in IMAGE_EXTENSIONS:
            candidate = (ROOT / name).resolve()
            if candidate.is_relative_to((ROOT / 'assets').resolve()):
                file = candidate
        if file is None:
            self.send_json(403, {'error': 'Client asset is not public'}); return
        if not file.is_file():
            self.send_json(404, {'error': 'Client asset not found'}); return
        self.send_bytes(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] or 'application/octet-stream')

    def do_POST(self):
        if not self.allowed_host():
            self.send_json(403, {'error': 'Loopback Host required'}); return
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'):
            self.send_json(403, {'error': 'Same-origin request required'}); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 <= length <= 16384:
                raise ValueError('Request body must not exceed 16 KiB')
            payload = json.loads(self.rfile.read(length) or b'{}')
            if not isinstance(payload, dict):
                raise ValueError('JSON object required')
            route = urlsplit(self.path).path
            if route == '/api/ai/load':
                self.send_json(*self.server.runtime.load()); return
            if route in ('/api/ai/decision', '/api/ai/cancel'):
                request_id = payload.get('requestId') or uuid.uuid4().hex
                if not isinstance(request_id, str) or len(request_id) > 80 or not all(c.isalnum() or c in '-_' for c in request_id):
                    raise ValueError('Invalid requestId')
                if route.endswith('/cancel'):
                    self.send_json(200, self.server.runtime.cancel(request_id)); return
                observation = payload.get('observation')
                if isinstance(observation, (dict, list)):
                    observation = json.dumps(observation, ensure_ascii=False, sort_keys=True)
                if not isinstance(observation, str) or not observation.strip() or len(observation) > 6000:
                    raise ValueError('observation must be nonempty text up to 6000 characters')
                timeout_ms = payload.get('timeoutMs', 8000)
                if not isinstance(timeout_ms, (int, float)) or not math.isfinite(timeout_ms):
                    raise ValueError('Invalid timeoutMs')
                self.send_json(*self.server.runtime.decide(observation, request_id, min(15000, max(100, timeout_ms)))); return
            self.send_json(404, {'error': 'Unknown API route'})
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_json(400, {'error': 'Invalid JSON, observation, requestId or timeoutMs'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8785)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    with GameServer(('127.0.0.1', args.port)) as server:
        print(f'Local platformer: http://127.0.0.1:{server.server_port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
