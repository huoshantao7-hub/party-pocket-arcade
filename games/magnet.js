export const meta = {
  id: 'magnet', title: '磁力双星', subtitle: '一个人点不亮的宇宙，就两个人一起。', genre: '双人合作 · 同步机关', accent: '#a5a4ff', duration: 75,
  rules: ['各自站上同色圆台，同时停留 1.2 秒，解锁中央星星。', '靠近星星收集；互动可展开短暂护盾并吸取近处星星。', '75 秒一起收更多星星；每 8 颗点亮一座星系，注意磁力绳与彗星。'],
  actionLabel: '护盾 / 吸星', altLabel: '护盾 / 吸星'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const empty = () => ({ x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
function rr(ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function label(ctx, value, x, y, size = 16, color = '#ebe7ff', align = 'center', weight = 700) { ctx.font = `${weight} ${size}px system-ui, "Microsoft YaHei", sans-serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(value, x, y); }
function starPath(ctx, x, y, radius, rotation = 0) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rotation - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .46 : radius; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); }

export function createGame({ width = 960, height = 600, seed = 2026, sound = () => {}, end = () => {}, debug = false } = {}) {
  let rng = seed >>> 0, elapsed = 0, ended = false, result = '', total = 0, round = 0, charge = 0, ready = false, roundWait = .5, pulseT = 0;
  const random = () => ((rng = Math.imul(rng, 1664525) + 1013904223 >>> 0) / 4294967296);
  const players = [
    { x: 327, y: 456, color: '#79e3ed', dark: '#308398', score: 0, cooldown: 0, shield: 0, invulnerable: 0, face: 1, walk: 0, hits: 0 },
    { x: 607, y: 456, color: '#f7a3e0', dark: '#ac589b', score: 0, cooldown: 0, shield: 0, invulnerable: 0, face: -1, walk: 0, hits: 0 }
  ];
  const pattern = [
    [[355, 334], [585, 334]], [[258, 260], [474, 260]], [[443, 428], [666, 428]], [[552, 247], [755, 247]],
    [[260, 412], [475, 412]], [[445, 253], [640, 365]], [[286, 310], [481, 420]], [[513, 347], [740, 347]]]
    .map(pair => pair.map(([x, y]) => ({ x: x + Math.round((random() - .5) * 12), y: y + Math.round((random() - .5) * 12) })));
  const sky = Array.from({ length: 70 }, () => ({ x: random() * 960, y: random() * 600, r: .7 + random() * 1.6, phase: random() * 6.28 }));
  const hazards = Array.from({ length: 3 }, (_, i) => ({ phase: random() * 6.28, offset: i, x: 0, y: 0, radius: 17 + i * 2 }));
  const particles = [], events = [];
  const emit = (type, extra = {}) => { events.push({ t: +elapsed.toFixed(3), type, ...extra }); if (events.length > 90) events.shift(); };
  const current = () => pattern[round % pattern.length];
  const starPosition = () => { const pads = current(); return { x: (pads[0].x + pads[1].x) / 2, y: (pads[0].y + pads[1].y) / 2 - 65 }; };
  function finish() {
    if (ended) return; elapsed = meta.duration; ended = true;
    result = `收集 ${total} 颗星 · 点亮 ${Math.floor(total / 8)} 座星系 · ${total >= 16 ? '你们就是宇宙最佳搭档！' : '这片星光属于你们。'}`;
    end({ title: total >= 8 ? '星河接通！' : '星河暂时休息', text: result, score: players.reduce((v, p) => v + p.score, 0), stars: total });
  }
  function burst(x, y, color, amount = 20) { for (let n = 0; n < amount; n++) { const a = random() * 6.28, v = 35 + random() * 110; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .9, color }); } }
  function collect(index) {
    if (!ready || roundWait > 0) return;
    const star = starPosition(); total++; players[index].score += 100; players[1 - index].score += 50;
    emit('collect', { player: index, round, total }); burst(star.x, star.y, '#ffe891', 32); sound('score'); round++; charge = 0; ready = false; roundWait = .7; pulseT = 1;
  }
  function shield(index) {
    const p = players[index]; if (p.cooldown > 0) return;
    p.shield = 1.05; p.cooldown = 3.6; burst(p.x, p.y, p.color, 8); sound('tap'); emit('shield', { player: index });
    if (ready && dist(p, starPosition()) < 110) collect(index);
  }
  function update(dt, inputs = []) {
    if (ended) return; dt = clamp(dt || 0, 0, 1 / 30); elapsed = Math.min(75, elapsed + dt); roundWait = Math.max(0, roundWait - dt); pulseT = Math.max(0, pulseT - dt);
    players.forEach((p, i) => {
      const input = inputs[i] || empty(); let x = clamp(input.x || 0, -1, 1), y = clamp(input.y || 0, -1, 1), n = Math.hypot(x, y); if (n > 1) { x /= n; y /= n; }
      p.cooldown = Math.max(0, p.cooldown - dt); p.shield = Math.max(0, p.shield - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.x = clamp(p.x + x * 177 * dt, 90, 870); p.y = clamp(p.y + y * 177 * dt, 174, 505); p.walk += n * dt * 9; if (x) p.face = Math.sign(x);
      if (input.pressed || input.altPressed) shield(i);
    });
    // A symmetric tether is the shared constraint; neither participant can move away alone.
    const a = players[0], b = players[1]; let d = dist(a, b);
    if (d > 310) { const amount = (d - 310) / 2, dx = (b.x - a.x) / d, dy = (b.y - a.y) / d; a.x += dx * amount; a.y += dy * amount; b.x -= dx * amount; b.y -= dy * amount; }
    if (d < 43 && d > .001) { const amount = (43 - d) / 2, dx = (b.x - a.x) / d, dy = (b.y - a.y) / d; a.x -= dx * amount; a.y -= dy * amount; b.x += dx * amount; b.y += dy * amount; }
    for (const h of hazards) {
      h.x = 480 + Math.sin(elapsed * (.36 + h.offset * .045) + h.phase) * (275 + h.offset * 25);
      h.y = 336 + Math.sin(elapsed * .67 + h.phase * 1.7) * (99 - h.offset * 13);
      players.forEach((p, index) => {
        if (p.invulnerable > 0 || p.shield > 0 || roundWait > 0 || dist(p, h) > h.radius + 21) return;
        const dx = p.x - h.x, dy = p.y - h.y, n = Math.max(1, Math.hypot(dx, dy)); p.x = clamp(p.x + dx / n * 35, 90, 870); p.y = clamp(p.y + dy / n * 35, 174, 505);
        p.invulnerable = 1.8; p.hits++; p.score = Math.max(0, p.score - 5); if (!ready) charge = Math.max(0, charge - .3);
        emit('hit', { player: index }); burst(p.x, p.y, '#ffc4aa', 10); sound('hit');
      });
    }
    if (!ready && roundWait <= 0) {
      const pads = current(), occupied = players.every((p, i) => dist(p, pads[i]) <= 32);
      charge = occupied ? Math.min(1.2, charge + dt) : Math.max(0, charge - dt * .7);
      if (charge >= 1.2 - 1e-8) { ready = true; charge = 1.2; emit('unlock', { round }); burst(starPosition().x, starPosition().y, '#ffeaa1', 12); sound('ready'); }
    }
    if (ready) players.forEach((p, index) => { if (ready && dist(p, starPosition()) < 34) collect(index); });
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98; p.vy *= .98; p.life -= dt; } while (particles[0]?.life <= 0) particles.shift();
    if (elapsed >= 75 - 1e-7) finish();
  }
  function bot(index) {
    const p = players[index], target = ready ? starPosition() : current()[index];
    const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy), moving = d > (ready ? 10 : 7);
    const imminent = hazards.some(h => dist(p, h) < 93);
    const action = p.cooldown <= 0 && (imminent || (ready && d < 105));
    return { ...empty(), x: moving ? dx / d : 0, y: moving ? dy / d : 0, action };
  }
  function drawOrb(ctx, p, index) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = '#111e454a'; ctx.beginPath(); ctx.ellipse(0, 25, 30, 11, 0, 0, 6.29); ctx.fill();
    ctx.translate(0, Math.sin(p.walk) * 2);
    if (p.shield > 0) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.fillStyle = `${p.color}24`; ctx.beginPath(); ctx.arc(0, -3, 39 + Math.sin(elapsed * 10) * 2, 0, 6.29); ctx.fill(); ctx.stroke(); }
    if (p.invulnerable > 0 && Math.floor(elapsed * 14) % 2 === 0) ctx.globalAlpha = .62;
    const body = ctx.createRadialGradient(-9, -17, 2, 0, 0, 37); body.addColorStop(0, '#ffffff'); body.addColorStop(.2, p.color); body.addColorStop(1, p.dark);
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 27, 29, Math.sin(p.walk) * .06, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#ece7ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-9, -26); ctx.lineTo(-9, -34); ctx.arc(0, -34, 9, Math.PI, 0); ctx.lineTo(9, -26); ctx.stroke();
    ctx.strokeStyle = p.dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-9, -29); ctx.lineTo(-9, -24); ctx.moveTo(9, -29); ctx.lineTo(9, -24); ctx.stroke();
    ctx.fillStyle = '#263956'; ctx.beginPath(); ctx.ellipse(-8 + p.face, -3, 3, 4.4, 0, 0, 6.29); ctx.ellipse(8 + p.face, -3, 3, 4.4, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffb1c9'; ctx.beginPath(); ctx.ellipse(-18, 5, 4.3, 2.5, 0, 0, 6.29); ctx.ellipse(18, 5, 4.3, 2.5, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#314258'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.face, 5, 6, .2, Math.PI - .2); ctx.stroke();
    rr(ctx, -20, 35, 40, 20, 10, p.dark); label(ctx, `P${index + 1}`, 0, 49, 12, '#fff');
    if (p.cooldown > 0) { ctx.strokeStyle = '#ffffffa0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -1, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.cooldown / 3.6)); ctx.stroke(); }
    ctx.restore();
  }
  function draw(ctx) {
    ctx.save(); ctx.scale(width / 960, height / 600);
    const bg = ctx.createLinearGradient(0, 0, 960, 600); bg.addColorStop(0, '#252548'); bg.addColorStop(.5, '#36315d'); bg.addColorStop(1, '#234453'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 960, 600);
    for (const s of sky) { ctx.fillStyle = `rgba(224,220,255,${.22 + .2 * Math.sin(elapsed * .8 + s.phase)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); }
    // Soft miniature island with a visible beveled underside.
    ctx.save(); ctx.shadowColor = '#131b39'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 20; rr(ctx, 55, 151, 850, 390, 75, '#283952'); ctx.restore();
    rr(ctx, 55, 134, 850, 390, 75, '#537180', '#8ea5b4');
    const surface = ctx.createLinearGradient(0, 136, 0, 521); surface.addColorStop(0, '#77919b'); surface.addColorStop(1, '#5d7b88'); rr(ctx, 60, 135, 840, 376, 69, surface);
    ctx.save(); ctx.beginPath(); ctx.roundRect(63, 137, 834, 371, 66); ctx.clip(); ctx.lineWidth = 1; ctx.strokeStyle = '#b7cace18';
    for (let x = -200; x < 1000; x += 74) { ctx.beginPath(); ctx.moveTo(x, 135); ctx.lineTo(x + 420, 515); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 420, 135); ctx.lineTo(x, 515); ctx.stroke(); } ctx.restore();
    label(ctx, '磁力双星', 48, 56, 32, '#f4eeff', 'left'); label(ctx, 'TWO LITTLE MAGNETS · ONE BIG GALAXY', 50, 87, 12, '#adaecc', 'left', 500);
    for (let i = 0; i < 8; i++) { starPath(ctx, 625 + i * 34, 48, 12); ctx.fillStyle = i < total % 8 ? '#ffe392' : '#777191'; ctx.fill(); }
    label(ctx, `${total} 颗星 · ${Math.floor(total / 8)} 座星系已点亮`, 746, 88, 15, '#e0d7ee');
    // A transparent wire between the two characters communicates the shared movement limit.
    const p = players[0], q = players[1], tension = dist(p, q) / 310;
    ctx.save(); ctx.shadowColor = tension > .91 ? '#ffe096' : '#b2baff'; ctx.shadowBlur = 12; ctx.strokeStyle = tension > .91 ? '#ffe096ba' : '#bec5ff92'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + (1 - tension) * 50, q.x, q.y); ctx.stroke(); ctx.restore();
    const pads = current();
    pads.forEach((pad, index) => {
      const on = dist(players[index], pad) <= 32, color = players[index].color;
      ctx.save(); ctx.shadowBlur = on ? 22 : 9; ctx.shadowColor = color;
      ctx.fillStyle = '#293d57'; ctx.beginPath(); ctx.ellipse(pad.x, pad.y + 8, 43, 28, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = on ? `${color}9e` : `${color}31`; ctx.beginPath(); ctx.ellipse(pad.x, pad.y, 41, 28, 0, 0, 6.29); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      label(ctx, on ? '✓' : `P${index + 1}`, pad.x, pad.y + 5, 16, on ? '#fff' : color);
      if (!ready) { ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(pad.x, pad.y, 47, 33, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge / 1.2); ctx.stroke(); }
    });
    const star = starPosition(), spin = Math.sin(elapsed * 2) * .14;
    ctx.save(); ctx.translate(star.x, star.y + Math.sin(elapsed * 3) * 5);
    ctx.fillStyle = '#23395042'; ctx.beginPath(); ctx.ellipse(0, 26, 27, 9, 0, 0, 6.29); ctx.fill();
    if (ready) { ctx.shadowColor = '#ffe499'; ctx.shadowBlur = 28; } starPath(ctx, 0, 0, ready ? 27 : 22, spin); ctx.fillStyle = ready ? '#ffe997' : '#a6adb2'; ctx.fill(); ctx.strokeStyle = ready ? '#fff9cf' : '#c9c9c7'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#80675c'; ctx.beginPath(); ctx.arc(-5, -1, 2, 0, 6.29); ctx.arc(5, -1, 2, 0, 6.29); ctx.fill();
    if (!ready) { ctx.strokeStyle = '#d5d4dfa0'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(0, 0, 36, elapsed * .2, Math.PI * 2 + elapsed * .2); ctx.stroke(); ctx.setLineDash([]); }
    label(ctx, ready ? '星星解锁！靠近或吸取' : '两人同时踏台点亮', 0, -48, 13, ready ? '#fff2b3' : '#e0e5e7'); ctx.restore();
    for (const h of hazards) {
      ctx.save(); ctx.translate(h.x, h.y); const gradient = ctx.createRadialGradient(-7, -6, 1, 0, 0, h.radius + 8); gradient.addColorStop(0, '#d6acc1'); gradient.addColorStop(1, '#705772'); ctx.fillStyle = gradient;
      ctx.fillStyle = '#453b5960'; ctx.beginPath(); ctx.ellipse(0, 18, h.radius + 4, 9, 0, 0, 6.29); ctx.fill(); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, h.radius, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#674966'; ctx.beginPath(); ctx.arc(-5, -6, 5, 0, 6.29); ctx.arc(7, 7, 3, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#f2b6c7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(-1, 2); ctx.moveTo(7, -1); ctx.lineTo(1, 2); ctx.stroke(); ctx.restore();
    }
    [...players.keys()].sort((a, b) => players[a].y - players[b].y).forEach(i => drawOrb(ctx, players[i], i));
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; starPath(ctx, p.x, p.y, 3.7, elapsed); ctx.fill(); } ctx.globalAlpha = 1;
    const message = ready ? '靠近星星，或者按互动吸过来！' : charge > .05 ? `同步充能 ${Math.round(charge / 1.2 * 100)}% · 稳住别动` : '找到同色圆台，等搭档一起站稳。';
    rr(ctx, 238, 551, 484, 32, 16, '#222a45a8'); label(ctx, message, 480, 573, 15, '#e0e3f2', 'center', 500);
    if (pulseT > 0 && !ended) { ctx.globalAlpha = pulseT; label(ctx, '+ 1 颗默契之星', 480, 169 - (1 - pulseT) * 20, 22, '#ffefb1'); ctx.globalAlpha = 1; }
    if (ended) { rr(ctx, 155, 239, 650, 116, 24, '#272441ee', '#c2b8f3'); label(ctx, total >= 8 ? '你们把宇宙接通了！' : '这一小片星光，属于你们。', 480, 283, 28, '#ffe9a1'); label(ctx, result, 480, 325, 16, '#e3d8ef'); }
    ctx.restore();
  }
  const getState = () => ({ timeLeft: Math.max(0, 75 - elapsed), players: players.map((p, i) => ({ name: `P${i + 1} ${i ? '粉色小磁铁' : '蓝色小磁铁'}`, score: p.score, detail: p.shield > 0 ? '护盾生效中' : p.cooldown > 0 ? `护盾 ${p.cooldown.toFixed(1)}s 后可用` : '护盾就绪 · 互动释放', x: p.x, y: p.y, shield: p.shield, hits: p.hits })), status: `合作收星 ${total} · 第 ${Math.floor(total / 8) + 1} 座星系 · ${ready ? '星星已解锁' : '同时踏台充能'}`, ended, result, elapsed, stars: total, round, charge, ready, pads: current().map(p => ({ ...p })), star: starPosition(), hazards: hazards.map(h => ({ x: h.x, y: h.y, radius: h.radius })), events: structuredClone(events) });
  const api = { update, draw, bot, getState };
  // Test-only placement drives normal puzzle and collision logic; absent in production.
  if (debug) api.__test = { place: (i, x, y) => { players[i].x = x; players[i].y = y; } };
  return api;
}
