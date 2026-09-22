export const meta={id:'racer',title:'微缩拉力赛',subtitle:'桌面跑道，也有最后一圈',genre:'街机赛车',accent:'#ffbe72',duration:75,actionLabel:'氮气',altLabel:'刹车',rules:['方向键控制车头，绕赛道顺时针跑完 6 圈','必须按顺序通过 8 个检查点，切草地不会抄近路','氮气会缓慢回复；刹车收线，车身可以互相碰撞']};
const W=960,H=600,CX=480,CY=302,RX=360,RY=195,TAU=Math.PI*2,START=-Math.PI/2,COLORS=['#60e5cb','#ff8d8e'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
const point=(a,offset=0)=>({x:CX+Math.cos(a)*(RX+offset),y:CY+Math.sin(a)*(RY+offset)});
const angleAt=(x,y)=>Math.atan2((y-CY)/RY,(x-CX)/RX);
const progressAt=(x,y)=>((angleAt(x,y)-START)%TAU+TAU)%TAU;
function trackDistance(x,y){const a=angleAt(x,y),p=point(a);return Math.hypot(x-p.x,y-p.y);}
function sectorAt(x,y){return Math.floor(progressAt(x,y)/(TAU/8))%8;}
function rng(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
function disc(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function rr(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function checkpoint(car,previousSector,previousAngle,wasOnTrack){
  const now=sectorAt(car.x,car.y),angle=angleAt(car.x,car.y),delta=wrap(angle-previousAngle);
  if(wasOnTrack&&trackDistance(car.x,car.y)<=52&&delta>0&&delta<.2&&now!==previousSector&&now===car.nextCheckpoint){car.checkpoints++;car.nextCheckpoint=(car.nextCheckpoint+1)%8;car.laps=Math.floor(car.checkpoints/8);return true;}return false;
}
export const __test={point,trackDistance,sectorAt,checkpoint};
export function createGame({width=W,height=H,seed=2026,sound=()=>{},end=()=>{},debug=false}={}){
  const random=rng(seed),trees=Array.from({length:20},(_,i)=>{const a=i/20*TAU;return{x:CX+Math.cos(a)*(205+random()*28),y:CY+Math.sin(a)*(72+random()*16),r:10+random()*8};});
  const cars=[-18,18].map((off,i)=>{const p=point(START+.015,off);return{x:p.x,y:p.y,angle:0,vx:0,vy:0,speed:0,nitro:1,laps:0,checkpoints:0,nextCheckpoint:1,color:COLORS[i],hit:0};});
  let time=0,ended=false,result='',countdown=1.6,particles=[],skids=[],winner=-1;
  function rank(car){return car.checkpoints+clamp((progressAt(car.x,car.y)/(TAU/8)+8-(car.nextCheckpoint+7)%8)%8,0,.99);}
  function finish(index=-1){if(ended)return;ended=true;winner=index;const a=rank(cars[0]),b=rank(cars[1]);if(winner<0)winner=Math.abs(a-b)<.03?-1:a>b?0:1;result=winner<0?'并驾齐驱，平局！':`P${winner+1} ${winner?'珊瑚':'薄荷'}车手获胜！`;sound('win');end(result);}
  function update(dt,inputs=[]){
    if(ended)return;dt=clamp(Number(dt)||0,0,1/30);time+=dt;countdown=Math.max(0,countdown-dt);
    cars.forEach((car,i)=>{
      const input=inputs[i]||{},x=clamp(Number(input.x)||0,-1,1),y=clamp(Number(input.y)||0,-1,1),moving=Math.hypot(x,y)>.08;
      const oldSector=sectorAt(car.x,car.y),oldAngle=angleAt(car.x,car.y),onTrack=trackDistance(car.x,car.y)<=52;
      car.hit=Math.max(0,car.hit-dt);const boost=input.action&&car.nitro>.015&&moving&&onTrack&&countdown<=0;
      car.nitro=clamp(car.nitro+(boost?-.45:.16)*dt,0,1);
      if(countdown>0)return;
      if(moving){const target=Math.atan2(y,x),diff=wrap(target-car.angle);car.angle+=clamp(diff,-(input.alt?5.8:4.25)*dt,(input.alt?5.8:4.25)*dt);}
      const desired=!moving?0:input.alt?105:boost?305:210;
      const grip=onTrack?8:3.2,targetSpeed=onTrack?desired:Math.min(desired,105);
      car.speed+=(targetSpeed-car.speed)*(1-Math.exp(-3.8*dt));
      car.vx+=(Math.cos(car.angle)*car.speed-car.vx)*(1-Math.exp(-grip*dt));car.vy+=(Math.sin(car.angle)*car.speed-car.vy)*(1-Math.exp(-grip*dt));
      car.x=clamp(car.x+car.vx*dt,30,W-30);car.y=clamp(car.y+car.vy*dt,35,H-35);
      if(checkpoint(car,oldSector,oldAngle,onTrack)){sound(car.laps&&car.nextCheckpoint===1?'lap':'tick');if(car.laps>=6)finish(i);}
      if(boost&&random()<.7){particles.push({x:car.x-Math.cos(car.angle)*21,y:car.y-Math.sin(car.angle)*21,vx:-car.vx*.18,vy:-car.vy*.18,life:.3,color:'#ffe083'});}
      if(!onTrack&&Math.hypot(car.vx,car.vy)>45&&random()<.35){particles.push({x:car.x,y:car.y,vx:(random()-.5)*40,vy:(random()-.5)*40,life:.5,color:'#a4c381'});}
      if(input.alt&&car.speed>120){skids.push({x:car.x,y:car.y,angle:car.angle,life:2.5});if(skids.length>130)skids.shift();}
    });
    const [a,b]=cars,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<31&&countdown<=0){const nx=d>.01?dx/d:1,ny=d>.01?dy/d:0,push=(31-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const force=-rel*.72;a.vx-=nx*force;a.vy-=ny*force;b.vx+=nx*force;b.vy+=ny*force;if(a.hit<=0){sound('hit');a.hit=b.hit=.25;particles.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:30,vy:-20,life:.35,color:'#fff1bd'});}}}
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);skids.forEach(p=>p.life-=dt);skids=skids.filter(p=>p.life>0);
    if(time>=meta.duration){time=meta.duration;finish();}
  }
  function bot(i){
    const c=cars[i],a=angleAt(c.x,c.y),offset=i?13:-13;const target=point(a+.22,offset),dx=target.x-c.x,dy=target.y-c.y,len=Math.hypot(dx,dy);
    // Corner-aware acceleration uses the same direction/nitro controls as humans.
    const straight=Math.abs(Math.sin(a))>.83,steering=Math.abs(wrap(Math.atan2(dy,dx)-c.angle));
    return{x:len?dx/len:0,y:len?dy/len:0,action:straight&&steering<.35&&c.nitro>.25,alt:steering>1.25,pressed:false,altPressed:false};
  }
  function draw(ctx){
    ctx.save();ctx.scale(width/W,height/H);ctx.fillStyle='#f2daba';ctx.fillRect(0,0,W,H);
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#f6e7ce');sky.addColorStop(1,'#dec49e');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(0,10);ctx.shadowColor='#755e5138';ctx.shadowBlur=20;ctx.fillStyle='#b3ad87';ctx.beginPath();ctx.ellipse(CX,CY,RX+78,RY+76,0,0,TAU);ctx.fill();ctx.restore();
    ctx.fillStyle='#93b47c';ctx.beginPath();ctx.ellipse(CX,CY,RX+66,RY+64,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#e9dfc8';ctx.lineWidth=116;ctx.beginPath();ctx.ellipse(CX,CY,RX,RY,0,0,TAU);ctx.stroke();
    ctx.strokeStyle='#566b73';ctx.lineWidth=102;ctx.beginPath();ctx.ellipse(CX,CY,RX,RY,0,0,TAU);ctx.stroke();
    ctx.strokeStyle='#6f858b';ctx.lineWidth=2;ctx.setLineDash([15,19]);ctx.beginPath();ctx.ellipse(CX,CY,RX,RY,0,0,TAU);ctx.stroke();ctx.setLineDash([]);
    for(let k=0;k<80;k++){const a=k/80*TAU,b=a+TAU/80*.65;ctx.strokeStyle=k%2?'#f0ebde':'#ed806c';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(CX,CY,RX+55,RY+55,0,a,b);ctx.stroke();ctx.beginPath();ctx.ellipse(CX,CY,RX-55,RY-55,0,a,b);ctx.stroke();}
    // White grid marks the finish line across both racing lanes.
    for(let y=0;y<8;y++)for(let x=0;x<2;x++){ctx.fillStyle=(x+y)%2?'#253d4a':'#fff9e9';ctx.fillRect(CX-9+x*9,CY-RY-49+y*12.25,9,12.25);}
    trees.forEach(t=>{disc(ctx,t.x+5,t.y+7,t.r+2,'#648d5735');disc(ctx,t.x,t.y,t.r,'#568d67');disc(ctx,t.x-3,t.y-4,t.r*.7,'#73a87a');});
    rr(ctx,362,245,236,111,18,'#668766');rr(ctx,358,237,236,111,18,'#fcf0d9');
    ctx.textAlign='center';ctx.fillStyle='#40576b';ctx.font='900 26px system-ui';ctx.fillText('TINY RALLY',476,278);ctx.font='700 13px system-ui';ctx.fillStyle='#83966b';ctx.fillText('MINIATURE GRAND PRIX',476,303);
    ctx.fillStyle='#d4c09b';ctx.fillRect(398,320,157,2);ctx.fillStyle='#7f8e78';ctx.font='700 12px system-ui';ctx.fillText('顺时针 · 6 圈冲线',476,336);
    [0,1,2].forEach(i=>{rr(ctx,235+i*38,238,28,18,5,['#f4a886','#e9c879','#8ac4b3'][i]);rr(ctx,634+i*28,345,20,30,4,['#f4a886','#aac3dd','#c4d58d'][i]);});
    // Small bleachers and umbrellas emphasize the toy scale.
    for(let i=0;i<8;i++){rr(ctx,359+i*30,19,24,15,3,i%2?'#d58974':'#faf0d5');disc(ctx,371+i*30,18,4,['#4e6576','#dc806d','#7eaa91'][i%3]);}
    rr(ctx,385,558,190,17,5,'#c5a97e');ctx.fillStyle='#725f4d';ctx.font='700 11px system-ui';ctx.fillText('PIT LANE  /  POCKET CIRCUIT',480,570);
    for(let k=1;k<8;k++){const a=START+k*TAU/8,p=point(a,67);disc(ctx,p.x,p.y,9,'#f6edd4');ctx.fillStyle='#6a795a';ctx.font='800 10px system-ui';ctx.fillText(String(k),p.x,p.y+3);}
    skids.forEach(s=>{ctx.save();ctx.globalAlpha=s.life/2.5*.27;ctx.translate(s.x,s.y);ctx.rotate(s.angle);rr(ctx,-10,-10,18,3,1,'#142e3b');rr(ctx,-10,7,18,3,1,'#142e3b');ctx.restore();});
    particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*3,0,1);disc(ctx,p.x,p.y,4.3,p.color);});ctx.globalAlpha=1;
    cars.forEach((c,i)=>{
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.shadowColor='#132b4740';ctx.shadowBlur=7;ctx.shadowOffsetY=5;
      rr(ctx,-18,-13,36,26,7,c.hit>0?'#fff5d1':c.color);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      rr(ctx,-11,-16,10,5,2,'#253c4a');rr(ctx,8,-16,10,5,2,'#253c4a');rr(ctx,-11,11,10,5,2,'#253c4a');rr(ctx,8,11,10,5,2,'#253c4a');
      rr(ctx,-6,-10,15,20,4,'#254e60');rr(ctx,4,-8,4,16,2,'#9acecc');rr(ctx,-19,-13,5,26,2,'#f7f2da');rr(ctx,15,-10,3,6,1,'#fff5c5');rr(ctx,15,4,3,6,1,'#fff5c5');
      ctx.fillStyle='#fff8e6';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(String(i+1),-10,4);ctx.restore();
      rr(ctx,c.x-18,c.y-33,36,5,2,'#20374775');rr(ctx,c.x-18,c.y-33,36*c.nitro,5,2,c.color);
      ctx.textAlign='center';ctx.fillStyle='#264b58';ctx.font='800 12px system-ui';ctx.fillText(`P${i+1}`,c.x,c.y-41);
    });
    if(countdown>0){rr(ctx,412,370,136,49,16,'#294653ef');ctx.fillStyle='#fff0d3';ctx.font='900 24px system-ui';ctx.fillText(countdown>.7?'准备发车':'GO!',480,402);}
    if(ended){ctx.fillStyle='#233b47dd';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff4dc';ctx.font='900 39px system-ui';ctx.fillText('冲线！',480,274);ctx.fillStyle=winner>=0?COLORS[winner]:'#ffcb86';ctx.font='800 25px system-ui';ctx.fillText(result,480,321);}
    ctx.restore();
  }
  const api={update,draw,bot,getState:()=>({timeLeft:Math.max(0,meta.duration-time),players:cars.map((c,i)=>({name:`P${i+1} ${i?'珊瑚':'薄荷'}车手`,score:c.laps,detail:`${c.laps}/6 圈 · 氮气 ${Math.round(c.nitro*100)}%`})),status:countdown>0?'起跑倒计时':ended?'比赛结束':'顺时针竞速 · 按序过点',ended,result,cars:cars.map(c=>({...c})),countdown})};
  // Test-only repositioning is not exposed by normal game instances.
  if(debug)api.debug={setCar:(i,values)=>Object.assign(cars[i],values),skipCountdown:()=>{countdown=0;}};
  return api;
}
