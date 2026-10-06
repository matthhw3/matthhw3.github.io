import * as THREE from './vendor/three.module.js';

const sections=[...document.querySelectorAll('.route-stop')];
const stopNames=['About','Education & Skills','Experience','Projects','Photos','Contact'];
const stopFractions=[0,.20,.40,.64,.83,1];
const markers=[...document.querySelectorAll('.map-stop')];
const scrubber=document.getElementById('route-scrubber');
const overviewButton=document.getElementById('view-toggle');
const status=document.getElementById('terrain-status');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
let motion=!document.documentElement.classList.contains('no-motion');
let targetProgress=0,currentProgress=0,overview=false,sceneReady=false;
let renderer,scene,camera,traveler,halo,completed,trees,sun,ambient;
let visible=true,lastTime=0,frame=0,anchors=[],currentStop=0,drawRequested=true;
const cameraTarget=new THREE.Vector3();
const desiredPosition=new THREE.Vector3();
const desiredTarget=new THREE.Vector3();
const scratchVector=new THREE.Vector3();
const terrainWidth=144;
function noise(x,z){return Math.sin(x*.27+Math.cos(z*.22)*1.5)*Math.cos(z*.25)+Math.sin(x*.69+z*.47)*.30+Math.cos(x*1.48-z*1.14)*.10;}
function elevation(x,z){
 const dx=(x-5)/25,dz=(z+8)/27,r=Math.sqrt(dx*dx+dz*dz);
 const volcano=28*Math.exp(-Math.pow(r,1.7));
 const shoulder=4.8*Math.exp(-((x+31)**2+(z-3)**2)/630)+5*Math.exp(-((x-34)**2+(z+26)**2)/520);
 const base=1.8+1.3*Math.sin(x*.07)*Math.cos(z*.09);
 const ridges=noise(x,z)*(1.4+volcano*.048);
 return Math.max(.6,volcano+shoulder+base+ridges);
}
const controls=[[-37,31],[-28,26],[-31,17],[-25,9],[-18,13],[-10,8],[-15,0],[-8,-5],[-10,-12],[-1,-15],[5,-8],[11,-3],[18,-8],[25,-6],[30,3]];
const horizontal=new THREE.CatmullRomCurve3(controls.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
const routeSamples=Array.from({length:641},(_,i)=>{const p=horizontal.getPointAt(i/640);p.y=elevation(p.x,p.z)+.35;return p;});
class TrailCurve extends THREE.Curve {
 getPoint(t,target=new THREE.Vector3()) {const u=clamp(t)*640,i=Math.min(639,Math.floor(u));return target.copy(routeSamples[i]).lerp(routeSamples[i+1],u-i);}
}
const route=new TrailCurve();
const stopPositions=stopFractions.map(t=>route.getPoint(t));
function setCameraView(){
 const w=window.innerWidth,h=window.innerHeight;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<720?1.25:1.65));
 renderer.setSize(w,h,false);camera.aspect=w/h;
 if(w>=900)camera.setViewOffset(w,h,-w*.20,0,w,h);
 else if(w<720)camera.setViewOffset(w,h,0,h*.20,w,h);
 else camera.clearViewOffset();
 camera.updateProjectionMatrix();drawRequested=true;
}
function initScene(){
 renderer=new THREE.WebGLRenderer({canvas:document.getElementById('terrain-canvas'),antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 scene=new THREE.Scene();scene.background=new THREE.Color('#91a9c3');scene.fog=new THREE.Fog('#91a9c3',105,235);
 camera=new THREE.PerspectiveCamera(44,1,.3,380);
 ambient=new THREE.HemisphereLight('#e5f0ff','#203753',2.5);scene.add(ambient);
 sun=new THREE.DirectionalLight('#e0edff',2.7);sun.position.set(-65,85,40);scene.add(sun);
 const segments=window.innerWidth<720?150:210;
 const terrain=new THREE.PlaneGeometry(terrainWidth,terrainWidth,segments,segments);terrain.rotateX(-Math.PI/2);
 const pos=terrain.attributes.position,colors=[];
 const dark=new THREE.Color('#243f60'),green=new THREE.Color('#6285a2'),rock=new THREE.Color('#91a4b7'),snow=new THREE.Color('#edf5ff');
 const color=new THREE.Color();
 for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),z=pos.getZ(i),y=elevation(x,z);pos.setY(i,y);
   if(y<15)color.copy(dark).lerp(green,clamp(y/22+noise(x*2,z*2)*.05));
   else if(y<23)color.copy(green).lerp(rock,(y-15)/8);
   else color.copy(rock).lerp(snow,clamp((y-22.5+noise(x,z)*1.1)/4.8));
   color.multiplyScalar(.91+noise(x*3,z*3)*.05);colors.push(color.r,color.g,color.b);
 }
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 scene.add(new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0})));
 const routeUnder=new THREE.Mesh(new THREE.TubeGeometry(route,640,.27,6,false),new THREE.MeshBasicMaterial({color:'#203d61',transparent:true,opacity:.95}));scene.add(routeUnder);
 scene.add(new THREE.Mesh(new THREE.TubeGeometry(route,640,.105,6,false),new THREE.MeshBasicMaterial({color:'#dbefff',transparent:true,opacity:.8})));
 const completedGeometry=new THREE.TubeGeometry(route,640,.145,6,false);
 completed=new THREE.Mesh(completedGeometry,new THREE.MeshBasicMaterial({color:'#97d1ff'}));scene.add(completed);
 // Instanced trees show the forest cover without hundreds of separate draw calls.
 const count=window.innerWidth<720?700:1400;
 trees=new THREE.InstancedMesh(new THREE.ConeGeometry(.72,2.9,6),new THREE.MeshStandardMaterial({color:'#284b6e',roughness:1}),count);
 const lowerTrees=new THREE.InstancedMesh(new THREE.ConeGeometry(.88,2.1,6),new THREE.MeshStandardMaterial({color:'#223e5d',roughness:1}),count);
 const dummy=new THREE.Object3D();let seed=9237;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 let n=0;
 while(n<count){
   const x=(random()-.5)*104,z=(random()-.5)*104,y=elevation(x,z);
   if(y>20.5||Math.abs(x)>53||Math.abs(z)>53)continue;
   let near=false;for(let j=0;j<routeSamples.length;j+=6){const p=routeSamples[j];if((p.x-x)**2+(p.z-z)**2<2.2){near=true;break;}}if(near)continue;
   const scale=.62+random()*.70;dummy.position.set(x,y+1.35*scale,z);dummy.scale.setScalar(scale);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();trees.setMatrixAt(n,dummy.matrix);
   dummy.position.y=y+.95*scale;dummy.updateMatrix();lowerTrees.setMatrixAt(n,dummy.matrix);n++;
 }
 scene.add(trees,lowerTrees);
 const pinMaterial=new THREE.MeshBasicMaterial({color:'#b5dfff'});
 stopPositions.forEach(p=>{
   const base=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.16,16),pinMaterial);base.position.copy(p);base.position.y+=.08;scene.add(base);
 });
 traveler=new THREE.Group();
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.46,18,14),new THREE.MeshStandardMaterial({color:'#edf8ff',emissive:'#629eca',emissiveIntensity:.35,roughness:.4}));marker.position.y=.6;
 halo=new THREE.Mesh(new THREE.RingGeometry(.7,.83,32),new THREE.MeshBasicMaterial({color:'#a6d9ff',transparent:true,opacity:.6,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.11;
 traveler.add(marker,halo);scene.add(traveler);
 setCameraView();camera.position.set(54,63,83);cameraTarget.set(1,11,2);camera.lookAt(cameraTarget);
 document.body.classList.add('terrain-ready');sceneReady=true;
 document.getElementById('terrain-canvas').addEventListener('webglcontextlost',event=>{event.preventDefault();sceneReady=false;document.body.classList.remove('terrain-ready');status.textContent='3D paused. Refresh to restore it; all sections are still available.';});
}
function updateAnchors(){anchors=sections.map(section=>section.offsetTop);updateScroll();}
function updateScroll(){
 const y=window.scrollY+(document.body.classList.contains('reading-view')?95:0);
 let index=0;for(let i=0;i<anchors.length;i++)if(y>=anchors[i]-2)index=i;
 currentStop=index;
 document.querySelectorAll('.site-header nav a').forEach(link=>{if(link.hash==='#'+sections[index].id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
 const next=Math.min(index+1,anchors.length-1);
 const fraction=next===index?0:clamp((y-anchors[index])/(anchors[next]-anchors[index]));
 // Stay at a waypoint while its content is being read; travel in the gap.
 const travel=smooth(clamp((fraction-.52)/.48));
 targetProgress=THREE.MathUtils.lerp(stopFractions[index],stopFractions[next],travel);
 scrubber.value=String(Math.round(targetProgress*1000));scrubber.setAttribute('aria-valuetext',stopNames[index]);
 document.getElementById('current-stop').textContent=`${String(index+1).padStart(2,'0')} / ${stopNames[index]}`;
 document.getElementById('route-percent').textContent=`${Math.round(targetProgress*100)}% explored`;
 markers.forEach((marker,i)=>{marker.classList.toggle('active',i===index);if(i===index)marker.setAttribute('aria-current','location');else marker.removeAttribute('aria-current');});
 document.querySelector('.page-progress>div').style.transform=`scaleX(${targetProgress})`;
 drawRequested=true;
}
function scrollToStop(index){window.scrollTo({top:Math.max(0,anchors[index]-(document.body.classList.contains('reading-view')?95:0)),behavior:'instant'});}
markers.forEach((button,index)=>button.addEventListener('click',()=>scrollToStop(index)));
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
 const i=sections.findIndex(section=>'#'+section.id===link.hash);
 if(i>=0){event.preventDefault();scrollToStop(i);history.replaceState(null,'',link.hash);document.querySelectorAll('.mobile-menu').forEach(menu=>menu.open=false);}
}));
scrubber.addEventListener('input',()=>{
 const t=Number(scrubber.value)/1000;let i=0;for(let j=0;j<stopFractions.length-1;j++)if(t>=stopFractions[j])i=j;
 const f=clamp((t-stopFractions[i])/(stopFractions[i+1]-stopFractions[i]));
 // Invert the smoothstep mapping so dragging does not jump across the reading pause.
 let lo=0,hi=1;for(let n=0;n<14;n++){const mid=(lo+hi)/2;if(smooth(mid)<f)lo=mid;else hi=mid;}
 const raw=f===0?0:.52+.48*(lo+hi)/2;
 window.scrollTo({top:THREE.MathUtils.lerp(anchors[i],anchors[i+1],raw),behavior:'instant'});
});

const readingToggle=document.getElementById('reading-toggle');
function setReadingView(enabled){
 const active=currentStop;
 document.body.classList.toggle('reading-view',enabled);
 readingToggle.setAttribute('aria-pressed',String(enabled));
 readingToggle.textContent=enabled?'Return to 3D trail':'Simple view';
 try{localStorage.setItem('portfolio-reading-view',String(enabled));}catch{}
 requestAnimationFrame(()=>{updateAnchors();scrollToStop(active);});
}
readingToggle.addEventListener('click',()=>setReadingView(!document.body.classList.contains('reading-view')));
try{if(localStorage.getItem('portfolio-reading-view')==='true')setReadingView(true);}catch{}

overviewButton.addEventListener('click',()=>{overview=!overview;overviewButton.setAttribute('aria-pressed',String(overview));overviewButton.textContent=overview?'Follow the trail':'Route overview';drawRequested=true;});
window.addEventListener('portfolio-motion',event=>{motion=event.detail.enabled;drawRequested=true;});
window.addEventListener('scroll',updateScroll,{passive:true});
window.addEventListener('resize',()=>{if(sceneReady)setCameraView();updateAnchors();});
new ResizeObserver(updateAnchors).observe(document.querySelector('main'));
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){lastTime=0;drawRequested=true;}});
const profile=routeSamples.filter((_,i)=>i%8===0);const maxHeight=Math.max(...profile.map(p=>p.y));
const profilePoints=profile.map((p,i)=>`${i*360/(profile.length-1)},${49-p.y/maxHeight*41}`);
document.getElementById('profile-line').setAttribute('d','M'+profilePoints.join(' L'));
document.getElementById('profile-fill').setAttribute('d','M0,55 L'+profilePoints.join(' L')+' L360,55 Z');
function frameLoop(time){
 frame=requestAnimationFrame(frameLoop);if(!visible||!sceneReady||document.body.classList.contains('reading-view'))return;
 const dt=Math.min((time-lastTime)/1000||.016,.05);lastTime=time;
 const damping=motion?1-Math.exp(-dt*6):1;
 currentProgress=THREE.MathUtils.lerp(currentProgress,targetProgress,damping);
 if(Math.abs(currentProgress-targetProgress)<.00001)currentProgress=targetProgress;
 const point=route.getPoint(currentProgress);
 traveler.position.copy(point);
 if(motion){halo.scale.setScalar(1+Math.sin(time*.002)*.11);}else halo.scale.setScalar(1);
 completed.geometry.setDrawRange(0,Math.max(0,Math.floor(currentProgress*640)*6*6));
 if(overview||!motion){desiredTarget.set(0,12,3);desiredPosition.set(69,76,88);}
 else{
   const introPullback=1-smooth(clamp(currentProgress/.08));
   const angle=.40+currentProgress*.48;
   desiredTarget.copy(point);desiredTarget.y+=1;
   desiredTarget.lerp(new THREE.Vector3(0,11,2),introPullback*.8);
   const distance=window.innerWidth<720?53:48;
   desiredPosition.set(desiredTarget.x+Math.sin(angle)*distance+introPullback*21,desiredTarget.y+29+introPullback*29,desiredTarget.z+Math.cos(angle)*distance+introPullback*15);
 }
 const camEase=motion?1-Math.exp(-dt*3):1;
 camera.position.lerp(desiredPosition,camEase);cameraTarget.lerp(desiredTarget,camEase);camera.lookAt(cameraTarget);
 const light=Number(document.getElementById('daylight').value)/100;
 sun.intensity=2.7-light*2.0;ambient.intensity=2.5-light*1.4;
 renderer.toneMappingExposure=1.18-light*.22;
 const bg=new THREE.Color('#91a9c3').lerp(new THREE.Color('#172b48'),light*.85);scene.background.copy(bg);scene.fog.color.copy(bg);
 renderer.render(scene,camera);
 markers.forEach((button,i)=>{
   scratchVector.copy(stopPositions[i]);scratchVector.y+=1.5;scratchVector.project(camera);
   const x=(scratchVector.x*.5+.5)*window.innerWidth,y=(-scratchVector.y*.5+.5)*window.innerHeight;
   const inView=scratchVector.z<1&&x>12&&x<window.innerWidth-12&&y>90&&y<window.innerHeight-115;
   button.hidden=!inView;
   if(inView){button.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;button.classList.toggle('near',Math.abs(stopFractions[i]-currentProgress)<.07||overview);}
 });
 const dot=route.getPoint(currentProgress);document.getElementById('profile-dot').setAttribute('cx',String(currentProgress*360));document.getElementById('profile-dot').setAttribute('cy',String(49-dot.y/maxHeight*41));
 drawRequested=false;
}
try{initScene();updateAnchors();requestAnimationFrame(frameLoop);}catch(error){console.error('3D trail unavailable',error);document.body.classList.add('terrain-unavailable');status.textContent='3D is unavailable in this browser. Scroll to explore all sections.';overviewButton.hidden=true;markers.forEach(button=>button.hidden=true);updateAnchors();}
if(location.hash){const index=sections.findIndex(section=>'#'+section.id===location.hash);if(index>=0)requestAnimationFrame(()=>scrollToStop(index));}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer?.dispose();});
