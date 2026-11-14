/* =====================================================================
   physics.js  ·  Martian Map · MR_PSG / Team Starseekers
   Physically based motion for the travelers on the REAL terrain.

   Vehicles (RAHHAL scout, QAFILA crew rover)
     - every wheel samples the real ground height under it
     - a plane is fitted through the contact points (least squares):
       its height, pitch and roll drive the body through spring-damper
       suspension (natural frequency ~1.6 Hz, damping ratio 0.75)
     - each wheel keeps its own suspension travel (what the plane cannot follow)
     - wheels turn by distance / radius, plus wheel slip on soft or steep ground
     - heading changes with a turn-rate limit; the QAFILA train bends at its joint
     - dust is thrown from the tyres and falls back under Mars gravity (3.71 m/s²)
   Astronaut (SINBAD suit)
     - low-gravity gait: step length and flight phase scale with g (Mars = 0.38 g),
       so the body floats higher and longer than on Earth
     - the body leans into slopes and into the walking speed; arms swing in counter-phase
   All lengths below are in scene units; `metersPerUnit` converts when needed.
   ===================================================================== */
import * as THREE from 'three';

const G_MARS = 3.71, G_EARTH = 9.81;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* critically-damped-ish spring for one value */
class Spring {
  constructor(omega = 10, zeta = 0.75) { this.k = omega * omega; this.c = 2 * zeta * omega; this.x = 0; this.v = 0; }
  snap(x) { this.x = x; this.v = 0; }
  step(target, dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;           // sub-steps keep it stable at low frame rates
    for (let i = 0; i < n; i++) { const a = this.k * (target - this.x) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.x;
  }
}

/* ---------- dust kicked up by wheels and boots ---------- */
export class Dust {
  constructor(scene, count = 220) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.col = new Float32Array(count * 3);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    // soft round puff (radial gradient) instead of square points
    let map = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      map = new THREE.CanvasTexture(c);
    }
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -9999;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, spread = 0.6) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx + (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 1] = vy + Math.random() * spread;
    this.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread;
    this.life[i] = 1;
  }
  update(dt, gScene, groundAt, bg) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      this.vel[k + 1] -= gScene * dt;                                      // Mars gravity
      const drag = Math.exp(-dt * 0.9);                                    // thin CO2 air: weak drag
      this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.life[i] -= dt * 0.55;
      const gy = groundAt(this.pos[k], this.pos[k + 2]);
      if (this.pos[k + 1] < gy) { this.pos[k + 1] = gy; this.vel[k] *= 0.3; this.vel[k + 1] = 0; this.vel[k + 2] *= 0.3; this.life[i] -= dt * 1.5; }
      const a = Math.max(0, this.life[i]);
      // fade into the background colour (Points have no per-particle alpha)
      this.col[k] = bg.r + (0.72 - bg.r) * a; this.col[k + 1] = bg.g + (0.5 - bg.g) * a; this.col[k + 2] = bg.b + (0.35 - bg.b) * a;
      if (this.life[i] <= 0) this.pos[k + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/* ---------- the motion rig ---------- */
export class MotionRig {
  /* holder: the Group positioned in the world (yaw lives here); model: the vehicle/astronaut inside it */
  constructor(holder, model, groundAt) {
    this.holder = holder;
    this.groundAt = groundAt;                       // (x, z) -> world y of the real terrain
    this.setModel(model);
  }
  setModel(model) {
    this.model = model;
    const u = (model && model.userData) || {};
    this.kind = u.kind || 'static';
    this.design = u.design || '';
    this.s = (model ? model.scale.x : 1);
    this.hS = new Spring(10, 0.8); this.pS = new Spring(9, 0.75); this.rS = new Spring(9, 0.75);
    this.yaw = this.holder.rotation.y; this.yawRate = 0;
    this.phase = 0; this.dist = 0; this.speed = 0;
    this.bob = new Spring(14, 0.5); this.lean = new Spring(6, 0.9);
    this.ready = false;
  }
  /* put the traveler exactly on the ground (no spring transient) */
  snap(x, z, yaw) {
    this.holder.position.x = x; this.holder.position.z = z;
    if (yaw !== undefined) { this.yaw = yaw; this.holder.rotation.y = yaw; }
    const f = this.fit(x, z, this.yaw);
    this.hS.snap(f.h); this.pS.snap(f.pitch); this.rS.snap(f.roll);
    this.apply(f, 0, 0);
    this.ready = true;
  }
  /* ground plane under the wheels (vehicles) or the feet (astronaut) */
  fit(x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const u = this.model && this.model.userData;
    const mounts = (u && u.wheelMounts) || null;
    const pts = mounts ? mounts.map(m => [m.x * this.s, m.z * this.s]) : [[0.6, 0.35], [0.6, -0.35], [-0.6, 0.35], [-0.6, -0.35]];
    // local (lx forward, lz right) -> world: forward = (cos yaw, -sin yaw) in x/z because models face +x and yaw turns about +y
    let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
    const hs = [];
    for (const [lx, lz] of pts) {
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      const y = this.groundAt(wx, wz);
      hs.push(y);
      sx += lx; sz += lz; sy += y; sxx += lx * lx; szz += lz * lz; sxz += lx * lz; sxy += lx * y; szy += lz * y;
    }
    const n = pts.length, mx = sx / n, mz = sz / n, my = sy / n;
    const cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz, cxy = sxy / n - mx * my, czy = szy / n - mz * my;
    const det = cxx * czz - cxz * cxz || 1e-9;
    const b = (cxy * czz - czy * cxz) / det, d = (czy * cxx - cxy * cxz) / det;   // dy/dlx, dy/dlz
    const h = my - b * mx - d * mz;
    const residual = pts.map(([lx, lz], i) => hs[i] - (h + b * lx + d * lz));
    return { h, pitch: Math.atan(b), roll: Math.atan(d), residual };
  }
  apply(f, wheelTurn, slip) {
    const m = this.model, u = m.userData;
    this.holder.position.y = this.hS.x;
    if (this.kind === 'rover') {
      m.rotation.z = this.pS.x;                      // nose up on climbs
      m.rotation.x = -this.rS.x;                     // roll toward the low side
      if (u.wheelMounts) u.wheelMounts.forEach((w, i) => {
        w.obj.position.y = w.restY + clamp((f.residual[i] || 0) / this.s, -w.travel, w.travel);
      });
      if (u.wheels && wheelTurn) for (const sp of u.wheels) sp.rotation.z -= wheelTurn * (1 + slip);
      if (u.joint) u.joint.rotation.y = clamp(-this.yawRate * 0.35, -0.45, 0.45);   // QAFILA bends into the turn
    }
  }
  /* one frame. target = where the route says the traveler is now; moved = scene units travelled since last frame */
  update(dt, target, yawTarget, opts = {}) {
    if (!this.model || dt <= 0) return;
    const { slip = 0, moving = false, dust = null, metersPerUnit = 100, bg = null } = opts;
    if (!this.ready) this.snap(target.x, target.z, yawTarget);
    const px = this.holder.position.x, pz = this.holder.position.z;
    const moved = Math.hypot(target.x - px, target.z - pz);
    this.holder.position.x = target.x; this.holder.position.z = target.z;
    this.speed = this.speed + (moved / dt - this.speed) * (1 - Math.exp(-dt * 6));
    // heading: turn-rate limit (vehicles turn slower than people)
    if (yawTarget !== undefined && (moving || moved > 1e-4)) {
      const maxRate = this.kind === 'astronaut' ? 4.5 : (this.design === 'QAFILA' ? 1.2 : 1.8);
      const d = angDiff(this.yaw, yawTarget);
      const step = clamp(d, -maxRate * dt, maxRate * dt);
      this.yawRate = this.yawRate + (step / dt - this.yawRate) * (1 - Math.exp(-dt * 8));
      this.yaw += step;
      this.holder.rotation.y = this.yaw;
    } else this.yawRate *= Math.exp(-dt * 4);

    const f = this.fit(target.x, target.z, this.yaw);
    if (this.kind === 'rover') {
      this.hS.step(f.h, dt); this.pS.step(f.pitch, dt); this.rS.step(f.roll, dt);
      const r = (this.model.userData.wheelRadius || 0.4) * this.s;
      this.apply(f, moved / r, slip);
      if (dust && moving && moved > 0) {
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        const rate = Math.min(6, 1 + this.speed * 0.8 + slip * 10);
        for (const w of this.model.userData.wheelMounts) {
          if (Math.random() > rate * dt * 2) continue;
          const lx = w.x * this.s, lz = w.z * this.s;
          const wx = target.x + lx * c + lz * s, wz = target.z - lx * s + lz * c;
          dust.emit(wx, this.groundAt(wx, wz) + 0.05, wz, -c * (0.6 + slip * 3), 0.9 + slip * 2.5, s * (0.6 + slip * 3), 0.7);
        }
      }
      return;
    }
    if (this.kind === 'astronaut') this.walk(dt, f, moved, moving, slip, dust, metersPerUnit);
    else { this.hS.step(this.groundAt(target.x, target.z), dt); this.holder.position.y = this.hS.x; }
  }
  walk(dt, f, moved, moving, slip, dust, metersPerUnit) {
    const u = this.model.userData;
    // people stay upright: only the height follows the ground, the body leans instead of tilting
    this.hS.step(f.h, dt);
    this.holder.position.y = this.hS.x;
    this.model.rotation.set(0, 0, 0);
    // gait: one stride = 2 steps. On Mars a relaxed stride is longer than on Earth (lower g)
    const legLen = 1.1 * this.s;
    const stride = legLen * 2.6 * Math.pow(G_EARTH / G_MARS, 0.25);      // dynamic similarity (Froude) ~ g^-1/4 scaling
    const maxCadence = 2.2;                                              // strides per second the eye can follow
    const dPhase = Math.min(moved / stride, maxCadence * dt) * Math.PI * 2;
    this.phase += moving ? dPhase : 0;
    const gait = moving ? Math.min(1, this.speed / (stride * 0.6)) : 0;
    const k = this.walkK = (this.walkK || 0) + ((moving ? 1 : 0) - (this.walkK || 0)) * (1 - Math.exp(-dt * 5));
    const ph = this.phase;
    // low gravity: longer flight phase -> higher, floatier bob (h ∝ 1/g for the same push-off)
    const hop = 0.05 * (G_EARTH / G_MARS) * k * (0.6 + 0.4 * gait);
    const lift = this.bob.step(Math.abs(Math.sin(ph)) * hop, dt);
    // lean: into the slope (forward when climbing) and slightly into the speed
    const lean = this.lean.step(-(f.pitch * 0.55) - 0.1 * k, dt);
    if (u.pose && this.gaitPose) u.pose(this.gaitPose(ph, k, { lean, lift }));
    if (this.onStep && moving && k > 0.3) {
      const st = Math.floor(ph / Math.PI);
      if (st !== this.lastStep) { this.lastStep = st; this.onStep(slip); }
    }
    // boot dust at each foot strike
    if (dust && moving) {
      const strike = Math.floor(ph / Math.PI);
      if (strike !== this.lastStrike) {
        this.lastStrike = strike;
        const side = strike % 2 ? 1 : -1, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        const lz = side * 0.22 * this.s, wx = this.holder.position.x + lz * s, wz = this.holder.position.z + lz * c;
        for (let i = 0; i < 5 + slip * 20; i++) dust.emit(wx, this.groundAt(wx, wz) + 0.03, wz, -c * 0.3, 0.5 + slip, s * 0.3, 0.5);
      }
    }
  }
}

export const MARS_GRAVITY = G_MARS;
