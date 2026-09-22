export const meta = {
  id: 'jelly', title: '果冻擂台', subtitle: '软乎乎，撞一下就出圈', genre: '物理派对 · 对抗', accent: '#94f8c0', duration: 60,
  rules: ['移动蓄力，冲刺把对手撞出圆环', '按住防守更稳，但移动会变慢', '圆环持续收缩；60 秒内得分高者获胜'], actionLabel: '冲刺', altLabel: '防守'
};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const neutral = () => ({x:0,y:0,action:false,alt:false,pressed:false,altPressed:false});
function rand(seed) { let s=seed>>>0; return () => { s+=0x6d2b79f5; let t=Math.imul(s^(s>>>15),1|s); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; }; }

export function createGame({width=960,height=600,seed=2026,sound=()=>{},end=()=>{},testMode=false}={}) {
  const rng=rand(seed), cx=width/2, cy=height/2+5;
  const baseR=Math.min(width*.32,height*.365), colors=['#8bf3c0','#ff9abb'];
  const players=[0,1].map(i=>({x:cx+(i?1:-1)*baseR*.43,y:cy,vx:0,vy:0,score:0,cool:0,dash:0,guard:false,out:0,face:i?Math.PI:0,blink:1+rng()*3,hit:0,botPhase:rng()*TAU}));
  let elapsed=0,roundTime=0,ready=1.1,round=1,roundPause=0,ended=false,result='',winnerFlash=-1;
  let sparks=[];
  const radius=()=>baseR-Math.min(baseR*.55,roundTime*6);
  function burst(x,y,c,n=16) { for(let i=0;i<n;i++){ const a=rng()*TAU,s=50+rng()*180; sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.35+rng()*.4,life:.8,c}); } }
  function finish(){if(ended)return;ended=true;const a=players[0].score,b=players[1].score;result=a===b?'平局！两团果冻一样能打':`${a>b?'薄荷 P1':'莓莓 P2'} 获胜 · ${a} : ${b}`;end({winner:a===b?null:a>b?0:1,scores:[a,b],text:result});}
  function resetRound(){round++;roundTime=0;ready=.7;winnerFlash=-1;players.forEach((p,i)=>Object.assign(p,{x:cx+(i?1:-1)*baseR*.43,y:cy,vx:0,vy:0,cool:0,dash:0,out:0,hit:0}));}
  function update(dt,inputs=[]){
    if(ended)return;dt=clamp(Number(dt)||0,0,1/30);elapsed+=dt;
    sparks=sparks.filter(p=>(p.t-=dt)>0);sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;});
    if(elapsed>=meta.duration){elapsed=meta.duration;finish();return;}
    if(roundPause>0){roundPause-=dt;if(roundPause<=0)resetRound();return;}
    if(ready>0){ready-=dt;return;}roundTime+=dt;
    for(let i=0;i<2;i++){
      const p=players[i],input=inputs[i]||neutral();
      let x=clamp(input.x||0,-1,1),y=clamp(input.y||0,-1,1),m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}
      p.guard=!!input.alt;p.cool=Math.max(0,p.cool-dt);p.dash=Math.max(0,p.dash-dt);p.hit=Math.max(0,p.hit-dt);p.blink-=dt;if(p.blink<-.13)p.blink=1.5+rng()*3;
      if(m>.1)p.face=Math.atan2(y,x);
      if(input.pressed&&p.cool===0&&!p.guard){p.vx+=Math.cos(p.face)*450;p.vy+=Math.sin(p.face)*450;p.cool=1.25;p.dash=.24;burst(p.x,p.y,colors[i],8);sound('dash');}
      const a=p.guard?330:760,drag=p.dash>0?1.1:p.guard?8:5;
      p.vx=(p.vx+x*a*dt)*Math.exp(-drag*dt);p.vy=(p.vy+y*a*dt)*Math.exp(-drag*dt);p.x+=p.vx*dt;p.y+=p.vy*dt;
      const d=Math.hypot(p.x-cx,p.y-cy);p.out=d>radius()+12?p.out+dt:Math.max(0,p.out-dt*3);
    }
    const a=players[0],b=players[1];let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
    if(dist<54){
      if(dist<.001){dx=1;dy=0;dist=1;}const nx=dx/dist,ny=dy/dist,depth=54-dist;
      a.x-=nx*depth*.5;a.y-=ny*depth*.5;b.x+=nx*depth*.5;b.y+=ny*depth*.5;
      const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(closing>0){const impulse=closing*.92+48;const wa=a.guard?.24:1,wb=b.guard?.24:1;a.vx-=nx*impulse*wa;a.vy-=ny*impulse*wa;b.vx+=nx*impulse*wb;b.vy+=ny*impulse*wb;
        if(a.dash>0&&!b.guard){b.vx+=nx*350;b.vy+=ny*350;}
        if(b.dash>0&&!a.guard){a.vx-=nx*350;a.vy-=ny*350;}
        a.hit=b.hit=.18;burst((a.x+b.x)/2,(a.y+b.y)/2,'#fff9d0',13);sound('hit');
      }
    }
    const fallen=players.map(p=>p.out>.3);
    if(fallen.some(Boolean)){
      if(fallen[0]&&!fallen[1]){b.score++;winnerFlash=1;}else if(fallen[1]&&!fallen[0]){a.score++;winnerFlash=0;}else winnerFlash=2;
      players.forEach((p,i)=>{if(fallen[i])burst(p.x,p.y,colors[i],30);});roundPause=1.1;sound('score');
    }
  }
  function bot(i){
    const p=players[i],q=players[1-i],r=radius(),d=Math.hypot(p.x-cx,p.y-cy),dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
    let tx=dx,ty=dy;
    if(d>r*.65){tx=(cx-p.x)*2;ty=(cy-p.y)*2;}
    else if(len>85){const flank=Math.sin(elapsed*1.7+p.botPhase)*30;tx=dx+(cx-p.x)*.18-dy/len*flank;ty=dy+(cy-p.y)*.18+dx/len*flank;}
    const norm=Math.hypot(tx,ty)||1,guard=q.dash>0&&len<105&&p.cool>.3;
    return{x:tx/norm,y:ty/norm,action:!guard&&p.cool===0&&len<175&&d<r*.72&&Math.sin(elapsed*2.4+p.botPhase)>.05,alt:guard,pressed:false,altPressed:false};
  }
  function draw(ctx){
    ctx.save();const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#16243c');bg.addColorStop(1,'#1c1733');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    for(let i=0;i<38;i++){const x=(i*137+49)%width,y=(i*83+13)%height;ctx.fillStyle=`rgba(198,226,255,${.07+.06*Math.sin(i+elapsed)})`;ctx.beginPath();ctx.arc(x,y,1.5,0,TAU);ctx.fill();}
    const r=radius();ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(cx,cy+29,r+19,r*.96,0,0,TAU);ctx.fill();
    ctx.shadowBlur=28;ctx.shadowColor='#89e3ff50';ctx.fillStyle='#334365';ctx.beginPath();ctx.arc(cx,cy+13,r+9,0,TAU);ctx.fill();ctx.shadowBlur=0;
    const floor=ctx.createRadialGradient(cx-80,cy-90,10,cx,cy,r);floor.addColorStop(0,'#465574');floor.addColorStop(1,'#27334d');ctx.fillStyle=floor;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-4,0,TAU);ctx.clip();ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;for(let x=cx-r;x<cx+r;x+=42){ctx.beginPath();ctx.moveTo(x,cy-r);ctx.lineTo(x,cy+r);ctx.stroke();}for(let y=cy-r;y<cy+r;y+=42){ctx.beginPath();ctx.moveTo(cx-r,y);ctx.lineTo(cx+r,y);ctx.stroke();}ctx.restore();
    ctx.lineWidth=5;ctx.strokeStyle=roundTime>12?'#ffbe88':'#a6d3ef';ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.stroke();ctx.setLineDash([5,14]);ctx.strokeStyle='#ffffff30';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r-15,elapsed*.04,elapsed*.04+TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.textAlign='center';ctx.fillStyle='#bcd0e8';ctx.font='600 12px system-ui';ctx.fillText(`第 ${round} 回合`,cx,39);ctx.fillStyle='#ffffff28';ctx.font='800 58px system-ui';ctx.fillText('JELLY',cx,cy+20);
    for(let i=0;i<2;i++){
      const p=players[i],speed=Math.hypot(p.vx,p.vy),squash=Math.sin(elapsed*9+i)*.028+Math.min(speed/2200,.12),danger=p.out>0;
      ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,24,30,11,0,0,TAU);ctx.fill();
      if(p.dash>0){ctx.save();ctx.rotate(Math.atan2(p.vy,p.vx));for(let k=0;k<3;k++){ctx.fillStyle=colors[i]+['20','35','60'][k];ctx.beginPath();ctx.ellipse(-30-k*15,0,25,18-k*3,0,0,TAU);ctx.fill();}ctx.restore();}
      ctx.scale(1+squash,1-squash);const g=ctx.createLinearGradient(-18,-33,20,32);g.addColorStop(0,i?'#ffcadb':'#c5ffdb');g.addColorStop(.55,colors[i]);g.addColorStop(1,i?'#db5e9c':'#46bc9d');ctx.fillStyle=g;ctx.shadowColor=colors[i]+'60';ctx.shadowBlur=p.hit>0?25:8;
      ctx.beginPath();ctx.moveTo(-29,12);ctx.bezierCurveTo(-31,-8,-20,-31,0,-31);ctx.bezierCurveTo(24,-31,32,-5,29,15);ctx.bezierCurveTo(25,31,-24,34,-29,12);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#ffffff55';ctx.beginPath();ctx.ellipse(-10,-19,10,5,-.45,0,TAU);ctx.fill();ctx.fillStyle='#263647';const eye=Math.cos(p.face)*2;
      for(const ex of[-10,10]){ctx.beginPath();ctx.ellipse(ex+eye,-4,p.blink<0?4:3.7,p.blink<0?1:5,0,0,TAU);ctx.fill();}
      ctx.strokeStyle='#263647';ctx.lineWidth=2.3;ctx.beginPath();if(danger){ctx.arc(0,9,4,0,TAU);}else{ctx.arc(0,5,6,.2,Math.PI-.2);}ctx.stroke();ctx.fillStyle='#fa628b55';ctx.beginPath();ctx.ellipse(-18,5,5,3,0,0,TAU);ctx.ellipse(18,5,5,3,0,0,TAU);ctx.fill();ctx.restore();
      if(p.guard){ctx.strokeStyle='#deefffbb';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,38,0,TAU);ctx.stroke();}
      if(p.cool>0){ctx.strokeStyle=colors[i];ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y+1,37,-Math.PI/2,-Math.PI/2+TAU*(1-p.cool/1.25));ctx.stroke();}
      ctx.fillStyle=colors[i];ctx.font='800 12px system-ui';ctx.fillText(i?'莓莓 P2':'薄荷 P1',p.x,p.y-47);
    }
    for(const p of sparks){ctx.globalAlpha=clamp(p.t/.3,0,1);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    if(ready>0||roundPause>0){ctx.fillStyle='#101b30bb';ctx.fillRect(cx-132,cy-29,264,58);ctx.fillStyle='#fff';ctx.font='800 23px system-ui';ctx.fillText(roundPause>0?(winnerFlash===2?'双双出圈！':`${winnerFlash?'莓莓':'薄荷'} +1 ✦`):'准备，开撞！',cx,cy+8);}
    ctx.fillStyle='#b7c7df';ctx.font='13px system-ui';ctx.fillText('靠近边缘会掉落  ·  冲刺后有短暂冷却',cx,height-25);ctx.restore();
  }
  const api={update,draw,bot,getState:()=>({timeLeft:Math.max(0,meta.duration-elapsed),players:players.map((p,i)=>({name:i?'莓莓 P2':'薄荷 P1',score:p.score,detail:p.cool>0?`冲刺 ${p.cool.toFixed(1)}s`:'冲刺就绪',x:p.x,y:p.y,vx:p.vx,vy:p.vy,cooldown:p.cool,guard:p.guard,out:p.out})),status:ended?result:roundPause>0?'下一回合即将开始':ready>0?'准备开撞':`第 ${round} 回合 · 圆环收缩中`,ended,result,round,radius:radius(),center:{x:cx,y:cy},ready,roundPause})};
  if(testMode)api.__test={setPlayer:(i,v)=>Object.assign(players[i],v),skipReady:()=>{ready=0;},setTime:t=>{elapsed=t;}};
  return api;
}
