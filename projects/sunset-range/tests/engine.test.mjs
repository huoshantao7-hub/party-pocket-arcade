import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, WEAPONS } from '../engine.js';
const DT=1/120;
const tick=(g,n)=>{for(let i=0;i<n;i++)g.update(DT);};
const advance=(g,seconds)=>tick(g,Math.ceil(seconds/DT));
function target(g,fields={}){
 const t={id:900,slot:0,x:500,y:250,r:50,depth:.5,type:'normal',motion:'static',baseX:500,baseY:250,motionPhase:0,speed:1,age:1,ttl:100,active:true,hit:false,expired:false,scale:1,phase:'live',respawnRemaining:0,...fields};
 g.state.targets=[t];return t;
}
function shot(g,offset=0,fields={}){const t=target(g,fields);return g.shoot(t.x+t.r*offset,t.y);}
function ready(g){advance(g,WEAPONS[g.state.weapon].cooldown);if(g.state.ammo===0){assert.equal(g.reload(),true);advance(g,WEAPONS[g.state.weapon].reload);}}

test('seed reproduces target layout, movement and expiration; other seeds differ',()=>{
 const a=createGame({seed:18}),b=createGame({seed:18}),c=createGame({seed:19});assert.deepEqual(a.state,b.state);assert.notDeepEqual(a.state.targets,c.state.targets);tick(a,1200);tick(b,1200);assert.deepEqual(a.state,b.state);
 for(const t of a.state.targets){assert.ok(t.x-t.r>=90-1e-9);assert.ok(t.x+t.r<=870+1e-9);assert.ok(t.y-t.r>=150-1e-9);assert.ok(t.y+t.r<=400+1e-9);}
});
test('three precise scoring rings and weapon-independent score values',()=>{
 for(const weapon of ['pistol','rifle'])for(const[offset,ring,score]of[[0,'bullseye',100],[.22,'middle',60],[.55,'outer',30],[1,'outer',30]]){
  const g=createGame({weapon});const hit=shot(g,offset);assert.equal(hit.type,'hit');assert.equal(hit.ring,ring);assert.equal(hit.score,score);assert.equal(g.state.hits,1);assert.equal(g.state.shots,1);assert.equal(g.state.ammo,g.state.maxAmmo-1);assert.equal(g.state.bullseyes,ring==='bullseye'?1:0);
 }
 const miss=createGame();assert.equal(shot(miss,1.01).type,'miss');assert.equal(miss.state.score,0);
});
test('nearest depth wins overlapping shot; fading and entering targets cannot occlude',()=>{
 const g=createGame();const far=target(g,{id:1,depth:.9}),near={...far,id:2,depth:.2,type:'bonus'};g.state.targets.push(near);let hit=g.shoot(500,250);assert.equal(hit.targetId,2);assert.equal(hit.score,200);assert.equal(far.hit,false);assert.equal(near.hit,true);assert.equal(near.active,false);
 advance(g,.25);hit=g.shoot(far.x,far.y);assert.equal(hit.targetId,1);assert.equal(g.state.hits,2);
 const entry=createGame();const t=entry.state.targets[0];assert.equal(entry.shoot(t.x,t.y).type,'miss');assert.equal(entry.state.hits,0);
});
test('combo grows every five hits to at most 3x; bonus doubles; miss breaks',()=>{
 const g=createGame({mode:'practice'});for(let i=1;i<=25;i++){const result=shot(g);assert.equal(result.multiplier,Math.min(3,1+Math.floor(i/5)*.5));if(i===5)assert.equal(result.score,150);if(i===20)assert.equal(result.score,300);ready(g);}
 assert.equal(g.state.combo,25);assert.equal(g.state.bestCombo,25);assert.equal(g.state.multiplier,3);const gold=shot(g,0,{type:'bonus'});assert.equal(gold.score,600);ready(g);assert.equal(g.shoot(0,0).type,'miss');assert.equal(g.state.combo,0);assert.equal(g.state.multiplier,1);assert.equal(g.state.bestCombo,26);
});
test('expired target breaks combo without counting a shot, and respawns only after fade',()=>{
 const g=createGame();g.state.combo=7;g.state.multiplier=1.5;const t=target(g,{ttl:1.02,age:1});tick(g,3);assert.equal(t.expired,true);assert.equal(t.active,false);assert.equal(g.state.combo,0);assert.equal(g.state.shots,0);assert.equal(g.state.targets[0].id,900);const before=g.state.targets[0].id;tick(g,40);assert.equal(g.state.targets[0].id,before);tick(g,2);const replacement=g.state.targets[0];assert.notEqual(replacement.id,before);assert.equal(replacement.active,false);assert.equal(replacement.scale,0);assert.equal(replacement.phase,'enter');
});
test('hit retires exactly once and cannot score again during its fade',()=>{
 const g=createGame({weapon:'rifle'});const t=target(g);assert.equal(g.shoot(t.x,t.y).type,'hit');advance(g,.1);assert.equal(g.shoot(t.x,t.y).type,'miss');assert.equal(g.state.hits,1);assert.equal(g.state.score,100);assert.equal(g.state.targets[0].id,t.id);advance(g,.26);assert.notEqual(g.state.targets[0].id,t.id);
});
test('ammo, cooldown, dry fire, reload timing and magazine bounds are enforced',()=>{
 for(const id of ['pistol','rifle']){const g=createGame({weapon:id});const gun=WEAPONS[id];assert.equal(g.reload(),false);for(let i=0;i<gun.capacity;i++){assert.equal(g.shoot(0,0).type,'miss');assert.equal(g.shoot(0,0).reason,'cooldown');advance(g,gun.cooldown);}assert.equal(g.state.ammo,0);assert.equal(g.state.shots,gun.capacity);assert.equal(g.shoot(0,0).type,'dryfire');assert.equal(g.state.shots,gun.capacity);assert.equal(g.reload(),true);assert.equal(g.reload(),false);assert.equal(g.shoot(0,0).reason,'reloading');tick(g,Math.round(gun.reload/DT)-1);assert.equal(g.state.ammo,0);tick(g,1);assert.equal(g.state.reloadRemaining,0);assert.equal(g.state.ammo,gun.capacity);}
});
test('switching weapons cannot replenish instantly or evade full reload',()=>{
 const g=createGame();g.shoot(0,0);assert.equal(g.state.ammo,7);assert.equal(g.setWeapon('pistol'),false);assert.equal(g.state.ammo,7);assert.equal(g.setWeapon('rifle'),true);assert.equal(g.state.ammo,0);assert.equal(g.state.reloadRemaining,1.6);assert.equal(g.shoot(0,0).reason,'reloading');advance(g,.8);g.setWeapon('pistol');assert.equal(g.state.ammo,0);assert.equal(g.state.reloadRemaining,1.1);advance(g,1.1);assert.equal(g.state.ammo,8);assert.equal(g.setWeapon('unknown'),false);assert.equal(g.setWeapon('__proto__'),false);assert.equal(g.setWeapon('constructor'),false);assert.equal(g.state.ammo,8);
});
test('timed end is exact, freezes gameplay and emits a single end event',()=>{
 const g=createGame({duration:1});tick(g,120);assert.equal(g.state.elapsed,1);assert.equal(g.state.timeLeft,0);assert.equal(g.state.status,'ended');assert.equal(g.state.events.filter(e=>e.type==='end').length,1);const state=structuredClone(g.state);tick(g,120);assert.deepEqual(g.state,state);assert.equal(g.shoot(500,250).reason,'ended');assert.equal(g.reload(),false);assert.equal(g.setWeapon('rifle'),false);assert.deepEqual(g.state,state);
});
test('practice is unlimited, duel defaults to 30 seconds and mode reset clears all round stats',()=>{
 const g=createGame({mode:'practice'});tick(g,14400);assert.equal(g.state.status,'playing');assert.equal(g.state.timeLeft,null);g.reset({mode:'duel'});assert.equal(g.state.duration,30);shot(g);g.reset();assert.equal(g.state.score,0);assert.equal(g.state.shots,0);assert.equal(g.state.combo,0);assert.equal(g.state.ammo,8);assert.equal(g.state.elapsed,0);g.reset({mode:'challenge'});assert.equal(g.state.duration,60);
});
test('events drain once and invalid inputs never consume ammo or time',()=>{
 const g=createGame();assert.equal(g.shoot(NaN,100).reason,'invalid-coordinate');assert.equal(g.shoot(100,Infinity).reason,'invalid-coordinate');assert.equal(g.state.ammo,8);g.update(-1);assert.equal(g.state.elapsed,0);shot(g);const events=g.drainEvents();assert.deepEqual(events.map(e=>e.type),['shot','hit']);assert.ok(events.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.score)&&Object.hasOwn(e,'ring')));assert.deepEqual(g.drainEvents(),[]);
});
test('moving and rising targets move while staying in target-safe area',()=>{
 const g=createGame({mode:'practice'});for(const motion of ['sweep','pop']){const t=target(g,{motion,baseX:480,baseY:280});const before={x:t.x,y:t.y};tick(g,120);assert.ok(Math.hypot(t.x-before.x,t.y-before.y)>3);assert.ok(t.x-t.r>=90);assert.ok(t.x+t.r<=870);assert.ok(t.y-t.r>=150);assert.ok(t.y+t.r<=400);}
});
