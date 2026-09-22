export const meta = {
  id: 'hockey', title: '霓虹气垫球', subtitle: '一记反弹，绝地翻盘', genre: '复古竞技',
  accent: '#67f0e5', duration: 60, actionLabel: '冲刺', altLabel: '稳住',
  rules: ['将冰球打入对方球门，率先进 7 球获胜', '每人只能在自己的半场移动，墙壁可反弹', '冲刺增加击球力量，稳住可减速精确防守'],
};
const W = 960, H = 600, LEFT = 48, RIGHT = 912, TOP = 58, BOTTOM = 542, CY = 300;
const COLORS = ['#64f4df', '#fd7bad'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const zero = () => ({x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false});
function seeded(seed) { let s = seed >>> 0; return () => { s += 0x6d2b79f5; let n = Math.imul(s ^ s >>> 15, 1 | s); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
function disc(ctx, x, y, radius, color) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function createGame({width = W, height = H, seed = 2026, sound = () => {}, end = () => {}, debug = false} = {}) {
  const random = seeded(seed), players = [0,1].map(i => ({x: i ? 765 : 195, y: CY, vx: 0, vy: 0, score: 0, boost: 0, cooldown: 0, color: COLORS[i]}));
  let time = 0, ended = false, result = '', serve = .85, lastGoal = -1, shake = 0, streak = [], sparks = [];
  const puck = {x: 480, y: CY, vx: (random() > .5 ? 1 : -1) * 335, vy: (random() - .5) * 230, r: 13};
  function finish() { if (ended) return; ended = true; result = players[0].score === players[1].score ? `平局！${players[0].score} : ${players[1].score}` : `${players[0].score > players[1].score ? 'P1 青绿队' : 'P2 粉红队'}获胜！${players[0].score} : ${players[1].score}`; end(result); }
  function burst(x, y, color, amount = 16) { for (let i = 0; i < amount; i++) { const a = random() * Math.PI * 2, speed = 60 + random() * 180; sparks.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.3+random()*.45,color}); } }
  function score(index) {
    players[index].score++; lastGoal = index; shake = .22; burst(puck.x,puck.y,COLORS[index],36); sound('goal');
    if (players[index].score >= 7) { finish(); return; }
    puck.x = 480; puck.y = CY; puck.vx = (index ? -1 : 1) * 345; puck.vy = (random() - .5) * 250; streak = []; serve = .8;
    players.forEach((p,i) => {p.x = i ? 765 : 195;p.y = CY;p.vx = p.vy = 0;});
  }
  function physics(dt) {
    puck.x += puck.vx * dt; puck.y += puck.vy * dt;
    if (puck.y < TOP + puck.r) {puck.y = TOP + puck.r;puck.vy = Math.abs(puck.vy);sound('bounce');}
    if (puck.y > BOTTOM - puck.r) {puck.y = BOTTOM - puck.r;puck.vy = -Math.abs(puck.vy);sound('bounce');}
    const inGoal = puck.y > CY - 78 + puck.r && puck.y < CY + 78 - puck.r;
    if (inGoal && puck.x < LEFT - puck.r) {score(1);return;}
    if (inGoal && puck.x > RIGHT + puck.r) {score(0);return;}
    if (!inGoal && puck.x < LEFT + puck.r) {puck.x = LEFT + puck.r;puck.vx = Math.abs(puck.vx);sound('bounce');}
    if (!inGoal && puck.x > RIGHT - puck.r) {puck.x = RIGHT - puck.r;puck.vx = -Math.abs(puck.vx);sound('bounce');}
    players.forEach(p => {
      const dx = puck.x - p.x, dy = puck.y - p.y, distance = Math.hypot(dx,dy), min = 39 + puck.r;
      if (distance >= min) return;
      const nx = distance > .001 ? dx / distance : (p.x < 480 ? 1 : -1), ny = distance > .001 ? dy / distance : 0;
      puck.x = p.x + nx * (min + .2); puck.y = p.y + ny * (min + .2);
      const approach = (puck.vx - p.vx) * nx + (puck.vy - p.vy) * ny;
      if (approach < 0) {
        puck.vx -= 1.88 * approach * nx; puck.vy -= 1.88 * approach * ny;
        const speed = Math.hypot(puck.vx,puck.vy), target = clamp(speed, 325, 1040);
        puck.vx *= target / Math.max(1,speed); puck.vy *= target / Math.max(1,speed);
        burst(puck.x,puck.y,p.color,12); shake = .065;sound('hit');
      }
    });
    const speed = Math.hypot(puck.vx,puck.vy);
    if (speed > 350) {puck.vx *= Math.exp(-.045*dt);puck.vy *= Math.exp(-.045*dt);}
  }
  function update(dt, inputs = []) {
    if (ended) return; dt = clamp(Number(dt) || 0,0,1/30);time += dt;
    players.forEach((p,i) => {
      const input = inputs[i] || zero(); p.cooldown = Math.max(0,p.cooldown-dt);p.boost = Math.max(0,p.boost-dt);
      if (input.pressed && p.cooldown <= 0) {p.boost = .23;p.cooldown = 2.25;sound('boost');}
      let x = clamp(Number(input.x)||0,-1,1), y = clamp(Number(input.y)||0,-1,1);const len = Math.hypot(x,y);if(len>1){x/=len;y/=len;}
      const speed = p.boost>0 ? 620 : input.alt ? 155 : 335;
      const oldX = p.x, oldY = p.y;
      p.x = clamp(p.x+x*speed*dt,i ? 520 : LEFT+42,i ? RIGHT-42 : 440);p.y = clamp(p.y+y*speed*dt,TOP+42,BOTTOM-42);
      p.vx = dt ? (p.x-oldX)/dt : 0;p.vy = dt ? (p.y-oldY)/dt : 0;
    });
    if (serve > 0) serve = Math.max(0,serve-dt); else { for (let i=0;i<4 && !ended && serve<=0;i++) physics(dt/4);streak.push({x:puck.x,y:puck.y});if(streak.length>17)streak.shift(); }
    shake = Math.max(0,shake-dt);sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});sparks=sparks.filter(p=>p.life>0);
    if (time >= meta.duration) {time=meta.duration;finish();}
  }
  function bot(i) {
    const p=players[i], toward = i ? puck.vx > 0 : puck.vx < 0;
    let tx=i?780:180, ty=CY;
    if (serve<=0) {
      const own = i ? puck.x>460 : puck.x<500;
      if (own && (i ? puck.x > 840 : puck.x < 120)) {tx=i?755:205;ty=clamp(puck.y+(puck.y>300?-85:85),115,485);}
      else if (own) {tx=puck.x+(i?37:-37);ty=puck.y;}
      else if(toward) {const t=Math.max(0,Math.abs((tx-puck.x)/(puck.vx||1)));ty=clamp(puck.y+puck.vy*Math.min(.7,t),115,485);}
      else ty=CY+(puck.y-CY)*.42;
    }
    const dx=tx-p.x,dy=ty-p.y,len=Math.hypot(dx,dy),strike=len>25&&len<115&&Math.abs(puck.x-p.x)<130;
    return {x:clamp(dx/30,-1,1),y:clamp(dy/30,-1,1),action:strike&&p.cooldown<=0,alt:false,pressed:strike&&p.cooldown<=0,altPressed:false};
  }
  function draw(ctx) {
    ctx.save();ctx.scale(width/W,height/H);ctx.fillStyle='#071c29';ctx.fillRect(0,0,W,H);
    const ambient=ctx.createRadialGradient(480,300,30,480,300,560);ambient.addColorStop(0,'#163345');ambient.addColorStop(1,'#071725');ctx.fillStyle=ambient;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#082333';rounded(ctx,LEFT-16,TOP-16,RIGHT-LEFT+32,BOTTOM-TOP+32,34);ctx.fill();
    ctx.save();rounded(ctx,LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP,20);ctx.clip();
    ctx.fillStyle='#112d3d';ctx.fillRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);
    ctx.strokeStyle='#244656';ctx.lineWidth=1;
    for(let x=64;x<RIGHT;x+=24){ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,BOTTOM);ctx.stroke();}
    for(let y=64;y<BOTTOM;y+=24){ctx.beginPath();ctx.moveTo(LEFT,y);ctx.lineTo(RIGHT,y);ctx.stroke();}
    const floor=ctx.createLinearGradient(48,0,912,0);floor.addColorStop(0,'#49dac313');floor.addColorStop(.5,'#102e3900');floor.addColorStop(1,'#ff78ad14');ctx.fillStyle=floor;ctx.fillRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);
    ctx.strokeStyle='#51819166';ctx.lineWidth=2;ctx.setLineDash([9,13]);ctx.beginPath();ctx.moveTo(480,TOP);ctx.lineTo(480,BOTTOM);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(480,300,88,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(480,300,96,0,Math.PI*2);ctx.strokeStyle='#41697c40';ctx.stroke();
    [LEFT,RIGHT].forEach((x,i)=>{ctx.strokeStyle=COLORS[i]+'55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,CY,140,i?Math.PI/2:-Math.PI/2,i?Math.PI*1.5:Math.PI/2);ctx.stroke();});
    ctx.restore();
    ctx.save();ctx.shadowBlur=16;ctx.shadowColor='#64edeb';ctx.strokeStyle='#73ecea';ctx.lineWidth=3;rounded(ctx,LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP,20);ctx.stroke();ctx.restore();
    [LEFT,RIGHT].forEach((x,i)=>{
      ctx.fillStyle='#071c29';ctx.fillRect(x-5,CY-78,10,156);ctx.fillStyle=COLORS[i]+'28';rounded(ctx,x-19,CY-79,38,158,8);ctx.fill();
      ctx.strokeStyle=COLORS[i];ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,CY-78);ctx.lineTo(x+(i?17:-17),CY-78);ctx.lineTo(x+(i?17:-17),CY+78);ctx.lineTo(x,CY+78);ctx.stroke();
      for(let y=CY-66;y<CY+78;y+=12){ctx.strokeStyle=COLORS[i]+'55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-11,y);ctx.lineTo(x+11,y);ctx.stroke();}
    });
    ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#7ea2b3';ctx.fillText('BANK THE SHOT',480,31);ctx.fillText('NEON AIR • ORIGINAL ARCADE',480,579);
    if(streak.length>1){ctx.lineCap='round';for(let i=1;i<streak.length;i++){ctx.strokeStyle=`rgba(224,249,255,${i/streak.length*.35})`;ctx.lineWidth=i/streak.length*19;ctx.beginPath();ctx.moveTo(streak[i-1].x,streak[i-1].y);ctx.lineTo(streak[i].x,streak[i].y);ctx.stroke();}}
    players.forEach((p,i)=>{
      if(p.boost>0){ctx.save();ctx.globalAlpha=.28;disc(ctx,p.x-p.vx*.025,p.y-p.vy*.025,45,p.color);ctx.restore();}
      disc(ctx,p.x,p.y+9,42,'#00121c88');ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=20;disc(ctx,p.x,p.y,40,p.color);ctx.restore();disc(ctx,p.x,p.y,32,'#173348');disc(ctx,p.x-4,p.y-5,22,p.color);disc(ctx,p.x-7,p.y-9,14,i?'#ffc5db':'#bafcf0');
      ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,47,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-p.cooldown/2.25));ctx.stroke();
      ctx.fillStyle='#d5f3fb';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(`P${i+1}`,p.x,p.y+66);
    });
    ctx.save();ctx.shadowColor='#d8f4ff';ctx.shadowBlur=20;disc(ctx,puck.x,puck.y+4,15,'#04151e');disc(ctx,puck.x,puck.y,13,'#edfbff');disc(ctx,puck.x-3,puck.y-4,6,'#ffffff');ctx.restore();
    sparks.forEach(p=>{ctx.globalAlpha=clamp(p.life*2,0,1);disc(ctx,p.x,p.y,2.7,p.color);});ctx.globalAlpha=1;
    if(serve>0){ctx.fillStyle='#08202cd9';rounded(ctx,361,270,238,60,18);ctx.fill();ctx.fillStyle=lastGoal<0?'#edfbff':COLORS[lastGoal];ctx.font='800 25px system-ui';ctx.fillText(lastGoal<0?'准备开球':`P${lastGoal+1} · 进球！`,480,309);}
    if(ended){ctx.fillStyle='#041825d9';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#e9fcff';ctx.font='900 38px system-ui';ctx.fillText('终场哨响',480,274);ctx.font='700 23px system-ui';ctx.fillStyle='#7cf3df';ctx.fillText(result,480,321);}
    ctx.restore();
  }
  const api={update,draw,bot,getState:()=>({timeLeft:Math.max(0,meta.duration-time),players:players.map((p,i)=>({name:`P${i+1} ${i?'粉红':'青绿'}队`,score:p.score,detail:p.cooldown>0?`冲刺 ${p.cooldown.toFixed(1)}s`:'冲刺就绪'})),status:serve>0?'准备开球':ended?'比赛结束':'7 球制 · 半场对抗',ended,result,paddles:players.map(p=>({x:p.x,y:p.y})),puck:{...puck},serve})};
  // Test-only state injection; omitted from normal host instances.
  if(debug) api.debug={setPuck:values=>{Object.assign(puck,values);serve=0;},setPaddle:(i,values)=>Object.assign(players[i],values)};
  return api;
}
