// Self-intersection check for the SINBAD suit: every body part is a capsule; we play the walk cycle
// and every celebration frame by frame and report any two parts that pass into each other,
// and any foot that sinks into or floats above the ground. Open tools/selfcheck.html on the dev server.
import * as THREE from 'three';
import { buildTravelerModel, celebrateModel, resetCelebration, __test } from '../models.js?v=7';

const model = buildTravelerModel('astronaut');
model.scale.set(1, 1, 1);
const u = model.userData;
const SKIP = new Set([
  'torsoA|torsoB', 'packA|packB', 'helmet|torsoA', 'helmet|torsoB', 'packA|torsoA', 'packA|torsoB', 'packB|torsoA', 'packB|torsoB',
  'helmet|packA', 'helmet|packB', 'hips|torsoA', 'hips|torsoB',
  'farmR|uarmR', 'farmL|uarmL', 'farmR|handR', 'farmL|handL', 'handR|khanjar', 'handR|saif', 'khanjar|saif',
  'hips|thighR', 'hips|thighL', 'shinR|thighR', 'shinL|thighL', 'bootR|shinR', 'bootL|shinL'
]);
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
function segDist(p1, q1, p2, q2) {                       // closest distance between two segments
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a < 1e-9 && e < 1e-9) return p1.distanceTo(p2);
  if (a < 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.dot(r);
    if (e < 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
function frame() {
  model.updateMatrixWorld(true);
  const caps = u.colliders.filter(c => c.obj.visible !== false && isShown(c.obj)).map(c => ({ n: c.name, a: c.a.clone().applyMatrix4(c.obj.matrixWorld), b: c.b.clone().applyMatrix4(c.obj.matrixWorld), r: c.r }));
  const hits = [];
  for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
    const A = caps[i], B = caps[j];
    if (SKIP.has(key(A.n, B.n))) continue;
    const pen = A.r + B.r - segDist(A.a, A.b, B.a, B.b);
    if (pen > 0.012) hits.push([key(A.n, B.n), pen]);
  }
  const boots = caps.filter(c => c.n.startsWith('boot')).map(c => Math.min(c.a.y, c.b.y) - c.r);
  return { hits, footMin: Math.min(...boots) };
}
function isShown(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; }
const cam = new THREE.Vector3(15, 4, 3);
const report = {};
function test(name, fn, T, dt = 1 / 30, grounded = true) {
  const worst = {}; let sink = 0, float = 0;
  for (let t = 0; t <= T; t += dt) {
    fn(t);
    const f = frame();
    for (const [k, p] of f.hits) if (!worst[k] || worst[k][0] < p) worst[k] = [+p.toFixed(3), +t.toFixed(2)];
    sink = Math.max(sink, -f.footMin - 0.0);
    if (grounded) float = Math.max(float, f.footMin);
  }
  report[name] = { hits: worst, sink: +sink.toFixed(3), float: +float.toFixed(3) };
}
export function runAll() {
  for (const k of [0, 0.5, 1]) test('walk k=' + k, t => u.pose(__test.gaitPose(t * Math.PI * 2, k, { lean: -0.1 * k, lift: 0 })), 2);
  for (const m of ['omani', 'baraa', 'razha', 'flagsalute', 'flag', 'wave', 'jump']) {
    resetCelebration(model);
    test(m, t => celebrateModel(model, t, m, cam), m === 'omani' ? 46 : 12, 1 / 30, m !== 'jump');
  }
  return report;
}
// salute solver: glove centre at the visor brow (front-right), no collisions
export function evalPose(P) { u.pose(P); return frame(); }
export function solveSalute(iter = 6000, lim = { abd: [0.5, 1.6], flex: [0.1, 2.0] }, tgt = [0.3, 3.32, 0.64]) {
  const target = new THREE.Vector3(...tgt);
  const hand = u.colliders.find(c => c.name === 'handR');
  let best = null, bestS = Infinity;
  const cur = Object.assign({}, __test.SALUTE);
  const score = P => {
    u.pose({ armR: P }); const f = frame();
    model.updateMatrixWorld(true);
    const hp = hand.a.clone().applyMatrix4(hand.obj.matrixWorld);
    return hp.distanceTo(target) + 3 * f.hits.reduce((s, h) => s + h[1], 0);
  };
  for (const k in lim) cur[k] = Math.min(lim[k][1], Math.max(lim[k][0], cur[k] ?? 0));
  let x = cur, sx = score(x), step = 0.5;
  for (let i = 0; i < iter; i++) {
    const y = {}; for (const k of ['flex', 'abd', 'twist', 'elbow', 'wrist']) { y[k] = (x[k] ?? 0) + (Math.random() - 0.5) * step; if (lim[k]) y[k] = Math.min(lim[k][1], Math.max(lim[k][0], y[k])); }
    const sy = score(y);
    if (sy < sx) { x = y; sx = sy; }
    if (i % 1000 === 999) step *= 0.5;
  }
  return { pose: x, score: sx };
}
window.__selfcheck = { runAll, solveSalute, evalPose };
document.getElementById('out').textContent = 'ready';
