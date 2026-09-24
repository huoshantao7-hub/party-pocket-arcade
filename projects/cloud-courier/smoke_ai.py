"""Real offline Laya smoke against a running loopback server. No simulated inference."""
import argparse
import hashlib
import json
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parent

def request(route, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request('http://127.0.0.1:8785' + route, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)

start = time.perf_counter()
request('/api/ai/load', {})
while True:
    status = request('/api/ai/status')
    if status['state'] == 'ready':
        break
    if status['state'] == 'error':
        raise RuntimeError(status['error'])
    if time.perf_counter() - start > 300:
        raise TimeoutError('Local model did not load in 300 seconds')
    time.sleep(1)
observations = [
    'Side-scrolling platform game. Status playing. The exit is 800 pixels to the right. Player is on the ground, vx=0, vy=0, hp=3, can_jump=true. Safe ground extends 500 pixels to the right. No wall, gap, or enemy within 300 pixels.',
    'Side-scrolling platform game. Status playing. The exit is 800 pixels to the right. Player is on the ground, vx=140, vy=0, hp=3, can_jump=true. Nearest ground edge is 28 pixels to the right. A 90-pixel-wide pit begins there, followed by safe ground. No enemy nearby.',
    'Side-scrolling platform game. Status playing. The exit is 500 pixels to the right. Player is on the ground, vx=80, vy=0, hp=3, can_jump=true. Ground is continuous. An enemy is 38 pixels to the right, moving left. No wall nearby.'
]
results = []
for i, observation in enumerate(observations):
    response = request('/api/ai/decision', {'requestId': f'real-smoke-{i}', 'observation': observation, 'timeoutMs': 15000})
    assert response['measured'] is True and response['simulated'] is False
    assert response['action'] in ('left', 'right', 'jump_left', 'jump_right', 'wait')
    assert response['latencyMs'] > 0
    results.append({'observation': observation, 'response': response})
    print(json.dumps({'case': i, 'action': response['action'], 'latencyMs': response['latencyMs'], 'confidence': response['confidence']}, ensure_ascii=False), flush=True)
report = {'real_model': True, 'simulated': False, 'provider': 'laya_local', 'device': 'cpu',
          'method': 'Three controlled English fact observations sent to the real loaded model. This verifies local inference, not level completion or generalized game skill.',
          'network_inference': False, 'loadMs': status['loadMs'], 'results': results,
          'status': request('/api/ai/status')}
(ROOT / 'qa').mkdir(exist_ok=True)
(ROOT / 'qa' / 'real-laya-smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
