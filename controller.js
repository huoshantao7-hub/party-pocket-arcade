import { empty, controlMarkup, bindTouch } from './shared/controls.js';
import { createSendQueue } from './shared/input-buffer.js';
const $ = x => document.getElementById(x);
let session = null, current = empty(), busy = false, controller = null, outgoing = createSendQueue();
const room = new URLSearchParams(location.search).get('room');
if (room) $('room-input').value = room.toUpperCase();

async function post(route, body) {
  const r = await fetch('/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), j = await r.json();
  if (!r.ok) throw Error(j.error || '连接失败');
  return j;
}
async function send() {
  if (!session || busy) return;
  const activeSession = session, queue = outgoing;
  busy = true;
  try {
    while (session === activeSession && queue.length) {
      const input = queue.take();
      try { await post('input', { ...activeSession, input }); }
      catch (error) { if (session === activeSession) queue.retry(input); throw error; }
      if (session !== activeSession) break;
      $('controller-status').textContent = `已连接 ${activeSession.code} · P${activeSession.slot + 1} · ${activeSession.title}`;
      $('controller-status').classList.remove('error');
    }
  } catch (error) {
    if (session === activeSession) {
      $('controller-status').textContent = error.message;
      $('controller-status').classList.add('error');
    }
  } finally {
    busy = false;
    if (session && session !== activeSession) send();
  }
}
function enqueue() { if (session) { outgoing.enqueue(current); send(); } }
$('join-form').onsubmit = async e => {
  e.preventDefault(); $('join').disabled = true;
  try {
    const j = await post('join', { code: $('room-input').value.trim().toUpperCase(), slot: +$('slot').value });
    session = j; current = empty(); outgoing = createSendQueue();
    $('controller-controls').hidden = false; $('join-form').hidden = true; $('leave').hidden = false;
    $('controller-controls').innerHTML = controlMarkup(0, `P${j.slot + 1} · ${j.title}`);
    controller = bindTouch($('controller-controls'), states => { current = states[0]; enqueue(); });
    enqueue();
  } catch (error) { $('controller-status').textContent = error.message; $('controller-status').classList.add('error'); }
  finally { $('join').disabled = false; }
};
async function leave() {
  const old = session; session = null; current = empty(); outgoing.clear(); controller?.clear();
  if (old) try { await post('leave', old); } catch {}
  $('controller-controls').hidden = true; $('join-form').hidden = false; $('leave').hidden = true;
  $('controller-status').textContent = '已退出，可以加入下一局。';
}
$('leave').onclick = leave;
setInterval(enqueue, 350);
document.addEventListener('visibilitychange', () => { if (document.hidden) { current = empty(); enqueue(); } });
addEventListener('pagehide', () => {
  if (session) navigator.sendBeacon('/api/leave', new Blob([JSON.stringify(session)], { type: 'application/json' }));
});
