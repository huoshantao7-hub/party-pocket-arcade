export const meta={id:'bubble',title:'泡泡爆破',subtitle:'复古迷宫，一颗泡泡翻盘',genre:'复古街机 · 对抗',accent:'#8edbff',duration:75,rules:['放下泡泡，2.1 秒后十字爆破', '破箱加分，拾取道具增加范围或容量', '护盾短暂保命；小心连锁爆破'],actionLabel:'放泡泡',altLabel:'护盾'};
const COLS=11,ROWS=9,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const key=(x,y)=>`${x},${y}`;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const blank=()=>({x:0,y:0,action:false,alt:false,pressed:false,altPressed:false});
function random(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=Math.imul(s^(s>>>15),s|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function createGame({width=960,height=600,seed=2026,sound=()=>{},end=()=>{},testMode=false}={}){
  const rng=random(seed),cell=Math.min(55,(height-85)/ROWS,(width-170)/COLS),ox=(width-COLS*cell)/2,oy=(height-ROWS*cell)/2+4;
  let board=[],bombs=[],flames=[],items=[],particles=[],time=0,ready=1,roundPause=0,round=1,ended=false,result='',bombId=1;
  const players=[0,1].map(i=>({x:i?9:1,y:i?7:1,rx:i?9:1,ry:i?7:1,score:0,wins:0,move:0,range:2,capacity:1,shield:0,shieldCool:0,dead:false,facing:i?-1:1,botPulse:0}));
  function newBoard(){
    board=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x===0||y===0||x===COLS-1||y===ROWS-1||(x%2===0&&y%2===0)?1:rng()<.58?2:0));
    // Connected outer corridors ensure neither spawn can be sealed by random crates.
    for(let x=1;x<COLS-1;x++)board[1][x]=board[ROWS-2][x]=0;
    for(let y=1;y<ROWS-1;y++)board[y][1]=board[y][COLS-2]=0;
    for(const[x,y]of[[2,3],[3,3],[3,2],[7,6],[7,5],[8,5]])if(board[y][x]!==1)board[y][x]=0;
  }
  function reset(){newBoard();bombs=[];flames=[];items=[];players.forEach((p,i)=>Object.assign(p,{x:i?9:1,y:i?7:1,rx:i?9:1,ry:i?7:1,move:0,range:2,capacity:1,shield:0,shieldCool:0,dead:false}));ready=.7;round++;}
  newBoard();
  const inside=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
  function rays(b){const cells=[[b.x,b.y]];for(const[dx,dy]of dirs){for(let n=1;n<=b.range;n++){const x=b.x+dx*n,y=b.y+dy*n;if(!inside(x,y)||board[y][x]===1)break;cells.push([x,y]);if(board[y][x]===2)break;}}return cells;}
  function canMove(x,y,actor=-1){return inside(x,y)&&board[y][x]===0&&!bombs.some(b=>b.x===x&&b.y===y)&&(actor<0||!players.some((p,i)=>i!==actor&&!p.dead&&p.x===x&&p.y===y));}
  function dangerMap(extra=[]){const map=new Map();for(const b of[...bombs,...extra])for(const[x,y]of rays(b)){const k=key(x,y);map.set(k,Math.min(map.get(k)??Infinity,b.fuse));}for(const f of flames)map.set(key(f.x,f.y),0);return map;}
  function spawnParticles(x,y,c){for(let i=0;i<10;i++){const a=rng()*TAU;particles.push({x:ox+(x+.5)*cell,y:oy+(y+.5)*cell,vx:Math.cos(a)*(30+rng()*100),vy:Math.sin(a)*(30+rng()*100),t:.4+rng()*.3,c});}}
  function place(i){const p=players[i];if(p.dead||bombs.some(b=>b.x===p.x&&b.y===p.y)||bombs.filter(b=>b.owner===i).length>=p.capacity)return false;bombs.push({id:bombId++,x:p.x,y:p.y,range:p.range,fuse:2.1,owner:i});sound('drop');return true;}
  function explode(b){
    bombs=bombs.filter(v=>v!==b);for(const[x,y]of rays(b)){
      flames.push({x,y,t:.45,owner:b.owner});const chain=bombs.find(v=>v.x===x&&v.y===y);if(chain)chain.fuse=0;
      if(board[y][x]===2){board[y][x]=0;players[b.owner].score+=4;spawnParticles(x,y,'#ffd886');if(rng()<.4)items.push({x,y,type:rng()<.5?'range':'capacity'});}
    }sound('pop');
  }
  function finish(){if(ended)return;ended=true;const a=players[0].score,b=players[1].score;result=a===b?'平局！泡泡高手不分上下':`${a>b?'蓝鳍 P1':'珊瑚 P2'} 获胜 · ${a} : ${b}`;end({winner:a===b?null:a>b?0:1,scores:[a,b],text:result});}
  function update(dt,inputs=[]){
    if(ended)return;dt=clamp(Number(dt)||0,0,1/30);time+=dt;if(time>=meta.duration){time=meta.duration;finish();return;}
    particles=particles.filter(p=>(p.t-=dt)>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;});
    if(roundPause>0){roundPause-=dt;if(roundPause<=0)reset();return;}if(ready>0){ready-=dt;return;}
    flames=flames.filter(f=>(f.t-=dt)>0);
    players.forEach((p,i)=>{
      const v=inputs[i]||blank();p.move=Math.max(0,p.move-dt);p.shield=Math.max(0,p.shield-dt);p.shieldCool=Math.max(0,p.shieldCool-dt);
      if((v.altPressed||v.alt)&&p.shieldCool===0){p.shield=.75;p.shieldCool=7;sound('shield');}
      if(p.move===0){let dx=0,dy=0;if(Math.abs(v.x||0)>=Math.abs(v.y||0)&&Math.abs(v.x||0)>.35)dx=Math.sign(v.x);else if(Math.abs(v.y||0)>.35)dy=Math.sign(v.y);
        if((dx||dy)&&canMove(p.x+dx,p.y+dy,i)){p.x+=dx;p.y+=dy;p.move=.14;if(dx)p.facing=dx;}
      }
      if(v.pressed)place(i);p.rx+=(p.x-p.rx)*Math.min(1,dt*19);p.ry+=(p.y-p.ry)*Math.min(1,dt*19);
      const item=items.find(v=>v.x===p.x&&v.y===p.y);if(item){if(item.type==='range')p.range=Math.min(4,p.range+1);else p.capacity=Math.min(3,p.capacity+1);items=items.filter(v=>v!==item);p.score+=3;spawnParticles(p.x,p.y,'#bfffe0');sound('pickup');}
    });
    bombs.forEach(b=>b.fuse-=dt);let due=bombs.find(b=>b.fuse<=0);while(due){explode(due);due=bombs.find(b=>b.fuse<=0);}
    const hit=players.map(p=>p.shield<=0&&flames.some(f=>f.x===p.x&&f.y===p.y));
    if(hit.some(Boolean)){hit.forEach((v,i)=>{players[i].dead=v;if(v)spawnParticles(players[i].x,players[i].y,i?'#ffa1a3':'#83dfff');});if(hit[0]&&!hit[1]){players[1].score+=40;players[1].wins++;}else if(hit[1]&&!hit[0]){players[0].score+=40;players[0].wins++;}roundPause=1.4;sound('score');}
  }
  function findPath(start,goal,danger,allowDangerStart=false){
    const actor=players.indexOf(start),q=[{x:start.x,y:start.y,path:[]}],seen=new Set([key(start.x,start.y)]);
    for(let qi=0;qi<q.length;qi++){const n=q[qi];if(goal(n.x,n.y)&&n.path.length)return n.path;
      for(const[dx,dy]of dirs){const x=n.x+dx,y=n.y+dy,k=key(x,y),arrival=(n.path.length+1)*.16;if(seen.has(k)||!canMove(x,y,actor))continue;const d=danger.get(k);if(d!==undefined&&(!allowDangerStart||d<arrival+.28))continue;seen.add(k);q.push({x,y,path:[...n.path,[dx,dy]]});}
    }return null;
  }
  function bot(i){
    const p=players[i],q=players[1-i],danger=dangerMap();if(ended||ready>0||roundPause>0)return blank();
    let path=null;const here=danger.get(key(p.x,p.y));
    if(here!==undefined){path=findPath(p,(x,y)=>!danger.has(key(x,y)),danger,true);if(path)return{...blank(),x:path[0][0],y:path[0][1],alt:here<.25&&p.shieldCool===0};return{...blank(),alt:here<.45&&p.shieldCool===0};}
    const active=bombs.filter(b=>b.owner===i).length;
    if(active<p.capacity){
      const fake={x:p.x,y:p.y,range:p.range,fuse:2.1,owner:i};const cells=rays(fake);const worthwhile=cells.some(([x,y])=>board[y][x]===2||(q.x===x&&q.y===y));
      if(worthwhile&&!bombs.some(b=>b.x===p.x&&b.y===p.y)){
        const next=dangerMap([fake]);const escape=findPath(p,(x,y)=>!next.has(key(x,y)),next,true);
        if(escape&&escape.length*.16<1.65)return{...blank(),action:true};
      }
    }
    const itemPath=findPath(p,(x,y)=>items.some(v=>v.x===x&&v.y===y),danger);
    if(itemPath)path=itemPath;
    else path=findPath(p,(x,y)=>dirs.some(([dx,dy])=>board[y+dy]?.[x+dx]===2)||Math.abs(q.x-x)+Math.abs(q.y-y)<=2,danger);
    if(!path){const candidates=dirs.filter(([dx,dy])=>canMove(p.x+dx,p.y+dy,i)&&!danger.has(key(p.x+dx,p.y+dy)));candidates.sort((a,b)=>(Math.abs(q.x-p.x-a[0])+Math.abs(q.y-p.y-a[1]))-(Math.abs(q.x-p.x-b[0])+Math.abs(q.y-p.y-b[1])));if(candidates.length)path=[candidates[0]];}
    return path?{...blank(),x:path[0][0],y:path[0][1]}:blank();
  }
  function rounded(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function draw(ctx){
    ctx.save();const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,'#15304a');g.addColorStop(1,'#122b39');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    for(let i=0;i<23;i++){const x=(i*173+30)%width,y=(height+i*87-time*(8+i%4))%height;ctx.strokeStyle='#a3eaff15';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,4+i%5*2,0,TAU);ctx.stroke();}
    rounded(ctx,ox-11,oy-10,COLS*cell+22,ROWS*cell+29,20,'#071b29');rounded(ctx,ox-6,oy-7,COLS*cell+12,ROWS*cell+14,15,'#486674');
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=ox+x*cell,py=oy+y*cell,t=board[y][x];rounded(ctx,px+1,py+1,cell-2,cell-2,5,(x+y)%2?'#204856':'#234d5b');
      if(t===1){rounded(ctx,px+3,py+8,cell-6,cell-8,9,'#132d40');const w=ctx.createLinearGradient(px,py,px+cell,py+cell);w.addColorStop(0,'#7594aa');w.addColorStop(1,'#42647b');rounded(ctx,px+3,py+3,cell-6,cell-10,9,w);ctx.strokeStyle='#cdefff28';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+12,py+10);ctx.lineTo(px+cell-13,py+10);ctx.stroke();}
      if(t===2){rounded(ctx,px+7,py+11,cell-14,cell-13,8,'#655238');const c=ctx.createLinearGradient(px,py,px,py+cell);c.addColorStop(0,'#ffe7a7');c.addColorStop(1,'#d4a65f');rounded(ctx,px+6,py+6,cell-12,cell-15,7,c);ctx.strokeStyle='#b58c53';ctx.lineWidth=2;ctx.strokeRect(px+11,py+11,cell-22,cell-25);ctx.fillStyle='#fff4cc';ctx.font=`800 ${cell*.3}px system-ui`;ctx.textAlign='center';ctx.fillText('✦',px+cell/2,py+cell*.6);}
    }
    for(const it of items){const px=ox+(it.x+.5)*cell,py=oy+(it.y+.5)*cell+Math.sin(time*6)*2;ctx.shadowColor='#a5ffe3';ctx.shadowBlur=12;rounded(ctx,px-14,py-14,28,28,8,'#a5ffe3');ctx.shadowBlur=0;ctx.fillStyle='#245867';ctx.font='900 18px system-ui';ctx.textAlign='center';ctx.fillText(it.type==='range'?'+':'Ⅱ',px,py+6);}
    for(const b of bombs){const px=ox+(b.x+.5)*cell,py=oy+(b.y+.5)*cell,r=cell*.31*(1+Math.sin(time*10)*.055);if(b.fuse<.8){ctx.globalAlpha=.1+.12*(1+Math.sin(time*20));for(const[x,y]of rays(b))rounded(ctx,ox+x*cell+3,oy+y*cell+3,cell-6,cell-6,6,'#ffdab3');ctx.globalAlpha=1;}
      ctx.fillStyle='#00000035';ctx.beginPath();ctx.ellipse(px,py+19,19,7,0,0,TAU);ctx.fill();const c=ctx.createRadialGradient(px-6,py-8,2,px,py,r);c.addColorStop(0,'#fffaff');c.addColorStop(.4,b.owner?'#ffc7d7':'#b3efff');c.addColorStop(.72,b.owner?'#f494cf88':'#70c8ee88');c.addColorStop(1,'#eaf9ff');ctx.fillStyle=c;ctx.beginPath();ctx.arc(px,py,r,0,TAU);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=b.fuse<.65?'#ffab8a':'#fff7c7';ctx.beginPath();ctx.arc(px,py,r+4,-Math.PI/2,-Math.PI/2+TAU*(b.fuse/2.1));ctx.stroke();}
    for(const f of flames){const px=ox+(f.x+.5)*cell,py=oy+(f.y+.5)*cell;ctx.globalAlpha=clamp(f.t/.15,0,1);ctx.shadowColor='#bafff4';ctx.shadowBlur=16;rounded(ctx,px-cell*.4,py-cell*.4,cell*.8,cell*.8,cell*.3,'#b9fff0');ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,cell*(.15+(1-f.t/.45)*.25),0,TAU);ctx.stroke();}ctx.globalAlpha=1;
    players.forEach((p,i)=>{const px=ox+(p.rx+.5)*cell,py=oy+(p.ry+.5)*cell;if(p.dead){ctx.globalAlpha=.35;}ctx.save();ctx.translate(px,py);ctx.fillStyle='#00000033';ctx.beginPath();ctx.ellipse(0,18,20,8,0,0,TAU);ctx.fill();const c=i?'#ffa5a6':'#81ddfa';ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(-26,-5);ctx.lineTo(-21,8);ctx.lineTo(-10,11);ctx.moveTo(12,0);ctx.lineTo(26,-5);ctx.lineTo(21,8);ctx.lineTo(10,11);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,18,21,Math.sin(time*7+i)*.04,0,TAU);ctx.fill();ctx.fillStyle=i?'#ffdfd2':'#d3f8ff';ctx.beginPath();ctx.ellipse(0,9,12,9,0,0,TAU);ctx.fill();rounded(ctx,-17,-13,34,20,9,'#263f58');rounded(ctx,-13,-10,26,13,6,'#d4f7ff');ctx.fillStyle='#25405c';ctx.beginPath();ctx.arc(-6+p.facing,-3,2.6,0,TAU);ctx.arc(6+p.facing,-3,2.6,0,TAU);ctx.fill();ctx.strokeStyle='#37516a';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,8,4,0,Math.PI);ctx.stroke();ctx.fillStyle='#fff';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText(i?'2':'1',0,-23);if(p.shield>0){ctx.strokeStyle='#deffff';ctx.lineWidth=3;ctx.shadowBlur=15;ctx.shadowColor='#a6f8ff';ctx.beginPath();ctx.arc(0,0,cell*.46,0,TAU);ctx.stroke();ctx.shadowBlur=0;}ctx.restore();ctx.globalAlpha=1;});
    for(const p of particles){ctx.globalAlpha=clamp(p.t/.3,0,1);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.fillStyle='#b9e2ed';ctx.font='600 13px system-ui';ctx.fillText(`第 ${round} 回合 · 破箱 +4  /  道具 +3  /  存活胜出 +40`,width/2,24);ctx.font='12px system-ui';ctx.fillStyle='#a4c7d2';ctx.fillText('泡泡 2.1 秒爆破  ·  护盾持续 0.75 秒，冷却 7 秒',width/2,height-16);
    if(ready>0||roundPause>0){rounded(ctx,width/2-140,height/2-28,280,56,12,'#0b263fe8');ctx.fillStyle='#fff';ctx.font='800 21px system-ui';ctx.fillText(ready>0?'泡泡就位！':players.every(p=>p.dead)?'一起被泡泡带走了！':`${players[0].dead?'珊瑚':'蓝鳍'} 赢下回合 +40`,width/2,height/2+7);}
    ctx.restore();
  }
  const api={update,draw,bot,getState:()=>({timeLeft:Math.max(0,meta.duration-time),players:players.map((p,i)=>({name:i?'珊瑚 P2':'蓝鳍 P1',score:p.score,detail:`范围 ${p.range} · 容量 ${p.capacity} · ${p.shieldCool>0?'护盾 '+Math.ceil(p.shieldCool)+'s':'护盾就绪'}`,x:p.x,y:p.y,range:p.range,capacity:p.capacity,shield:p.shield,shieldCool:p.shieldCool,dead:p.dead,wins:p.wins})),status:ended?result:roundPause>0?'下一回合即将开始':ready>0?'准备放泡泡':`第 ${round} 回合 · 十字爆破，小心连锁`,ended,result,round,ready,roundPause,board:board.map(r=>[...r]),bombs:bombs.map(b=>({...b})),flames:flames.map(f=>({...f})),items:items.map(i=>({...i}))})};
  if(testMode)api.__test={skipReady:()=>{ready=0;},setPlayer:(i,v)=>Object.assign(players[i],v),setCell:(x,y,v)=>{board[y][x]=v;},addBomb:b=>bombs.push({id:bombId++,owner:0,range:2,fuse:2.1,...b}),setTime:t=>{time=t;},addItem:item=>items.push({...item})};
  return api;
}
