/* =====================================================================
   models.js  ·  Martian Map · Team Starseekers
   3D models of the traveler. Built from shapes in code and styled after
   real hardware:
     - "astronaut": an Apollo-style EVA suit (A7L look: white fabric suit, life-support
                    backpack, chest control box with hoses, gold mirror visor)
     - "rover"    : a Perseverance / Curiosity style robotic rover
                    (6 aluminum wheels with cleats, rocker-bogie legs, RTG, mast, antenna, arm)
     - "crewed"   : a NASA-concept pressurized crew rover (faceted cabin windows,
                    big black tires with gold rims, roof tanks and antenna)
   They are drawn larger than real scale so they stay visible on a 24 km map.
   Real NASA models (see models/README.txt) replace these automatically.
   Materials use physically based settings and an environment map, so metal and the
   gold visor reflect the Martian sky.
   All models face +x. y is up.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { drawOmanFlag, FLAG_RATIO } from './flag.js?v=6';

/* ---------- Fine fabric / dust bump texture (small canvas, cheap) ---------- */
let _fabric = null;
function fabricBump() {
  if (_fabric !== null) return _fabric;
  if (typeof document === 'undefined') { _fabric = undefined; return _fabric; }
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {                         // woven threads
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(i, 0, 2, 128);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, i, 128, 2);
  }
  for (let i = 0; i < 900; i++) {                            // speckle
    const v = 90 + Math.random() * 90;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  _fabric = new THREE.CanvasTexture(c);
  _fabric.wrapS = _fabric.wrapT = THREE.RepeatWrapping;
  _fabric.repeat.set(4, 4);
  return _fabric;
}

const M = (color, rough = 0.6, metal = 0.1, extra = {}) =>
  new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));

const MAT = {
  white: M('#ece9e2', 0.5, 0.05),
  suitWhite: M('#f1efe9', 0.88, 0.0, { bumpMap: fabricBump() || null, bumpScale: 0.9 }),
  suitGrey: M('#b9b8b2', 0.85, 0.0, { bumpMap: fabricBump() || null, bumpScale: 0.9 }),
  cream: M('#d8d2c4', 0.6, 0.15),
  alu: M('#b9bcc2', 0.34, 0.9),
  darkAlu: M('#6f737a', 0.42, 0.85),
  black: M('#17171a', 0.85, 0.1),
  rubber: M('#1e1e21', 0.95, 0.0),
  hose: M('#8d8d89', 0.7, 0.05),
  blanket: M('#c79a3d', 0.3, 0.75),             // gold thermal blanket
  panel: M('#16254a', 0.25, 0.6),
  orange: M('#e4622b', 0.6, 0.0),
  red: M('#c8352b', 0.6, 0.0),
  glass: M('#0a121f', 0.04, 0.95),
  gold: M('#e1b24c', 0.06, 1.0),                // mirror-gold visor
  rim: M('#d9a62a', 0.35, 0.7),
  lamp: M('#fff3c4', 0.3, 0.0, { emissive: '#ffe9a0', emissiveIntensity: 1.2 }),
  blue: M('#2a5cc0', 0.5, 0.1)
};

function mesh(geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.x = rx; m.rotation.y = ry; m.rotation.z = rz;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, mat, x, y, z, rx, ry, rz) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const cyl = (rt, rb, h, mat, x, y, z, rx, ry, rz, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz);
const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 32, 20), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
const cap = (r, len, mat, x, y, z, rx, ry, rz) => mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat, x, y, z, rx, ry, rz);
const ring = (R, r, mat, x, y, z, rx, ry, rz) => mesh(new THREE.TorusGeometry(R, r, 10, 28), mat, x, y, z, rx, ry, rz);
const HP = Math.PI / 2;

/* A smooth hose through points */
function hose(points, r, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, r, 8, false), mat);
  m.castShadow = true;
  return m;
}

/* ---------- Wheel with cleats (Perseverance style, spins around the z axis) ---------- */
function makeWheel(radius, width, cleats) {
  const spin = new THREE.Group();
  spin.add(cyl(radius, radius, width, MAT.alu, 0, 0, 0, HP, 0, 0, 36));
  spin.add(cyl(radius * 0.55, radius * 0.55, width * 1.04, MAT.darkAlu, 0, 0, 0, HP, 0, 0, 20));
  spin.add(cyl(radius * 0.2, radius * 0.2, width * 1.2, MAT.black, 0, 0, 0, HP, 0, 0, 12));
  for (let i = 0; i < cleats; i++) {
    const a = (i / cleats) * Math.PI * 2;
    spin.add(box(radius * 0.16, radius * 0.22, width * 0.96, MAT.alu, Math.cos(a) * radius, Math.sin(a) * radius, 0, 0, 0, a));
  }
  const outer = new THREE.Group();
  outer.add(spin);
  outer.userData.spin = spin;
  return outer;
}

/* ---------- Big black tire with a gold rim (crew rover) ---------- */
function makeTire(radius, width, blocks) {
  const spin = new THREE.Group();
  spin.add(cyl(radius, radius, width, MAT.rubber, 0, 0, 0, HP, 0, 0, 40));
  spin.add(cyl(radius * 0.64, radius * 0.64, width * 1.03, MAT.rim, 0, 0, 0, HP, 0, 0, 28));
  spin.add(cyl(radius * 0.5, radius * 0.5, width * 1.06, MAT.darkAlu, 0, 0, 0, HP, 0, 0, 20));
  spin.add(cyl(radius * 0.16, radius * 0.16, width * 1.12, MAT.alu, 0, 0, 0, HP, 0, 0, 10));
  for (let i = 0; i < blocks; i++) {                           // tread blocks
    const a = (i / blocks) * Math.PI * 2;
    spin.add(box(radius * 0.12, radius * 0.12, width * 0.98, MAT.black, Math.cos(a) * radius, Math.sin(a) * radius, 0, 0, 0, a));
  }
  for (let i = 0; i < 6; i++) {                                // spokes (visible through the rim face)
    const a = (i / 6) * Math.PI * 2;
    for (const s of [-1, 1]) spin.add(box(radius * 0.42, radius * 0.07, 0.02, MAT.alu, Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36, s * width * 0.53, 0, 0, a));
  }
  const outer = new THREE.Group();
  outer.add(spin);
  outer.userData.spin = spin;
  return outer;
}

/* ---------- Perseverance / Curiosity style rover ---------- */
function buildRover() {
  const g = new THREE.Group();
  const wheels = [];

  // warm electronics box and deck
  g.add(box(2.5, 0.72, 1.55, MAT.cream, 0, 1.2, 0));
  g.add(box(2.62, 0.07, 1.72, MAT.blanket, 0, 1.6, 0));
  for (const s of [-1, 1]) g.add(box(2.3, 0.5, 0.06, MAT.blanket, 0, 1.18, s * 0.79));
  g.add(box(1.3, 0.2, 0.9, MAT.white, -0.2, 1.75, 0));                       // electronics cover
  g.add(box(0.5, 0.05, 0.5, MAT.panel, 0.55, 1.67, -0.5));                   // calibration target plate
  g.add(box(0.3, 0.3, 0.4, MAT.black, 0, 0.78, 0));                          // sample caching bay (underbelly)

  // RTG power source at the back (cylinder with cooling fins)
  const rtg = new THREE.Group();
  rtg.add(cyl(0.2, 0.2, 0.95, MAT.darkAlu, 0, 0, 0, 0, 0, HP, 20));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rtg.add(box(0.85, 0.025, 0.2, MAT.black, 0, Math.sin(a) * 0.27, Math.cos(a) * 0.27, a, 0, 0));
  }
  rtg.position.set(-1.65, 1.55, 0);
  rtg.rotation.z = 0.3;
  g.add(rtg);

  // remote sensing mast with camera head
  g.add(cyl(0.05, 0.06, 1.05, MAT.alu, 0.75, 2.25, 0.5, 0, 0, 0, 12));
  g.add(box(0.28, 0.2, 0.62, MAT.white, 0.75, 2.84, 0.5));
  for (const dz of [0.14, -0.14]) {
    g.add(cyl(0.065, 0.065, 0.12, MAT.black, 0.93, 2.86, 0.5 + dz, 0, 0, HP, 14));
    g.add(cyl(0.035, 0.035, 0.13, MAT.glass, 0.95, 2.86, 0.5 + dz, 0, 0, HP, 12));
  }
  g.add(cyl(0.09, 0.09, 0.26, MAT.alu, 0.85, 2.84, 0.28, 0, 0, HP, 14));    // SuperCam style telescope
  g.add(box(0.2, 0.16, 0.16, MAT.darkAlu, 0.62, 2.84, 0.72));

  // high-gain antenna (hexagonal dish) and UHF antenna
  g.add(cyl(0.025, 0.025, 0.55, MAT.alu, -0.55, 1.95, -0.55, 0, 0, 0, 8));
  g.add(cyl(0.3, 0.3, 0.035, MAT.white, -0.55, 2.28, -0.55, 0.6, 0, 0.2, 6));
  g.add(cyl(0.02, 0.02, 0.7, MAT.alu, -1.0, 2.0, 0.55, 0, 0, -0.15, 6));

  // robotic arm folded at the front, with turret and drill
  g.add(box(0.35, 0.3, 0.45, MAT.darkAlu, 1.3, 1.1, 0.0));
  g.add(cyl(0.07, 0.07, 0.9, MAT.alu, 1.65, 1.02, 0.18, 0, 0, HP, 12));
  g.add(cyl(0.07, 0.07, 0.8, MAT.alu, 1.6, 0.86, -0.18, 0, 0, HP, 12));
  g.add(cyl(0.2, 0.2, 0.25, MAT.black, 2.12, 0.95, 0, 0, 0, HP, 20));
  g.add(cyl(0.04, 0.02, 0.35, MAT.alu, 2.32, 0.95, 0, 0, 0, HP, 8));

  // hazard cameras and lights
  for (const s of [-1, 1]) {
    g.add(box(0.1, 0.1, 0.16, MAT.black, 1.28, 1.52, s * 0.55));
    g.add(box(0.1, 0.1, 0.16, MAT.black, -1.28, 1.52, s * 0.55));
  }

  // rocker-bogie suspension and 6 wheels
  const wr = 0.34, ww = 0.4;
  for (const s of [-1, 1]) {
    const z = s * 1.0;
    g.add(box(1.55, 0.07, 0.08, MAT.alu, 0.35, 0.78, s * 0.86, 0, 0, -0.2));      // rocker
    g.add(box(1.1, 0.07, 0.08, MAT.alu, -0.85, 0.72, s * 0.86, 0, 0, 0.22));      // bogie
    g.add(box(0.07, 0.5, 0.07, MAT.darkAlu, 0.0, 1.15, s * 0.8));
    for (const x of [1.15, -0.2, -1.4]) {
      g.add(cyl(0.035, 0.035, 0.5, MAT.darkAlu, x, wr + 0.28, s * 0.86, 0, 0, 0, 8));
      const w = makeWheel(wr, ww, 18);
      w.position.set(x, wr, z);
      g.add(w);
      wheels.push(w.userData.spin);
    }
  }
  g.userData = { kind: 'rover', wheels, wheelRadius: wr };
  return g;
}

/* ---------- NASA-concept pressurized crew rover ---------- */
function buildCrewedRover() {
  const g = new THREE.Group();
  const wheels = [];

  // faceted white cabin: a side profile extruded across the width
  const prof = new THREE.Shape();
  const pts = [[-1.85, 1.1], [1.75, 1.1], [2.05, 1.5], [1.55, 2.15], [0.75, 2.72], [-1.0, 2.72], [-1.85, 2.5]];
  prof.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) prof.lineTo(pts[i][0], pts[i][1]);
  prof.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.8, steps: 1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2 });
  bodyGeo.translate(0, 0, -0.9);
  g.add(mesh(bodyGeo, MAT.white));

  // windshield on the sloped front and angular side windows
  g.add(box(0.98, 0.05, 1.5, MAT.glass, 1.21, 2.52, 0, 0, 0, -0.6));
  const sideWin = (poly, z) => {
    const sh = new THREE.Shape();
    sh.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) sh.lineTo(poly[i][0], poly[i][1]);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
    geo.translate(0, 0, z - 0.02);
    return mesh(geo, MAT.glass);
  };
  for (const s of [-1, 1]) {
    const z = s * 0.99;
    g.add(sideWin([[-0.1, 1.78], [1.0, 1.78], [1.42, 2.12], [0.85, 2.55], [-0.1, 2.55]], z));
    g.add(sideWin([[-1.35, 1.85], [-0.35, 1.85], [-0.35, 2.45], [-1.35, 2.45]], z));
    g.add(box(1.2, 0.05, 0.05, MAT.alu, 0.45, 1.74, z + s * 0.01));                // sill
    g.add(box(0.5, 0.35, 0.05, MAT.cream, -0.3, 1.38, z));                          // hatch panel
    g.add(box(0.35, 0.05, 0.3, MAT.darkAlu, 0.5, 1.12, s * 1.1));                   // step
  }
  // roof: tanks, rack, antenna dish, camera mast
  for (const s of [-1, 1]) g.add(cyl(0.2, 0.2, 1.1, MAT.alu, -0.9, 3.0, s * 0.42, 0, 0, HP, 28));
  g.add(box(1.5, 0.05, 1.3, MAT.darkAlu, -0.9, 2.78, 0));
  g.add(cyl(0.025, 0.025, 0.8, MAT.alu, -1.35, 3.1, -0.75, 0, 0, 0, 8));
  g.add(cyl(0.3, 0.06, 0.1, MAT.white, -1.35, 3.55, -0.75, 0.5, 0, 0.15, 24));
  g.add(cyl(0.04, 0.04, 0.6, MAT.alu, 0.2, 3.05, 0.55, 0, 0, 0, 10));
  g.add(box(0.2, 0.15, 0.3, MAT.black, 0.2, 3.38, 0.55));
  // lights, bumper, front tool arm, rear equipment block
  for (const s of [-1, 1]) g.add(sph(0.1, MAT.lamp, 1.95, 1.55, s * 0.55));
  g.add(box(0.25, 0.14, 1.7, MAT.darkAlu, 2.08, 1.15, 0));
  g.add(cyl(0.07, 0.07, 1.0, MAT.alu, 2.2, 1.0, 0.7, 0, 0, 0.35, 12));
  g.add(box(0.3, 0.22, 0.3, MAT.black, 2.62, 0.84, 0.7));
  g.add(box(0.5, 1.0, 1.5, MAT.darkAlu, -2.1, 1.65, 0));
  g.add(cyl(0.18, 0.18, 0.6, MAT.cream, -2.45, 1.5, 0.4, 0, 0, HP, 20));
  g.add(cyl(0.18, 0.18, 0.6, MAT.cream, -2.45, 1.5, -0.4, 0, 0, HP, 20));
  // suspension struts and 6 big tires
  const wr = 0.58, ww = 0.55;
  for (const s of [-1, 1]) {
    for (const x of [1.3, 0, -1.3]) {
      g.add(box(0.14, 0.62, 0.14, MAT.darkAlu, x, 0.82, s * 1.12));
      g.add(box(0.1, 0.1, 0.42, MAT.darkAlu, x, 0.62, s * 1.0));
      const w = makeTire(wr, ww, 22);
      w.position.set(x, wr, s * 1.38);
      g.add(w);
      wheels.push(w.userData.spin);
    }
  }
  g.scale.set(0.9, 0.9, 0.9);
  g.userData = { kind: 'rover', wheels, wheelRadius: wr * 0.9 };
  return g;
}

/* ---------- Flag of Oman (official 4:7 layout, see flag.js) ---------- */
let _flagTex = null;
function omanFlagTexture() {
  if (_flagTex) return _flagTex;
  if (typeof document === 'undefined') return null;
  const c = drawOmanFlag(document.createElement('canvas'), 896);
  _flagTex = new THREE.CanvasTexture(c);
  _flagTex.colorSpace = THREE.SRGBColorSpace;
  _flagTex.anisotropy = 8;
  return _flagTex;
}

const FLAG_W = 2.6, FLAG_H = FLAG_W / FLAG_RATIO, POLE_H = 5.4;
function buildFlag() {
  const grp = new THREE.Group();
  const pole = cyl(0.05, 0.05, POLE_H, MAT.alu, 0, POLE_H / 2, 0, 0, 0, 0, 12);
  const knob = sph(0.1, MAT.gold, 0, POLE_H + 0.05, 0);
  grp.add(pole, knob);
  const SX = 20, SY = 10;
  const geo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, SX, SY);
  const tex = omanFlagTexture();
  // The cloth glows a little by itself (emissive map), so it stays readable in shade and from any angle
  const mat = new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : '#db161b', map: tex || null,
    emissive: '#ffffff', emissiveMap: tex || null, emissiveIntensity: tex ? 0.6 : 0,
    roughness: 0.85, metalness: 0, side: THREE.DoubleSide
  });
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(FLAG_W / 2 + 0.05, POLE_H - FLAG_H / 2 - 0.15, 0);
  cloth.castShadow = false;
  grp.add(cloth);
  const pos = geo.attributes.position, base = [];
  for (let i = 0; i < pos.count; i++) base.push([pos.array[i * 3], pos.array[i * 3 + 1]]);
  grp.visible = false;
  grp.userData = { cloth, base, pole, knob, W: FLAG_W };
  return grp;
}

/* ---------- EVA astronaut (Apollo A7L look) ---------- */
function makeLimb(r, upperLen, lowerLen, matUpper, matLower, endBuilder) {
  // pivot at the top (shoulder or hip). Swings about the z axis.
  const pivot = new THREE.Group();
  pivot.add(cap(r, upperLen, matUpper, 0, -(upperLen / 2 + r * 0.4), 0));
  pivot.add(ring(r * 0.95, r * 0.3, MAT.suitGrey, 0, -(upperLen + r * 1.2), 0, HP, 0, 0));      // elbow / knee convolute
  const lower = new THREE.Group();
  lower.position.set(0, -(upperLen + r * 1.2), 0);
  lower.add(cap(r * 0.92, lowerLen, matLower, 0, -(lowerLen / 2 + r * 0.3), 0));
  const endY = -(lowerLen + r * 1.0);
  endBuilder(lower, endY);
  pivot.add(lower);
  pivot.userData.lower = lower;
  return pivot;
}

function buildAstronaut() {
  const g = new THREE.Group();
  const body = new THREE.Group();            // bobs while walking
  g.add(body);

  // torso: a smooth lathe profile (wider across the shoulders), waist ring, neck ring
  const prof = [[0.0, -0.66], [0.34, -0.66], [0.42, -0.5], [0.45, -0.2], [0.49, 0.15], [0.48, 0.38], [0.38, 0.55], [0.24, 0.62], [0.0, 0.64]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const torso = mesh(new THREE.LatheGeometry(prof, 36), MAT.suitWhite, 0, 2.05, 0);
  torso.scale.set(0.95, 1, 1.22);
  body.add(torso);
  body.add(ring(0.42, 0.08, MAT.suitGrey, 0, 1.43, 0, HP, 0, 0));
  body.add(ring(0.3, 0.07, MAT.darkAlu, 0, 2.66, 0, HP, 0, 0));

  // chest control box (RCU) with connectors, patches and hoses
  body.add(box(0.2, 0.34, 0.5, M('#d7d6d0', 0.55, 0.1), 0.5, 2.2, 0));
  body.add(box(0.21, 0.1, 0.4, MAT.darkAlu, 0.5, 2.32, 0));
  body.add(box(0.03, 0.12, 0.28, M('#2b7bd0', 0.3, 0.2, { emissive: '#14407a', emissiveIntensity: 0.9 }), 0.605, 2.14, 0));
  for (const [dz, mat] of [[0.17, MAT.blue], [0.0, MAT.red], [-0.17, MAT.orange]]) body.add(cyl(0.035, 0.035, 0.07, mat, 0.5, 2.4, dz, 0, 0, 0, 12));
  for (const s of [-1, 1]) {
    body.add(hose([[0.5, 2.3, s * 0.2], [0.42, 2.0, s * 0.5], [0.15, 1.72, s * 0.62], [-0.3, 1.7, s * 0.55]], 0.032, MAT.hose));
    body.add(hose([[0.5, 2.15, s * 0.12], [0.46, 1.9, s * 0.42], [0.2, 1.62, s * 0.5]], 0.028, MAT.hose));
    body.add(cyl(0.05, 0.05, 0.1, MAT.alu, 0.2, 1.62, s * 0.5, 0, 0, HP, 12));
  }

  // life-support backpack (PLSS) with antenna
  body.add(box(0.6, 1.05, 0.9, MAT.suitWhite, -0.63, 2.12, 0));
  body.add(box(0.5, 0.3, 0.8, MAT.white, -0.62, 2.78, 0));
  body.add(box(0.66, 0.08, 0.95, MAT.suitGrey, -0.63, 1.58, 0));
  body.add(box(0.12, 0.7, 0.55, MAT.cream, -0.96, 2.1, 0));
  for (const s of [-1, 1]) body.add(cyl(0.06, 0.06, 0.4, MAT.alu, -0.9, 1.62, s * 0.3, 0, 0, 0, 12));
  body.add(cyl(0.015, 0.015, 0.8, MAT.alu, -0.8, 3.25, 0.32, 0, 0, 0, 8));
  body.add(sph(0.045, M('#ff5030', 0.3, 0, { emissive: '#ff3010', emissiveIntensity: 1.4 }), -0.8, 3.66, 0.32));

  // helmet: white shell, polycarbonate dome, gold mirror visor, side bezels
  body.add(sph(0.51, MAT.white, 0.0, 3.1, 0, 1.0, 1.03, 1.0));
  const visorGeo = new THREE.SphereGeometry(0.545, 40, 24, Math.PI - 1.05, 2.1, 1.0, 1.25);
  const visor = mesh(visorGeo, MAT.gold, 0.0, 3.1, 0);
  visor.castShadow = false;
  body.add(visor);
  body.add(ring(0.5, 0.045, MAT.darkAlu, 0, 3.1 - 0.12, 0, HP, 0, 0));            // neck dam / seal
  for (const s of [-1, 1]) {
    body.add(box(0.14, 0.26, 0.1, MAT.suitGrey, 0.05, 3.1, s * 0.52));              // side bezel
    body.add(box(0.2, 0.06, 0.12, MAT.darkAlu, 0.38, 3.45, s * 0.2));               // brow clip
  }

  // arms: soft sleeves with convolutes, gloves (white palm, grey fingertips) and cuff rings
  const gloves = (limb, y) => {
    limb.add(ring(0.17, 0.055, M('#5aa0e0', 0.35, 0.6), 0, y + 0.25, 0, HP, 0, 0));    // wrist disconnect ring
    limb.add(sph(0.2, MAT.suitWhite, 0, y, 0, 1, 1.15, 1));
    limb.add(cap(0.065, 0.14, MAT.suitGrey, 0.1, y - 0.2, 0.04, 0, 0, 0.1));
    limb.add(cap(0.065, 0.14, MAT.suitGrey, 0.04, y - 0.22, -0.06, 0, 0, 0.0));
    limb.add(cap(0.06, 0.12, MAT.suitGrey, -0.05, y - 0.2, 0.0, 0, 0, -0.1));
    limb.add(cap(0.06, 0.12, MAT.suitWhite, 0.17, y + 0.02, 0.04, 0, 0, -0.9));          // thumb
  };
  const armL = makeLimb(0.17, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, gloves);
  const armR = makeLimb(0.17, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, gloves);
  armL.position.set(0, 2.55, 0.64); armR.position.set(0, 2.55, -0.64);
  body.add(armL, armR);
  // Oman flag patch on the shoulder (the astronaut's left)
  const patchTex = omanFlagTexture();
  if (patchTex) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3 / FLAG_RATIO), new THREE.MeshStandardMaterial({ map: patchTex, roughness: 0.9 }));
    patch.position.set(0.02, -0.2, -0.19);
    patch.rotation.y = Math.PI;
    armR.add(patch);
  }

  // legs (pivot at hips; they stay outside the bobbing body group)
  const boots = (limb, y) => {
    limb.add(ring(0.2, 0.05, MAT.suitGrey, 0, y + 0.26, 0, HP, 0, 0));
    limb.add(cap(0.19, 0.38, MAT.suitGrey, 0.14, y - 0.06, 0, 0, 0, HP));              // lunar-boot overshoe
    limb.add(box(0.78, 0.09, 0.4, MAT.rubber, 0.14, y - 0.24, 0));                      // ribbed sole
    for (let i = 0; i < 5; i++) limb.add(box(0.03, 0.03, 0.42, MAT.black, -0.16 + i * 0.15, y - 0.3, 0));
  };
  const legL = makeLimb(0.22, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, boots);
  const legR = makeLimb(0.22, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, boots);
  legL.position.set(0, 1.4, 0.27); legR.position.set(0, 1.4, -0.27);
  g.add(legL, legR);

  const flag = buildFlag();
  flag.position.set(0.3, 0, -1.9);
  g.add(flag);
  g.scale.set(0.82, 0.82, 0.82);
  g.userData = { kind: 'astronaut', body, armL, armR, legL, legR, flag };
  return g;
}

/* ---------- Environment map (Martian sky) so metal and the gold visor reflect it ---------- */
export function makeMarsEnv(renderer) {
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const geo = new THREE.SphereGeometry(50, 32, 16);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const top = new THREE.Color('#9d6e58'), hor = new THREE.Color('#f0c39c'), low = new THREE.Color('#6b4128');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 50;
      if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(low, Math.min(1, -y * 3));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(30) }));
    sunDisc.position.set(-26, 26, 20);
    sc.add(sunDisc);
    const tex = pm.fromScene(sc, 0.03).texture;
    pm.dispose();
    return tex;
  } catch (e) { console.warn('Environment map not available', e); return null; }
}

/* Give a model its own materials (so two renderers never share one) and attach the sky reflection */
export function applyModelEnv(root, envTex, intensity = 1) {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const fix = m => {
      if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return m;
      const k = m.clone();
      if (envTex) { k.envMap = envTex; k.envMapIntensity = (m.metalness > 0.5 ? 1.2 : 0.55) * intensity; }
      return k;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    o.receiveShadow = true;
  });
}

/* ---------- Optional real models (NASA 3D resources, glTF/GLB) ---------- */
const overrides = {};

export async function loadOptionalModels(base = 'models/') {
  try {
    const r = await fetch(base + 'models.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const cfg = await r.json();
    const loaded = [];
    for (const key of ['astronaut', 'rover', 'crewed']) {
      const c = cfg[key];
      if (!c || !c.file) continue;
      try {
        const gltf = await new GLTFLoader().loadAsync(base + c.file);
        const root = gltf.scene;
        root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        const wrap = new THREE.Group();
        const inner = new THREE.Group();
        inner.add(root);
        inner.rotation.y = ((c.rotYDeg || 0) * Math.PI) / 180;
        wrap.add(inner);
        const bb = new THREE.Box3().setFromObject(wrap);
        const size = new THREE.Vector3(); bb.getSize(size);
        const k = (c.targetLength || 3.2) / (Math.max(size.x, size.z) || 1);
        wrap.scale.set(k, k, k);
        const bb2 = new THREE.Box3().setFromObject(wrap);
        wrap.position.y -= bb2.min.y;                 // stand on the ground
        const holder = new THREE.Group();
        holder.add(wrap);
        holder.userData = { kind: 'static' };
        overrides[key] = holder;
        loaded.push(key);
      } catch (err) { console.warn('Could not load model', key, err); }
    }
    return loaded;
  } catch (e) { return []; }
}

export function buildTravelerModel(kind) {
  if (overrides[kind]) return overrides[kind].clone(true);
  if (kind === 'rover') return buildRover();
  if (kind === 'crewed') return buildCrewedRover();
  return buildAstronaut();
}

/* ---------- Animation: walking astronaut, spinning wheels ---------- */
export function animateModel(model, tSec, dt, moving) {
  if (!model || !model.userData) return;
  const u = model.userData;
  if (u.kind === 'astronaut') {
    const w = moving ? Math.sin(tSec * 5.5) : 0, amp = 0.55;
    u.legL.rotation.z = w * amp; u.legR.rotation.z = -w * amp;
    u.legL.userData.lower && (u.legL.userData.lower.rotation.z = moving ? Math.max(0, -w) * 0.7 : 0);
    u.legR.userData.lower && (u.legR.userData.lower.rotation.z = moving ? Math.max(0, w) * 0.7 : 0);
    u.armL.rotation.z = -w * 0.45; u.armR.rotation.z = w * 0.45;
    u.body.position.y = moving ? Math.abs(Math.sin(tSec * 5.5)) * 0.08 : 0;
  } else if (u.kind === 'rover' && moving) {
    for (const s of u.wheels) s.rotation.z -= dt * 3.0 / (u.wheelRadius || 0.4);
  }
}

/* ---------- Arrival celebrations (astronaut only) ----------
   Every mode ends when the person presses Play again or changes the vehicle.
   The astronaut turns to face the camera. Joint angles for the salute were solved
   numerically so the glove ends up at the visor (see the note in the project). */
export const CELEBRATIONS = [
  { id: 'flag', label: 'Raise the flag of Oman 🇴🇲' },
  { id: 'flagsalute', label: 'Flag + military salute 🎖️' },
  { id: 'salute', label: 'Military salute 🎖️' },
  { id: 'wave', label: 'Wave hello 👋' },
  { id: 'jump', label: 'Mars-gravity jumps 🦘' },
  { id: 'dance', label: 'Spin dance 🕺' },
  { id: 'robot', label: 'Robot dance 🤖' },
  { id: 'mix', label: 'Dance mix 🎉' }
];
export const CELEBRATION_TEXT = {
  flag: 'Raising the flag of Oman 🇴🇲',
  flagsalute: 'Raising the flag of Oman and saluting 🎖️',
  salute: 'The astronaut salutes 🎖️',
  wave: 'The astronaut waves hello 👋',
  jump: 'Jumping in Mars gravity 🦘',
  dance: 'Spin dance 🕺',
  robot: 'Robot dance 🤖',
  mix: 'Dance mix 🎉'
};

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const _v = typeof THREE.Vector3 === 'function' ? new THREE.Vector3() : null;

function restPose(model, u) {
  for (const a of [u.armL, u.armR]) { a.rotation.set(0, 0, 0); a.userData.lower && a.userData.lower.rotation.set(0, 0, 0); }
  for (const l of [u.legL, u.legR]) { l.rotation.set(0, 0, 0); l.userData.lower && l.userData.lower.rotation.set(0, 0, 0); }
  u.body.position.set(0, 0, 0);
  u.body.rotation.set(0, 0, 0);
  model.position.y = 0;
}

/* The salute: hand to the visor. Mirror image for the arm on the +z side. */
function salute(u, k) {
  const a = u.armL, low = a.userData.lower;
  a.rotation.set(-0.05 * k, 0, 1.65 * k);
  low.rotation.set(1.45 * k, 0, 1.15 * k);
  u.armR.rotation.z = -0.12 * k;
}
function cheerArms(u, k, t) {
  u.armR.rotation.z = k * (2.7 + Math.sin(t * 5) * 0.25);
  u.armL.rotation.z = k * (2.5 - Math.sin(t * 5) * 0.25);
}

function flagPose(u, tt, camLocalFn) {
  const f = u.flag, rise = sm(tt / 3.0);
  f.visible = true;
  const k = Math.max(rise, 0.001);                          // the pole grows out of the ground, the cloth climbs it
  f.userData.pole.scale.y = k; f.userData.pole.position.y = POLE_H * k / 2;
  f.userData.knob.position.y = POLE_H * k + 0.05;
  const cloth = f.userData.cloth, pos = cloth.geometry.attributes.position, base = f.userData.base, W = f.userData.W;
  cloth.position.y = FLAG_H / 2 + 0.1 + (POLE_H - FLAG_H - 0.25) * rise;
  for (let i = 0; i < base.length; i++) {
    const x = base[i][0] + W / 2;                            // 0 at the pole, W at the free end
    pos.setXYZ(i, base[i][0], base[i][1], Math.sin(x * 4 - tt * 6) * 0.1 * (x / W) + Math.sin(base[i][1] * 3 + tt * 4) * 0.02 * (x / W));
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
  // the cloth always turns its face to the camera
  if (camLocalFn) {
    const c = camLocalFn(f.parent);
    if (c) f.rotation.y = Math.atan2(c.x - f.position.x, c.z - f.position.z);
  }
  return rise;
}

export function celebrateModel(model, tt, mode, camWorld) {
  const u = model && model.userData;
  if (!u || u.kind !== 'astronaut') return false;
  restPose(model, u);
  u.flag.visible = false;
  const camLocal = parent => {
    if (!camWorld || !parent || !_v) return null;
    _v.copy(camWorld);
    return parent.worldToLocal(_v);
  };

  // turn to face the camera (the dance mode spins instead)
  if (u.celebYaw0 === undefined) u.celebYaw0 = model.rotation.y;
  const c = camLocal(model.parent);
  const target = c ? Math.atan2(-c.z, c.x) : 0;
  const face = u.celebYaw0 + angDiff(u.celebYaw0, target) * sm(tt / 1.0);

  let m = mode;
  let lt = tt;
  if (m === 'mix') { const seq = ['dance', 'robot', 'jump', 'wave']; const k = Math.floor(tt / 3.2); m = seq[k % seq.length]; lt = tt - k * 3.2; }

  if (m === 'dance') {
    const beat = tt * 7;
    model.rotation.y = tt * 2.2;
    u.body.position.y = Math.abs(Math.sin(beat)) * 0.28;
    u.legL.rotation.z = Math.sin(beat) * 0.7; u.legR.rotation.z = -Math.sin(beat) * 0.7;
    u.armL.rotation.z = 2.5 + Math.sin(beat * 2) * 0.5; u.armR.rotation.z = 2.5 - Math.sin(beat * 2) * 0.5;
    return true;
  }
  model.rotation.y = face;

  if (m === 'robot') {
    const poses = [[1.57, 1.57, 0, 0], [0, 0, 1.57, 1.57], [2.8, 0, 2.8, 0], [1.2, -1.6, 1.2, -1.6], [0, 0, 2.8, -0.3], [2.8, -0.3, 0, 0]];
    const i = Math.floor(lt / 0.45) % poses.length, p = poses[i];
    u.armL.rotation.z = p[0]; u.armL.userData.lower.rotation.z = p[1];
    u.armR.rotation.z = p[2]; u.armR.userData.lower.rotation.z = p[3];
    u.body.rotation.y = (i % 2 ? 0.5 : -0.5);
    u.legL.rotation.z = (i % 2 ? 0.25 : -0.05); u.legR.rotation.z = (i % 2 ? -0.05 : 0.25);
    return true;
  }
  if (m === 'jump') {
    const T = 1.7, ph = (lt % T) / T, h = 2.2 * 4 * ph * (1 - ph);          // slow, high jumps: Mars gravity is about 0.38 g
    model.position.y = h;
    const air = Math.min(1, h * 3);
    cheerArms(u, 0.3 + 0.7 * air, tt);
    u.legL.rotation.z = 0.5 * air; u.legR.rotation.z = -0.3 * air;
    u.legL.userData.lower.rotation.z = 0.9 * air; u.legR.userData.lower.rotation.z = 0.6 * air;
    u.body.position.y = ph < 0.08 || ph > 0.92 ? -0.12 : 0;                  // little squat on landing
    return true;
  }
  if (m === 'wave') {
    const k = sm(lt / 0.7);
    const a = u.armL;                                                        // the +z arm, mirrored
    a.rotation.set(-2.45 * k, 0, 0);
    a.userData.lower.rotation.set(k * 0.55 * Math.sin(lt * 9), 0, 0.2 * k);
    u.body.position.y = Math.abs(Math.sin(lt * 4)) * 0.05;
    u.body.rotation.z = Math.sin(lt * 3) * 0.04;
    return true;
  }
  if (m === 'salute' || m === 'flagsalute') {
    const k = sm((tt - 0.5) / 0.8);
    salute(u, k);
    if (m === 'flagsalute') flagPose(u, tt, camLocal);
    return true;
  }
  // 'flag' (default): the astronaut cheers while the flag climbs the pole
  const rise = flagPose(u, tt, camLocal);
  const cheer = sm((tt - 0.3) / 1.2);
  cheerArms(u, cheer, tt);
  u.body.position.y = rise < 1 ? 0 : Math.abs(Math.sin(tt * 6)) * 0.07;
  return true;
}

export function resetCelebration(model) {
  const u = model && model.userData;
  if (!u || u.kind !== 'astronaut') return;
  restPose(model, u);
  model.rotation.y = 0;
  u.celebYaw0 = undefined;
  u.flag.visible = false;
  u.flag.userData.pole.scale.y = 1; u.flag.userData.pole.position.y = POLE_H / 2;
  u.flag.userData.knob.position.y = POLE_H + 0.05;
  u.flag.rotation.y = 0;
}
