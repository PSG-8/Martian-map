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

/* ---------- SINBAD EVA suit (original Starseekers design) ---------- */
function makeLimb(r, upperLen, lowerLen, matUpper, matLower, endBuilder) {
  // pivot at the top (shoulder or hip). Swings about the z axis.
  const pivot = new THREE.Group();
  pivot.add(cap(r, upperLen, matUpper, 0, -(upperLen / 2 + r * 0.4), 0));
  pivot.add(ring(r * 1.02, r * 0.22, PAL.teal, 0, -r * 0.2, 0, HP, 0, 0));                      // bearing ring at the joint
  pivot.add(ring(r * 0.98, r * 0.26, PAL.graphite, 0, -(upperLen + r * 1.2), 0, HP, 0, 0));    // elbow / knee bearing
  const lower = new THREE.Group();
  lower.position.set(0, -(upperLen + r * 1.2), 0);
  lower.add(cap(r * 0.9, lowerLen, matLower, 0, -(lowerLen / 2 + r * 0.3), 0));
  lower.add(box(r * 0.9, lowerLen * 0.55, r * 1.1, PAL.shellWarm, r * 0.62, -(lowerLen * 0.45), 0));   // armour plate (shin / forearm)
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
  const soft = M('#4d535c', 0.9, 0.0, { bumpMap: fabricBump() || null, bumpScale: 0.6 });   // charcoal soft-goods

  // hard upper torso: faceted shell (lathe), graphite waist bearing
  const prof = [[0.0, -0.6], [0.36, -0.6], [0.44, -0.42], [0.5, -0.1], [0.53, 0.2], [0.5, 0.42], [0.36, 0.58], [0.0, 0.6]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const torso = mesh(new THREE.LatheGeometry(prof, 8), PAL.shell, 0, 2.08, 0);            // 8 sides = faceted, armour-like
  torso.scale.set(0.92, 1, 1.2);
  torso.rotation.y = Math.PI / 8;
  body.add(torso);
  body.add(ring(0.42, 0.09, PAL.graphite, 0, 1.46, 0, HP, 0, 0));
  body.add(ring(0.43, 0.025, PAL.teal, 0, 1.52, 0, HP, 0, 0));
  // chest: OLED status panel, Omani red/green chevron and two light strips
  body.add(box(0.06, 0.34, 0.46, PAL.graphite, 0.5, 2.18, 0));
  body.add(box(0.02, 0.22, 0.34, PAL.tealGlow, 0.535, 2.2, 0));
  body.add(box(0.05, 0.07, 0.5, PAL.omanRed, 0.46, 2.46, 0, 0, 0, -0.25));
  body.add(box(0.05, 0.05, 0.5, PAL.omanGreen, 0.46, 2.39, 0, 0, 0, -0.25));
  for (const s of [-1, 1]) body.add(box(0.02, 0.5, 0.03, PAL.tealGlow, 0.45, 1.98, s * 0.4, 0, 0, 0.08));

  // rear-entry suitport hatch = flat life-support pack (docks onto the QAFILA rover)
  body.add(extrude([[-0.95, 1.55], [-0.55, 1.55], [-0.5, 2.8], [-0.62, 2.95], [-0.95, 2.85]], 0.86, PAL.shellWarm, 0.05));
  body.add(ring(0.36, 0.035, PAL.teal, -0.97, 2.22, 0, 0, HP, 0));                          // hatch seal ring
  body.add(box(0.03, 0.5, 0.06, PAL.amber, -0.99, 2.22, 0.3));                              // status light
  for (const s of [-1, 1]) body.add(cyl(0.05, 0.05, 0.45, PAL.steel, -0.78, 1.7, s * 0.36, 0, 0, 0, 12));   // O2 bottles

  // helmet: rounded hard shell + wraparound bronze visor + halo HUD ring with lights
  body.add(sph(0.5, PAL.shell, 0.0, 3.08, 0, 1.0, 1.02, 0.98));
  const visor = mesh(new THREE.SphereGeometry(0.525, 48, 24, Math.PI - 1.35, 2.7, 0.95, 1.15), PAL.bronzeVisor, 0.0, 3.08, 0);
  visor.castShadow = false;
  body.add(visor);
  body.add(ring(0.505, 0.028, PAL.graphite, 0, 3.17, 0, HP, 0, 0));                        // halo HUD band around the helmet
  body.add(ring(0.51, 0.011, PAL.tealGlow, 0, 3.2, 0, HP, 0, 0));
  for (const s of [-1, 1]) {
    body.add(cyl(0.07, 0.07, 0.07, PAL.graphite, 0.12, 3.18, s * 0.5, HP, 0, 0, 16));       // side camera / lamp pods
    body.add(cyl(0.04, 0.04, 0.08, PAL.amber, 0.12, 3.18, s * 0.54, HP, 0, 0, 12));
  }
  body.add(ring(0.42, 0.06, PAL.graphite, 0, 2.66, 0, HP, 0, 0));                            // neck bearing

  // arms and gloves
  const gloves = (limb, y) => {
    limb.add(ring(0.16, 0.05, PAL.teal, 0, y + 0.25, 0, HP, 0, 0));
    limb.add(sph(0.19, PAL.graphite, 0, y, 0, 1, 1.15, 1));
    limb.add(cap(0.06, 0.14, PAL.carbon, 0.1, y - 0.2, 0.04, 0, 0, 0.1));
    limb.add(cap(0.06, 0.14, PAL.carbon, 0.03, y - 0.22, -0.06, 0, 0, 0.0));
    limb.add(cap(0.055, 0.12, PAL.carbon, -0.05, y - 0.2, 0.0, 0, 0, -0.1));
    limb.add(cap(0.055, 0.12, PAL.graphite, 0.17, y + 0.02, 0.04, 0, 0, -0.9));
  };
  const armL = makeLimb(0.165, 0.42, 0.42, soft, soft, gloves);
  const armR = makeLimb(0.165, 0.42, 0.42, soft, soft, gloves);
  armL.position.set(0, 2.55, 0.64); armR.position.set(0, 2.55, -0.64);
  armL.add(sph(0.23, PAL.shell, 0, 0.04, 0, 1.05, 0.5, 1.1)); armR.add(sph(0.23, PAL.shell, 0, 0.04, 0, 1.05, 0.5, 1.1));   // shoulder armour
  body.add(armL, armR);
  // flag of Oman patch on the left shoulder
  const patchTex = omanFlagTexture();
  if (patchTex) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3 / FLAG_RATIO), new THREE.MeshStandardMaterial({ map: patchTex, roughness: 0.9 }));
    patch.position.set(0.02, -0.25, -0.2);
    patch.rotation.y = Math.PI;
    armR.add(patch);
  }

  // legs with knee armour and treaded boots
  const boots = (limb, y) => {
    limb.add(ring(0.19, 0.05, PAL.teal, 0, y + 0.26, 0, HP, 0, 0));
    limb.add(cap(0.19, 0.36, PAL.graphite, 0.14, y - 0.06, 0, 0, 0, HP));
    limb.add(box(0.8, 0.1, 0.42, PAL.carbon, 0.14, y - 0.24, 0));
    for (let i = 0; i < 6; i++) limb.add(box(0.03, 0.04, 0.44, PAL.tyre, -0.2 + i * 0.13, y - 0.31, 0));
  };
  const legL = makeLimb(0.21, 0.42, 0.42, soft, soft, boots);
  const legR = makeLimb(0.21, 0.42, 0.42, soft, soft, boots);
  legL.position.set(0, 1.4, 0.27); legR.position.set(0, 1.4, -0.27);
  g.add(legL, legR);

  const flag = buildFlag();
  flag.position.set(0.3, 0, -1.9);
  g.add(flag);
  g.scale.set(0.82, 0.82, 0.82);
  g.userData = { kind: 'astronaut', design: 'SINBAD', body, armL, armR, legL, legR, flag };
  return g;
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
  if (kind === 'rover') return buildRahhal();
  if (kind === 'crewed') return buildQafila();
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
