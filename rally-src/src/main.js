import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './style.css';
const uiRoot=window.__ATHLETE_ROOT__??document;
const $=id=>uiRoot.getElementById(id),viewport=$('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#13212d');renderer.toneMapping=THREE.ACESFilmicToneMapping;viewport.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#13212d',22,65);
const camera=new THREE.PerspectiveCamera(40,1,.03,100);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI/2-.02;controls.minDistance=2;controls.maxDistance=28;
function view(){camera.position.set(-6.5,-8.2,5.4);controls.target.set(1.6,0,.65);controls.update();}view();$('view').onclick=view;
scene.add(new THREE.HemisphereLight('#ecf4ff','#243341',1.8));const sun=new THREE.DirectionalLight('#fff5de',2.2);sun.position.set(-3,-4,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:30});sun.shadow.bias=-.0004;scene.add(sun);scene.add(sun.target);
const objects=new Map();const matrix=new THREE.Matrix4();
let ready=false,latest=null,trail=[],lastTime=-1;
const trailGeom=new THREE.BufferGeometry();const trailLine=new THREE.Line(trailGeom,new THREE.LineBasicMaterial({color:'#efff38',transparent:true,opacity:.85,toneMapped:false}));scene.add(trailLine);
const ballHalo=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),new THREE.MeshBasicMaterial({color:'#efff38',transparent:true,opacity:.16,depthWrite:false,toneMapped:false}));scene.add(ballHalo);
function addGeoms(geoms,target){
  for(const g of geoms){const [x,y,z]=g.size;let geo;
    if(g.type===7){geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(g.vertices,3));geo.setIndex(new THREE.BufferAttribute(g.indices,1));geo.computeVertexNormals();}
    else if(g.type===0)geo=new THREE.PlaneGeometry(100,100);
    else if(g.type===2)geo=new THREE.SphereGeometry(x,24,16);
    else if(g.type===6)geo=new THREE.BoxGeometry(x*2,y*2,z*2);
    else if(g.type===3){geo=new THREE.CapsuleGeometry(x,y*2,8,16);geo.rotateX(Math.PI/2);}
    else if(g.type===5){geo=new THREE.CylinderGeometry(x,x,y*2,24);geo.rotateX(Math.PI/2);}
    else if(g.type===4){geo=new THREE.SphereGeometry(1,24,16);geo.scale(x,y,z);}
    else continue;
    let color=new THREE.Color(g.rgba[0],g.rgba[1],g.rgba[2]);
    if(g.type===0)color=new THREE.Color('#172d37');
    if(g.name.includes('court_surface'))color=new THREE.Color('#174456');
    if(g.ball)color=new THREE.Color('#efff38');
    const mesh=new THREE.Mesh(geo,g.ball
      ? new THREE.MeshBasicMaterial({color,toneMapped:false,fog:false})
      : new THREE.MeshStandardMaterial({color,roughness:.8,metalness:g.type===7?.16:0,transparent:g.rgba[3]<1,opacity:g.rgba[3],side:THREE.DoubleSide}));
    mesh.castShadow=g.type!==0&&g.rgba[3]>.6;mesh.receiveShadow=true;objects.set(g.id,mesh);scene.add(mesh);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.23,.27,64),new THREE.MeshBasicMaterial({color:'#68dfdc',side:THREE.DoubleSide}));ring.position.set(target[0],target[1],.013);scene.add(ring);
}
const packaged=window.__ATHLETE_BUNDLE__;
const worker=packaged?new Worker(URL.createObjectURL(new Blob([packaged.worker],{type:'text/javascript'}))):new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});
const send=(type,more={})=>worker.postMessage({type,...more});
window.__rally={ready:false,errors:[],parity:null,latest:null,send};
worker.onerror=e=>error(e.message);
function error(message){window.__rally.errors.push(message);$('loading').classList.remove('hidden');$('load-text').textContent='加载或运行失败';$('loading').querySelector('p').textContent=message;$('loading').querySelector('.spinner').style.display='none';$('state').textContent='已停止';}
worker.onmessage=({data:f})=>{
  if(f.type==='status')$('load-text').textContent=f.message;
  if(f.type==='error')error(f.message);
  if(f.type==='parity'){window.__rally.parity=f;console.info('Parity',JSON.stringify(f));document.body.dataset.parity=JSON.stringify(f);}
  if(f.type==='scene')addGeoms(f.geoms,f.target);
  if(f.type==='ready'){ready=true;window.__rally.ready=true;$('loading').classList.add('hidden');['serve','pause','reset','push','ball-reset'].forEach(id=>$(id).disabled=false);}
  if(f.type==='frame'){
    latest=f;window.__rally.latest=f;
    $('ball-speed').textContent=Math.hypot(...f.ballVelocity).toFixed(2);
    for(const [id,obj] of objects){const r=f.rotations,p=f.positions,i=id*9;matrix.set(r[i],r[i+1],r[i+2],0,r[i+3],r[i+4],r[i+5],0,r[i+6],r[i+7],r[i+8],0,0,0,0,1);obj.quaternion.setFromRotationMatrix(matrix);obj.position.fromArray(p,id*3);}
    ballHalo.position.fromArray(f.ball);
    if(f.time<lastTime||!f.flying||f.shot?.start!==window.__rally.shotStart){trail=[];window.__rally.shotStart=f.shot?.start;}
    if(f.time!==lastTime&&f.flying){trail.push(new THREE.Vector3(...f.ball));if(trail.length>230)trail.shift();trailGeom.setFromPoints(trail);}lastTime=f.time;
    $('state').textContent=f.fallen?'已倾倒 · 请重置':f.dragging?'鼠标牵引球':f.paused?(f.steps?'已暂停':'准备就绪'):f.time<.5?'站立准备':'策略运行中';
    $('simtime').innerHTML=`${f.time.toFixed(2)} <span>s</span>`;
    if(!f.paused)$('latency').innerHTML=`${f.ms.toFixed(1)} <span>ms / 帧</span>`;
    $('shot').textContent=f.dragging?'拖动施力 · 松手释放':f.shot?.landing?`落点 ${f.shot.landing.map(v=>v.toFixed(1)).join(', ')} m`:f.shot?.net?'回球已过网':f.shot?.hit?'球拍已触球':f.flying?'来球飞行中':'等待发球';
  }
};
send('init',{embedded:packaged?.files,base:new URL('./',location.href).href,verify:new URLSearchParams(location.search).has('verify')});
function values(){return {y:Number($('lateral').value),speed:Number($('speed').value),lift:Number($('lift').value)};}
function serve(){endBallDrag();if(ready)send('launch',values());}
$('serve').onclick=serve;$('pause').onclick=()=>{endBallDrag();send('pause');};$('reset').onclick=()=>{endBallDrag();send('reset');$('auto').checked=false;send('auto',{value:false});};$('ball-reset').onclick=()=>{endBallDrag();$('auto').checked=false;send('ball-reset');};$('push').onclick=()=>send('push');$('auto').onchange=e=>send('auto',{value:e.target.checked,...values()});
for(const id of ['lateral','speed','lift'])$(id).oninput=()=>{$(`${id}-value`).textContent=`${Number($(id).value).toFixed(id==='lateral'?2:1)} ${id==='lateral'?'m':'m/s'}`;send('settings',values());};
for(const [id,y]of [['forehand',-.65],['backhand',.65]])$(id).onclick=()=>{$('lateral').value=y;$('lateral').oninput();['forehand','backhand'].forEach(k=>$(k).classList.toggle('selected',id===k));};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes((uiRoot.activeElement??document.activeElement).tagName)){e.preventDefault();serve();}if(e.code==='KeyR')$('reset').click();if(e.code==='KeyB')$('ball-reset').click();});
// Pointer capture keeps the spring attached when the cursor leaves the ball.
// Empty-space drags still go to OrbitControls; Ctrl uses the preselected ball.
const pointerRay=new THREE.Raycaster(),dragPlane=new THREE.Plane();
const dragOffset=new THREE.Vector3(),dragTarget=new THREE.Vector3();
let dragPointer=null;
const tetherGeo=new THREE.BufferGeometry();
const tether=new THREE.Line(tetherGeo,new THREE.LineBasicMaterial({color:'#f3c86a',depthTest:false}));tether.renderOrder=10;tether.visible=false;scene.add(tether);
function pointerWorld(e){
  const box=renderer.domElement.getBoundingClientRect();
  pointerRay.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),camera);
  return pointerRay.ray.intersectPlane(dragPlane,new THREE.Vector3());
}
function endBallDrag(){
  if(dragPointer===null)return;
  const id=dragPointer;dragPointer=null;
  if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);
  controls.enabled=true;tether.visible=false;renderer.domElement.style.cursor='grab';send('drag-end');
}
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!ready||latest?.fallen||e.button!==0||dragPointer!==null)return;
  const box=renderer.domElement.getBoundingClientRect(),ball=new THREE.Vector3(...latest.ball),screen=ball.clone().project(camera);
  const sx=box.left+(screen.x+1)*box.width/2,sy=box.top+(1-screen.y)*box.height/2;
  const onBall=screen.z>-1&&screen.z<1&&Math.hypot(e.clientX-sx,e.clientY-sy)<22;
  if(!onBall&&!e.ctrlKey)return;
  const normal=e.shiftKey?new THREE.Vector3(0,0,1):camera.getWorldDirection(new THREE.Vector3()).setZ(0).normalize();
  if(normal.lengthSq()<.01)return;
  dragPlane.setFromNormalAndCoplanarPoint(normal,ball);
  const hit=pointerWorld(e);if(!hit)return;
  dragOffset.copy(ball).sub(hit);dragTarget.copy(ball);dragPointer=e.pointerId;
  controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';
  e.preventDefault();e.stopImmediatePropagation();$('auto').checked=false;
  send('drag-start',{position:ball.toArray()});
},true);
renderer.domElement.addEventListener('pointermove',e=>{
  if(e.pointerId!==dragPointer)return;
  const hit=pointerWorld(e);if(hit){dragTarget.copy(hit).add(dragOffset);send('drag-target',{position:dragTarget.toArray()});}
  e.preventDefault();e.stopImmediatePropagation();
},true);
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{
  if(e.pointerId!==dragPointer)return;endBallDrag();e.stopImmediatePropagation();
},true);
window.addEventListener('blur',endBallDrag);
document.addEventListener('visibilitychange',()=>{if(document.hidden)endBallDrag();});
new ResizeObserver(()=>{renderer.setSize(viewport.clientWidth,viewport.clientHeight);camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();}).observe(viewport);
function render(){requestAnimationFrame(render);if(dragPointer!==null&&latest){tether.visible=true;tetherGeo.setFromPoints([new THREE.Vector3(...latest.ball),dragTarget]);}controls.update();renderer.render(scene,camera);}render();
