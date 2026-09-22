import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../games/kitchen.js';

const blank = () => ({ x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
function tick(g, seconds, inputs = [blank(), blank()]) { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60, inputs); }
function tap(g, player, alt = false) { const inputs = [blank(), blank()]; inputs[player][alt ? 'altPressed' : 'pressed'] = true; g.update(1 / 60, inputs); }
function at(g, player, station) { const s = g.getState().stations.find(x => x.id === station); const offsets = { pantry: [85, 0], prep: [0, 67], pass: [player ? 87 : -87, 0], stove: [0, 67], serve: [-85, 0] }; const [dx, dy] = offsets[station]; g.__test.place(player, s.x + dx, s.y + dy); }

test('kitchen: separate directional inputs move independent chefs, diagonal speed is bounded', () => {
  const g = createGame(), a = g.getState(); tick(g, .4, [{ ...blank(), x: -1 }, { ...blank(), x: 1, y: 1 }]); const b = g.getState();
  assert.ok(b.players[0].x < a.players[0].x - 65); assert.ok(b.players[1].x > a.players[1].x + 45);
  assert.ok(Math.hypot(b.players[1].x - a.players[1].x, b.players[1].y - a.players[1].y) <= 80);
});

test('kitchen: raw ingredients cannot score; full two-chef recipe awards actual relay points', () => {
  const g = createGame({ debug: true }); at(g, 0, 'pantry'); tap(g, 0);
  assert.equal(g.getState().players[0].carry.stage, 'raw');
  at(g, 0, 'serve'); tap(g, 0); assert.equal(g.getState().teamScore, 0); assert.equal(g.getState().served, 0);
  at(g, 0, 'prep'); tap(g, 0); assert.equal(g.getState().players[0].carry, null);
  tap(g, 0); assert.equal(g.getState().players[0].carry, null, 'processing cannot be skipped');
  tick(g, 2.2); tap(g, 0); assert.equal(g.getState().players[0].carry.stage, 'chopped');
  at(g, 0, 'pass'); tap(g, 0); at(g, 1, 'pass'); tap(g, 1); assert.deepEqual(g.getState().players[1].carry.handlers, [0, 1]);
  at(g, 1, 'stove'); tap(g, 1); tick(g, 2.9); tap(g, 1); assert.equal(g.getState().players[1].carry.stage, 'cooked');
  at(g, 1, 'serve'); tap(g, 1); const s = g.getState(); assert.equal(s.served, 1); assert.equal(s.teamScore, 140); assert.equal(s.players[0].score, 70); assert.equal(s.players[1].score, 70); assert.equal(s.players[1].carry, null);
  tap(g, 1); assert.equal(g.getState().teamScore, 140, 'empty-handed delivery must not score twice');
});

test('kitchen: direct handoff requires nearby empty-handed partner and preserves ingredient', () => {
  const g = createGame({ debug: true }); at(g, 0, 'pantry'); tap(g, 0); const id = g.getState().players[0].carry.id;
  tap(g, 0, true); assert.ok(g.getState().players[0].carry, 'cannot pass across kitchen');
  g.__test.place(0, 250, 420); g.__test.place(1, 310, 420); tap(g, 0, true);
  const s = g.getState(); assert.equal(s.players[0].carry, null); assert.equal(s.players[1].carry.id, id); assert.deepEqual(s.players[1].carry.handlers, [0, 1]);
});

test('kitchen: orders expire, round ends once and post-end state is frozen', () => {
  let calls = 0; const g = createGame({ end: () => calls++ }); tick(g, 26); assert.equal(g.getState().expired, 1); tick(g, 50); const s = g.getState();
  assert.equal(s.ended, true); assert.equal(s.timeLeft, 0, 'finished timer is exactly zero, never ceil to 1'); assert.equal(s.elapsed, 75); assert.equal(calls, 1); tick(g, 2, [{ ...blank(), x: 1, pressed: true }, blank()]); assert.deepEqual(g.getState(), s); assert.equal(calls, 1);
});

test('kitchen: bots process, hand off and deliver without bypassing controls; seeded runs replay exactly', () => {
  const run = () => { const g = createGame({ seed: 451 }); const was = [false, false]; for (let i = 0; i < 4600; i++) { const inputs = [0, 1].map(p => { const input = g.bot(p); input.pressed = input.action && !was[p]; was[p] = input.action; return input; }); g.update(1 / 60, inputs); } return g.getState(); };
  const a = run(), b = run(); assert.deepEqual(a, b); assert.ok(a.served >= 4, `expected playable kitchen, got ${a.served} meals`); assert.ok(a.events.some(e => e.type === 'serve' && e.relay)); assert.equal(a.ended, true);
});
