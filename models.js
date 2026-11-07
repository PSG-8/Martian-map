/* =====================================================================
   models.js  ·  Martian Map · Team Starseekers
   3D models of the traveler. Built from basic shapes in code, styled after
   real hardware:
     - "rover"   : a Perseverance / Curiosity style robotic rover
                   (6 aluminum wheels with cleats, rocker-bogie legs, RTG at the back,
                   mast camera head, high-gain antenna, robotic arm)
     - "crewed"  : a concept pressurized crew rover (cabin, solar roof, 6 wheels)
     - "astronaut": an EVA suit (hard torso, life-support backpack, gold visor, jointed limbs)
   They are drawn larger than real scale so they stay visible on a 24 km map.
   If you add real NASA models (see models/README.txt) they replace these automatically.
   All models face +x. y is up.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const M = (color, rough = 0.6, metal = 0.1, extra = {}) =>
  new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));

const MAT = {
  white: M('#efede8', 0.55, 0.05),
  suitWhite: M('#f4f2ee', 0.8, 0.0),
  cream: M('#d8d2c4', 0.6, 0.15),
  alu: M('#b9bcc2', 0.38, 0.85),
  darkAlu: M('#6f737a', 0.45, 0.8),
  black: M('#17171a', 0.85, 0.1),
  rubber: M('#222226', 0.95, 0.0),
  blanket: M('#c79a3d', 0.35, 0.7),            // gold thermal blanket
  panel: M('#16254a', 0.3, 0.6),
  orange: M('#e4622b', 0.6, 0.0),
  red: M('#c8352b', 0.6, 0.0),
  glass: M('#0b1424', 0.06, 0.95),
  gold: M('#d9a83a', 0.12, 0.95),
  lamp: M('#fff3c4', 0.3, 0.0, { emissive: '#ffe9a0', emissiveIntensity: 1.2 }),
  blue: M('#2a5cc0', 0.5, 0.1)
};

function mesh(geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.x = rx; m.rotation.y = ry; m.rotation.z = rz;
  m.castShadow = true;
  return m;
}
const box = (w, h, d, mat, x, y, z, rx, ry, rz) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const cyl = (rt, rb, h, mat, x, y, z, rx, ry, rz, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz);
const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
const cap = (r, len, mat, x, y, z, rx, ry, rz) => mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat, x, y, z, rx, ry, rz);
const ring = (R, r, mat, x, y, z, rx, ry, rz) => mesh(new THREE.TorusGeometry(R, r, 8, 20), mat, x, y, z, rx, ry, rz);
const HP = Math.PI / 2;

/* ---------- Wheel with cleats (spins around the z axis) ---------- */
function makeWheel(radius, width, cleats) {
  const spin = new THREE.Group();
  spin.add(cyl(radius, radius, width, MAT.alu, 0, 0, 0, HP, 0, 0, 28));
  spin.add(cyl(radius * 0.55, radius * 0.55, width * 1.04, MAT.darkAlu, 0, 0, 0, HP, 0, 0, 16));
  spin.add(cyl(radius * 0.2, radius * 0.2, width * 1.2, MAT.black, 0, 0, 0, HP, 0, 0, 10));
  for (let i = 0; i < cleats; i++) {
    const a = (i / cleats) * Math.PI * 2;
    spin.add(box(radius * 0.16, radius * 0.22, width * 0.96, MAT.alu, Math.cos(a) * radius, Math.sin(a) * radius, 0, 0, 0, a));
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
  rtg.add(cyl(0.2, 0.2, 0.95, MAT.darkAlu, 0, 0, 0, 0, 0, HP, 16));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rtg.add(box(0.85, 0.025, 0.2, MAT.black, 0, Math.sin(a) * 0.27, Math.cos(a) * 0.27, a, 0, 0));
  }
  rtg.position.set(-1.65, 1.55, 0);
  rtg.rotation.z = 0.3;
  g.add(rtg);

  // remote sensing mast with camera head
  g.add(cyl(0.05, 0.06, 1.05, MAT.alu, 0.75, 2.25, 0.5, 0, 0, 0, 10));
  g.add(box(0.28, 0.2, 0.62, MAT.white, 0.75, 2.84, 0.5));
  for (const dz of [0.14, -0.14]) {
    g.add(cyl(0.065, 0.065, 0.12, MAT.black, 0.93, 2.86, 0.5 + dz, 0, 0, HP, 12));
    g.add(cyl(0.035, 0.035, 0.13, MAT.glass, 0.95, 2.86, 0.5 + dz, 0, 0, HP, 10));
  }
  g.add(cyl(0.09, 0.09, 0.26, MAT.alu, 0.85, 2.84, 0.28, 0, 0, HP, 12));    // SuperCam style telescope
  g.add(box(0.2, 0.16, 0.16, MAT.darkAlu, 0.62, 2.84, 0.72));

  // high-gain antenna (hexagonal dish) and UHF antenna
  g.add(cyl(0.025, 0.025, 0.55, MAT.alu, -0.55, 1.95, -0.55, 0, 0, 0, 8));
  g.add(cyl(0.3, 0.3, 0.035, MAT.white, -0.55, 2.28, -0.55, 0.6, 0, 0.2, 6));
  g.add(cyl(0.02, 0.02, 0.7, MAT.alu, -1.0, 2.0, 0.55, 0, 0, -0.15, 6));

  // robotic arm folded at the front, with turret and drill
  g.add(box(0.35, 0.3, 0.45, MAT.darkAlu, 1.3, 1.1, 0.0));
  g.add(cyl(0.07, 0.07, 0.9, MAT.alu, 1.65, 1.02, 0.18, 0, 0, HP, 10));
  g.add(cyl(0.07, 0.07, 0.8, MAT.alu, 1.6, 0.86, -0.18, 0, 0, HP, 10));
  g.add(cyl(0.2, 0.2, 0.25, MAT.black, 2.12, 0.95, 0, 0, 0, HP, 16));
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

/* ---------- Concept pressurized crew rover ---------- */
function buildCrewedRover() {
  const g = new THREE.Group();
  const wheels = [];
  g.add(box(3.4, 0.35, 2.0, MAT.darkAlu, 0, 0.95, 0));                       // chassis
  g.add(box(3.0, 1.15, 1.85, MAT.white, -0.1, 1.72, 0));                     // pressurized cabin
  g.add(box(0.9, 0.9, 1.6, MAT.white, 1.45, 1.6, 0, 0, 0, -0.4));            // sloped nose
  g.add(box(0.7, 0.55, 1.5, MAT.glass, 1.62, 1.82, 0, 0, 0, -0.62));         // windshield
  for (const s of [-1, 1]) g.add(box(1.2, 0.4, 0.04, MAT.glass, 0.25, 1.95, s * 0.94));
  g.add(box(0.06, 1.2, 0.06, MAT.alu, -1.65, 1.8, 0.75));
  // solar roof
  for (const s of [-1, 1]) {
    g.add(box(2.4, 0.05, 0.95, MAT.panel, -0.2, 2.5, s * 0.5));
    g.add(box(0.05, 0.35, 0.05, MAT.alu, -0.9, 2.3, s * 0.5));
    g.add(box(0.05, 0.35, 0.05, MAT.alu, 0.5, 2.3, s * 0.5));
  }
  g.add(box(2.4, 0.06, 0.06, MAT.alu, -0.2, 2.53, 0));
  // radiators, antenna, suit-port hatch, lights
  g.add(box(1.4, 0.5, 0.05, MAT.cream, -0.3, 1.5, 0.95));
  g.add(box(1.4, 0.5, 0.05, MAT.cream, -0.3, 1.5, -0.95));
  g.add(cyl(0.3, 0.3, 0.06, MAT.cream, -1.52, 1.7, 0, 0, 0, HP, 20));
  g.add(cyl(0.02, 0.02, 0.9, MAT.alu, -1.2, 3.0, -0.8, 0, 0, 0, 6));
  g.add(cyl(0.26, 0.26, 0.03, MAT.white, -1.2, 3.45, -0.8, 0.5, 0, 0.1, 18));
  for (const s of [-1, 1]) g.add(sph(0.09, MAT.lamp, 2.0, 1.45, s * 0.6));
  g.add(cyl(0.05, 0.05, 0.7, MAT.alu, 1.0, 2.65, 0.65, 0, 0, 0, 8));
  g.add(box(0.2, 0.16, 0.34, MAT.black, 1.0, 3.05, 0.65));
  // front arm
  g.add(cyl(0.08, 0.08, 0.9, MAT.alu, 1.95, 0.9, 0.45, 0, 0, 0.3, 10));
  g.add(box(0.25, 0.2, 0.3, MAT.black, 2.35, 0.78, 0.45));
  // wheels with cleats on short struts
  const wr = 0.52, ww = 0.5;
  for (const s of [-1, 1]) {
    for (const x of [1.2, 0, -1.2]) {
      g.add(box(0.12, 0.5, 0.12, MAT.darkAlu, x, 0.75, s * 1.1));
      const w = makeWheel(wr, ww, 20);
      w.position.set(x, wr, s * 1.32);
      g.add(w);
      wheels.push(w.userData.spin);
    }
  }
  g.scale.set(0.95, 0.95, 0.95);
  g.userData = { kind: 'rover', wheels, wheelRadius: wr * 0.95 };
  return g;
}

/* ---------- EVA astronaut ---------- */
function makeLimb(r, upperLen, lowerLen, matUpper, matLower, endBuilder) {
  // pivot at the top (shoulder or hip). Swings about the z axis.
  const pivot = new THREE.Group();
  pivot.add(cap(r, upperLen, matUpper, 0, -(upperLen / 2 + r * 0.4), 0));
  pivot.add(ring(r * 0.92, r * 0.28, MAT.darkAlu, 0, -(upperLen + r * 1.2), 0, HP, 0, 0));
  const lower = new THREE.Group();
  lower.position.set(0, -(upperLen + r * 1.2), 0);
  lower.add(cap(r * 0.92, lowerLen, matLower, 0, -(lowerLen / 2 + r * 0.3), 0));
  const endY = -(lowerLen + r * 1.0);
  endBuilder(lower, endY);
  pivot.add(lower);
  pivot.userData.lower = lower;
  return pivot;
}

/* ---------- Flag of Oman (simplified) for the arrival celebration ---------- */
function omanFlagTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 600; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 600, 134);          // white stripe (top)
  g.fillStyle = '#db161b'; g.fillRect(0, 133, 600, 134);        // red stripe (middle)
  g.fillStyle = '#008000'; g.fillRect(0, 266, 600, 134);        // green stripe (bottom)
  g.fillStyle = '#db161b'; g.fillRect(0, 0, 150, 400);          // red band at the pole side
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineCap = 'round';
  g.lineWidth = 7;                                              // simplified emblem: crossed swords and a curved dagger
  g.beginPath(); g.moveTo(32, 28); g.lineTo(118, 112); g.moveTo(118, 28); g.lineTo(32, 112); g.stroke();
  g.lineWidth = 6;
  g.beginPath(); g.arc(75, 86, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.beginPath(); g.arc(75, 68, 7, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFlag() {
  const grp = new THREE.Group();
  grp.add(cyl(0.045, 0.045, 4.2, MAT.alu, 0, 2.1, 0, 0, 0, 0, 10));
  grp.add(sph(0.09, MAT.gold, 0, 4.25, 0));
  const W = 1.7, H = 1.1, SX = 16, SY = 8;
  const geo = new THREE.PlaneGeometry(W, H, SX, SY);
  const tex = omanFlagTexture();
  const mat = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : '#db161b', map: tex, roughness: 0.9, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(W / 2 + 0.05, 3.55, 0);
  cloth.castShadow = true;
  grp.add(cloth);
  const pos = geo.attributes.position, base = [];
  for (let i = 0; i < pos.count; i++) base.push([pos.array[i * 3], pos.array[i * 3 + 1]]);
  grp.visible = false;
  grp.userData = { cloth, base, W };
  return grp;
}

function buildAstronaut() {
  const g = new THREE.Group();
  const body = new THREE.Group();            // bobs while walking
  g.add(body);

  // torso, waist ring, chest display unit
  body.add(cap(0.42, 0.55, MAT.suitWhite, 0, 2.05, 0));
  body.add(ring(0.45, 0.07, MAT.darkAlu, 0, 1.45, 0, HP, 0, 0));
  body.add(box(0.2, 0.34, 0.5, MAT.black, 0.42, 2.12, 0));
  body.add(box(0.03, 0.2, 0.34, M('#2b7bd0', 0.3, 0.2, { emissive: '#14407a', emissiveIntensity: 0.8 }), 0.52, 2.12, 0));
  body.add(cyl(0.07, 0.07, 0.04, MAT.red, 0.42, 2.38, 0.2, 0, 0, HP, 14));     // patch
  body.add(cyl(0.07, 0.07, 0.04, MAT.blue, 0.42, 2.38, -0.2, 0, 0, HP, 14));
  body.add(cyl(0.035, 0.035, 0.18, MAT.alu, 0.38, 1.85, 0.3, 0, 0, 0.2, 8));   // oxygen port
  // life-support backpack
  body.add(box(0.55, 1.05, 0.85, MAT.suitWhite, -0.6, 2.1, 0));
  body.add(box(0.58, 0.12, 0.88, MAT.darkAlu, -0.6, 2.68, 0));
  body.add(box(0.3, 0.5, 0.5, MAT.cream, -0.93, 2.0, 0));
  for (const s of [-1, 1]) {
    body.add(cyl(0.07, 0.07, 0.35, MAT.alu, -0.6, 1.5, s * 0.25, 0, 0, 0, 10));
    body.add(box(0.04, 0.8, 0.12, MAT.orange, -0.33, 2.1, s * 0.3));
  }
  body.add(cyl(0.015, 0.015, 0.7, MAT.alu, -0.8, 3.1, 0.3, 0, 0, 0, 6));        // antenna
  body.add(sph(0.05, M('#ff5030', 0.3, 0, { emissive: '#ff3010', emissiveIntensity: 1.4 }), -0.8, 3.46, 0.3));
  body.add(cyl(0.03, 0.03, 0.4, MAT.black, 0.1, 2.3, 0.45, 0, 0, HP, 8));       // hoses
  body.add(cyl(0.03, 0.03, 0.4, MAT.black, 0.1, 2.3, -0.45, 0, 0, HP, 8));

  // helmet: shell, gold visor, neck ring, lamps
  body.add(ring(0.33, 0.07, MAT.darkAlu, 0, 2.68, 0, HP, 0, 0));
  body.add(sph(0.52, MAT.suitWhite, 0.02, 3.1, 0));
  const visor = sph(0.43, MAT.gold, 0.3, 3.1, 0, 0.62, 0.86, 0.95);
  body.add(visor);
  body.add(sph(0.36, MAT.glass, 0.34, 3.1, 0, 0.5, 0.74, 0.82));
  for (const s of [-1, 1]) {
    body.add(box(0.1, 0.1, 0.12, MAT.lamp, 0.34, 3.58, s * 0.2));
    body.add(box(0.12, 0.2, 0.08, MAT.darkAlu, 0.05, 3.1, s * 0.52));
  }
  body.add(box(0.12, 0.08, 0.26, MAT.black, 0.42, 3.62, 0));                    // helmet camera

  // arms
  const gloves = (limb, y) => {
    limb.add(sph(0.21, MAT.suitWhite, 0, y, 0, 1, 1.15, 1));
    limb.add(sph(0.08, MAT.orange, 0.15, y + 0.04, 0.0));
    limb.add(ring(0.17, 0.05, MAT.darkAlu, 0, y + 0.22, 0, HP, 0, 0));
  };
  const armL = makeLimb(0.17, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, gloves);
  const armR = makeLimb(0.17, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, gloves);
  armL.position.set(0, 2.55, 0.62); armR.position.set(0, 2.55, -0.62);
  body.add(armL, armR);
  for (const a of [armL, armR]) a.add(ring(0.17, 0.05, MAT.orange, 0, -0.3, 0, HP, 0, 0));

  // legs (pivot at hips; they stay outside the bobbing body group)
  const boots = (limb, y) => {
    limb.add(box(0.66, 0.3, 0.36, MAT.darkAlu, 0.1, y - 0.05, 0));
    limb.add(box(0.7, 0.1, 0.38, MAT.rubber, 0.1, y - 0.22, 0));
    limb.add(sph(0.18, MAT.darkAlu, 0.38, y - 0.04, 0, 1, 0.8, 1));
    limb.add(ring(0.2, 0.05, MAT.orange, 0, y + 0.27, 0, HP, 0, 0));
  };
  const legL = makeLimb(0.22, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, boots);
  const legR = makeLimb(0.22, 0.42, 0.42, MAT.suitWhite, MAT.suitWhite, boots);
  legL.position.set(0, 1.4, 0.27); legR.position.set(0, 1.4, -0.27);
  g.add(legL, legR);
  for (const l of [legL, legR]) l.add(ring(0.23, 0.05, MAT.orange, 0, -0.3, 0, HP, 0, 0));

  const flag = buildFlag();
  flag.position.set(1.5, 0, -0.9);
  g.add(flag);
  g.scale.set(0.82, 0.82, 0.82);
  g.userData = { kind: 'astronaut', body, armL, armR, legL, legR, flag };
  return g;
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
        root.traverse(o => { if (o.isMesh) o.castShadow = true; });
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
    u.armL.rotation.z = -w * 0.45 + (moving ? 0 : 0); u.armR.rotation.z = w * 0.45;
    u.body.position.y = moving ? Math.abs(Math.sin(tSec * 5.5)) * 0.08 : 0;
  } else if (u.kind === 'rover' && moving) {
    for (const s of u.wheels) s.rotation.z -= dt * 3.0 / (u.wheelRadius || 0.4);
  }
}

/* ---------- Arrival celebration (astronaut only) ----------
   mode 'flag'  : the flag of Oman rises out of the ground, the astronaut cheers and waves
   mode 'dance' : the astronaut spins and dances
   tt = seconds since arrival. Returns false if this model cannot celebrate. */
export function celebrateModel(model, tt, mode) {
  const u = model && model.userData;
  if (!u || u.kind !== 'astronaut') return false;
  const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  u.legL.userData.lower && (u.legL.userData.lower.rotation.z = 0);
  u.legR.userData.lower && (u.legR.userData.lower.rotation.z = 0);
  if (mode === 'dance') {
    const beat = tt * 7;
    model.rotation.y = tt * 2.2;
    u.body.position.y = Math.abs(Math.sin(beat)) * 0.28;
    u.legL.rotation.z = Math.sin(beat) * 0.7; u.legR.rotation.z = -Math.sin(beat) * 0.7;
    u.armL.rotation.z = 2.5 + Math.sin(beat * 2) * 0.5; u.armR.rotation.z = 2.5 - Math.sin(beat * 2) * 0.5;
    u.flag.visible = false;
    return true;
  }
  // flag
  const f = u.flag, rise = sm(tt / 2.5);
  f.visible = true;
  f.scale.set(1, Math.max(rise, 0.001), 1);                // the pole grows out of the ground
  u.body.position.y = rise < 1 ? 0 : Math.abs(Math.sin(tt * 6)) * 0.07;
  u.legL.rotation.z = 0; u.legR.rotation.z = 0;
  const cheer = sm((tt - 0.3) / 1.2);
  u.armR.rotation.z = cheer * (2.7 + Math.sin(tt * 5) * 0.25);
  u.armL.rotation.z = cheer * (2.5 - Math.sin(tt * 5) * 0.25);
  const pos = f.userData.cloth.geometry.attributes.position, base = f.userData.base, W = f.userData.W;
  for (let i = 0; i < base.length; i++) {
    const x = base[i][0] + W / 2;                            // 0 at the pole, W at the free end
    pos.setXYZ(i, base[i][0], base[i][1], Math.sin(x * 5 - tt * 6) * 0.09 * (x / W));
  }
  pos.needsUpdate = true;
  f.userData.cloth.position.y = 0.9 + 2.65 * rise;           // the flag climbs up the pole
  return true;
}

export function resetCelebration(model) {
  const u = model && model.userData;
  if (!u || u.kind !== 'astronaut') return;
  model.rotation.y = 0;
  u.flag.visible = false;
  u.flag.scale.set(1, 1, 1);
  u.armL.rotation.z = 0; u.armR.rotation.z = 0; u.body.position.y = 0;
}
