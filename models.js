/* =====================================================================
   models.js  ·  Martian Map · MR_PSG / Team Starseekers
   3D models of the travelers. All three are ORIGINAL Starseekers designs
   (not copies of NASA hardware), built from shapes in code:
     - SINBAD : hard-shell EVA suit, rear-entry suitport hatch, bronze visor, halo HUD
     - RAHHAL : autonomous scout on four articulated wheel-legs, folding solar wing, lidar dome
     - QAFILA : articulated two-module pressurized crew rover, 8 airless wheels, suitports
   Physically based materials + a Martian sky environment map. Physics in physics.js.
   Models are drawn larger than real scale so they stay visible on a map tens of km wide.
   All models face +x. y is up.
   ===== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { drawOmanFlag, FLAG_RATIO } from './flag.js?v=7';

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

/* =====================================================================
   ORIGINAL STARSEEKERS DESIGNS (by MR_PSG / Team Starseekers)
   These are new concepts, not copies of NASA hardware:
     RAHHAL  (رحّال, "wanderer")  - autonomous scout on four wheel-legs, solar wing, lidar dome
     QAFILA  (قافلة, "caravan")   - articulated two-module pressurized crew rover, 8 wheels, suitports
     SINBAD                         - hard-shell EVA suit with rear-entry suitport hatch and halo HUD
   Every model faces +x, y is up. userData.wheelMounts lets the physics rig (physics.js) move each
   wheel up and down with its own suspension, so the vehicles really ride over the real terrain.
   ===================================================================== */
const PAL = {
  shell: M('#f1f0ec', 0.38, 0.06),
  shellWarm: M('#e2ddd2', 0.45, 0.06),
  graphite: M('#2b2e33', 0.55, 0.45),
  carbon: M('#16181b', 0.6, 0.3),
  steel: M('#9aa1aa', 0.3, 0.92),
  teal: M('#14b8a6', 0.35, 0.2, { emissive: '#0d9488', emissiveIntensity: 0.55 }),
  tealGlow: M('#5eead4', 0.2, 0.0, { emissive: '#2dd4bf', emissiveIntensity: 2.0 }),
  omanRed: M('#db161b', 0.45, 0.1),
  omanGreen: M('#0b7a34', 0.5, 0.1),
  solar: M('#163a7a', 0.16, 0.5, { emissive: '#0b1f4a', emissiveIntensity: 0.35 }),
  fabric: M('#4a4f57', 0.92, 0.0),
  bronzeVisor: new THREE.MeshPhysicalMaterial({ color: '#7a4e1f', roughness: 0.06, metalness: 1.0, clearcoat: 1, clearcoatRoughness: 0.05 }),
  window: new THREE.MeshPhysicalMaterial({ color: '#0d1b2a', roughness: 0.05, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03 }),
  tyre: M('#24262a', 0.92, 0.05),
  amber: M('#ffb547', 0.3, 0.0, { emissive: '#ff9a1f', emissiveIntensity: 1.6 })
};

function shapeFrom(pts) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  return sh;
}
function extrude(pts, depth, mat, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth, steps: 1, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat);
}

/* Airless honeycomb tyre (spins around z) */
function makeAirlessWheel(radius, width) {
  const spin = new THREE.Group();
  const band = (r, w, mat) => mesh(new THREE.CylinderGeometry(r, r, w, 44, 1, true), mat, 0, 0, 0, HP, 0, 0);
  const tyreMat = PAL.tyre.clone(); tyreMat.side = THREE.DoubleSide;
  spin.add(band(radius, width, tyreMat));                                                   // tread band (open: the spokes show)
  spin.add(band(radius * 0.9, width * 0.96, PAL.carbon));                                  // inner shear band
  for (let i = 0; i < 26; i++) {                                                            // chevron tread lugs
    const a = (i / 26) * Math.PI * 2;
    spin.add(box(radius * 0.1, radius * 0.08, width * 0.9, PAL.graphite, Math.cos(a) * radius * 1.01, Math.sin(a) * radius * 1.01, 0, 0, 0, a + 0.3));
  }
  for (let i = 0; i < 12; i++) {                                                            // flexible spokes (the honeycomb look)
    const a = (i / 12) * Math.PI * 2;
    for (const s of [-1, 1]) spin.add(box(radius * 0.62, radius * 0.05, 0.03, PAL.steel, Math.cos(a) * radius * 0.52, Math.sin(a) * radius * 0.52, s * width * 0.42, 0, 0, a + 0.35 * s));
  }
  spin.add(cyl(radius * 0.26, radius * 0.26, width * 1.08, PAL.steel, 0, 0, 0, HP, 0, 0, 24));    // hub motor
  spin.add(cyl(radius * 0.12, radius * 0.12, width * 1.14, PAL.teal, 0, 0, 0, HP, 0, 0, 16));
  const outer = new THREE.Group();
  outer.add(spin);
  outer.userData.spin = spin;
  return outer;
}

/* ---------- RAHHAL: autonomous scout on four articulated wheel-legs ---------- */
function buildRahhal() {
  const g = new THREE.Group();
  const chassis = new THREE.Group();
  g.add(chassis);
  // low, wide hull with chamfered nose (side profile extruded across the width)
  chassis.add(extrude([[-1.25, 0.72], [1.05, 0.72], [1.45, 0.95], [1.3, 1.22], [-1.05, 1.28], [-1.35, 1.05]], 1.25, PAL.shell, 0.08));
  chassis.add(box(2.1, 0.06, 1.3, PAL.graphite, -0.05, 0.7, 0));                     // belly armour
  chassis.add(box(1.6, 0.03, 0.08, PAL.omanRed, -0.1, 1.05, 0.7));                   // side stripes (Omani red & green)
  chassis.add(box(1.6, 0.03, 0.08, PAL.omanGreen, -0.1, 0.99, 0.7));
  chassis.add(box(1.6, 0.03, 0.08, PAL.omanRed, -0.1, 1.05, -0.7));
  chassis.add(box(1.6, 0.03, 0.08, PAL.omanGreen, -0.1, 0.99, -0.7));
  // lidar / vision dome on the nose (no mast: everything sits low and protected)
  chassis.add(cyl(0.26, 0.3, 0.12, PAL.graphite, 0.95, 1.33, 0, 0, 0, 0, 28));
  const dome = mesh(new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), PAL.window, 0.95, 1.38, 0);
  chassis.add(dome);
  chassis.add(ring(0.25, 0.02, PAL.tealGlow, 0.95, 1.4, 0, HP, 0, 0));
  for (const s of [-1, 1]) {
    chassis.add(box(0.06, 0.12, 0.22, PAL.carbon, 1.43, 1.0, s * 0.36));             // stereo hazard cams
    chassis.add(sph(0.04, PAL.amber, 1.47, 1.0, s * 0.36));
  }
  // folding solar wing on a short pylon (tilts toward the Sun while parked)
  const wing = new THREE.Group();
  wing.position.set(-0.35, 1.42, 0);
  wing.add(box(0.12, 0.2, 0.12, PAL.graphite, 0, -0.1, 0));
  const panel = new THREE.Group();
  panel.add(box(1.5, 0.04, 1.9, PAL.solar, 0, 0, 0));
  panel.add(box(1.54, 0.05, 0.04, PAL.steel, 0, 0, 0.96));
  panel.add(box(1.54, 0.05, 0.04, PAL.steel, 0, 0, -0.96));
  for (let i = -2; i <= 2; i++) panel.add(box(0.01, 0.045, 1.88, PAL.steel, i * 0.3, 0, 0));
  panel.rotation.z = -0.12;
  wing.add(panel);
  chassis.add(wing);
  // sample arm folded along the right side, with a coring head
  chassis.add(box(0.9, 0.08, 0.08, PAL.steel, 0.35, 0.88, -0.74));
  chassis.add(box(0.6, 0.07, 0.07, PAL.steel, 0.9, 0.82, -0.8, 0, 0, -0.4));
  chassis.add(cyl(0.1, 0.1, 0.16, PAL.graphite, 1.18, 0.7, -0.8, 0, 0, 0, 16));
  chassis.add(cyl(0.025, 0.01, 0.22, PAL.steel, 1.18, 0.54, -0.8, 0, 0, 0, 8));
  // comms: flat phased-array tile + whip antenna
  chassis.add(box(0.36, 0.03, 0.36, PAL.shellWarm, -0.95, 1.31, 0.35, 0, 0, 0.15));
  chassis.add(cyl(0.012, 0.012, 0.7, PAL.steel, -1.1, 1.6, -0.45, 0, 0, 0, 6));
  chassis.add(sph(0.03, PAL.tealGlow, -1.1, 1.96, -0.45));

  // four wheel-legs: hip joint on the hull, thigh, knee, and an airless wheel
  const wheels = [], mounts = [];
  const wr = 0.42, ww = 0.32;
  for (const [x, s] of [[0.82, 1], [0.82, -1], [-0.86, 1], [-0.86, -1]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.98, s * 0.66);
    hip.add(sph(0.11, PAL.graphite, 0, 0, 0));
    hip.add(ring(0.1, 0.025, PAL.teal, 0, 0, 0, 0, 0, 0));
    hip.add(box(0.12, 0.62, 0.1, PAL.steel, 0, -0.18, s * 0.12, s * 0.5, 0, 0));      // thigh angled outwards
    chassis.add(hip);
    const mount = new THREE.Group();                                                    // moves up/down (suspension travel)
    const rest = wr;
    mount.position.set(x, rest, s * 1.02);
    mount.add(box(0.09, 0.36, 0.09, PAL.steel, 0, 0.24, -s * 0.14));                  // shin
    mount.add(sph(0.07, PAL.teal, 0, 0.42, -s * 0.14));                                // knee
    const w = makeAirlessWheel(wr, ww);
    mount.add(w);
    g.add(mount);
    wheels.push(w.userData.spin);
    mounts.push({ obj: mount, x, z: s * 1.02, restY: rest, travel: 0.32 });
  }
  g.userData = { kind: 'rover', design: 'RAHHAL', wheels, wheelRadius: wr, wheelMounts: mounts, chassis, clearance: 0 };
  return g;
}

/* ---------- QAFILA: articulated pressurized crew rover ---------- */
function buildQafila() {
  const g = new THREE.Group();
  const front = new THREE.Group(), rear = new THREE.Group();
  g.add(front);
  // rear module hangs on an articulation joint just behind the cab, so the train bends in turns
  const joint = new THREE.Group();
  joint.position.set(-0.55, 0, 0);
  joint.add(rear);
  g.add(joint);

  // --- front cab: rounded capsule with a panoramic window band ---
  // (shell half-width = 0.975 + 0.14 bevel = 1.115, so trim sits at |z| >= 1.125)
  const cabProfile = [[-0.5, 0.95], [1.5, 0.95], [2.15, 1.35], [2.25, 1.9], [1.75, 2.55], [-0.5, 2.6]];
  front.add(extrude(cabProfile, 1.95, PAL.shell, 0.14));
  front.add(box(0.86, 0.04, 2.05, PAL.window, 2.13, 2.33, 0, 0, 0, 2.227));                   // windshield on the sloped nose
  front.add(box(0.5, 0.04, 2.0, PAL.window, 2.36, 1.66, 0, 0, 0, 1.39));                      // lower view port
  for (const s of [-1, 1]) {
    front.add(box(1.55, 0.36, 0.03, PAL.window, 0.62, 2.12, s * 1.128));                     // side window band
    front.add(box(2.6, 0.07, 0.03, PAL.omanRed, 0.75, 1.66, s * 1.13));                      // livery
    front.add(box(2.6, 0.05, 0.03, PAL.omanGreen, 0.75, 1.57, s * 1.13));
    front.add(box(2.85, 0.3, 0.03, PAL.graphite, 0.8, 1.08, s * 1.13));                      // lower skirt
    front.add(box(0.06, 0.62, 0.035, PAL.teal, -0.25, 1.7, s * 1.13));                       // door seam light
  }
  front.add(box(1.9, 0.06, 1.7, PAL.solar, 0.45, 2.78, 0));                                   // solar roof
  front.add(box(0.25, 0.16, 1.6, PAL.graphite, 2.38, 1.1, 0));                                // bumper with light bar
  front.add(box(0.05, 0.05, 1.4, PAL.tealGlow, 2.52, 1.12, 0));
  for (const s of [-1, 1]) front.add(sph(0.08, PAL.amber, 2.36, 1.42, s * 0.72));
  front.add(cyl(0.03, 0.03, 0.6, PAL.steel, -0.2, 3.05, -0.6, 0, 0, 0, 8));                   // comm mast + dish
  front.add(cyl(0.32, 0.05, 0.08, PAL.shellWarm, -0.2, 3.37, -0.6, 0.55, 0, 0.2, 28));
  // --- flexible pressurized bellows in the gap between the modules ---
  for (let i = 0; i < 4; i++) front.add(ring(0.72, 0.09, PAL.graphite, -0.7 - i * 0.1, 1.75, 0, 0, HP, 0));
  // --- rear module (lab + habitat), with suitports for two SINBAD suits on the back wall ---
  rear.position.x = -0.42;
  rear.add(extrude([[-2.6, 0.95], [-0.15, 0.95], [-0.15, 2.55], [-2.4, 2.55], [-2.75, 2.2], [-2.75, 1.25]], 1.95, PAL.shellWarm, 0.14));
  rear.add(box(1.9, 0.06, 1.7, PAL.solar, -1.4, 2.73, 0));
  for (let i = 0; i < 6; i++) rear.add(box(0.03, 0.42, 1.6, PAL.steel, -0.55 - i * 0.28, 2.95, 0));   // radiator fins
  for (const s of [-1, 1]) {
    rear.add(cyl(0.34, 0.34, 0.06, PAL.graphite, -2.92, 1.75, s * 0.5, 0, 0, HP, 32));      // suitport hatches
    rear.add(ring(0.34, 0.035, PAL.teal, -2.96, 1.75, s * 0.5, 0, HP, 0));
    rear.add(box(2.4, 0.07, 0.03, PAL.omanRed, -1.4, 1.66, s * 1.13));
    rear.add(box(2.4, 0.05, 0.03, PAL.omanGreen, -1.4, 1.57, s * 1.13));
    rear.add(box(2.7, 0.3, 0.03, PAL.graphite, -1.45, 1.08, s * 1.13));
    rear.add(box(0.8, 0.32, 0.03, PAL.window, -1.0, 2.12, s * 1.128));
  }
  rear.add(box(0.05, 0.05, 1.2, PAL.amber, -2.92, 2.4, 0));                                   // rear marker light

  // 8 wheels: 4 under each module, each on its own active suspension arm
  const wheels = [], mounts = [];
  const wr = 0.55, ww = 0.42;
  const place = (parent, x, s, jointX) => {
    const arm = box(0.55, 0.1, 0.12, PAL.graphite, x + 0.25, 0.9, s * 0.95, 0, 0, -0.3);
    parent.add(arm);
    const mount = new THREE.Group();
    mount.position.set(x, wr, s * 1.22);
    const w = makeAirlessWheel(wr, ww);
    mount.add(w);
    mount.add(box(0.12, 0.42, 0.12, PAL.steel, 0, 0.32, -s * 0.18));                     // damper
    parent.add(mount);
    wheels.push(w.userData.spin);
    mounts.push({ obj: mount, x: x + jointX + (parent === rear ? -0.42 : 0), z: s * 1.22, restY: wr, travel: 0.3, rear: parent === rear });
  };
  for (const s of [-1, 1]) {
    place(front, 1.55, s, 0); place(front, 0.3, s, 0);
    place(rear, -0.65, s, -0.55); place(rear, -1.95, s, -0.55);
  }
  g.scale.set(0.85, 0.85, 0.85);
  g.userData = { kind: 'rover', design: 'QAFILA', wheels, wheelRadius: wr * 0.85, wheelMounts: mounts, joint, scaleK: 0.85 };
  return g;
}

/* =====================================================================
   FLAG OF OMAN, as real cloth on a pole
   Layout: official 4:7 flag law (flag.js). The cloth moves like fabric in
   wind: travelling waves from the pole to the free end, amplitude growing
   along the cloth, a second cross wave for diagonal folds, the free end
   sagging under gravity, and the cloth length kept (it pulls in as it folds).
   Lighting comes from the folds themselves (normals recomputed each frame),
   with a fabric sheen, like a real flag in sunlight.
   ===================================================================== */
let _flagTex = null;
function omanFlagTexture() {
  if (_flagTex) return _flagTex;
  if (typeof document === 'undefined') return null;
  const c = drawOmanFlag(document.createElement('canvas'), 1400);
  _flagTex = new THREE.CanvasTexture(c);
  _flagTex.colorSpace = THREE.SRGBColorSpace;
  _flagTex.anisotropy = 8;
  return _flagTex;
}

const FLAG_W = 2.6, FLAG_H = FLAG_W / FLAG_RATIO, POLE_H = 5.4;
const POLE_MAT = M('#e6e9ec', 0.24, 0.9);                   // satin aluminium pole, like a real flagpole
function buildFlag() {
  const grp = new THREE.Group();
  const pole = cyl(0.055, 0.07, POLE_H, POLE_MAT, 0, POLE_H / 2, 0, 0, 0, 0, 20);
  const knob = new THREE.Group();
  knob.add(sph(0.12, POLE_MAT, 0, 0.1, 0));                  // ball finial
  knob.add(cyl(0.075, 0.06, 0.08, POLE_MAT, 0, 0, 0, 0, 0, 0, 16));
  knob.position.y = POLE_H;
  grp.add(pole, knob);
  const SX = 60, SY = 34;
  const geo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, SX, SY);
  geo.translate(FLAG_W / 2, -FLAG_H / 2, 0);                 // origin = top corner at the pole
  const tex = omanFlagTexture();
  const mat = new THREE.MeshPhysicalMaterial({
    color: tex ? '#ffffff' : '#c8102e', map: tex || null,
    roughness: 0.58, metalness: 0, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffffff'),
    emissive: '#ffffff', emissiveMap: tex || null, emissiveIntensity: tex ? 0.05 : 0,   // a little self-light so shade is never black
    side: THREE.DoubleSide
  });
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
  mat.vertexColors = true;
  const cloth = new THREE.Mesh(geo, mat);
  cloth.castShadow = true;
  const holder = new THREE.Group();                          // slides up the pole
  holder.position.set(0.07, POLE_H - 0.14, 0);
  holder.add(cloth);
  for (const y of [-0.05, -FLAG_H + 0.05]) holder.add(box(0.05, 0.07, 0.05, POLE_MAT, -0.02, y, 0));   // halyard clips
  grp.add(holder);
  const pos = geo.attributes.position, base = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { base[i * 2] = pos.array[i * 3]; base[i * 2 + 1] = pos.array[i * 3 + 1]; }
  grp.visible = false;
  grp.userData = { cloth, holder, base, pole, knob, W: FLAG_W, H: FLAG_H, poleH: POLE_H };
  return grp;
}

/* cloth motion. t = seconds, wind 0..1 */
function waveFlag(f, t, wind) {
  const { cloth, base, W, H } = f.userData, pos = cloth.geometry.attributes.position, a = pos.array;
  const sag = 0.05 + 0.22 * (1 - wind);
  for (let i = 0, n = pos.count; i < n; i++) {
    const bx = base[i * 2], by = base[i * 2 + 1];
    const u = bx / W, v = -by / H;                           // u: 0 at the pole .. 1 free end; v: 0 top .. 1 bottom
    const pin = u < 0.06 ? u / 0.06 : 1;                     // the hoist edge stays on the pole
    const amp = wind * (0.06 + 0.3 * Math.pow(u, 1.1)) * pin;
    const ph1 = bx * 4.1 - t * 5.4 + v * 1.5;
    const ph2 = bx * 6.8 - t * 7.9 + v * 3.0 + 1.3;
    const z = amp * Math.sin(ph1) + 0.42 * amp * Math.sin(ph2) + 0.12 * amp * Math.sin(by * 6 + t * 3.3) * u;
    const pull = 0.07 * wind * u + 0.05 * amp * (1 + Math.cos(ph1));     // folding pulls the free end in
    a[i * 3] = bx * (1 - pull);
    a[i * 3 + 1] = by - sag * u * u * (0.55 + 0.45 * v) + 0.03 * amp * Math.sin(ph1 + 0.7);
    a[i * 3 + 2] = z;
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
  // fold shading: the side of each fold that turns away from the light is darker, like satin in sun
  const nrm = cloth.geometry.attributes.normal.array, col = cloth.geometry.attributes.color.array;
  for (let i = 0, n = pos.count; i < n; i++) {
    const d = Math.abs(nrm[i * 3] * 0.78 + nrm[i * 3 + 1] * 0.3 + nrm[i * 3 + 2] * 0.55);   // two-sided cloth
    const k = 0.45 + 0.65 * Math.pow(d, 1.3);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1.05, k);
  }
  cloth.geometry.attributes.color.needsUpdate = true;
}
const flagWind = t => 0.62 + 0.22 * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 1.13 + 1);   // gusts

/* =====================================================================
   SINBAD EVA suit: articulated like a person, with joint limits.
   Skeleton: root > pelvis > chest > shoulders > elbows > hands
                       pelvis > hips > knees > ankles (feet)
   Every joint has a range like a real body in a hard suit, the knees only
   bend backwards, and the feet stay on the ground (the pelvis height comes
   from the leg angles). The body parts are checked against each other with
   capsule colliders (tools/selfcheck.mjs) so nothing passes through
   anything else, in walking and in every dance.
   Right hand = +z side (the model faces +x).
   ===================================================================== */
const UP = 0.05;                                             // upper body offset
const LEG = { r: 0.21, up: 0.37, lo: 0.38 };
const KNEE = LEG.up + LEG.r * 1.2, ANKLE = LEG.lo + LEG.r, SOLE = 0.28;
const HIP_Y = KNEE + ANKLE + SOLE;                           // 1.49: feet exactly on the ground when standing
const ARM = { r: 0.165, up: 0.42, lo: 0.4 };
const SHOULDER = { y: 2.6, z: 0.84 };
const clampV = (v, a, b) => Math.min(b, Math.max(a, v));

function makeLimb2(r, upperLen, lowerLen, mat, endBuilder) {
  const pivot = new THREE.Group();                           // shoulder / hip: flex about z, abduction about x
  pivot.add(cap(r, upperLen, mat, 0, -(upperLen / 2 + r * 0.4), 0));
  pivot.add(ring(r * 1.02, r * 0.22, PAL.teal, 0, -r * 0.2, 0, HP, 0, 0));
  pivot.add(ring(r * 0.98, r * 0.26, PAL.graphite, 0, -(upperLen + r * 1.2), 0, HP, 0, 0));
  const lower = new THREE.Group();                           // elbow / knee
  lower.position.set(0, -(upperLen + r * 1.2), 0);
  lower.add(cap(r * 0.9, lowerLen, mat, 0, -(lowerLen / 2 + r * 0.3), 0));
  lower.add(box(r * 0.9, lowerLen * 0.55, r * 1.1, PAL.shellWarm, r * 0.62, -(lowerLen * 0.45), 0));
  const end = new THREE.Group();                             // hand / foot
  end.position.set(0, -(lowerLen + r), 0);
  endBuilder(end);
  lower.add(end);
  pivot.add(lower);
  pivot.userData = { lower, end };
  return pivot;
}

/* ---------- props: Omani khanjar, saif (sword), belt with sheath, shal ---------- */
const SILVER = M('#d9dde2', 0.22, 1.0);
const BLADE = M('#eef1f4', 0.12, 1.0);
const LEATHER = M('#5a3a22', 0.75, 0.05);
function buildKhanjar() {                                    // held: grip in the fist, curved blade continues the arm
  const k = new THREE.Group();
  k.add(cyl(0.035, 0.04, 0.2, SILVER, 0, 0.0, 0, 0, 0, 0, 12));                        // grip
  k.add(box(0.2, 0.045, 0.07, SILVER, 0.0, 0.12, 0));                                  // flat T pommel (Omani style)
  k.add(sph(0.035, SILVER, 0, 0.16, 0));
  k.add(box(0.11, 0.035, 0.06, SILVER, 0, -0.11, 0));                                  // guard
  const blade = extrude([[-0.045, -0.13], [0.045, -0.13], [0.065, -0.3], [0.1, -0.46], [0.18, -0.6], [0.075, -0.52], [0.0, -0.35]], 0.018, BLADE, 0.007);
  blade.rotation.y = HP;                                     // broad side of the blade faces forward
  k.add(blade);
  k.scale.setScalar(1.35);
  return k;
}
function buildSaif() {                                       // straight double-edged Omani sword, flared pommel
  const s = new THREE.Group();
  s.add(cyl(0.032, 0.036, 0.26, LEATHER, 0, 0, 0, 0, 0, 0, 12));                       // grip
  s.add(cyl(0.085, 0.03, 0.07, SILVER, 0, 0.16, 0, 0, 0, 0, 16));                      // flared pommel
  s.add(box(0.16, 0.04, 0.05, SILVER, 0, -0.15, 0));                                   // short cross guard
  const blade = extrude([[-0.042, -0.17], [0.042, -0.17], [0.036, -1.2], [0.05, -1.36], [0, -1.48], [-0.05, -1.36], [-0.036, -1.2]], 0.014, BLADE, 0.006);
  blade.rotation.y = HP;                                     // broad side faces forward; the tip flares a little (Omani saif)
  s.add(blade);
  s.add(box(0.012, 1.1, 0.02, SILVER, 0, -0.75, 0));         // fuller line
  return s;
}
function buildSheath() {                                     // J-shaped khanjar sheath worn at the front of the belt
  const g = new THREE.Group();
  g.add(extrude([[-0.07, 0.08], [0.07, 0.08], [0.07, -0.18], [0.02, -0.32], [-0.12, -0.36], [-0.2, -0.3], [-0.1, -0.27], [-0.05, -0.2], [-0.07, -0.05]], 0.06, SILVER, 0.012));
  g.add(box(0.2, 0.04, 0.08, SILVER, 0, 0.15, 0));
  return g;
}
function buildShal() {                                       // cloth held in the left hand in al-Bar'ah
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let map = null;
  if (c) {
    c.width = 32; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#7d1420'; g.fillRect(0, 0, 32, 128);
    g.fillStyle = '#d8b24a'; for (let y = 6; y < 128; y += 16) g.fillRect(0, y, 32, 3);
    g.fillStyle = '#1d5a37'; g.fillRect(0, 118, 32, 10);
    map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  }
  const geo = new THREE.PlaneGeometry(0.16, 0.7, 1, 6);
  geo.translate(0, -0.35, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, color: map ? '#fff' : '#7d1420', roughness: 0.9, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function buildAstronaut() {
  const g = new THREE.Group();
  const soft = M('#4d535c', 0.9, 0.0, { bumpMap: fabricBump() || null, bumpScale: 0.6 });

  const pelvis = new THREE.Group();
  pelvis.position.y = HIP_Y;
  g.add(pelvis);
  pelvis.add(cap(0.27, 0.34, soft, 0, 0.0, 0, HP, 0, 0));                              // hip bearing unit
  pelvis.add(ring(0.3, 0.05, PAL.graphite, 0, 0.0, 0.0, 0, 0, 0));
  const chest = new THREE.Group();                           // waist joint: lean, roll, twist
  chest.position.y = 0.06;
  pelvis.add(chest);
  const up = new THREE.Group();                              // lets the upper body be written in standing coordinates
  up.position.y = -(HIP_Y + 0.06);
  chest.add(up);
  const Y = y => y + UP;

  // hard upper torso (faceted lathe), graphite waist bearing
  const prof = [[0.0, -0.6], [0.36, -0.6], [0.44, -0.42], [0.5, -0.1], [0.53, 0.2], [0.5, 0.42], [0.36, 0.58], [0.0, 0.6]].map(p => new THREE.Vector2(p[0], p[1]));
  const torso = mesh(new THREE.LatheGeometry(prof, 8), PAL.shell, 0, Y(2.08), 0);
  torso.scale.set(0.92, 1, 1.2);
  torso.rotation.y = Math.PI / 8;
  up.add(torso);
  up.add(ring(0.42, 0.09, PAL.graphite, 0, Y(1.5), 0, HP, 0, 0));
  up.add(ring(0.43, 0.025, PAL.teal, 0, Y(1.56), 0, HP, 0, 0));
  up.add(box(0.06, 0.34, 0.46, PAL.graphite, 0.5, Y(2.18), 0));
  up.add(box(0.02, 0.22, 0.34, PAL.tealGlow, 0.535, Y(2.2), 0));
  up.add(box(0.05, 0.07, 0.5, PAL.omanRed, 0.46, Y(2.46), 0, 0, 0, -0.25));
  up.add(box(0.05, 0.05, 0.5, PAL.omanGreen, 0.46, Y(2.39), 0, 0, 0, -0.25));
  for (const s of [-1, 1]) up.add(box(0.02, 0.5, 0.03, PAL.tealGlow, 0.45, Y(1.98), s * 0.4, 0, 0, 0.08));
  // belt with the khanjar sheath (Omani dress, worn on the suit)
  const belt = ring(0.45, 0.045, LEATHER, 0, Y(1.62), 0, HP, 0, 0);
  belt.scale.set(1.0, 1.25, 1);
  up.add(belt);
  const sheath = buildSheath();
  sheath.position.set(0.5, Y(1.6), 0.02);
  sheath.rotation.y = -HP;                                   // faces forward, tip curving to the right side
  up.add(sheath);

  // suitport hatch / life-support pack
  up.add(extrude([[-0.95, Y(1.55)], [-0.55, Y(1.55)], [-0.5, Y(2.8)], [-0.62, Y(2.95)], [-0.95, Y(2.85)]], 0.86, PAL.shellWarm, 0.05));
  up.add(ring(0.36, 0.035, PAL.teal, -0.97, Y(2.22), 0, 0, HP, 0));
  up.add(box(0.03, 0.5, 0.06, PAL.amber, -0.99, Y(2.22), 0.3));
  for (const s of [-1, 1]) up.add(cyl(0.05, 0.05, 0.45, PAL.steel, -0.78, Y(1.7), s * 0.36, 0, 0, 0, 12));

  // helmet + bronze visor + halo HUD band
  up.add(sph(0.5, PAL.shell, 0.0, Y(3.08), 0, 1.0, 1.02, 0.98));
  const visor = mesh(new THREE.SphereGeometry(0.525, 48, 24, Math.PI - 1.35, 2.7, 0.95, 1.15), PAL.bronzeVisor, 0.0, Y(3.08), 0);
  visor.castShadow = false;
  up.add(visor);
  up.add(ring(0.505, 0.028, PAL.graphite, 0, Y(3.17), 0, HP, 0, 0));
  up.add(ring(0.51, 0.011, PAL.tealGlow, 0, Y(3.2), 0, HP, 0, 0));
  for (const s of [-1, 1]) {
    up.add(cyl(0.07, 0.07, 0.07, PAL.graphite, 0.12, Y(3.18), s * 0.5, HP, 0, 0, 16));
    up.add(cyl(0.04, 0.04, 0.08, PAL.amber, 0.12, Y(3.18), s * 0.54, HP, 0, 0, 12));
  }
  up.add(ring(0.42, 0.06, PAL.graphite, 0, Y(2.66), 0, HP, 0, 0));
  // shoulder yokes: bridge the torso and the wider-set shoulder bearings
  for (const s of [-1, 1]) up.add(cap(0.2, 0.22, PAL.shell, 0, Y(2.6), s * 0.62, HP, 0, 0));

  // arms and gloves
  const glove = end => {
    end.add(ring(0.16, 0.05, PAL.teal, 0, 0.2, 0, HP, 0, 0));
    end.add(sph(0.19, PAL.graphite, 0, -0.05, 0, 1, 1.15, 1));
    end.add(cap(0.06, 0.14, PAL.carbon, 0.1, -0.25, 0.04, 0, 0, 0.1));
    end.add(cap(0.06, 0.14, PAL.carbon, 0.03, -0.27, -0.06, 0, 0, 0.0));
    end.add(cap(0.055, 0.12, PAL.carbon, -0.05, -0.25, 0.0, 0, 0, -0.1));
    end.add(cap(0.055, 0.12, PAL.graphite, 0.17, -0.03, 0.04, 0, 0, -0.9));
  };
  const armR = makeLimb2(ARM.r, ARM.up, ARM.lo, soft, glove);     // right arm (+z)
  const armL = makeLimb2(ARM.r, ARM.up, ARM.lo, soft, glove);     // left arm (-z)
  armR.position.set(0, Y(SHOULDER.y), SHOULDER.z);
  armL.position.set(0, Y(SHOULDER.y), -SHOULDER.z);
  for (const a of [armR, armL]) a.add(sph(0.23, PAL.shell, 0, 0.04, 0, 1.05, 0.5, 1.1));
  up.add(armR, armL);
  const patchTex = omanFlagTexture();                        // flag of Oman on the left shoulder
  if (patchTex) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3 / FLAG_RATIO), new THREE.MeshStandardMaterial({ map: patchTex, roughness: 0.9 }));
    patch.position.set(0.02, -0.25, -0.2);
    patch.rotation.y = Math.PI;
    armL.add(patch);
  }
  // hand props
  const khanjar = buildKhanjar(); khanjar.position.set(0.02, -0.12, 0); khanjar.rotation.z = 0.35; khanjar.visible = false;
  armR.userData.end.add(khanjar);
  const saif = buildSaif(); saif.position.set(0.02, -0.1, 0); saif.rotation.z = 0.2; saif.visible = false;
  armR.userData.end.add(saif);
  const freeSaif = buildSaif(); freeSaif.visible = false; g.add(freeSaif);            // the sword in the air (al-Razha toss)
  const shal = buildShal(); shal.visible = false; armL.userData.end.add(shal); shal.position.set(0, -0.12, 0);

  // legs with knee armour and treaded boots
  const boot = end => {
    end.add(ring(0.19, 0.05, PAL.teal, 0, 0.22, 0, HP, 0, 0));
    end.add(cap(0.18, 0.34, PAL.graphite, 0.12, -0.1, 0, 0, 0, HP));
    end.add(box(0.78, 0.1, 0.4, PAL.carbon, 0.13, -0.22, 0));
    for (let i = 0; i < 6; i++) end.add(box(0.03, 0.04, 0.42, PAL.tyre, -0.2 + i * 0.13, -0.26, 0));
  };
  const legR = makeLimb2(LEG.r, LEG.up, LEG.lo, soft, boot);
  const legL = makeLimb2(LEG.r, LEG.up, LEG.lo, soft, boot);
  legR.position.set(0, 0, 0.27); legL.position.set(0, 0, -0.27);
  pelvis.add(legR, legL);

  const flag = buildFlag();
  flag.position.set(0.3, 0, -1.9);
  g.add(flag);
  g.scale.set(0.82, 0.82, 0.82);

  // capsule colliders: [name, object, a, b, radius] in the object's own frame
  const C = (name, obj, a, b, r) => ({ name, obj, a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), r });
  const colliders = [
    C('torsoA', up, [0, Y(1.98), 0.17], [0, Y(2.3), 0.17], 0.47), C('torsoB', up, [0, Y(1.98), -0.17], [0, Y(2.3), -0.17], 0.47),
    C('helmet', up, [0, Y(3.09), 0], [0, Y(3.09), 0], 0.52),
    C('packA', up, [-0.76, Y(1.75), 0.2], [-0.76, Y(2.75), 0.2], 0.22), C('packB', up, [-0.76, Y(1.75), -0.2], [-0.76, Y(2.75), -0.2], 0.22),
    C('hips', pelvis, [0, 0, -0.18], [0, 0, 0.18], 0.27)
  ];
  for (const [s, a, l] of [['R', armR, legR], ['L', armL, legL]]) {
    colliders.push(C('uarm' + s, a, [0, -0.3, 0], [0, -0.6, 0], ARM.r), C('farm' + s, a.userData.lower, [0, -0.06, 0], [0, -0.42, 0], 0.15),
      C('hand' + s, a.userData.end, [0, -0.08, 0], [0.05, -0.2, 0], 0.17),
      C('thigh' + s, l, [0, -0.25, 0], [0, -0.55, 0], LEG.r), C('shin' + s, l.userData.lower, [0, -0.08, 0], [0, -0.48, 0], 0.19),
      C('boot' + s, l.userData.end, [-0.2, -0.18, 0], [0.45, -0.18, 0], 0.1));
  }
  colliders.push(C('khanjar', khanjar, [0.0, -0.15, 0], [0, -0.55, 0.12], 0.04), C('saif', saif, [0, -0.2, 0], [0, -1.45, 0], 0.04));

  const u = { kind: 'astronaut', design: 'SINBAD', pelvis, chest, up, body: chest, armR, armL, legR, legL, flag, khanjar, saif, freeSaif, shal, colliders };
  u.pose = P => applyPose(u, P);
  g.userData = u;
  applyPose(u, {});
  return g;
}

/* ---------- the pose API: every value is clamped to a real joint range ---------- */
function setArm(limb, side, a = {}) {
  // order ZXY: abduction (out to the side) first, then flexion (forward/up), then twist: "out" stays out even overhead
  limb.rotation.order = 'ZXY';
  limb.rotation.set(-side * clampV(a.abd ?? 0.06, -0.15, 1.75), clampV(a.twist ?? 0, -1.6, 1.6), clampV(a.flex ?? 0, -0.9, 3.05));
  limb.userData.lower.rotation.set(0, 0, clampV(a.elbow ?? 0.12, 0, 2.35));
  limb.userData.end.rotation.set(side * (a.wristRoll ?? 0), 0, clampV(a.wrist ?? 0, -1.1, 1.1));
}
function setLeg(limb, side, l = {}) {
  const flex = clampV(l.flex ?? 0, -0.6, 1.7), knee = clampV(l.knee ?? 0, 0, 2.3), abd = clampV(l.abd ?? 0, -0.08, 0.5);
  limb.rotation.order = 'ZXY';
  limb.rotation.set(-side * abd, 0, flex);
  limb.userData.lower.rotation.set(0, 0, -knee);             // knees bend backwards only
  limb.userData.end.rotation.set(side * abd, 0, clampV(-(flex - knee) + (l.ankle ?? 0), -0.75, 0.75));   // sole stays level
  return Math.cos(abd) * (KNEE * Math.cos(flex) + ANKLE * Math.cos(flex - knee)) + SOLE;                  // hip height above the sole
}
function applyPose(u, P) {
  setArm(u.armR, 1, P.armR); setArm(u.armL, -1, P.armL);
  const hR = setLeg(u.legR, 1, P.legR), hL = setLeg(u.legL, -1, P.legL);
  u.pelvis.position.set(P.x ?? 0, Math.max(hR, hL) + (P.lift ?? 0), P.z ?? 0);   // the longer leg stands on the ground
  u.pelvis.rotation.set(P.hipRoll ?? 0, P.hipTwist ?? 0, 0);
  u.chest.rotation.set(P.roll ?? 0, P.twist ?? 0, P.lean ?? 0);
}


/* ---------- Environment map (Martian sky) so metal and the visor reflect it ---------- */
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
  if (kind === 'rover' || kind === 'crewed') {
    const g = kind === 'rover' ? buildRahhal() : buildQafila();
    // a flag mast at the back of the roof: the flag goes up when the vehicle arrives
    const bb = new THREE.Box3().setFromObject(g), k = 1 / g.scale.x;
    const flag = buildFlag();
    flag.scale.setScalar(kind === 'rover' ? 0.5 : 0.6);
    flag.position.set((bb.min.x * 0.55) * k, (bb.max.y - 0.08) * k, 0);
    g.add(flag);
    g.userData.flag = flag;
    return g;
  }
  return buildAstronaut();
}

/* ---------- walking (used by the preview; the physics rig in physics.js uses u.walk too) ---------- */
export function gaitPose(ph, k, o = {}) {
  const sw = Math.sin(ph), cw = Math.cos(ph);
  return {
    legR: { flex: 0.04 + 0.42 * k * sw, knee: k * (0.1 + 0.85 * Math.max(0, cw)) },
    legL: { flex: 0.04 - 0.42 * k * sw, knee: k * (0.1 + 0.85 * Math.max(0, -cw)) },
    armR: { flex: -0.34 * k * sw, elbow: 0.22 + 0.25 * k, abd: 0.08 },        // arms swing against the legs
    armL: { flex: 0.34 * k * sw, elbow: 0.22 + 0.25 * k, abd: 0.08 },
    lean: o.lean ?? -0.1 * k, twist: 0.07 * k * sw, hipTwist: -0.05 * k * sw, lift: o.lift ?? 0
  };
}

export function animateModel(model, tSec, dt, moving) {
  if (!model || !model.userData) return;
  const u = model.userData;
  if (u.kind === 'astronaut') {
    const ph = tSec * Math.PI * 2 * 0.85, k = moving ? 1 : 0;
    u.pose(gaitPose(ph, k, { lift: k * Math.abs(Math.sin(ph)) * 0.12 }));
  } else if (u.kind === 'rover' && moving) {
    for (const s of u.wheels) s.rotation.z -= dt * 3.0 / (u.wheelRadius || 0.4);
  }
}

/* =====================================================================
   ARRIVAL CELEBRATIONS
   Omani arts:
   - al-Bar'ah (Dhofar, UNESCO 2010): a war-like dance to drums; the dancer
     brandishes the khanjar above shoulder level in the right hand and holds the
     shal at the waist in the left, with quick, crouched, codified steps.
   - al-Razha (northern Oman): stately and rhythmic; the sword is raised and
     shaken, the dancers step in time, and the sword is thrown up and caught.
     On Mars the sword flies 2.6 times longer than on Earth (0.38 g).
   Gravity in the model: 1 model unit = 0.537 m (SINBAD is 1.95 m tall),
   so Mars g = 3.71 m/s² = 6.9 units/s².
   ===================================================================== */
export const CELEBRATIONS = [
  { id: 'omani', label: 'Omani celebration: flag + al-Bar\'ah + al-Razha 🇴🇲' },
  { id: 'baraa', label: 'al-Bar\'ah (khanjar dance, Dhofar) 🗡️' },
  { id: 'razha', label: 'al-Razha (sword dance) ⚔️' },
  { id: 'flagsalute', label: 'Raise the flag + salute 🎖️' },
  { id: 'flag', label: 'Raise the flag of Oman 🇴🇲' },
  { id: 'wave', label: 'Wave hello 👋' },
  { id: 'jump', label: 'Mars-gravity jumps 🦘' },
  { id: 'off', label: 'No celebration' }
];
export const CELEBRATION_TEXT = {
  omani: 'Raising the flag of Oman, then al-Bar\'ah and al-Razha 🇴🇲',
  baraa: 'al-Bar\'ah: the khanjar raised above the shoulder, quick crouched steps to the drums 🗡️',
  razha: 'al-Razha: the sword raised and shaken, then thrown up — it stays in the air 1.6 s in Mars gravity (0.6 s on Earth) ⚔️',
  flagsalute: 'Raising the flag of Oman and saluting 🎖️',
  flag: 'Raising the flag of Oman 🇴🇲',
  wave: 'The astronaut waves hello 👋',
  jump: 'Jumping in Mars gravity: about 1 m high, 1.5 s in the air 🦘',
  rover: 'Mission complete: the flag of Oman goes up on the mast 🇴🇲'
};
export const BEAT = { baraa: 60 / 132, razha: 60 / 96 };
const G_MODEL = 6.9;
const FLAG_INTRO = 4.6;

/* which part of a celebration is playing at time tt (shared with the drum sound) */
export function celebrationTrack(mode, tt) {
  if (mode === 'omani') {
    if (tt < FLAG_INTRO) return { dance: 'flagsalute', lt: tt, flag: true };
    const A = 24 * BEAT.baraa, Bd = 16 * BEAT.razha, t = (tt - FLAG_INTRO) % (A + Bd), t0 = tt - t;
    return t < A ? { dance: 'baraa', lt: t, start: t0, flag: true } : { dance: 'razha', lt: t - A, start: t0 + A, flag: true };
  }
  return { dance: mode, lt: tt, start: 0, flag: mode === 'flag' || mode === 'flagsalute' };
}

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const TAU = Math.PI * 2;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _c = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/* blend two poses (nested numbers) */
function mixPose(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if ((x && typeof x === 'object') || (y && typeof y === 'object')) out[key] = mixPose(x || {}, y || {}, k);
    else out[key] = (x ?? DEF[key] ?? 0) + ((y ?? DEF[key] ?? 0) - (x ?? DEF[key] ?? 0)) * k;
  }
  return out;
}
const DEF = { abd: 0.06, elbow: 0.12 };
const REST = { armR: {}, armL: {}, legR: {}, legL: {} };

/* right-hand salute: glove at the visor brow (solved numerically against the colliders, see tools/selfcheck.mjs) */
const SALUTE = { flex: 2.22, abd: 0.43, twist: 0.98, elbow: 1.76, wrist: -0.72 };

function flagPose(f, tt, camLocal, riseTime = 3.0) {
  const { holder, pole, knob, poleH, H } = f.userData, rise = sm(tt / riseTime);
  f.visible = true;
  const k = Math.max(rise, 0.001);                           // the pole grows out of the ground, the cloth climbs it
  pole.scale.y = k; pole.position.y = poleH * k / 2;
  knob.position.y = poleH * k;
  holder.position.y = Math.max(H + 0.12, poleH * k - 0.14) * (rise < 0.35 ? rise / 0.35 : 1);
  waveFlag(f, tt, flagWind(tt) * (0.4 + 0.6 * rise));
  if (camLocal) {                                            // a three-quarter view of the cloth towards the camera
    const c = camLocal(f.parent);
    if (c) f.rotation.y = Math.atan2(c.x - f.position.x, c.z - f.position.z) + 0.45;
  }
  return rise;
}

function baraaPose(lt, u) {
  const B = BEAT.baraa, b = lt / B, bi = Math.floor(b), bf = b - bi;
  const toBelt = sm((lt - 0.2) / 0.55), raise = sm((lt - 0.85) / 0.55);
  u.khanjar.visible = lt > 0.78;
  u.shal.visible = true;
  const belt = { flex: 0.62, abd: 0.0, twist: -0.25, elbow: 1.7, wrist: 0.2 };
  const raised = { flex: 2.2 + 0.16 * Math.sin(TAU * b / 2), abd: 0.52, elbow: 0.48 + 0.14 * Math.sin(TAU * b), wrist: -0.2 + 0.42 * Math.sin(TAU * b) };
  const armR = mixPose(mixPose({}, belt, toBelt), raised, raise);
  const liftR = bi % 2 === 0 ? Math.sin(Math.PI * bf) : 0, liftL = bi % 2 === 1 ? Math.sin(Math.PI * bf) : 0;
  const crouch = sm(lt / 0.8);
  const pose = {
    armR,
    armL: { flex: 0.42, abd: 0.36, twist: 0.25, elbow: 1.3 + 0.12 * Math.sin(TAU * b / 2) },
    legR: { flex: 0.26 * crouch + 0.4 * liftR * raise, knee: 0.55 * crouch + 0.8 * liftR * raise, abd: 0.06 },
    legL: { flex: 0.26 * crouch + 0.4 * liftL * raise, knee: 0.55 * crouch + 0.8 * liftL * raise, abd: 0.06 },
    x: 0.35 * Math.sin(TAU * b / 8) * raise,
    lean: -0.2 * crouch + 0.05 * Math.sin(TAU * b) * raise,
    roll: 0.06 * Math.sin(Math.PI * b) * raise, twist: 0.12 * Math.sin(Math.PI * b) * raise, hipRoll: -0.03 * Math.sin(Math.PI * b) * raise
  };
  return mixPose(REST, pose, sm(lt / 0.4));
}

function razhaPose(lt, u, model) {
  const B = BEAT.razha, b = lt / B, bi = Math.floor(b), bf = b - bi;
  const rise = sm(lt / 0.9), pulse = Math.exp(-bf * 6);
  const cyc = b % 8, T = Math.sqrt(8 * 2.3 / G_MODEL), tRel = 5.4;      // throw on beat 5.4, 2.3 units high
  const flight = cyc >= tRel ? (cyc - tRel) * B : -1, inAir = lt > 4 * B && flight >= 0 && flight < T;
  const windUp = lt > 4 * B && cyc >= 4.9 && cyc < tRel ? Math.sin(Math.PI * (cyc - 4.9) / (tRel - 4.9)) : 0;
  const armR = {
    flex: 2.72 - 0.45 * windUp + 0.07 * pulse, abd: 0.42, elbow: 0.22 + 0.5 * windUp,
    wrist: inAir ? -0.1 : 0.1 + 0.08 * Math.sin(TAU * lt * 6.5)           // the "hazz": the sword trembles in the raised hand
  };
  const stepR = bi % 4 === 0 ? Math.sin(Math.PI * bf) : 0, stepL = bi % 4 === 2 ? Math.sin(Math.PI * bf) : 0;
  const pose = {
    armR: mixPose({}, armR, rise),
    armL: { flex: 1.15, abd: 0.3, twist: -0.3, elbow: 1.5 },
    legR: { flex: 0.1 + 0.32 * stepR, knee: 0.18 * pulse + 0.6 * stepR },
    legL: { flex: 0.1 + 0.32 * stepL, knee: 0.18 * pulse + 0.6 * stepL },
    x: 0.25 * Math.sin(TAU * b / 8),
    lean: inAir ? 0.12 * Math.sin(Math.PI * flight / T) : 0.02,          // looks up at the sword
    roll: 0.04 * Math.sin(Math.PI * b / 2), twist: 0.05 * Math.sin(Math.PI * b / 2)
  };
  u.pose(mixPose(REST, pose, sm(lt / 0.5)));
  u.saif.visible = !inAir;
  u.freeSaif.visible = inAir;
  if (inAir) {
    // ballistic flight under Mars gravity, two full turns around the sword's middle, caught where it left
    model.updateMatrixWorld(true);
    const h = 0.5 * G_MODEL * flight * (T - flight);          // = v0 t - g t²/2 with v0 = gT/2
    _q.copy(model.getWorldQuaternion(_q2)).invert();
    u.saif.getWorldQuaternion(_qs);
    _qs.premultiply(_q);                                     // sword orientation in model space
    _c.set(0, -0.7, 0).applyMatrix4(u.saif.matrixWorld);
    model.worldToLocal(_c);
    _c.y += h;
    const spin = _q2.setFromAxisAngle(Z_AXIS, -TAU * 2 * flight / T);
    u.freeSaif.quaternion.copy(spin).multiply(_qs);
    _v.set(0, -0.7, 0).applyQuaternion(u.freeSaif.quaternion);
    u.freeSaif.position.copy(_c).sub(_v);
  }
}

function celebratePose(u, d, lt, model) {
  switch (d) {
    case 'baraa': u.pose(baraaPose(lt, u)); return;
    case 'razha': razhaPose(lt, u, model); return;
    case 'wave': {
      const k = sm(lt / 0.7);
      u.pose(mixPose(REST, { armR: { flex: 1.3, abd: 0.95, elbow: 1.55, twist: 0.35 * Math.sin(lt * 7) }, armL: { abd: 0.1 }, lean: 0, roll: Math.sin(lt * 3) * 0.03 }, k));
      return;
    }
    case 'jump': {
      const T = 1.5, prep = 0.35, cyc = lt % (T + prep), air = cyc > prep;
      const tau = air ? cyc - prep : 0, h = air ? 0.5 * G_MODEL * tau * (T - tau) : 0;
      const squat = air ? Math.max(0, 1 - tau / 0.12, 1 - (T - tau) / 0.12) * 0.6 : Math.sin(Math.PI * cyc / prep);
      const tuck = air ? Math.sin(Math.PI * tau / T) : 0;
      const arms = { flex: 2.55 + 0.15 * Math.sin(lt * 5), abd: 0.6, elbow: 0.3 };
      u.pose({
        armR: mixPose({ flex: -0.5, abd: 0.15, elbow: 0.4 }, arms, air ? 1 : 0.2), armL: mixPose({ flex: -0.5, abd: 0.15, elbow: 0.4 }, arms, air ? 1 : 0.2),
        legR: { flex: 0.45 * squat + 0.55 * tuck, knee: 0.95 * squat + 0.9 * tuck }, legL: { flex: 0.45 * squat + 0.45 * tuck, knee: 0.95 * squat + 0.75 * tuck },
        lift: h, lean: -0.15 * squat
      });
      return;
    }
    case 'flagsalute': case 'salute': {
      const k = sm((lt - 0.5) / 0.8);
      u.pose(mixPose(REST, { armR: SALUTE, armL: { abd: 0.08, flex: -0.05 } }, k));
      return;
    }
    default: {                                               // 'flag': cheering, arms raised in a V (clear of the helmet)
      const cheer = sm((lt - 0.3) / 1.2);
      const arms = s => ({ flex: 2.5 + s * 0.12 * Math.sin(lt * 5), abd: 0.62, elbow: 0.32 });
      u.pose(mixPose(REST, { armR: arms(1), armL: arms(-1), lift: lt > 3 ? Math.abs(Math.sin(lt * 3.4)) * 0.08 : 0 }, cheer));
    }
  }
}

export function celebrateModel(model, tt, mode, camWorld) {
  const u = model && model.userData;
  if (!u) return false;
  const camLocal = parent => {
    if (!camWorld || !parent) return null;
    _v.copy(camWorld);
    return parent.worldToLocal(_v);
  };
  if (u.kind === 'rover') {                                  // vehicles: the flag goes up on the mast
    if (u.flag) flagPose(u.flag, tt, camLocal, 3.5);
    return true;
  }
  if (u.kind !== 'astronaut') return false;
  const tr = celebrationTrack(mode, tt);
  u.khanjar.visible = false; u.saif.visible = false; u.freeSaif.visible = false; u.shal.visible = false;
  if (tr.flag) flagPose(u.flag, tt, camLocal); else u.flag.visible = false;
  // turn to face the camera
  if (u.celebYaw0 === undefined) u.celebYaw0 = model.rotation.y;
  const c = camLocal(model.parent);
  const target = c ? Math.atan2(-c.z, c.x) : 0;
  model.rotation.y = u.celebYaw0 + angDiff(u.celebYaw0, target) * sm(tt / 1.0);
  celebratePose(u, tr.dance, tr.lt, model);
  if (u.shal.visible) {                                      // the shal hangs down from the hand (gravity), swinging a little
    model.updateMatrixWorld(true);
    u.shal.parent.getWorldQuaternion(_q).invert();
    model.getWorldQuaternion(_q2);
    u.shal.quaternion.copy(_q).multiply(_q2).multiply(_qs.setFromAxisAngle(Z_AXIS, 0.25 * Math.sin(tt * 4.4)));
  }
  return true;
}

export function resetCelebration(model) {
  const u = model && model.userData;
  if (!u) return;
  if (u.kind === 'rover') { if (u.flag) u.flag.visible = false; return; }
  if (u.kind !== 'astronaut') return;
  u.pose({});
  model.rotation.y = 0;
  u.celebYaw0 = undefined;
  u.flag.visible = false;
  u.khanjar.visible = false; u.saif.visible = false; u.freeSaif.visible = false; u.shal.visible = false;
  const f = u.flag.userData;
  f.pole.scale.y = 1; f.pole.position.y = f.poleH / 2; f.knob.position.y = f.poleH;
  u.flag.rotation.y = 0;
}

/* for tools/selfcheck.mjs: poses to test for self-intersection */
export const __test = { celebratePose, gaitPose, mixPose, SALUTE, celebrationTrack, applyPose: (u, P) => u.pose(P) };
