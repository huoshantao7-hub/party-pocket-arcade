import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,meta,__test} from '../games/racer.js';
const start=-Math.PI/2,tau=Math.PI*2;
test('racer: ordered checkpoints count a lap, reverse and out-of-order cannot score',()=>{
  const c={checkpoints:0,nextCheckpoint:1,laps:0};
  for(let k=1;k<=8;k++){const a=start+k*tau/8;Object.assign(c,__test.point(a+.01));assert.equal(__test.checkpoint(c,(k-1)%8,a-.01,true),true);}
  assert.equal(c.laps,1);assert.equal(c.checkpoints,8);
  Object.assign(c,__test.point(start+3*tau/8+.01));assert.equal(__test.checkpoint(c,2,start+3*tau/8-.01,true),false);assert.equal(c.checkpoints,8);
  Object.assign(c,__test.point(start+tau/8-.01));assert.equal(__test.checkpoint(c,1,start+tau/8+.01,true),false);assert.equal(c.checkpoints,8);
});
test('racer: crossing next gate through grass does not count',()=>{
  const a=start+tau/8,c={...__test.point(a+.01,-100),checkpoints:0,nextCheckpoint:1,laps:0};assert.equal(__test.checkpoint(c,0,a-.01,false),false);assert.equal(c.checkpoints,0);
});
test('racer: independent driving, nitro consumption, brake reduction',()=>{
  const game=createGame({debug:true});game.debug.skipCountdown();const initial=game.getState().cars;game.update(1/30,[{x:1,y:0,action:true},{}]);let s=game.getState();assert.ok(s.cars[0].x>initial[0].x);assert.equal(s.cars[1].x,initial[1].x);assert.ok(s.cars[0].nitro<1);
  const fast=createGame({debug:true}),brake=createGame({debug:true});fast.debug.skipCountdown();brake.debug.skipCountdown();for(let n=0;n<25;n++){fast.update(1/60,[{x:1,y:0},{}]);brake.update(1/60,[{x:1,y:0,alt:true},{}]);}assert.ok(fast.getState().cars[0].speed>brake.getState().cars[0].speed);
});
test('racer: vehicles separate on collision and bounce actual velocities',()=>{
  const game=createGame({debug:true});game.debug.skipCountdown();game.debug.setCar(0,{x:350,y:500,vx:100,vy:0,speed:100,angle:0});game.debug.setCar(1,{x:375,y:500,vx:-100,vy:0,speed:100,angle:Math.PI});game.update(1/60,[{},{}]);const [a,b]=game.getState().cars;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=30.99);assert.ok(a.vx<0);assert.ok(b.vx>0);
});
test('racer: six complete ordered laps trigger victory exactly once',()=>{
  let calls=0;const game=createGame({debug:true,end:()=>calls++});game.debug.skipCountdown();const a=start+tau-.015;game.debug.setCar(0,{...__test.point(a),angle:0,vx:230,vy:0,speed:230,checkpoints:47,nextCheckpoint:0,laps:5});for(let i=0;i<15&&!game.getState().ended;i++)game.update(1/60,[{x:1},{}]);assert.equal(game.getState().cars[0].laps,6);assert.equal(calls,1);const state=game.getState();game.update(1/30,[{x:1},{x:1}]);assert.deepEqual(game.getState(),state);
});
test('racer: deterministic bots complete real checkpoints and end within cap',()=>{
  const a=createGame({seed:19}),b=createGame({seed:19});for(let n=0;n<meta.duration*60+3&&!a.getState().ended;n++){a.update(1/60,[a.bot(0),a.bot(1)]);b.update(1/60,[b.bot(0),b.bot(1)]);}
  assert.deepEqual(a.getState(),b.getState());assert.equal(a.getState().ended,true);assert.ok(a.getState().cars.some(c=>c.laps===6));assert.ok(a.getState().cars.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)));assert.equal(a.debug,undefined);assert.deepEqual(createGame({seed:19}).getState(),createGame({seed:19}).getState());
});
