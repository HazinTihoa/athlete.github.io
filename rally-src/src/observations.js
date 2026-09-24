// Port of IntentObservationBuilder: histories preserve their original frame semantics.
export const transposeRotate = (r, v) => [0,1,2].map(i => r[i]*v[0]+r[3+i]*v[1]+r[6+i]*v[2]);
const subtract = (a,b) => a.map((v,i)=>v-b[i]);
const lags=[20,15,10,5,0];
export class Observations {
  constructor(mj, model, data, cfg) {
    Object.assign(this,{mj,model,data,cfg});
    this.jac=new mj.DoubleBuffer(3*model.nv);
    this.rotJac=new mj.DoubleBuffer(3*model.nv);
    this.reset();
  }
  reset() { this.state=[]; this.clearBall(); this.target=[...this.cfg.landing_target,0]; }
  clearBall() { this.bp=[];this.bv=[];this.wp=[];this.wv=[]; }
  push(h,v) { h.push(v); if(h.length>25)h.shift(); }
  gather(h) { return lags.map(l=>h[Math.max(0,h.length-1-l)]); }
  encode(v) {
    const enc=this.cfg.ball_encoding;if(!enc)return v;
    const [inner,outer]=enc, r=Math.hypot(...v);
    return r<=inner?v:v.map(x=>x*(inner+(outer-inner)*Math.tanh((r-inner)/(outer-inner)))/r);
  }
  build(last) {
    const {mj,model:m,data:d,cfg:c}=this;
    const root=Array.from(d.qpos.slice(0,3)), r=d.xmat.slice(c.pelvis_body*9,c.pelvis_body*9+9);
    const rot=v=>transposeRotate(r,v);
    const q=c.qadr.map((a,i)=>d.qpos[a]-c.default_joints[i]), dq=c.vadr.map(a=>d.qvel[a]);
    const ang=Array.from(d.qvel.slice(3,6)), grav=rot([0,0,-1]);
    const bp=Array.from(d.qpos.slice(c.ball_qadr,c.ball_qadr+3)),bv=Array.from(d.qvel.slice(c.ball_vadr,c.ball_vadr+3));
    this.push(this.state,[...ang,...grav,...q,...dq,...last]);
    this.push(this.bp,rot(subtract(bp,root)));this.push(this.bv,rot(bv));this.push(this.wp,bp);this.push(this.wv,bv);
    mj.mj_jacSite(m,d,this.jac,this.rotJac,c.sweet_site);
    const j=this.jac.GetView(), sw=[0,1,2].map(k=>c.vadr.reduce((s,a)=>s+j[k*m.nv+a]*d.qvel[a],0));
    const sweet=rot(subtract(Array.from(d.site_xpos.slice(c.sweet_site*3,c.sweet_site*3+3)),root));
    const yaw=Math.atan2(r[3],r[0]);
    const obs=new Float32Array([
      ...ang,...q,...dq,...last,...rot(subtract(this.target,root)).slice(0,2),
      ...this.gather(this.bp).flatMap(v=>this.encode(v)),...this.gather(this.bv).flat(),
      ...rot(sw),...grav,...sweet,Math.cos(yaw),-Math.sin(yaw),...root,
      ...this.gather(this.state).flat(),
      ...this.gather(this.wp).flatMap(v=>this.encode(rot(subtract(v,root)))),...this.gather(this.wv).flatMap(rot),
    ]);
    if(obs.length!==631||!obs.every(Number.isFinite))throw Error('Invalid policy observation');
    return obs;
  }
}
