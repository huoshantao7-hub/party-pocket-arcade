export const meta = {
  id: 'kitchen', title: '午夜外卖', subtitle: '打烊前，再送出一碗热腾腾的星光面。', genre: '双人合作 · 厨房接力', accent: '#ffbc72', duration: 75,
  rules: ['仓库取料 → 切菜 → 炉灶煮面 → 窗口出餐。', '按互动操作附近台面；中间传菜台连接两位厨师。', '不同玩家接力完成，额外奖励 40 分；订单过时会换新。'],
  actionLabel: '互动', altLabel: '传给搭档'
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const idle = () => ({ x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
const stationDefs = [
  { id: 'pantry', x: 100, y: 318, w: 116, h: 110, label: '取料', icon: '蔬菜仓', color: '#b2dfba', approach: [185, 318] },
  { id: 'prep', x: 280, y: 183, w: 142, h: 78, label: '切菜', icon: '备菜台', color: '#e6c897', approach: [280, 250] },
  { id: 'pass', x: 480, y: 337, w: 116, h: 60, label: '传菜', icon: '接力台', color: '#9ebce2', approach: [393, 337] },
  { id: 'stove', x: 680, y: 183, w: 142, h: 78, label: '煮面', icon: '炉灶', color: '#e6a08c', approach: [680, 250] },
  { id: 'serve', x: 860, y: 318, w: 116, h: 110, label: '出餐', icon: '外卖窗口', color: '#cfb4eb', approach: [775, 318] },
];

function round(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function text(ctx, value, x, y, size = 16, color = '#fff0db', align = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px system-ui, "Microsoft YaHei", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
}
function bowl(ctx, x, y, stage, t = 0, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (stage === 'raw') {
    round(ctx, -18, -5, 36, 18, 6, '#c59563', '#6f4537');
    ctx.fillStyle = '#ff7459'; ctx.beginPath(); ctx.ellipse(-6, -7, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ac794'; ctx.beginPath(); ctx.ellipse(7, -8, 8, 12, .45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c7f2ae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, 1); ctx.lineTo(9, -15); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff0dc'; ctx.beginPath(); ctx.ellipse(0, -1, 23, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = stage === 'cooked' ? '#ffa955' : '#82c797'; ctx.beginPath(); ctx.ellipse(0, -2, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = stage === 'cooked' ? '#f1837a' : '#e7caa0'; ctx.beginPath(); ctx.moveTo(-23, -1); ctx.quadraticCurveTo(-20, 22, 0, 22); ctx.quadraticCurveTo(20, 22, 23, -1); ctx.quadraticCurveTo(0, 14, -23, -1); ctx.fill();
    ctx.strokeStyle = '#fff2bd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(0, 6, 10, -2); ctx.stroke();
    if (stage === 'cooked') for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,247,224,${.3 + .16 * Math.sin(t * 3 + i)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-11 + i * 11, -14); ctx.bezierCurveTo(-18 + i * 11, -24, i * 11 - 5, -26, -10 + i * 11, -34); ctx.stroke();
    }
  }
  ctx.restore();
}

export function createGame({ width = 960, height = 600, seed = 2026, sound = () => {}, end = () => {}, debug = false } = {}) {
  let rng = seed >>> 0, elapsed = 0, ended = false, teamScore = 0, served = 0, expired = 0, nextItem = 0, result = '', orderTime = 24, combo = 0;
  const random = () => ((rng = Math.imul(rng, 1664525) + 1013904223 >>> 0) / 4294967296);
  const players = [
    { x: 235, y: 408, color: '#8ee3cd', accent: '#2d877c', face: 1, score: 0, carry: null, walk: 0, interaction: '', flash: 0 },
    { x: 723, y: 408, color: '#ffb0b5', accent: '#b75979', face: -1, score: 0, carry: null, walk: 0, interaction: '', flash: 0 }
  ];
  const stations = stationDefs.map(s => ({ ...s, item: null, progress: 0 }));
  const confetti = [];
  const decorations = Array.from({ length: 18 }, () => ({ x: 15 + random() * 930, y: 450 + random() * 70, r: 1 + random() * 2 }));
  const events = [];
  const get = id => stations.find(s => s.id === id);
  const emit = (type, data = {}) => { events.push({ t: +elapsed.toFixed(3), type, ...data }); if (events.length > 100) events.shift(); };
  const sparkle = (x, y, color, count = 16) => { for (let i = 0; i < count; i++) confetti.push({ x, y, vx: (random() - .5) * 130, vy: -50 - random() * 90, life: .8, color }); };
  const finish = () => {
    if (ended) return; elapsed = meta.duration; ended = true;
    result = `打烊！合作出餐 ${served} 碗 · ${teamScore} 分${served >= 6 ? ' · 星级夜宵搭档' : served >= 3 ? ' · 默契正在升温' : ' · 下次继续练默契'}`;
    end({ title: '今晚辛苦啦', text: result, score: teamScore, served, expired });
  };
  function act(index) {
    const p = players[index];
    const s = [...stations].sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (distance(p, s) > 102) { p.interaction = '靠近台面再互动'; p.flash = .9; return; }
    p.interaction = ''; p.flash = .4;
    if (s.id === 'pantry') {
      if (!p.carry) { p.carry = { id: ++nextItem, stage: 'raw', creator: index, prepper: null, cooker: null, handlers: [index] }; emit('take', { player: index, item: p.carry.id }); sound('pickup'); }
      else p.interaction = '先把手里的食材处理好';
    } else if (s.id === 'serve') {
      if (p.carry?.stage === 'cooked') {
        const item = p.carry; const relay = item.handlers.includes(0) && item.handlers.includes(1);
        const points = 100 + (relay ? 40 : 0) + Math.min(combo, 4) * 10;
        teamScore += points;
        if (relay) { p.score += Math.ceil(points / 2); players[1 - index].score += Math.floor(points / 2); }
        else p.score += points;
        served++; combo++; orderTime = 24; p.carry = null;
        emit('serve', { player: index, item: item.id, points, relay }); sparkle(s.x - 40, s.y - 25, '#ffcd78', 28); sound('score');
        p.interaction = relay ? `接力出餐 +${points}` : `出餐 +${points}`; p.flash = 1.6;
      } else { p.interaction = p.carry ? '先去炉灶煮熟哦' : '端着热面来出餐'; p.flash = .9; }
    } else if (s.id === 'pass') {
      if (p.carry && !s.item) { s.item = p.carry; p.carry = null; emit('pass-put', { player: index, item: s.item.id }); sound('tap'); }
      else if (!p.carry && s.item) { p.carry = s.item; s.item = null; if (!p.carry.handlers.includes(index)) p.carry.handlers.push(index); emit('pass-take', { player: index, item: p.carry.id }); sound('pickup'); }
      else p.interaction = s.item ? '接力台已放好一份' : '把食材放这里交给搭档';
    } else {
      const required = s.id === 'prep' ? 'raw' : 'chopped';
      const produced = s.id === 'prep' ? 'chopped' : 'cooked';
      if (!p.carry && s.item?.stage === produced && s.progress <= 0) {
        p.carry = s.item; s.item = null; if (!p.carry.handlers.includes(index)) p.carry.handlers.push(index); emit('station-take', { station: s.id, player: index }); sound('pickup');
      } else if (!s.item && p.carry?.stage === required) {
        s.item = p.carry; p.carry = null; s.progress = s.id === 'prep' ? 2.1 : 2.8;
        s.item[s.id === 'prep' ? 'prepper' : 'cooker'] = index;
        emit('process-start', { station: s.id, player: index, item: s.item.id }); sound('tap');
      } else { p.interaction = s.progress > 0 ? '处理中，稍等一下' : p.carry ? `这里需要${required === 'raw' ? '新鲜食材' : '切好的食材'}` : '还没有食材'; p.flash = .8; }
    }
  }
  function handoff(index) {
    const p = players[index], q = players[1 - index];
    if (p.carry && !q.carry && distance(p, q) < 92) {
      q.carry = p.carry; p.carry = null; if (!q.carry.handlers.includes(1 - index)) q.carry.handlers.push(1 - index);
      emit('handoff', { from: index, to: 1 - index, item: q.carry.id }); sparkle((p.x + q.x) / 2, (p.y + q.y) / 2 - 18, '#a7efc5', 8); sound('pickup');
    } else { p.interaction = '靠近空手搭档，即可递过去'; p.flash = 1; }
  }
  function solid(x, y) { return stations.some(s => x > s.x - s.w / 2 - 18 && x < s.x + s.w / 2 + 18 && y > s.y - s.h / 2 - 8 && y < s.y + s.h / 2 + 19); }
  function update(dt, inputs = []) {
    if (ended) return; dt = clamp(dt || 0, 0, 1 / 30); elapsed = Math.min(75, elapsed + dt); orderTime -= dt;
    if (orderTime <= 0) { expired++; combo = 0; orderTime = 24; emit('expired'); sound('hit'); }
    stations.forEach(s => { if (s.progress > 0) { s.progress = Math.max(0, s.progress - dt); if (s.progress === 0) { s.item.stage = s.id === 'prep' ? 'chopped' : 'cooked'; emit('process-ready', { station: s.id }); sparkle(s.x, s.y - 15, s.color, 8); sound('ready'); } } });
    players.forEach((p, index) => {
      const input = inputs[index] || idle(); let dx = clamp(input.x || 0, -1, 1), dy = clamp(input.y || 0, -1, 1); const n = Math.hypot(dx, dy); if (n > 1) { dx /= n; dy /= n; }
      const speed = p.carry ? 178 : 195, nx = clamp(p.x + dx * speed * dt, 30, 930), ny = clamp(p.y + dy * speed * dt, 240, 543);
      if (!solid(nx, p.y)) p.x = nx; if (!solid(p.x, ny)) p.y = ny;
      if (dx) p.face = Math.sign(dx); p.walk += n * dt * 10; p.flash = Math.max(0, p.flash - dt);
      if (input.pressed) act(index); if (input.altPressed) handoff(index);
    });
    const a = players[0], b = players[1], d = distance(a, b);
    if (d < 38 && d > .01) { const push = (38 - d) * .25, dx = (a.x - b.x) / d * push, dy = (a.y - b.y) / d * push; if (!solid(a.x + dx, a.y + dy)) { a.x += dx; a.y += dy; } if (!solid(b.x - dx, b.y - dy)) { b.x -= dx; b.y -= dy; } }
    for (const c of confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 150 * dt; c.life -= dt; } while (confetti[0]?.life <= 0) confetti.shift();
    if (elapsed >= 75 - 1e-7) finish();
  }
  function bot(index) {
    const p = players[index], prep = get('prep'), stove = get('stove'), pass = get('pass'); let target, waiting = false;
    if (p.carry?.stage === 'cooked') target = get('serve');
    else if (p.carry?.stage === 'raw') { target = prep; waiting = !!prep.item; }
    else if (p.carry?.stage === 'chopped') {
      if (index === 0 && !pass.item) target = pass;
      else if (index === 0 && pass.item && !stove.item && players[1].carry?.stage !== 'chopped') target = stove;
      else if (index === 0) { target = pass; waiting = true; }
      else { target = stove; waiting = !!stove.item; }
    } else if (index === 0) {
      if (prep.item) { target = prep; waiting = prep.progress > 0; }
      else if (stove.item?.stage === 'cooked' && players[1].carry) target = stove;
      else { target = get('pantry'); waiting = !!pass.item && players[1].carry?.stage === 'chopped'; }
    } else {
      if (stove.item) { target = stove; waiting = stove.progress > 0; }
      else if (pass.item) target = pass;
      else if (prep.item?.stage === 'chopped' && players[0].carry) target = prep;
      else { target = pass; waiting = true; }
    }
    let [tx, ty] = target.approach; if (target.id === 'pass' && index === 1) tx = 567;
    // Routes run below the center counter, never through it.
    if ((p.x < 415 && tx > 545) || (p.x > 545 && tx < 415)) { if (p.y < 420) { tx = p.x; ty = 434; } else ty = 434; }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), moving = d > 7;
    const action = !moving && !waiting && (Math.floor(elapsed * 7) + index) % 2 === 0;
    return { ...idle(), x: moving ? dx / d : 0, y: moving ? dy / d : 0, action };
  }
  function drawChef(ctx, p, index) {
    const bounce = Math.sin(p.walk) * 2.3;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(22,17,37,.3)'; ctx.beginPath(); ctx.ellipse(0, 11, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bounce);
    round(ctx, -17, -2, 12, 15, 5, '#3e3c55'); round(ctx, 6, -2, 12, 15, 5, '#3e3c55');
    round(ctx, -24, -37, 48, 44, 16, p.color, p.accent); round(ctx, -15, -32, 30, 35, 8, '#fff2da');
    ctx.fillStyle = '#f2c5a5'; ctx.beginPath(); ctx.ellipse(0, -43, 22, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#342d43'; ctx.beginPath(); ctx.arc(-8 + p.face * 1.4, -44, 2.8, 0, Math.PI * 2); ctx.arc(8 + p.face * 1.4, -44, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#995b53'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.face, -39, 6, .15, Math.PI - .15); ctx.stroke();
    ctx.fillStyle = '#ed9b93'; ctx.beginPath(); ctx.ellipse(-15, -37, 4, 2.5, 0, 0, Math.PI * 2); ctx.ellipse(15, -37, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7e7'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-15 + i * 15, -63 - (i === 1 ? 5 : 0), 13, 0, Math.PI * 2); ctx.fill(); } round(ctx, -22, -62, 44, 12, 4, '#fff7e7');
    round(ctx, -23, -55, 46, 7, 3, p.color);
    if (p.carry) bowl(ctx, 0, -14, p.carry.stage, elapsed, .82);
    round(ctx, -20, 21, 40, 20, 10, p.accent); text(ctx, `P${index + 1}`, 0, 35, 12, '#fffaf0');
    if (p.interaction && p.flash > 0) { ctx.globalAlpha = Math.min(1, p.flash * 3); const width = Math.max(120, p.interaction.length * 12 + 18); round(ctx, -width / 2, -112, width, 28, 10, '#fff6e6'); text(ctx, p.interaction, 0, -93, 12, '#554660'); }
    ctx.restore();
  }
  function draw(ctx) {
    ctx.save(); ctx.scale(width / 960, height / 600);
    const bg = ctx.createLinearGradient(0, 0, 0, 600); bg.addColorStop(0, '#302b49'); bg.addColorStop(1, '#4b3953'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 960, 600);
    round(ctx, 18, 15, 924, 107, 22, '#242139', '#736079');
    text(ctx, 'MIDNIGHT NOODLES', 45, 46, 15, '#f3b9a0', 'left'); text(ctx, '星光夜宵铺', 45, 88, 31, '#fff0d8', 'left');
    ctx.save(); ctx.shadowColor = '#ffd38d'; ctx.shadowBlur = 18; round(ctx, 276, 38, 62, 30, 8, '#ffcc89'); text(ctx, '营业中', 307, 58, 12, '#633f4b'); ctx.restore();
    round(ctx, 373, 30, 328, 72, 15, '#fff0d7'); bowl(ctx, 411, 55, 'cooked', elapsed, .65); text(ctx, '新订单 · 星光热面', 448, 54, 16, '#57404e', 'left');
    text(ctx, '备菜  →  煮面  →  出餐', 448, 78, 13, '#8b6c70', 'left', 500);
    round(ctx, 385, 93, 302, 4, 2, '#dfc9b8'); round(ctx, 385, 93, Math.max(1, 302 * orderTime / 24), 4, 2, orderTime < 7 ? '#e87579' : '#94b397');
    text(ctx, String(served).padStart(2, '0'), 760, 70, 35, '#ffcc89'); text(ctx, '已出餐', 760, 91, 12, '#baa0ae');
    text(ctx, `${Math.ceil(75 - elapsed)}s`, 868, 70, 35, '#c9e6de'); text(ctx, '距离打烊', 868, 91, 12, '#baa0ae');
    // Floor tiles use subtle irregular highlights instead of flat presentation panels.
    round(ctx, 17, 133, 926, 422, 24, '#bd9989');
    ctx.save(); ctx.beginPath(); ctx.roundRect(17, 133, 926, 422, 24); ctx.clip();
    for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++) { ctx.fillStyle = (row + col) % 2 ? '#c6a390' : '#d1b29a'; ctx.fillRect(19 + col * 82, 133 + row * 78, 80, 76); }
    ctx.restore();
    for (const d of decorations) { ctx.fillStyle = 'rgba(255,240,216,.18)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.29); ctx.fill(); }
    round(ctx, 40, 505, 112, 30, 8, '#ac837b'); text(ctx, '小心热汤 ♡', 96, 525, 12, '#f8decc');
    // Trails show the shared assembly line while leaving the walking area readable.
    ctx.setLineDash([4, 11]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(117,77,83,.23)'; ctx.beginPath(); ctx.moveTo(190, 408); ctx.bezierCurveTo(370, 480, 590, 480, 770, 408); ctx.stroke(); ctx.setLineDash([]);
    for (const s of stations) {
      ctx.save(); ctx.shadowColor = 'rgba(58,33,56,.23)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 9;
      round(ctx, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 15, s.color, '#795b68'); ctx.restore();
      round(ctx, s.x - s.w / 2 + 5, s.y - s.h / 2 + 5, s.w - 10, s.h - 19, 11, s.id === 'stove' ? '#685564' : s.id === 'pantry' ? '#6c8975' : s.id === 'serve' ? '#6c597a' : '#efe0c8');
      if (s.id === 'pantry') { bowl(ctx, s.x - 20, s.y - 10, 'raw', elapsed, .75); bowl(ctx, s.x + 21, s.y - 5, 'raw', elapsed, .8); }
      if (s.id === 'serve') { round(ctx, s.x - 40, s.y - 43, 80, 62, 8, '#2c314c'); ctx.strokeStyle = '#d1a3c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y - 43); ctx.lineTo(s.x, s.y + 19); ctx.stroke(); text(ctx, '外卖取餐', s.x, s.y - 10, 13, '#f8cbaa'); }
      if (s.id === 'prep') { round(ctx, s.x - 45, s.y - 23, 90, 38, 7, '#b79b70'); ctx.strokeStyle = '#f6ead3'; ctx.lineWidth = 6; ctx.beginPath(); const knifeY = s.progress > 0 ? Math.sin(elapsed * 20) * 5 : 0; ctx.moveTo(s.x + 24, s.y - 17 + knifeY); ctx.lineTo(s.x + 42, s.y + 3 + knifeY); ctx.stroke(); }
      if (s.id === 'stove') { ctx.strokeStyle = '#fead7e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 32, 18, 0, 0, Math.PI * 2); ctx.stroke(); if (s.progress > 0) { ctx.fillStyle = '#ffcc79'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(s.x - 22 + i * 11, s.y + 5, 3, 5 + 2 * Math.sin(elapsed * 14 + i), 0, 0, 6.29); ctx.fill(); } } }
      if (s.id === 'pass' && !s.item) { text(ctx, '←  接 力  →', s.x, s.y + 1, 13, '#73879b'); }
      if (s.item) bowl(ctx, s.x, s.y - 4, s.item.stage, elapsed, .85);
      if (s.progress > 0) { round(ctx, s.x - 49, s.y + s.h / 2 + 7, 98, 7, 4, '#7e6570'); round(ctx, s.x - 49, s.y + s.h / 2 + 7, 98 * (1 - s.progress / (s.id === 'prep' ? 2.1 : 2.8)), 7, 4, '#f8d88b'); }
      const stationLabelY = s.id === 'prep' || s.id === 'stove' ? s.y - s.h / 2 - 8 : s.y + s.h / 2 + (s.progress > 0 ? 30 : 25);
      text(ctx, s.icon, s.x, stationLabelY, 14, '#674d5b');
    }
    [...players.keys()].sort((a, b) => players[a].y - players[b].y).forEach(i => drawChef(ctx, players[i], i));
    for (const c of confetti) { ctx.globalAlpha = Math.max(0, c.life); ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, 5, 5); } ctx.globalAlpha = 1;
    text(ctx, '分工小贴士：一人备菜，一人煮面；在中间的接力台交接。', 480, 582, 15, '#edd1c9', 'center', 500);
    if (ended) { round(ctx, 178, 237, 604, 113, 20, '#30263fea', '#f0c28f'); text(ctx, '今晚的星光，全部打包好了。', 480, 278, 26, '#ffe0a4'); text(ctx, result, 480, 316, 17, '#eed9d0'); }
    ctx.restore();
  }
  const state = () => ({ timeLeft: Math.max(0, 75 - elapsed), players: players.map((p, i) => ({ name: `P${i + 1} ${i ? '热汤主厨' : '备菜主厨'}`, score: p.score, detail: p.carry ? ({ raw: '新鲜食材', chopped: '切好的食材', cooked: '热面待出餐' }[p.carry.stage]) : '空手 · 靠近台面互动', x: p.x, y: p.y, carry: p.carry ? structuredClone(p.carry) : null })), status: `合作 ${teamScore} 分 · 已送 ${served} 碗 · 订单剩余 ${Math.ceil(orderTime)} 秒`, ended, result, teamScore, served, expired, elapsed, orderTime, stations: stations.map(s => ({ id: s.id, x: s.x, y: s.y, progress: s.progress, item: s.item ? structuredClone(s.item) : null })), events: structuredClone(events) });
  const api = { update, draw, bot, getState: state };
  // Test-only position control reaches real interaction code; production has no debug handle.
  if (debug) api.__test = { place: (i, x, y) => { players[i].x = x; players[i].y = y; } };
  return api;
}
