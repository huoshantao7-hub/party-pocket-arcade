"""Bounded offline prompt probe; never modifies or replaces live-model actions."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT = Path(__file__).resolve().parent
REPORT = ROOT / 'qa' / 'prompt-probe.json'

def save(data):
    REPORT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

if '--worker' not in sys.argv:
    before = time.perf_counter()
    try:
        completed = subprocess.run([sys.executable, '-B', '-X', 'utf8', str(Path(__file__)), '--worker'], timeout=120, check=False)
        if completed.returncode:
            raise SystemExit(completed.returncode)
    except subprocess.TimeoutExpired:
        data = json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else {}
        data.update({'status': 'time_budget_exceeded', 'budgetSeconds': 120, 'totalSeconds': round(time.perf_counter()-before,3), 'liveServerChanged': False})
        save(data)
        print('Prompt probe stopped at 120-second bound; live service unchanged.', flush=True)
    raise SystemExit()

sys.dont_write_bytecode = True
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
sys.path.insert(0, os.environ['LAYA_SOURCE_PATH'])
started = time.perf_counter()
data = {'real_model': True, 'simulated': False, 'status': 'loading', 'budgetSeconds':120, 'maxPredictions':6, 'variants':[], 'liveServerChanged':False}
save(data)
import torch
import laya
torch.set_num_threads(4)
torch.set_num_interop_threads(1)
agent = laya.load(os.environ['LAYA_MODEL_PATH'], device='cpu')
data['loadSeconds'] = round(time.perf_counter()-started,3)
data['status'] = 'probing'
save(data)
observations = [item['observation'] for item in json.loads((ROOT/'qa'/'real-laya-smoke.json').read_text(encoding='utf-8'))['results']]
variants = [
    {'name':'short_action_names','question':{'type':'choice','instructions':'Choose the next move in this platform game.','criteria':{'left':'Move left.','right':'Move right.','jump_left':'Jump to the left.','jump_right':'Jump to the right.','wait':'Stand still.'}}},
    {'name':'short_goal_context','question':{'type':'choice','instructions':'Which move best advances toward the exit without falling or hitting an enemy?','criteria':{'left':'Walk left without jumping.','right':'Walk right without jumping.','jump_left':'Jump left.','jump_right':'Jump right.','wait':'Stop moving and wait.'}}}
]
for variant in variants:
    row={'name':variant['name'],'question':variant['question'],'results':[]}
    data['variants'].append(row)
    for index, observation in enumerate(observations):
        tick=time.perf_counter()
        prediction=agent.predict(observation,{'action':variant['question']})
        elapsed=(time.perf_counter()-tick)*1000
        answer=prediction['answers']['action']
        assert answer['choice'] in ('left','right','jump_left','jump_right','wait')
        row['results'].append({'case':index,'observation':observation,'latencyMs':round(elapsed,3),'answer':answer})
        print(json.dumps({'variant':variant['name'],'case':index,'action':answer['choice'],'latencyMs':round(elapsed,3)},ensure_ascii=False),flush=True)
        save(data)
data['status']='complete'
data['totalSeconds']=round(time.perf_counter()-started,3)
save(data)
