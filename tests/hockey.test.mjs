import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,meta} from '../games/hockey.js';
const neutral={x:0,y:0,action:false,pressed:false,alt:false};
test('hockey: seed/reset deterministic and public game hides test hooks',()=>{
  const a=createGame({seed:37}),b=createGame({seed:37});
  for(let n=0;n<600;n++){a.update(1/60,[a.bot(0),a.bot(1)]);b.update(1/60,[b.bot(0),b.bot(1)]);}
  assert.deepEqual(a.getState(),b.getState());assert.equal(a.debug,undefined);assert.deepEqual(createGame({seed:37}).getState(),createGame({seed:37}).getState());
});
test('hockey: both players move independently and cannot cross halfway',()=>{
  const game=createGame();game.update(1/30,[{x:1,y:0},neutral]);let s=game.getState();assert.ok(s.paddles[0].x>195);assert.equal(s.paddles[1].x,765);
  for(let i=0;i<240;i++)game.update(1/30,[{x:1,y:-1},{x:-1,y:1}]);s=game.getState();assert.ok(s.paddles[0].x<=440);assert.ok(s.paddles[1].x>=520);assert.ok(s.paddles[0].y>=100);assert.ok(s.paddles[1].y<=500);
});
test('hockey: top wall reflects puck and paddle collision adds shot velocity',()=>{
  const game=createGame({debug:true});game.debug.setPuck({x:470,y:72,vx:0,vy:-300});game.update(1/30,[]);assert.ok(game.getState().puck.vy>0);
  game.debug.setPaddle(0,{x:195,y:300});game.debug.setPuck({x:250,y:300,vx:-300,vy:0});game.update(1/30,[]);assert.ok(game.getState().puck.vx>0);
});
test('hockey: goal opening scores only opponent and outside opening bounces',()=>{
  const game=createGame({debug:true});game.debug.setPuck({x:39,y:300,vx:-400,vy:0});game.update(1/30,[]);assert.deepEqual(game.getState().players.map(p=>p.score),[0,1]);assert.ok(game.getState().serve>0);
  game.debug.setPuck({x:60,y:170,vx:-400,vy:0});game.update(1/30,[]);assert.ok(game.getState().puck.vx>0);assert.deepEqual(game.getState().players.map(p=>p.score),[0,1]);
});
test('hockey: boost grants burst and first to seven ends exactly once/frozen',()=>{
  const normal=createGame(),fast=createGame({debug:true});normal.update(1/30,[{x:1},neutral]);fast.update(1/30,[{x:1,pressed:true},neutral]);assert.ok(fast.getState().paddles[0].x>normal.getState().paddles[0].x);
  let ended=0;const win=createGame({debug:true,end:()=>ended++});for(let i=0;i<7;i++){win.debug.setPuck({x:923,y:300,vx:400,vy:0});win.update(1/30,[]);}assert.equal(ended,1);assert.equal(win.getState().players[0].score,7);const snapshot=win.getState();win.update(1/30,[{x:1},{y:1}]);assert.deepEqual(win.getState(),snapshot);
});
test('hockey: automatic full match has finite actual scores and times out',()=>{
  const game=createGame();for(let n=0;n<meta.duration*60+3&&!game.getState().ended;n++)game.update(1/60,[game.bot(0),game.bot(1)]);
  const s=game.getState();assert.equal(s.ended,true);assert.ok(s.players.some(p=>p.score>0));s.players.forEach(p=>assert.ok(Number.isInteger(p.score)&&p.score<=7));
});
