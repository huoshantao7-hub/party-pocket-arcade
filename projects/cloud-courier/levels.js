const floor=(segments)=>segments.map(([x,end],i)=>({id:`ground-${i}`,x,y:444,w:end-x,h:96,kind:'ground'}));
const ledges=(rows)=>rows.map(([x,y,w],i)=>({id:`ledge-${i}`,x,y,w,h:22,kind:'ledge',oneWay:true}));
const boxes=(rows)=>rows.map(([x,y,type='question'],i)=>({id:`block-${i}`,x,y,w:40,h:40,type,used:false,bump:0}));
const coinLine=(x,y,count,step=40)=>Array.from({length:count},(_,i)=>({x:x+i*step,y,r:10,collected:false}));
const coinArc=(x,y,count=5,step=31)=>Array.from({length:count},(_,i)=>({x:x+i*step,y:y-Math.sin(i/(count-1)*Math.PI)*46,r:10,collected:false}));
const enemies=(rows)=>rows.map(([x,minX,maxX,speed=38],i)=>({id:`enemy-${i}`,x,y:416,w:30,h:28,vx:speed,minX,maxX,alive:true,stompTime:0}));
function define(level){level.coins=level.coins.map((c,i)=>({...c,id:`coin-${i}`}));return level;}
export const LEVELS=[
 define({id:'meadow',name:'01 · 晴空邮路',theme:'meadow',width:4400,height:540,spawn:{x:80,y:406},
  platforms:[...floor([[0,920],[1050,1660],[1770,2600],[2710,3460],[3590,4400]]),...ledges([[490,336,190],[1240,326,190],[2040,334,180],[2960,316,200],[3780,330,200]])],
  blocks:boxes([[260,320],[300,320,'brick'],[340,320],[1330,216],[2120,222],[2820,320],[3860,220]]),
  coins:[...coinLine(470,292,6),...coinArc(870,360,6),...coinLine(1210,285,6),...coinArc(1600,355,6),...coinLine(1990,294,6),...coinArc(2530,355,6),...coinLine(2940,275,7),...coinArc(3400,355,6),...coinLine(3760,290,7),...coinLine(4120,391,4)],
  enemies:enemies([[550,520,580,36],[1200,1160,1240,-37],[2000,1940,2020,40],[2940,2850,3010,-40],[4020,4000,4110,36]]),
  checkpoint:{x:2220,y:374,w:30,h:70,active:false},goal:{x:4290,y:340,w:38,h:104}}),
 define({id:'sunset',name:'02 · 落日汽水厂',theme:'sunset',width:4800,height:540,spawn:{x:80,y:406},
  platforms:[...floor([[0,770],[920,1540],[1670,2300],[2440,3180],[3340,4140],[4290,4800]]),...ledges([[340,338,190],[1070,360,170],[1280,296,170],[1920,390,115],[2120,308,160],[2670,350,170],[2870,286,175],[3560,354,190],[3800,290,170],[4460,340,180]])],
  blocks:boxes([[210,320],[250,320,'brick'],[420,228],[1140,250],[1770,320],[1810,320],[2760,240],[3620,244],[4500,230]]),
  coins:[...coinLine(330,299,6),...coinArc(710,352,6),...coinLine(1080,316,5),...coinLine(1280,254,5),...coinArc(1470,350,6),...coinLine(1890,343,6),...coinArc(2230,348,6),...coinLine(2650,307,6),...coinLine(2870,244,5),...coinArc(3110,350,7),...coinLine(3540,312,7),...coinArc(4080,350,6),...coinLine(4450,297,6)],
  enemies:enemies([[400,370,440,40],[1140,1080,1160,-43],[1900,1800,1920,38],[2760,2630,2780,-45],[3650,3480,3680,43],[4570,4550,4660,-40]]),
  checkpoint:{x:2570,y:374,w:30,h:70,active:false},goal:{x:4680,y:340,w:38,h:104}}),
 define({id:'night',name:'03 · 星灯云港',theme:'night',width:5200,height:540,spawn:{x:80,y:406},
  platforms:[...floor([[0,650],[800,1370],[1510,2240],[2400,3100],[3260,3960],[4110,5200]]),...ledges([[290,342,180],[1010,396,100],[1180,325,155],[1720,336,145],[1870,366,90],[2050,294,155],[2660,354,160],[2860,292,155],[3480,388,140],[3700,318,150],[4370,350,165],[4570,286,165],[4840,344,180]])],
  blocks:boxes([[210,320],[360,232],[895,316],[1760,226],[2470,316],[2510,316,'brick'],[2740,244],[3350,316],[4410,240],[4890,234]]),
  coins:[...coinLine(280,299,6),...coinArc(590,350,7),...coinLine(1000,352,4),...coinArc(1300,352,6),...coinLine(1700,296,6),...coinLine(2050,252,5),...coinArc(2160,347,7),...coinLine(2650,312,5),...coinLine(2860,250,5),...coinArc(3030,348,7),...coinLine(3470,343,5),...coinArc(3890,345,7),...coinLine(4360,307,5),...coinLine(4570,244,5),...coinLine(4820,300,6),...coinLine(4990,391,3)],
  enemies:enemies([[300,260,330,43],[980,900,1000,-42],[1590,1550,1650,45],[1850,1790,1890,-43],[2670,2500,2700,44],[3520,3410,3540,-43],[4280,4240,4335,45],[4770,4750,4890,-42]]),
  checkpoint:{x:2550,y:374,w:30,h:70,active:false},goal:{x:5080,y:340,w:38,h:104}})
];
