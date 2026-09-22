const idle = () => ({ x: 0, y: 0, action: false, alt: false });
const axis = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
export const normalizeInput = (value = {}) => ({ x: axis(value.x), y: axis(value.y), action: !!value.action, alt: !!value.alt });

// Only movement snapshots may collapse. Every button transition stays ordered.
export function createSendQueue() {
  const pending = [];
  return {
    enqueue(value) {
      const input = normalizeInput(value), tail = pending.at(-1);
      if (tail && tail.action === input.action && tail.alt === input.alt) pending[pending.length - 1] = input;
      else pending.push(input);
    },
    take() { return pending.shift(); },
    retry(input) { pending.unshift(normalizeInput(input)); },
    clear() { pending.length = 0; },
    get length() { return pending.length; }
  };
}

// SSE can deliver a complete tap between frames. Each rising edge gets a tick.
export function createRemoteInputBuffer(playerCount = 2) {
  const states = Array.from({ length: playerCount }, idle);
  const edges = Array.from({ length: playerCount }, () => ({ action: 0, alt: 0 }));
  const clear = i => { states[i] = idle(); edges[i] = { action: 0, alt: 0 }; };
  return {
    receive(i, value, captureEdges = true) {
      if (!states[i]) return;
      const input = normalizeInput(value);
      if (captureEdges) {
        for (const key of ['action', 'alt']) if (input[key] && !states[i][key]) edges[i][key]++;
      } else edges[i] = { action: 0, alt: 0 };
      states[i] = input;
    },
    consume(i) {
      if (!states[i]) return { ...idle(), pressed: false, altPressed: false };
      const pressed = edges[i].action > 0, altPressed = edges[i].alt > 0;
      if (pressed) edges[i].action--;
      if (altPressed) edges[i].alt--;
      return { ...states[i], action: states[i].action || pressed, alt: states[i].alt || altPressed, pressed, altPressed };
    },
    clear(i) { if (i === undefined) states.forEach((_, index) => clear(index)); else if (states[i]) clear(i); }
  };
}
