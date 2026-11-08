(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const W = 1800, H = 1200;
  const ui = {gold: document.getElementById('gold'), pop: document.getElementById('pop'), objective: document.getElementById('objective-text'), selected: document.getElementById('selected-count'), toast: document.getElementById('toast'), modal: document.getElementById('modal'), pause: document.getElementById('pause-overlay')};
  const colors = {grass:'#82945d', darkgrass:'#788b56', lightgrass:'#94a46b', road:'#b9a177', roadEdge:'#9b8967', blue:'#598eaa', red:'#bd5b4b'};
  let vw=0,vh=0,dpr=1,camera={x:300,y:600,zoom:1},cameraFollow=true,mapDragging=false, running=false,paused=false,ended=false, gold=180, elapsed=0, incomeClock=0, enemyClock=10, spawnCount=0, order='attack', commandPoint=null, drag=null, toastTimer=0;
  let units=[], particles=[], decor=[], selected=new Set();
  const bases={player:{x:235,y:600,hp:1200,max:1200,color:'#4d8da4',label:'YOUR KEEP'},enemy:{x:1565,y:600,hp:1150,max:1150,color:'#c85a4c',label:'CRIMSON KEEP'}};
  const unitStats={militia:{cost:40,pop:1,hp:95,damage:13,range:28,speed:57,rate:.86,color:'#6e9dae',name:'Militia',reach:28},archer:{cost:65,pop:1,hp:62,damage:12,range:150,speed:48,rate:1.25,color:'#6da57c',name:'Archer',reach:150},knight:{cost:110,pop:2,hp:210,damage:27,range:31,speed:43,rate:1.05,color:'#b18a51',name:'Knight',reach:31},raider:{cost:0,pop:1,hp:80,damage:11,range:27,speed:42,rate:1.05,color:'#ce6756',name:'Raider',reach:27},brute:{cost:0,pop:2,hp:185,damage:22,range:31,speed:33,rate:1.25,color:'#d18e54',name:'Brute',reach:31}};
  function resize(){dpr=Math.min(window.devicePixelRatio||1,2);vw=canvas.clientWidth;vh=canvas.clientHeight;canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);camera.zoom=Math.max(.43,Math.min(.78,vh/920));}
  window.addEventListener('resize',resize); resize();
  function rand(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=t;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296;};}
  const random=rand(90421);
  for(let i=0;i<180;i++){let x=35+random()*(W-70),y=35+random()*(H-70);if(Math.abs(y-600)<100&&x>270&&x<1530)continue;decor.push({x,y,r:5+random()*11,type:random()<.63?'tree':random()<.5?'stone':'bush',tone:random()});}
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1500);}
  function updateHud(){ui.gold.textContent=Math.floor(gold);let p=units.filter(u=>u.team==='player').reduce((n,u)=>n+u.pop,0);ui.pop.textContent=`${p} / 30`;ui.selected.textContent=`${selected.size} selected`;ui.objective.textContent=`Crimson Keep · ${Math.max(0,Math.ceil(bases.enemy.hp/bases.enemy.max*100))}%`;document.querySelectorAll('.unit-card').forEach(btn=>{const st=unitStats[btn.dataset.unit];btn.disabled=!running||ended||gold<st.cost||p+st.pop>30;});}
  function startGame(){
    units=[];particles=[];selected.clear();gold=180;elapsed=0;incomeClock=0;enemyClock=10;spawnCount=0;order='attack';commandPoint=null;paused=false;ended=false;running=true;
    bases.player.hp=bases.player.max;bases.enemy.hp=bases.enemy.max;
    document.querySelectorAll('.order-btn').forEach(b=>b.classList.toggle('active',b.id==='march-btn'));
    ui.pause.classList.remove('visible');ui.modal.classList.add('hidden');
    camera.x=360;camera.y=600;cameraFollow=true;
    for(let i=0;i<3;i++)addUnit('militia','player',280+random()*35,575+random()*50,false);
    for(let i=0;i<2;i++)addUnit('archer','player',270+random()*30,540+random()*95,false);
    addUnit('raider','enemy',1515,590,false);
    updateHud();
  }
  function addUnit(type,team,x,y,announce=true){const st=unitStats[type];if(team==='player'){const pop=units.filter(u=>u.team==='player').reduce((n,u)=>n+u.pop,0);if(pop+st.pop>30){showToast('Army at capacity — upgrade your command!');return false;}if(announce&&gold<st.cost){showToast('Not enough gold');return false;}if(announce)gold-=st.cost;}
    units.push({id:Math.random(),type,team,x,y,hp:st.hp,max:st.hp,pop:st.pop,damage:st.damage,range:st.range,speed:st.speed,rate:st.rate,cool:random()*.4,face:team==='player'?1:-1,goal:team==='player'?{x:bases.enemy.x,y:bases.enemy.y}:{x:bases.player.x,y:bases.player.y},selected:false,anim:random()*6.28,hit:0});if(announce)updateHud();return true;
  }
  document.getElementById('play-btn').addEventListener('click',startGame);
  document.querySelectorAll('.unit-card').forEach(btn=>btn.addEventListener('click',()=>{if(!running||ended)return;addUnit(btn.dataset.unit,'player',bases.player.x+55+(random()-.5)*35,bases.player.y+(random()-.5)*110);updateHud();}));
  function setOrder(next){order=next;document.querySelectorAll('.order-btn').forEach(b=>b.classList.toggle('active',b.id===(next==='attack'?'march-btn':'guard-btn')));if(next==='attack'){commandPoint=null;units.filter(u=>u.team==='player').forEach(u=>u.goal={x:bases.enemy.x,y:bases.enemy.y});showToast('Attack order · advancing on the enemy keep');}else{commandPoint={x:bases.player.x+170,y:bases.player.y};units.filter(u=>u.team==='player').forEach(u=>u.goal={...commandPoint});showToast('Guard order · defend your territory');}}
  document.getElementById('march-btn').addEventListener('click',()=>setOrder('attack'));
  document.getElementById('guard-btn').addEventListener('click',()=>setOrder('guard'));
  document.getElementById('pause-btn').addEventListener('click',togglePause);
  document.getElementById('resume-btn').addEventListener('click',togglePause);
  function togglePause(){if(!running||ended)return;paused=!paused;ui.pause.classList.toggle('visible',paused);}
  window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePause();return;}if(e.key==='Escape'&&paused){togglePause();return;}if(!running||paused||ended||e.repeat)return;const key=e.key.toLowerCase();if(key==='f'){cameraFollow=true;showToast('Camera following your army');}else if(key==='a')setOrder('attack');else if(key==='g')setOrder('guard');else if(key==='1'||key==='2'||key==='3'){const type=['militia','archer','knight'][Number(key)-1];addUnit(type,'player',bases.player.x+55+(random()-.5)*35,bases.player.y+(random()-.5)*110);updateHud();}else if(['arrowup','arrowdown','arrowleft','arrowright','w','s','d'].includes(key)){cameraFollow=false;const step=70/camera.zoom;if(key==='arrowup'||key==='w')camera.y-=step;if(key==='arrowdown'||key==='s')camera.y+=step;if(key==='arrowleft'||key==='a')camera.x-=step;if(key==='arrowright'||key==='d')camera.x+=step;}});
  function screenToWorld(sx,sy){return{x:(sx-vw/2)/camera.zoom+camera.x,y:(sy-vh/2)/camera.zoom+camera.y};}
  function worldToScreen(x,y){return{x:(x-camera.x)*camera.zoom+vw/2,y:(y-camera.y)*camera.zoom+vh/2};}
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(!running||paused||ended)return;canvas.setPointerCapture(e.pointerId);const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;drag={sx,sy,x:sx,y:sy,moved:false,pan:e.button===2,lastX:sx,lastY:sy};});
  canvas.addEventListener('pointermove',e=>{if(drag){const r=canvas.getBoundingClientRect();drag.x=e.clientX-r.left;drag.y=e.clientY-r.top;if(Math.hypot(drag.x-drag.sx,drag.y-drag.sy)>8)drag.moved=true;if(drag.pan){cameraFollow=false;camera.x-=(drag.x-drag.lastX)/camera.zoom;camera.y-=(drag.y-drag.lastY)/camera.zoom;drag.lastX=drag.x;drag.lastY=drag.y;}}});
  canvas.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(!running||paused)return;if(d.pan)return;const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;if(d.moved){const a=screenToWorld(Math.min(d.sx,sx),Math.min(d.sy,sy)),b=screenToWorld(Math.max(d.sx,sx),Math.max(d.sy,sy));selected.clear();units.forEach(u=>{if(u.team==='player'&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y){u.selected=true;selected.add(u.id)}else u.selected=false;});updateHud();return;}
    const p=screenToWorld(sx,sy), clicked=[...units].reverse().find(u=>u.team==='player'&&Math.hypot(u.x-p.x,u.y-p.y)<22/camera.zoom);
    if(clicked){if(!e.shiftKey){selected.clear();units.forEach(u=>u.selected=false);}clicked.selected=!clicked.selected;if(clicked.selected)selected.add(clicked.id);else selected.delete(clicked.id);updateHud();return;}
    const squad=units.filter(u=>u.team==='player'&&(!selected.size||selected.has(u.id)));if(squad.length){commandPoint={x:p.x,y:p.y};squad.forEach(u=>u.goal={x:p.x+(random()-.5)*34,y:p.y+(random()-.5)*34});showToast(selected.size?'Squad orders received':'All troops moving');}
  });
  function scoutMap(e){const r=mini.getBoundingClientRect();camera.x=(e.clientX-r.left)/r.width*W;camera.y=(e.clientY-r.top)/r.height*H;cameraFollow=false;clampCamera();}
  mini.addEventListener('pointerdown',e=>{mini.setPointerCapture(e.pointerId);mapDragging=true;scoutMap(e);});
  mini.addEventListener('pointermove',e=>{if(mapDragging)scoutMap(e);});
  mini.addEventListener('pointerup',()=>{mapDragging=false;});
  mini.addEventListener('pointercancel',()=>{mapDragging=false;});
  document.getElementById('center-btn').addEventListener('click',()=>{cameraFollow=true;showToast('Camera following your army');});
  canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.35,Math.min(.9,camera.zoom*(e.deltaY<0?1.08:.92)));clampCamera();},{passive:false});
  function spawnEnemy(){const type=spawnCount%4===3?'brute':'raider';addUnit(type,'enemy',1490,555+random()*90,false);spawnCount++;if(spawnCount%4===0)addUnit('raider','enemy',1490,550+random()*100,false);}
  function update(dt){if(!running||paused||ended)return;elapsed+=dt;incomeClock+=dt;enemyClock-=dt;while(incomeClock>=2){gold+=5;incomeClock-=2;updateHud();}if(enemyClock<=0){spawnEnemy();enemyClock=Math.max(7.5,13-elapsed*.025)+(random()*2);}
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=14*dt;}particles=particles.filter(p=>p.life>0);
    for(const u of units){u.anim+=dt*6;u.cool-=dt;u.hit=Math.max(0,u.hit-dt);const enemyTeam=u.team==='player'?'enemy':'player',targetBase=u.team==='player'?bases.enemy:bases.player;let target=null,best=Infinity;
      for(const other of units){if(other.team!==enemyTeam)continue;const d=Math.hypot(other.x-u.x,other.y-u.y);if(d<best&&d<Math.max(190,u.range+36)){best=d;target=other;}}
      const baseDist=Math.hypot(targetBase.x-u.x,targetBase.y-u.y);if(target&&best<Math.min(190,baseDist+35)){}else target=null;
      let tx,ty,dist,reach;
      if(target){tx=target.x;ty=target.y;dist=Math.hypot(tx-u.x,ty-u.y);reach=u.range;}
      else{tx=u.goal.x;ty=u.goal.y;dist=Math.hypot(tx-u.x,ty-u.y);reach=12;if(baseDist<115){tx=targetBase.x;ty=targetBase.y;dist=baseDist;reach=u.range+(u.range>60?10:48);}}
      if(dist>reach+2){const move=Math.min(dist-reach,u.speed*dt);u.x+=(tx-u.x)/Math.max(dist,1)*move;u.y+=(ty-u.y)/Math.max(dist,1)*move;u.face=tx>=u.x?1:-1;}
      if(u.cool<=0){if(target&&dist<=u.range){strike(u,target);u.cool=u.rate;}else if(!target&&baseDist<reach+6){const b=targetBase;b.hp=Math.max(0,b.hp-u.damage);u.cool=u.rate;particles.push({x:b.x+(u.team==='player'?-40:40),y:b.y+(random()-.5)*95,vx:(random()-.5)*20,vy:-30,life:.45,color:'#f0c46b',text:''});updateHud();}}
    }
    units=units.filter(u=>u.hp>0);for(const id of [...selected])if(!units.some(u=>u.id===id))selected.delete(id);
    if(bases.enemy.hp<=0){finish(true);}else if(bases.player.hp<=0){finish(false);}
    if(Math.floor(elapsed)%5===0&&Math.floor(elapsed)!==Math.floor(elapsed-dt))updateHud();
  }
  function strike(attacker,target){target.hp-=attacker.damage;attacker.hit=.12;attacker.face=target.x>=attacker.x?1:-1;const ranged=attacker.range>60;particles.push({x:target.x,y:target.y-6,vx:(random()-.5)*17,vy:-23-random()*15,life:.45,color:attacker.team==='player'?'#f0d47a':'#ee8870',text:''});if(ranged)particles.push({x:attacker.x,y:attacker.y-8,vx:(target.x-attacker.x)*1.3,vy:(target.y-attacker.y)*1.3,life:.22,color:'#e6d49a',text:'bolt'});if(target.hp<=0){if(target.team==='enemy'&&attacker.team==='player'){gold+=10;particles.push({x:target.x,y:target.y-12,vx:0,vy:-22,life:.75,color:'#f4cf67',text:'+10'});updateHud();}}}
  function finish(win){ended=true;running=false;selected.clear();const card=ui.modal.querySelector('.modal-card');card.innerHTML=`<div class="crest">${win?'♛':'♜'}</div><div class="eyebrow">${win?'THE REALM IS YOURS':'YOUR BANNER HAS FALLEN'}</div><h1>${win?'CROWN\n':'FALLEN\n'}<em>${win?'CLAIMED':'KINGDOM'}</em></h1><p>${win?'The Crimson Keep is no more. Your name will echo through the ages.':'The rival host has breached your walls. Rally your forces and try again.'}</p><button id="play-btn" class="primary-btn">${win?'PLAY AGAIN':'RALLY AGAIN'} <span>→</span></button>`;document.getElementById('play-btn').addEventListener('click',startGame);ui.modal.classList.remove('hidden');updateHud();}
  function clampCamera(){const hx=vw/(2*camera.zoom),hy=vh/(2*camera.zoom);camera.x=hx>=W/2?W/2:Math.max(hx,Math.min(W-hx,camera.x));camera.y=hy>=H/2?H/2:Math.max(hy,Math.min(H-hy,camera.y));}
  function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function drawTerrain(){ctx.fillStyle=colors.grass;ctx.fillRect(0,0,W,H);
    for(let i=0;i<36;i++){const x=(i*173+55)%W,y=(i*281+99)%H;ctx.fillStyle=i%2?'#ffffff08':'#34462809';ctx.beginPath();ctx.ellipse(x,y,95+(i%5)*13,40+(i%4)*12,i*.5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#667e71';ctx.fillRect(0,960,W,240);ctx.fillStyle='#719184';ctx.fillRect(0,979,W,221);for(let i=0;i<35;i++){ctx.strokeStyle='#d2e0c022';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i*57,1000+(i%5)*38);ctx.quadraticCurveTo(i*57+30,990+(i%5)*38,i*57+60,1002+(i%5)*38);ctx.stroke();}
    ctx.strokeStyle=colors.roadEdge;ctx.lineWidth=142;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(150,600);ctx.bezierCurveTo(500,565,560,635,895,600);ctx.bezierCurveTo(1180,565,1320,625,1650,600);ctx.stroke();ctx.strokeStyle=colors.road;ctx.lineWidth=128;ctx.beginPath();ctx.moveTo(150,600);ctx.bezierCurveTo(500,565,560,635,895,600);ctx.bezierCurveTo(1180,565,1320,625,1650,600);ctx.stroke();
    ctx.setLineDash([14,18]);ctx.strokeStyle='#d9c99e77';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(250,600);ctx.bezierCurveTo(500,565,560,635,895,600);ctx.bezierCurveTo(1180,565,1320,625,1550,600);ctx.stroke();ctx.setLineDash([]);
    for(const d of decor){if(d.type==='tree')drawTree(d);else if(d.type==='stone')drawStone(d);else drawBush(d);}
    // small stepping bridge over the stream
    ctx.fillStyle='#846d4c';rr(ctx,846,925,108,76,8);ctx.fill();for(let x=854;x<950;x+=15){ctx.fillStyle='#b89b6d';ctx.fillRect(x,930,9,65);ctx.strokeStyle='#68583f';ctx.strokeRect(x,930,9,65);}
  }
  function drawTree(d){const s=d.tone;ctx.fillStyle='#263a2d35';ctx.beginPath();ctx.ellipse(d.x+5,d.y+9,d.r*1.1,d.r*.63,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=s>.5?'#5c7145':'#4c6744';ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();ctx.fillStyle=s>.5?'#75864e':'#647b4b';ctx.beginPath();ctx.arc(d.x-d.r*.18,d.y-d.r*.2,d.r*.67,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9aa26688';ctx.beginPath();ctx.arc(d.x-d.r*.27,d.y-d.r*.36,d.r*.19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#705d3c';ctx.fillRect(d.x-2,d.y+d.r*.5,4,d.r*.45);}
  function drawStone(d){ctx.fillStyle='#3d4d4033';ctx.beginPath();ctx.ellipse(d.x+3,d.y+5,d.r,d.r*.6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#858b78';ctx.beginPath();ctx.moveTo(d.x-d.r,d.y+d.r*.3);ctx.lineTo(d.x-d.r*.55,d.y-d.r*.7);ctx.lineTo(d.x+d.r*.25,d.y-d.r);ctx.lineTo(d.x+d.r,d.y+d.r*.05);ctx.lineTo(d.x+d.r*.45,d.y+d.r*.7);ctx.closePath();ctx.fill();ctx.fillStyle='#b3b69a88';ctx.beginPath();ctx.moveTo(d.x-d.r*.5,d.y-d.r*.45);ctx.lineTo(d.x+d.r*.2,d.y-d.r*.78);ctx.lineTo(d.x+d.r*.42,d.y-d.r*.15);ctx.closePath();ctx.fill();}
  function drawBush(d){ctx.fillStyle='#506b43';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(d.x+(i-1)*d.r*.45,d.y+(i%2)*3,d.r*.62,0,Math.PI*2);ctx.fill();}}
  function drawBase(b,team){const blue=team==='player',x=b.x,y=b.y,c=blue?'#4b8190':'#a54c43',roof=blue?'#31535a':'#743b35';ctx.fillStyle='#18221f44';ctx.beginPath();ctx.ellipse(x,y+47,105,66,0,0,Math.PI*2);ctx.fill();
    // outer palisade and courtyard
    ctx.fillStyle=blue?'#c3b080':'#b28b76';ctx.fillRect(x-89,y-70,178,140);ctx.fillStyle=blue?'#627d70':'#85645b';ctx.fillRect(x-82,y-63,164,126);
    ctx.fillStyle=blue?'#9b8a64':'#8c6b5b';ctx.fillRect(x-76,y-57,152,114);
    ctx.fillStyle=blue?'#6c9395':'#ae6558';ctx.fillRect(x-53,y-37,106,82);ctx.fillStyle=blue?'#47737b':'#864740';ctx.fillRect(x-42,y-27,84,67);
    ctx.fillStyle=blue?'#d1bd8b':'#c6a083';ctx.fillRect(x-75,y-61,20,20);ctx.fillRect(x+55,y-61,20,20);ctx.fillRect(x-75,y+41,20,20);ctx.fillRect(x+55,y+41,20,20);
    for(const [tx,ty] of [[-65,-51],[65,-51],[-65,51],[65,51]]){ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x+tx-13,y+ty);ctx.lineTo(x+tx,y+ty-23);ctx.lineTo(x+tx+13,y+ty);ctx.closePath();ctx.fill();ctx.fillStyle='#ebd9aa';ctx.fillRect(x+tx-1,y+ty-27,2,14);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x+tx,y+ty-27);ctx.lineTo(x+tx+14,y+ty-23);ctx.lineTo(x+tx,y+ty-18);ctx.fill();}
    ctx.fillStyle='#473c31';ctx.fillRect(x-13,y+16,26,41);ctx.fillStyle='#d5bc84';ctx.fillRect(x-10,y+19,20,38);ctx.fillStyle='#554a3a';ctx.beginPath();ctx.arc(x,y+18,10,Math.PI,0);ctx.fill();
    ctx.fillStyle='#eff0dc';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(b.label,x,y-94);
    ctx.fillStyle='#202824';rr(ctx,x-53,y-87,106,7,3);ctx.fill();ctx.fillStyle=blue?'#83c8ba':'#e17a63';rr(ctx,x-52,y-86,104*Math.max(0,b.hp/b.max),5,2);ctx.fill();
  }
  function drawUnit(u){const r=u.type==='knight'||u.type==='brute'?12:9,player=u.team==='player',st=unitStats[u.type],body=player?st.color:st.color;
    ctx.fillStyle='#17211e44';ctx.beginPath();ctx.ellipse(u.x,u.y+r*.9,r*1.1,r*.48,0,0,Math.PI*2);ctx.fill();
    if(u.selected){ctx.strokeStyle='#f6d575';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(u.x,u.y+r+5,r+5,5,0,0,Math.PI*2);ctx.stroke();}
    const sway=Math.sin(u.anim)*1.3;ctx.fillStyle=u.hit>0?'#fff1c6':body;ctx.beginPath();ctx.ellipse(u.x,u.y+sway,r*.72,r*.95,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=player?'#d5e0c0':'#f1bd9d';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=player?'#dfc99a':'#d7ad90';ctx.beginPath();ctx.arc(u.x,u.y-r*.35+sway,r*.46,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=player?(u.type==='archer'?'#426f5a':'#456979'):'#78463e';ctx.beginPath();ctx.arc(u.x,u.y-r*.48+sway,r*.53,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(u.x-r*.5,u.y-r*.47+sway,r,2.5);
    if(u.type==='archer'){ctx.strokeStyle=player?'#d5c28c':'#d7b790';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(u.x+u.face*r*.8,u.y+sway,5,-1.2,1.2);ctx.stroke();}
    else{ctx.strokeStyle=u.type==='knight'?'#e4d6ae':'#d7d4be';ctx.lineWidth=u.type==='knight'?3:2;ctx.beginPath();ctx.moveTo(u.x+u.face*r*.35,u.y+sway);ctx.lineTo(u.x+u.face*(r+8),u.y-r*.9+sway);ctx.stroke();ctx.fillStyle='#e2d6ad';ctx.beginPath();ctx.arc(u.x-u.face*r*.8,u.y+sway,3,0,Math.PI*2);ctx.fill();}
    if(u.hp<u.max){ctx.fillStyle='#202824';ctx.fillRect(u.x-r,u.y-r-8,r*2,3);ctx.fillStyle=player?'#80c69e':'#df7661';ctx.fillRect(u.x-r,u.y-r-8,r*2*Math.max(0,u.hp/u.max),3);}
  }
  function drawWorld(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);ctx.save();ctx.translate(vw/2,vh/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);drawTerrain();drawBase(bases.player,'player');drawBase(bases.enemy,'enemy');
    for(const u of units)drawUnit(u);
    if(commandPoint){ctx.strokeStyle='#efe1ad99';ctx.lineWidth=2;ctx.beginPath();ctx.arc(commandPoint.x,commandPoint.y,18+Math.sin(performance.now()/140)*3,0,Math.PI*2);ctx.stroke();}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.75);ctx.fillStyle=p.color;if(p.text){ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}else{ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;
    if(drag&&drag.moved){const a=screenToWorld(drag.sx,drag.sy),b=screenToWorld(drag.x,drag.y);ctx.fillStyle='#dbeaa022';ctx.strokeStyle='#f2dfa4';ctx.lineWidth=1.5;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
    ctx.restore();drawMinimap();
  }
  function drawMinimap(){const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#84945f';mctx.fillRect(0,0,w,h);mctx.fillStyle='#6d8b7b';mctx.fillRect(0,h*.8,w,h*.2);mctx.strokeStyle='#b9a177';mctx.lineWidth=11;mctx.beginPath();mctx.moveTo(7,h*.5);mctx.quadraticCurveTo(w*.5,h*.47,w-7,h*.5);mctx.stroke();for(const d of decor){if(d.type==='tree'){mctx.fillStyle='#526e46';mctx.fillRect(d.x/W*w-1,d.y/H*h-1,2,2);}}mctx.fillStyle='#508ea5';mctx.fillRect(bases.player.x/W*w-5,bases.player.y/H*h-5,10,10);mctx.fillStyle='#c05a4d';mctx.fillRect(bases.enemy.x/W*w-5,bases.enemy.y/H*h-5,10,10);for(const u of units){mctx.fillStyle=u.team==='player'?'#d7e4c1':'#f29070';mctx.beginPath();mctx.arc(u.x/W*w,u.y/H*h,2,0,Math.PI*2);mctx.fill();}const left=(camera.x-vw/2/camera.zoom)/W*w,top=(camera.y-vh/2/camera.zoom)/H*h,rw=vw/camera.zoom/W*w,rh=vh/camera.zoom/H*h;mctx.strokeStyle='#f2e4bd';mctx.lineWidth=1.5;mctx.strokeRect(left,top,rw,rh);}
  updateHud();
  let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(running&&!paused&&!ended){if(cameraFollow){const allies=units.filter(u=>u.team==='player');if(allies.length){const cx=allies.reduce((n,u)=>n+u.x,0)/allies.length,cy=allies.reduce((n,u)=>n+u.y,0)/allies.length;camera.x+=(cx+120-camera.x)*Math.min(1,dt*.35);camera.y+=(cy-camera.y)*Math.min(1,dt*.4);}}update(dt);}clampCamera();drawWorld();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
