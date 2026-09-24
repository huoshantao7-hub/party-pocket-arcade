import { LEVELS } from './levels.js';
export { LEVELS };
const GRAVITY=1900, JUMP_SPEED=650, WALK_SPEED=235, RUN_SPEED=320, COYOTE=.11, BUFFER=.13;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const approach=(value,target,amount)=>value<target?Math.min(value+amount,target):Math.max(value-amount,target);
const round=n=>Math.round(n*10)/10;
const clone=v=>JSON.parse(JSON.stringify(v));

export function createGame(levelIndex=0){
  levelIndex=clamp(Math.trunc(Number(levelIndex)||0),0,LEVELS.length-1);
  const state={};
  function reset(){
    const level=clone(LEVELS[levelIndex]);
    Object.assign(state,{levelIndex,level,player:{x:level.spawn.x,y:level.spawn.y,w:28,h:38,vx:0,vy:0,onGround:false,facing:1,hp:3,invulnerable:0,coyote:0,jumpBuffer:0,jumpHeld:false,jumpHoldTime:0,supportId:null},coins:0,score:0,deaths:0,elapsed:0,cameraX:0,status:'playing',events:[]});
    return state;
  }
  reset();
  const event=(type,x,y,value)=>state.events.push({type,x,y,...(value===undefined?{}:{value})});
  const solids=()=>[...state.level.platforms,...state.level.blocks];
  function respawn(){
    const p=state.player,c=state.level.checkpoint,point=c.active?{x:c.x-8,y:444-p.h}:state.level.spawn;
    Object.assign(p,{x:point.x,y:point.y,vx:0,vy:0,onGround:false,invulnerable:1.7,coyote:0,jumpBuffer:0,jumpHeld:false,jumpHoldTime:0,supportId:null});
    state.cameraX=clamp(p.x-300,0,state.level.width-960);
  }
  function takeDamage(pit=false,sourceX=state.player.x+50){
    const p=state.player;if(!pit&&p.invulnerable>0)return;
    p.hp--;event(pit?'death':'hurt',p.x+p.w/2,p.y+p.h/2,p.hp);
    if(pit||p.hp<=0)state.deaths++;
    if(p.hp<=0){p.hp=0;state.status='lost';p.vx=0;p.vy=0;return;}
    if(pit)respawn();else{p.invulnerable=1.5;p.vx=sourceX>p.x?-240:240;p.vy=-285;p.onGround=false;}
  }
  function rewardBlock(b){
    b.bump=.22;event('block',b.x+b.w/2,b.y,b.used?0:1);
    if(b.type==='question'&&!b.used){b.used=true;state.coins++;state.score+=100;event('coin',b.x+b.w/2,b.y-15,1);}
  }
  function update(dt,input={}){
    state.events=[];if(state.status!=='playing')return;
    dt=clamp(Number(dt)||0,0,1/30);if(!dt)return;
    const p=state.player,level=state.level,jump=!!input.jump;
    state.elapsed+=dt;for(const b of level.blocks)b.bump=Math.max(0,b.bump-dt);
    for(const e of level.enemies){if(!e.alive){e.stompTime=Math.max(0,e.stompTime-dt);continue;}e.x+=e.vx*dt;if(e.x<e.minX){e.x=e.minX;e.vx=Math.abs(e.vx);}if(e.x>e.maxX){e.x=e.maxX;e.vx=-Math.abs(e.vx);}}
    p.invulnerable=Math.max(0,p.invulnerable-dt);
    p.coyote=p.onGround?COYOTE:Math.max(0,p.coyote-dt);
    p.jumpBuffer=jump&&!p.jumpHeld?BUFFER:Math.max(0,p.jumpBuffer-dt);
    if(p.jumpBuffer>0&&(p.onGround||p.coyote>0)){
      p.vy=-JUMP_SPEED;p.onGround=false;p.coyote=0;p.jumpBuffer=0;p.jumpHoldTime=0;event('jump',p.x+p.w/2,p.y+p.h);
    }
    if(!jump&&p.jumpHeld&&p.vy<-270)p.vy=-270;
    p.jumpHeld=jump;
    const direction=Number(!!input.right)-Number(!!input.left),speed=input.run?RUN_SPEED:WALK_SPEED;
    if(direction)p.facing=direction;
    p.vx=approach(p.vx,direction*speed,(p.onGround?2300:1500)*dt);
    p.jumpHoldTime+=dt;
    p.vy=Math.min(880,p.vy+GRAVITY*(jump&&p.vy<0&&p.jumpHoldTime<.19?.57:1)*dt);
    const world=solids(),oldX=p.x,oldY=p.y,oldBottom=p.y+p.h;
    p.x+=p.vx*dt;
    for(const s of world)if(!s.oneWay&&overlap(p,s)){
      if(p.vx>0&&oldX+p.w<=s.x+2){p.x=s.x-p.w;p.vx=0;}
      else if(p.vx<0&&oldX>=s.x+s.w-2){p.x=s.x+s.w;p.vx=0;}
    }
    p.x=clamp(p.x,0,level.width-p.w);
    p.y+=p.vy*dt;p.onGround=false;p.supportId=null;
    for(const s of world)if(overlap(p,s)){
      if(p.vy>=0&&oldBottom<=s.y+2){p.y=s.y-p.h;p.vy=0;p.onGround=true;p.supportId=s.id;}
      else if(!s.oneWay&&p.vy<0&&oldY>=s.y+s.h-2){p.y=s.y+s.h;p.vy=0;if(level.blocks.includes(s))rewardBlock(s);}
    }
    for(const c of level.coins){if(c.collected)continue;const nx=clamp(c.x,p.x,p.x+p.w),ny=clamp(c.y,p.y,p.y+p.h);if(Math.hypot(nx-c.x,ny-c.y)<c.r+1){c.collected=true;state.coins++;state.score+=100;event('coin',c.x,c.y,1);}}
    for(const e of level.enemies){if(!e.alive||!overlap(p,e))continue;
      if(p.vy>0&&oldBottom<=e.y+14){e.alive=false;e.stompTime=.4;p.y=e.y-p.h;p.vy=jump?-540:-420;p.onGround=false;p.jumpHoldTime=.19;state.score+=200;event('stomp',e.x+e.w/2,e.y,200);}
      else takeDamage(false,e.x+e.w/2);
    }
    if(state.status!=='playing')return;
    if(p.y>level.height+100){takeDamage(true);return;}
    const checkpoint=level.checkpoint;
    if(!checkpoint.active&&overlap(p,checkpoint)){checkpoint.active=true;p.hp=3;state.score+=250;event('checkpoint',checkpoint.x,checkpoint.y,250);}
    if(p.x+p.w>=level.goal.x&&p.y<444&&p.y+p.h>0){state.status='won';p.vx=0;state.score+=500;event('win',level.goal.x,level.goal.y,500);}
    state.cameraX=approach(state.cameraX,clamp(p.x-310,0,level.width-960),Math.max(90,Math.abs(p.vx)*1.25)*dt);
  }
  function terrain(){
    const p=state.player,feet=p.y+p.h,cx=p.x+p.w/2,ground=state.level.platforms.filter(s=>s.kind==='ground').sort((a,b)=>a.x-b.x);
    let segment=ground.find(s=>cx>=s.x&&cx<s.x+s.w),edgeDistance=Infinity,gapWidth=0,nextLandingX=null;
    if(segment){const index=ground.indexOf(segment),next=ground[index+1];if(next){edgeDistance=segment.x+segment.w-(p.x+p.w);gapWidth=next.x-(segment.x+segment.w);nextLandingX=next.x;}}
    else{const next=ground.find(s=>s.x>cx);if(next){edgeDistance=0;gapWidth=next.x-cx;nextLandingX=next.x;}}
    const obstacles=solids().filter(s=>s.x>=p.x+p.w-1&&s.x-p.x<190&&!s.oneWay&&s.y<feet-5&&s.y+s.h>p.y+3).sort((a,b)=>a.x-b.x);
    const obstacle=obstacles[0];
    return{edgeDistance,gapWidth,nextLandingX,obstacleDistance:obstacle?obstacle.x-p.x-p.w:Infinity,obstacleHeight:obstacle?feet-obstacle.y:0};
  }
  function nearestEnemy(){const p=state.player;const candidates=state.level.enemies.filter(e=>e.alive&&e.x+e.w>p.x-5&&Math.abs(e.y-p.y)<180).sort((a,b)=>a.x-b.x);return candidates[0]||null;}
  function observation(){
    const p=state.player,t=terrain(),enemy=nearestEnemy(),coin=state.level.coins.filter(c=>!c.collected&&c.x>=p.x).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    const fact=n=>Number.isFinite(n)?round(n):'none';
    return `Platform game factual observation. Level ${levelIndex+1}. Status=${state.status}. World coordinates: x grows right, y grows downward. Player left=${round(p.x)}, top=${round(p.y)}, width=${p.w}, height=${p.h}, vx=${round(p.vx)}, vy=${round(p.vy)}, on_ground=${p.onGround}, can_jump=${p.onGround||p.coyote>0}, jump_button_held=${p.jumpHeld}, hp=${p.hp}. Goal is to the right, distance=${round(state.level.goal.x-p.x)}. Ground edge distance ahead=${fact(t.edgeDistance)}, gap width=${fact(t.gapWidth)}, next landing x=${t.nextLandingX??'none'}. Nearest wall ahead distance=${fact(t.obstacleDistance)}, height above feet=${fact(t.obstacleHeight)}. Nearest living enemy ahead distance=${enemy?round(enemy.x-p.x-p.w):'none'}, enemy top=${enemy?round(enemy.y):'none'}. Nearest uncollected coin dx=${coin?round(coin.x-p.x):'none'}, dy=${coin?round(coin.y-p.y):'none'}.`;
  }
  function getBotInput(){
    if(state.status!=='playing')return{left:false,right:false,jump:false,run:false};
    const p=state.player,t=terrain(),enemy=nearestEnemy();
    let jump=p.vy<-20;
    if(p.onGround||p.coyote>0){
      const enemyDistance=enemy?enemy.x-p.x-p.w:Infinity;
      jump=(t.edgeDistance<50&&t.edgeDistance>=-20&&t.gapWidth>8)||(t.obstacleDistance<91&&t.obstacleHeight<175)||(enemyDistance<80&&enemyDistance>-25);
      const box=state.level.blocks.find(b=>b.type==='question'&&!b.used&&Math.abs(b.x+b.w/2-(p.x+p.w/2))<20&&p.y>b.y+b.h&&p.y-(b.y+b.h)<110);
      if(box&&t.edgeDistance>200)jump=true;
    }
    return{left:false,right:true,jump,run:true};
  }
  return{state,update,reset,observation,getBotInput};
}
