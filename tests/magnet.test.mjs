import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../games/magnet.js';
const blank = () => ({ x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
function tick(g, seconds, inputs = [blank(), blank()]) { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60, inputs); }

test('magnet: independent directions, bounded motion and shared magnetic tether', () => {
  const g = createGame(); const a = g.getState(); tick(g, .08, [{ ...blank(), y: -1 }, { ...blank(), y: 1 }]); let s = g.getState(); assert.ok(s.players[0].y < a.players[0].y); assert.ok(s.players[1].y > a.players[1].y);
  tick(g, 1.4, [{ ...blank(), x: -1 }, { ...blank(), x: 1 }]); s = g.getState(); assert.ok(Math.hypot(s.players[0].x - s.players[1].x, s.players[0].y - s.players[1].y) <= 311);
});

test('magnet: one player cannot unlock a star; both matching switches unlock and collection scores once', () => {
  const g = createGame({ seed: 92, debug: true }); const pads = g.getState().pads;
  g.__test.place(0, pads[0].x, pads[0].y); tick(g, 1.8); assert.equal(g.getState().ready, false); assert.equal(g.getState().stars, 0);
  for (let i = 0; i < 240 && !g.getState().ready; i++) { pads.forEach((p, index) => g.__test.place(index, p.x, p.y)); g.update(1 / 60, [blank(), blank()]); }
  let s = g.getState(); assert.equal(s.ready, true); assert.equal(s.stars, 0); assert.ok(s.events.some(e => e.type === 'unlock'));
  g.__test.place(0, s.star.x, s.star.y); g.update(1 / 60, [blank(), blank()]); s = g.getState(); assert.equal(s.stars, 1); assert.equal(s.ready, false); assert.ok(s.players[0].score >= 95); assert.ok(s.players[1].score >= 45);
  tick(g, .2); assert.equal(g.getState().stars, 1, 'collected star cannot be collected twice');
});

test('magnet: shield protects collisions and respects cooldown; unshielded collisions are real', () => {
  const g = createGame({ seed: 12, debug: true }); tick(g, .7); let s = g.getState(); let hazard = s.hazards[0]; g.__test.place(0, hazard.x, hazard.y); g.__test.place(1, hazard.x + 70, hazard.y);
  g.update(1 / 60, [{ ...blank(), pressed: true }, blank()]); s = g.getState(); assert.equal(s.players[0].hits, 0); assert.ok(s.players[0].shield > 0); assert.equal(s.events.filter(e => e.type === 'shield' && e.player === 0).length, 1);
  g.update(1 / 60, [{ ...blank(), pressed: true }, blank()]); assert.equal(g.getState().events.filter(e => e.type === 'shield' && e.player === 0).length, 1);
  tick(g, 1.2); s = g.getState(); hazard = s.hazards[0]; g.__test.place(0, hazard.x, hazard.y); g.__test.place(1, hazard.x + 70, hazard.y); g.update(1 / 60, [blank(), blank()]); assert.ok(g.getState().players[0].hits > 0);
});

test('magnet: bots cooperate through real controls; deterministic seed and single end event', () => {
  function run() { let ends = 0; const g = createGame({ seed: 143, end: () => ends++ }), was = [false, false]; for (let i = 0; i < 4600; i++) { const inputs = [0, 1].map(p => { const input = g.bot(p); input.pressed = input.action && !was[p]; was[p] = input.action; return input; }); g.update(1 / 60, inputs); } return { state: g.getState(), ends }; }
  const a = run(), b = run(); assert.deepEqual(a, b); assert.equal(a.ends, 1); assert.equal(a.state.ended, true); assert.ok(a.state.stars >= 16, `bot cooperation should work, got ${a.state.stars}`); assert.equal(a.state.elapsed, 75); assert.equal(a.state.timeLeft, 0, 'finished timer is exactly zero, never ceil to 1'); assert.ok(a.state.events.some(e => e.type === 'unlock')); assert.ok(a.state.players.every(p => Number.isFinite(p.score)));
});
