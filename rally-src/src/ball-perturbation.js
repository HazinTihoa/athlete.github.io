// Same force application as native Deploy Sim's --interactive-perturbation.
export class BallPerturbation {
  constructor(mj, model, data, cfg) {
    Object.assign(this, {mj, model, data, cfg});
    this.perturb = new mj.MjvPerturb();
    mj.mjv_defaultPerturb(this.perturb);
    this.perturb.select = cfg.ball_body;
    this.perturb.localpos.fill(0);
    // For the independent free sphere selected at its centre, the spatial
    // effective mass computed by mjv_initPerturb equals the sphere's mass.
    this.perturb.localmass = model.body_mass[cfg.ball_body];
  }
  setTarget(position) {
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return false;
    this.perturb.refselpos.set(position);
    this.perturb.active = this.mj.mjtPertBit.mjPERT_TRANSLATE.value;
    return true;
  }
  get active() { return this.perturb.active !== 0; }
  stop() { this.perturb.active = 0; }
  apply() {
    this.mj.mjv_applyPerturbPose(this.model, this.data, this.perturb, 0);
    this.mj.mjv_applyPerturbForce(this.model, this.data, this.perturb);
  }
}
