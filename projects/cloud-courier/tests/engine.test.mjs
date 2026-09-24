import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, LEVELS } from '../engine.js';
const DT=1/120, idle={left:false,right:false,jump:false,run:false};
const tick=(g,n,input=idle)=>{for(let i=0;i<n;i++)g.update(DT,input);};
function fixture(){const g=createGame();Object.assign(g.state.level,{width:2000,platforms:[{id:'floor',x:0,y:444,w:2000,h:96,kind:'ground'}],blocks:[],coins:[],enemies:[],checkpoint:{x:1600,y:374,w:30,h:70,active:false},goal:{x:1900,y:340,w:38,h:104}});tick(g,2);return g;}
const enemy=(x=300)=>({id:'e',x,y:416,w:30,h:28,vx:0,minX:x,maxX:x,alive:true,stompTime:0});

test('ground, running, braking and solid side collision use actual physics',()=>{
 const walk=fixture(),run=fixture();tick(walk,90,{...idle,right:true});tick(run,90,{...idle,right:true,run:true});assert.ok(run.state.player.x>walk.state.player.x+40);assert.equal(run.state.player.y,406);assert.ok(run.state.player.onGround);tick(run,30);assert.equal(run.state.player.vx,0);
 const wall=fixture();wall.state.level.platforms.push({id:'wall',x:200,y:390,w:50,h:54,kind:'solid'});tick(wall,180,{...idle,right:true,run:true});assert.equal(wall.state.player.x,172);assert.equal(wall.state.player.vx,0);
});
test('jump hold changes height and holding jump does not auto-jump on landing',()=>{
 const height=hold=>{const g=fixture();let min=g.state.player.y,jumps=0;for(let f=0;f<180;f++){g.update(DT,{...idle,jump:f<hold});min=Math.min(min,g.state.player.y);jumps+=g.state.events.filter(e=>e.type==='jump').length;}return{min,jumps,y:g.state.player.y};};
 const short=height(3),high=height(160);assert.ok(high.min<short.min-65);assert.equal(short.jumps,1);assert.equal(high.jumps,1);assert.equal(high.y,406);
});
test('coyote time permits a late ledge jump but expires',()=>{
 const g=fixture();g.state.level.platforms[0].w=200;Object.assign(g.state.player,{x:190,y:406,vx:200,onGround:true});let left=false;for(let i=0;i<20;i++){g.update(DT,{...idle,right:true,run:true});if(!g.state.player.onGround){left=true;break;}}assert.ok(left);tick(g,3,{...idle,right:true,run:true});g.update(DT,{...idle,right:true,run:true,jump:true});assert.ok(g.state.events.some(e=>e.type==='jump'));assert.ok(g.state.player.vy<-600);
 const late=fixture();late.state.level.platforms[0].w=200;Object.assign(late.state.player,{x:230,y:406,onGround:false,coyote:0});tick(late,20);late.update(DT,{...idle,jump:true});assert.ok(late.state.player.vy>0);assert.ok(!late.state.events.some(e=>e.type==='jump'));
});
test('jump buffer turns a just-before-landing press into a real jump',()=>{
 const g=fixture();Object.assign(g.state.player,{y:350,vy:300,onGround:false,coyote:0});while(g.state.player.y+g.state.player.h<430)g.update(DT,idle);
 let fired=false;for(let i=0;i<14;i++){g.update(DT,{...idle,jump:true});if(g.state.events.some(e=>e.type==='jump'))fired=true;}assert.ok(fired);assert.ok(g.state.player.vy<0);
});
test('cloud ledges pass through from below and catch descending feet',()=>{
 const g=fixture();g.state.level.platforms.push({id:'cloud',x:60,y:330,w:160,h:22,kind:'ledge',oneWay:true});tick(g,150,{...idle,jump:true});assert.equal(g.state.player.y,292);assert.equal(g.state.player.supportId,'cloud');assert.ok(g.state.player.onGround);
});
test('coins and head-hit question rewards are collected once',()=>{
 const g=fixture();g.state.level.coins.push({id:'coin',x:94,y:420,r:10,collected:false});g.update(DT,idle);assert.equal(g.state.coins,1);tick(g,10);assert.equal(g.state.coins,1);
 g.state.level.blocks.push({id:'q',x:80,y:320,w:40,h:40,type:'question',used:false,bump:0});tick(g,100,{...idle,jump:true});assert.equal(g.state.coins,2);assert.equal(g.state.score,200);assert.equal(g.state.level.blocks[0].used,true);tick(g,3);tick(g,100,{...idle,jump:true});assert.equal(g.state.coins,2);
});
test('descending stomp kills enemy and bounces; side contact hurts only outside invulnerability',()=>{
 const g=fixture();g.state.level.enemies.push(enemy());Object.assign(g.state.player,{x:300,y:365,vy:220,onGround:false,coyote:0});let stomped=false;for(let i=0;i<30;i++){g.update(DT,idle);if(g.state.events.some(e=>e.type==='stomp')){stomped=true;break;}}assert.ok(stomped);assert.equal(g.state.level.enemies[0].alive,false);assert.equal(g.state.score,200);assert.ok(g.state.player.vy<0);assert.equal(g.state.player.hp,3);
 const hit=fixture();hit.state.level.enemies.push(enemy());Object.assign(hit.state.player,{x:285,y:406});hit.update(DT,idle);assert.equal(hit.state.player.hp,2);Object.assign(hit.state.player,{x:285,y:406,vy:0});hit.update(DT,idle);assert.equal(hit.state.player.hp,2);assert.ok(hit.state.player.invulnerable>1);
});
test('checkpoint restores hearts and becomes respawn point; three falls lose',()=>{
 const g=fixture();g.state.level.checkpoint.x=500;Object.assign(g.state.player,{x:505,hp:1});g.update(DT,idle);assert.ok(g.state.level.checkpoint.active);assert.equal(g.state.player.hp,3);assert.equal(g.state.score,250);g.state.coins=4;
 g.state.player.y=660;g.update(DT,idle);assert.equal(g.state.player.x,492);assert.equal(g.state.player.hp,2);assert.equal(g.state.deaths,1);assert.equal(g.state.coins,4);
 g.state.player.y=660;g.update(DT,idle);g.state.player.y=660;g.update(DT,idle);assert.equal(g.state.player.hp,0);assert.equal(g.state.status,'lost');assert.equal(g.state.deaths,3);
});
test('crossing finish while airborne wins, freezes clock and never automatically changes level',()=>{
 const g=fixture();Object.assign(g.state.player,{x:1880,y:200,vy:0,onGround:false});g.update(DT,idle);assert.equal(g.state.status,'won');assert.equal(g.state.score,500);assert.ok(g.state.events.some(e=>e.type==='win'));const elapsed=g.state.elapsed,x=g.state.player.x;tick(g,240,{...idle,right:true,run:true});assert.equal(g.state.elapsed,elapsed);assert.equal(g.state.player.x,x);assert.equal(g.state.levelIndex,0);g.reset();assert.equal(g.state.status,'playing');assert.equal(g.state.coins,0);assert.equal(g.state.player.hp,3);assert.equal(g.state.player.x,LEVELS[0].spawn.x);
});
test('observation is short factual text and reset preserves original hand-authored level data',()=>{
 const g=createGame(1);assert.equal(typeof g.observation(),'string');assert.ok(g.observation().length<2500);assert.match(g.observation(),/Goal is to the right/);assert.match(g.observation(),/Ground edge distance ahead/);assert.ok(!/should|recommend|choose|best action/i.test(g.observation()));g.state.level.coins[0].collected=true;g.reset();assert.equal(g.state.level.coins[0].collected,false);assert.equal(LEVELS[1].coins[0].collected,false);assert.equal(g.state.levelIndex,1);
});
test('each of three handmade levels is actually completed by the same deterministic rule bot',()=>{
 const outcomes=[];for(let i=0;i<LEVELS.length;i++){const run=()=>{const g=createGame(i);for(let f=0;f<7200&&g.state.status==='playing';f++)g.update(DT,g.getBotInput());return{status:g.state.status,time:g.state.elapsed,coins:g.state.coins,score:g.state.score,deaths:g.state.deaths,hp:g.state.player.hp};};const a=run(),b=run();assert.deepEqual(a,b);assert.equal(a.status,'won',`level ${i+1} must finish`);assert.equal(a.deaths,0);assert.ok(a.coins>10);assert.ok(a.hp>0);outcomes.push({level:i+1,...a});}console.log('Three-level rule-bot completion:',JSON.stringify(outcomes));
});
