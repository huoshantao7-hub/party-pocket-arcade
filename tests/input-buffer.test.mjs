import test from 'node:test';
import assert from 'node:assert/strict';
import { createSendQueue, createRemoteInputBuffer, normalizeInput } from '../shared/input-buffer.js';

test('sender preserves both button edges while an earlier POST is in flight', () => {
  const q = createSendQueue(); q.enqueue({}); const inFlight = q.take();
  q.enqueue({ action: true }); q.enqueue({ action: false });
  assert.equal(inFlight.action, false);
  assert.deepEqual([q.take().action, q.take().action], [true, false]);
  assert.equal(q.length, 0);
});
test('movement coalesces without erasing action or alternate transitions', () => {
  const q = createSendQueue(); q.enqueue({ x: 1 }); q.enqueue({ x: -.5 });
  q.enqueue({ x: -.5, action: true }); q.enqueue({ x: .3, action: true });
  q.enqueue({ alt: true }); q.enqueue({});
  assert.equal(q.length, 4);
  assert.deepEqual(Array.from({ length: 4 }, () => q.take()), [
    { x: -.5, y: 0, action: false, alt: false }, { x: .3, y: 0, action: true, alt: false },
    { x: 0, y: 0, action: false, alt: true }, { x: 0, y: 0, action: false, alt: false }
  ]);
});
test('failed sends retry ahead of their release; reset discards queued actions', () => {
  const q = createSendQueue(); q.enqueue({ action: true }); const failed = q.take();
  q.enqueue({}); q.retry(failed); assert.equal(q.take().action, true); assert.equal(q.take().action, false);
  q.enqueue({ alt: true }); q.clear(); assert.equal(q.length, 0);
});
test('receiver latches a tap for one tick, then releases held and pressed state', () => {
  const b = createRemoteInputBuffer(); b.receive(0, { action: true, alt: true }); b.receive(0, {});
  assert.deepEqual(b.consume(0), { x: 0, y: 0, action: true, alt: true, pressed: true, altPressed: true });
  assert.deepEqual(b.consume(0), { x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
  assert.equal(b.consume(1).pressed, false);
});
test('receiver counts distinct taps but does not repeat a held button or its retry', () => {
  const b = createRemoteInputBuffer(); b.receive(0, { action: true }); b.receive(0, { action: true });
  assert.equal(b.consume(0).pressed, true); assert.equal(b.consume(0).pressed, false); assert.equal(b.consume(0).action, true);
  b.receive(0, {}); b.receive(0, { action: true }); b.receive(0, {}); b.receive(0, { action: true }); b.receive(0, {});
  assert.equal(b.consume(0).pressed, true); assert.equal(b.consume(0).pressed, true); assert.equal(b.consume(0).pressed, false);
});
test('paused input, stale/disconnected player, reset and invalid axes cannot leak queued actions', () => {
  const b = createRemoteInputBuffer(); b.receive(0, { action: true }); b.clear(); assert.equal(b.consume(0).pressed, false);
  b.receive(1, { alt: true }, false); assert.equal(b.consume(1).altPressed, false); b.clear(1); assert.equal(b.consume(1).alt, false);
  assert.deepEqual(normalizeInput({ x: 2, y: NaN }), { x: 1, y: 0, action: false, alt: false });
});
