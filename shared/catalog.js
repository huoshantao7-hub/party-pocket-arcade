export const catalog = [
 {id:'jelly',title:'果冻擂台',en:'JELLY RUMBLE',genre:'对抗',tag:'撞飞朋友，保住自己',color:'#bada77',desc:'软乎乎的果冻，硬碰硬的友谊。看准时机冲刺，抢下擂台。'},
 {id:'kitchen',title:'午夜外卖',en:'MIDNIGHT KITCHEN',genre:'合作',tag:'默契不够，订单来凑',color:'#ffae86',desc:'接单、备料、出餐。两个人，一间小厨房，一场忙中有序的接力。'},
 {id:'bubble',title:'泡泡爆破',en:'BUBBLE PANIC',genre:'对抗',tag:'童年玩法，泡泡开战',color:'#aebcff',desc:'摆下泡泡，拐进安全通道。连锁爆破，是惊喜也是陷阱。'},
 {id:'magnet',title:'磁力双星',en:'MAGNET MATES',genre:'合作',tag:'拉我一把，一起过关',color:'#f0b8db',desc:'两颗小星球，一条默契连线。相互照应，收集星光，越过机关。'},
 {id:'hockey',title:'霓虹气垫球',en:'NEON RALLY',genre:'对抗',tag:'一张球桌，手速见真章',color:'#7fd9d6',desc:'球不会等你。反弹、拦截、突然提速，把最后一球送进对方门里。'},
 {id:'racer',title:'微缩拉力赛',en:'POCKET CIRCUIT',genre:'竞速',tag:'方寸赛道，也能超车',color:'#e7ca80',desc:'小车，大脾气。找准弯道与加速时机，在迷你赛道上争个高下。'}
];
export async function loadGame(id){if(!catalog.some(x=>x.id===id))throw Error('未知游戏');return import(`../games/${id}.js`)}
