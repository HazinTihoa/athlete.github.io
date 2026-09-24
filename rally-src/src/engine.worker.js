import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import * as ort from 'onnxruntime-web/wasm';
import {Observations} from './observations.js';
import {BallPerturbation} from './ball-perturbation.js';
import {MAX_BALL_SPEED, limitBallSpeed} from './ball-speed.js';
let mj,m,d,c,obs,session,drag,last=new Float32Array(29),paused=true,flying=false,fallen=false;
let pending=null,age=0,hold=[6,-.65,1],warmup=0,steps=0,shot=null,auto=false,pushUntil=0,launchVelocity=[-3.5,0,4.5],interactiveTrack=false,serveSettings={y:-.65,speed:3.5,lift:4.5};
const send=(type,fields={})=>postMessage({type,...fields});
const commands=[];
onmessage=e=>{ if(e.data.type==='init')init(e.data).catch(fail);else commands.push(e.data); };
const fail=e=>{paused=true;send('error',{message:String(e.stack||e)});};
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json();}
let embeddedFiles=null;
async function resource(path,base){
  if(embeddedFiles){if(!embeddedFiles[path])throw Error(`Missing packaged asset: ${path}`);return embeddedFiles[path];}
  const r=await fetch(new URL(path,base));if(!r.ok)throw Error(`Asset missing: ${path}`);return new Uint8Array(await r.arrayBuffer());
}
async function init({base,verify,embedded}) {
  embeddedFiles=embedded??null;
  send('status',{message:'加载物理引擎与机器人…'});
  c=JSON.parse(new TextDecoder().decode(await resource('assets/config.json',base)));
  mj=await loadMujoco(embeddedFiles?{wasmBinary:embeddedFiles['runtime/mujoco.wasm'],locateFile:()=> 'mujoco.wasm'}:{locateFile:()=>wasmUrl});mj.FS.mkdir('/scene');
  await Promise.all(c.files.map(async f=>{mj.FS.writeFile(`/scene/${f}`,await resource(`assets/${f}`,base));}));
  m=mj.MjModel.from_xml_path('/scene/scene.xml');d=new mj.MjData(m);
  for(const [key,v] of Object.entries(c.model_fields))m[key].set(v);
  mj.mj_setConst(m,d);obs=new Observations(mj,m,d,c);drag=new BallPerturbation(mj,m,d,c);
  send('status',{message:'加载网球策略…'});
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;if(embeddedFiles){ort.env.wasm.wasmBinary=embeddedFiles['runtime/ort.wasm'];ort.env.wasm.wasmPaths=undefined;}else ort.env.wasm.wasmPaths=new URL('runtime/',base).href;
  session=await ort.InferenceSession.create(embeddedFiles?embeddedFiles['assets/policy.onnx']:new URL('assets/policy.onnx',base).href,{executionProviders:['wasm']});
  if(verify)await parity(base);
  reset();sendScene();send('ready',{policy:c.policy});tick();
}
async function infer(input) {
  const t=new ort.Tensor('float32',input,[1,631]);
  const outputs=await session.run({[session.inputNames[0]]:t});
  const action=Float32Array.from(outputs[session.outputNames[0]].data);
  t.dispose();Object.values(outputs).forEach(o=>o.dispose());
  if(!action.every(Number.isFinite))throw Error('Policy returned nonfinite action');return action;
}
async function parity(base) {
  send('status',{message:'校验 Python / 浏览器观测与动作…'});
  const frames=JSON.parse(new TextDecoder().decode(await resource('assets/parity.json',base)));let observationError=0,actionError=0,worstIndex=0;
  obs.reset();
  for(const f of frames){d.qpos.set(f.qpos);d.qvel.set(f.qvel);mj.mj_forward(m,d);const input=obs.build(f.last);
    input.forEach((v,i)=>{const err=Math.abs(v-f.observation[i]);if(err>observationError){observationError=err;worstIndex=i;}});
    const a=await infer(input);a.forEach((v,i)=>actionError=Math.max(actionError,Math.abs(v-f.actions[i])));
  }
  send('parity',{frames:frames.length,observationError,actionError,worstIndex});
  if(observationError>1e-5||actionError>1e-4)throw Error(`Parity failed: obs=${observationError} action=${actionError}`);
}
function reset(){
  mj.mj_resetData(m,d);d.qpos.set(c.default_base,0);c.qadr.forEach((a,i)=>d.qpos[a]=c.initial_joints[i]);
  interactiveTrack=false;drag.stop();last.fill(0);obs.reset();flying=false;fallen=false;warmup=0;steps=0;pending=null;shot=null;pushUntil=0;
  hold=[6,-.65,1];holdBall();mj.mj_forward(m,d);paused=true;frame(0);
}
function holdBall(){d.qpos.set([...hold,1,0,0,0],c.ball_qadr);d.qvel.fill(0,c.ball_vadr,c.ball_vadr+6);}
function launch(cmd={}) {
  if(fallen)return;
  interactiveTrack=false;drag.stop();
  const y=Number(cmd.y??-.65),speed=Number(cmd.speed??3.5),lift=Number(cmd.lift??4.5);
  hold=[6,y,1];launchVelocity=[-speed,0,lift];d.qpos.set([...hold,1,0,0,0],c.ball_qadr);d.qvel.set([...launchVelocity,0,0,0],c.ball_vadr);limitBallSpeed(d.qvel,c.ball_vadr);
  flying=true;pending=null;obs.clearBall();paused=false;shot={hit:false,net:false,landing:null,start:d.time};mj.mj_forward(m,d);
}
function resetInteractiveBall(){
  interactiveTrack=true;drag.stop();auto=false;pending=null;age=0;shot=null;flying=false;
  hold=[...(c.interactive_ball_position??[.31931576,.9375947,1.08916278])];
  holdBall();obs.clearBall();mj.mj_forward(m,d);if(!fallen)paused=false;
}
function startDrag(position){
  if(fallen||!drag.setTarget(position))return;
  interactiveTrack=true;auto=false;paused=false;
  if(!flying){flying=true;pending=null;shot={hit:false,net:false,landing:null,start:d.time};}
}
function aero(){
  const a=c.aero,v=Array.from(d.qvel.slice(c.ball_vadr,c.ball_vadr+3)).map((x,i)=>x-a.wind_w[i]),w=d.qvel.slice(c.ball_vadr+3,c.ball_vadr+6),r=c.radius,rho=a.air_density_kg_m3,mu=a.dynamic_viscosity_pa_s;
  const drag=.5*rho*c.physics.drag_coefficient*Math.PI*r*r*Math.hypot(...v)+6*Math.PI*r*mu;
  const mag=rho*4/3*Math.PI*r**3*a.magnus_coefficient,ad=rho*a.angular_drag_coefficient*8/15*Math.PI*r**5*Math.hypot(...w)+Math.PI*(2*r)**3*mu;
  const cross=[w[1]*v[2]-w[2]*v[1],w[2]*v[0]-w[0]*v[2],w[0]*v[1]-w[1]*v[0]];
  for(let i=0;i<3;i++){d.xfrc_applied[c.ball_body*6+i]+=-drag*v[i]+mag*cross[i];d.xfrc_applied[c.ball_body*6+3+i]+=-ad*w[i];}
}
function rebound(){
  const z=d.qpos[c.ball_qadr+2],vz=d.qvel[c.ball_vadr+2];
  if(pending)age++;else if(vz<-.05&&z<=c.radius+.03){pending=Array.from(d.qvel.slice(c.ball_vadr,c.ball_vadr+3));pending[2]=-Math.sqrt(vz*vz+2*9.81*Math.max(z-c.radius,0));age=0;}
  if(pending&&z<=c.radius+.002){
    if(shot?.hit&&!shot.landing)shot.landing=Array.from(d.qpos.slice(c.ball_qadr,c.ball_qadr+2));
    d.qpos[c.ball_qadr+2]=c.radius+.0001;
    for(let i=0;i<2;i++)d.qvel[c.ball_vadr+i]=pending[i]*c.physics.ground_tangent_speed_retention;
    d.qvel[c.ball_vadr+2]=-pending[2]*c.physics.court_restitution;pending=null;mj.mj_forward(m,d);
  }else if(age>20)pending=null;
}
let ballGeom,racketGeoms;
function contacts(){
  if(!shot||shot.hit)return;
  const contacts=d.contact;
  for(let i=0;i<d.ncon;i++){
    const con=contacts.get(i),g=con.geom;
    if((g[0]===ballGeom&&racketGeoms.has(g[1]))||(g[1]===ballGeom&&racketGeoms.has(g[0])))shot.hit=true;
    con.delete();
  }
  contacts.delete();
}
function sendScene(){
  const geoms=[];racketGeoms=new Set();
  for(let i=0;i<m.ngeom;i++){
    const name=mj.mj_id2name(m,mj.mjtObj.mjOBJ_GEOM.value,i)||'';
    if(m.geom_bodyid[i]===c.ball_body)ballGeom=i;
    if(name.includes('racket'))racketGeoms.add(i);
    const mat=m.geom_matid[i],rgba=Array.from(m.geom_rgba.slice(i*4,i*4+4));
    if(mat>=0&&rgba.every((x,j)=>Math.abs(x-[.5,.5,.5,1][j])<1e-5))rgba.splice(0,4,...m.mat_rgba.slice(mat*4,mat*4+4));
    if(rgba[3]===0||m.geom_group[i]===3||name.includes('launch'))continue;
    const g={id:i,name,type:m.geom_type[i],size:Array.from(m.geom_size.slice(i*3,i*3+3)),rgba,ball:m.geom_bodyid[i]===c.ball_body};
    if(g.type===7){const id=m.geom_dataid[i],v=m.mesh_vertadr[id],n=m.mesh_vertnum[id],f=m.mesh_faceadr[id],nf=m.mesh_facenum[id];g.vertices=Float32Array.from(m.mesh_vert.slice(v*3,(v+n)*3));g.indices=Uint32Array.from(m.mesh_face.slice(f*3,(f+nf)*3));}
    geoms.push(g);
  }
  send('scene',{geoms,target:c.landing_target});
}
function frame(elapsed){send('frame',{positions:Float32Array.from(d.geom_xpos),rotations:Float32Array.from(d.geom_xmat),ball:Array.from(d.qpos.slice(c.ball_qadr,c.ball_qadr+3)),root:Array.from(d.qpos.slice(0,3)),maxBallSpeed:MAX_BALL_SPEED,time:d.time,paused,fallen,flying,dragging:drag.active,ballVelocity:Array.from(d.qvel.slice(c.ball_vadr,c.ball_vadr+3)),dragTarget:drag.active?Array.from(drag.perturb.refselpos):null,shot,steps,ms:elapsed,actionMax:Math.max(...last.map(Math.abs))});}
async function tick(){
  const start=performance.now();
  try{
    for(const cmd of commands.splice(0)){
      if(cmd.type==='reset')reset();if(cmd.type==='pause'){drag.stop();paused=!paused;}
      if(cmd.type==='ball-reset')resetInteractiveBall();
      if(cmd.type==='drag-start')startDrag(cmd.position);
      if(cmd.type==='drag-target'&&drag.active)drag.setTarget(cmd.position);
      if(cmd.type==='drag-end')drag.stop();if(cmd.type==='launch'){serveSettings={...serveSettings,...cmd};launch(serveSettings);}
      if(cmd.type==='settings')serveSettings={...serveSettings,...cmd};
      if(cmd.type==='auto'){auto=cmd.value;serveSettings={...serveSettings,...cmd};if(auto&&!flying)launch(serveSettings);}
      if(cmd.type==='push')pushUntil=d.time+.15;
    }
    if(!paused&&!fallen){
      // Warm the standing PD pose with floating-base support, as in Deploy Sim home mode.
      const warming=warmup<.5;
      if(!warming)last=await infer(obs.build(last));
      for(let sub=0;sub<Math.round(c.control_dt/c.physics_dt);sub++){
        d.xfrc_applied.fill(0);
        if(d.time<pushUntil)d.xfrc_applied[c.pelvis_body*6+1]=40;
        for(let j=0;j<29;j++){const target=c.default_joints[j]+(warming?0:c.action_scale[j]*last[j]);d.ctrl[c.actuators[j]]=c.kp[j]*(target-d.qpos[c.qadr[j]])-c.kd[j]*d.qvel[c.vadr[j]];}
        if(warming){d.qpos.set(c.default_base,0);d.qvel.fill(0,0,6);}
        if(flying&&(!warming||interactiveTrack)){if(drag.active)drag.apply();aero();}else holdBall();
        const oldX=d.qpos[c.ball_qadr];mj.mj_step(m,d);limitBallSpeed(d.qvel,c.ball_vadr);
        if(flying&&(!warming||interactiveTrack)){contacts();rebound();limitBallSpeed(d.qvel,c.ball_vadr);if(shot?.hit&&!shot.net&&oldX<c.net_x&&d.qpos[c.ball_qadr]>=c.net_x&&d.qpos[c.ball_qadr+2]>.914&&Math.abs(d.qpos[c.ball_qadr+1])<5)shot.net=true;}
        if(warming){d.qpos.set(c.default_base,0);d.qvel.fill(0,0,6);if(!flying||!interactiveTrack)holdBall();}
      }
      if(warming){warmup+=c.control_dt;if(warmup>=.5&&flying&&!interactiveTrack){d.qvel.set([...launchVelocity,0,0,0],c.ball_vadr);limitBallSpeed(d.qvel,c.ball_vadr);obs.clearBall();}}
      mj.mj_forward(m,d);steps++;
      fallen=d.qpos[2]<.35||d.xmat[c.pelvis_body*9+8]<Math.cos(70*Math.PI/180);
      if(!Array.from(d.qpos).every(Number.isFinite))throw Error('Nonfinite simulation state');
      if(flying&&auto&&d.time-(shot?.start??0)>7)launch(serveSettings);
    }
    frame(performance.now()-start);
  }catch(e){fail(e);return;}
  setTimeout(tick,Math.max(0,20-(performance.now()-start)));
}
