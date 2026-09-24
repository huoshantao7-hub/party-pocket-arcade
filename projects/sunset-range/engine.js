export const WEAPONS = Object.freeze({
  pistol: Object.freeze({ id: 'pistol', name: '星火手枪', capacity: 8, cooldown: .25, reload: 1.1 }),
  rifle: Object.freeze({ id: 'rifle', name: '流光连发器', capacity: 18, cooldown: .10, reload: 1.6 })
});
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const decrease = (value, dt) => value - dt <= 1e-9 ? 0 : value - dt;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const idlePoint = { x: 480, y: 510 };
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normalize(options = {}) {
  const mode = ['challenge', 'practice', 'duel'].includes(options.mode) ? options.mode : 'challenge';
  const duration = mode === 'practice' ? null : Number.isFinite(options.duration) && options.duration > 0 ? clamp(options.duration, .1, 3600) : mode === 'duel' ? 30 : 60;
  return { mode, duration, seed: Number.isFinite(options.seed) ? options.seed >>> 0 : 2026, weapon: Object.hasOwn(WEAPONS, options.weapon) ? options.weapon : 'pistol' };
}

export function createGame(options = {}) {
  let config = normalize(options), rng, nextId;
  const state = {};
  function emit(type, detail = {}) {
    const event = { type, x: idlePoint.x, y: idlePoint.y, score: 0, ring: null, time: state.elapsed, ...detail };
    state.events.push(event);
    return event;
  }
  function makeTarget(slot, initial = false) {
    const depth = .2 + rng() * .72;
    const r = 44 - depth * 18;
    const baseX = [168, 326, 486, 646, 803][slot] + (rng() - .5) * 18;
    const baseY = [231, 322, 259, 326, 220][slot] + (rng() - .5) * 20;
    const motion = ['static', 'sweep', 'pop'][(slot + Math.floor(rng() * 3)) % 3];
    const hasBonus = state.targets?.some(t => t.slot !== slot && t.type === 'bonus' && t.phase !== 'exit');
    const type = !hasBonus && ((initial && slot === 4) || (!initial && rng() < .23)) ? 'bonus' : 'normal';
    return {
      id: nextId++, slot, x: baseX, y: baseY, r, depth, type, motion, baseX, baseY,
      motionPhase: rng() * Math.PI * 2, speed: .75 + rng() * .65,
      age: 0, ttl: type === 'bonus' ? 5.3 + rng() * 1.4 : 6 + rng() * 2.2,
      active: false, hit: false, expired: false, scale: 0, phase: 'enter', respawnRemaining: 0
    };
  }
  function reset(overrides = {}) {
    // Duration defaults follow a newly selected mode, rather than leaking the old round length.
    const merged = { ...config, ...overrides };
    if (overrides.mode && overrides.mode !== config.mode && !Object.hasOwn(overrides, 'duration')) delete merged.duration;
    config = normalize(merged); rng = random(config.seed); nextId = 1;
    const gun = WEAPONS[config.weapon];
    Object.assign(state, {
      mode: config.mode, duration: config.duration, seed: config.seed, status: 'playing',
      elapsed: 0, timeLeft: config.duration, score: 0, shots: 0, hits: 0, bullseyes: 0,
      combo: 0, bestCombo: 0, multiplier: 1, ammo: gun.capacity, maxAmmo: gun.capacity,
      reloadRemaining: 0, shotCooldown: 0, weapon: gun.id, targets: [], events: []
    });
    for (let slot = 0; slot < 5; slot++) state.targets.push(makeTarget(slot, true));
    return state;
  }
  reset();
  function breakCombo() { state.combo = 0; state.multiplier = 1; }
  function retire(target, hit) {
    target.active = false; target.hit = hit; target.expired = !hit; target.phase = 'exit'; target.respawnRemaining = .35;
  }
  function update(dt) {
    if (state.status !== 'playing') return;
    dt = clamp(Number(dt) || 0, 0, 1 / 30);
    if (!dt) return;
    if (state.duration !== null) dt = Math.min(dt, state.duration - state.elapsed);
    state.elapsed += dt;
    state.timeLeft = state.duration === null ? null : Math.max(0, state.duration - state.elapsed);
    state.shotCooldown = decrease(state.shotCooldown, dt);
    if (state.reloadRemaining > 0) {
      state.reloadRemaining = decrease(state.reloadRemaining, dt);
      if (state.reloadRemaining === 0) {
        state.ammo = state.maxAmmo;
        emit('reloaded', { weapon: state.weapon, ammo: state.ammo });
      }
    }
    for (let i = 0; i < state.targets.length; i++) {
      const target = state.targets[i];
      if (target.phase === 'exit') {
        target.respawnRemaining = decrease(target.respawnRemaining, dt);
        target.scale = smooth(target.respawnRemaining / .35);
        if (target.respawnRemaining === 0) state.targets[i] = makeTarget(target.slot);
        continue;
      }
      target.age += dt;
      target.scale = smooth(target.age / .28);
      target.phase = target.age >= .28 ? 'live' : 'enter';
      target.active = target.phase === 'live';
      const phase = target.motionPhase + target.age * target.speed;
      target.x = target.baseX + (target.motion === 'sweep' ? Math.sin(phase) * 42 : 0);
      target.y = target.baseY + (target.motion === 'pop' ? Math.sin(phase * 1.4) * 34 : 0);
      target.x = clamp(target.x, 90 + target.r, 870 - target.r);
      target.y = clamp(target.y, 150 + target.r, 400 - target.r);
      if (target.age >= target.ttl - 1e-9) {
        retire(target, false); breakCombo();
        emit('expire', { x: target.x, y: target.y, targetId: target.id });
      }
    }
    if (state.duration !== null && state.elapsed >= state.duration - 1e-9) {
      state.elapsed = state.duration; state.timeLeft = 0; state.status = 'ended';
      emit('end', { score: state.score, reason: 'time', shots: state.shots, hits: state.hits });
    }
  }
  function shoot(x, y) {
    if (state.status !== 'playing') return { type: 'blocked', reason: 'ended' };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { type: 'blocked', reason: 'invalid-coordinate' };
    if (state.reloadRemaining > 0) return { type: 'blocked', reason: 'reloading' };
    if (state.shotCooldown > 0) return { type: 'blocked', reason: 'cooldown' };
    if (state.ammo <= 0) return emit('dryfire', { x, y, weapon: state.weapon });
    const gun = WEAPONS[state.weapon];
    state.ammo--; state.shots++; state.shotCooldown = gun.cooldown;
    emit('shot', { x, y, weapon: gun.id, ammo: state.ammo });
    // Smaller depth is nearer the camera. An inactive fading target never occludes a live target.
    const target = state.targets.filter(t => t.active && !t.hit && t.phase !== 'exit' && Math.hypot(x - t.x, y - t.y) <= t.r * t.scale)
      .sort((a, b) => a.depth - b.depth || a.id - b.id)[0];
    if (!target) { breakCombo(); return emit('miss', { x, y, weapon: gun.id }); }
    const distance = Math.hypot(x - target.x, y - target.y) / (target.r * target.scale);
    const ring = distance < .22 ? 'bullseye' : distance < .55 ? 'middle' : 'outer';
    const baseScore = ring === 'bullseye' ? 100 : ring === 'middle' ? 60 : 30;
    state.hits++; if (ring === 'bullseye') state.bullseyes++;
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.multiplier = Math.min(3, 1 + Math.floor(state.combo / 5) * .5);
    const bonus = target.type === 'bonus' ? 2 : 1;
    const score = Math.round(baseScore * state.multiplier * bonus);
    state.score += score; retire(target, true);
    return emit('hit', { x, y, targetX: target.x, targetY: target.y, targetId: target.id, targetType: target.type, ring, baseScore, multiplier: state.multiplier, bonus, score, combo: state.combo, weapon: gun.id });
  }
  function reload() {
    if (state.status !== 'playing' || state.reloadRemaining > 0 || state.ammo === state.maxAmmo) return false;
    state.reloadRemaining = WEAPONS[state.weapon].reload;
    emit('reload', { weapon: state.weapon, duration: state.reloadRemaining, switching: false });
    return true;
  }
  function setWeapon(id) {
    if (state.status !== 'playing' || !Object.hasOwn(WEAPONS, id) || id === state.weapon) return false;
    state.weapon = id; config.weapon = id; state.maxAmmo = WEAPONS[id].capacity;
    state.ammo = 0; state.shotCooldown = 0; state.reloadRemaining = WEAPONS[id].reload;
    emit('reload', { weapon: id, duration: state.reloadRemaining, switching: true });
    return true;
  }
  function drainEvents() { const events = state.events; state.events = []; return events; }
  return { state, update, shoot, reload, setWeapon, reset, drainEvents };
}
