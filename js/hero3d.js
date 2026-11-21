/* iLab@Home – real-time 3D banners and the opening splash (three.js, physically based materials, ACES tone mapping). */
import * as THREE from './vendor/three.module.min.js';

const R = {}; // renderer state
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eo = x => 1 - Math.pow(1 - x, 3);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let seed = 11; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const MC = {};
const std = (c, o) => { const k = 's' + c + JSON.stringify(o || {}); return MC[k] || (MC[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, metalness: 0 }, o || {}))); };
const phys = (c, o) => { const k = 'p' + c + JSON.stringify(o || {}); return MC[k] || (MC[k] = new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: .4, metalness: 0 }, o || {}))); };
const mesh = (g, m, p, sh = true) => { const x = new THREE.Mesh(g, m); if (p) x.position.set(p[0], p[1], p[2]); x.castShadow = sh; x.receiveShadow = true; return x; };
function ctex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function rr(x, X, Y, w, h, r){ x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function roundShape(w, h, r){ const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function rbox(w, h, d, r, bevel = .04){ const g = new THREE.ExtrudeGeometry(roundShape(w, h, r), { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 10 }); g.translate(0, 0, -(d - bevel * 2) / 2); return g; }
function hexMark(x, X, Y, s, col){ x.save(); x.translate(X, Y); x.scale(s / 64, s / 64); x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
  x.lineWidth = 3.4; x.stroke(new Path2D('M51.5 15.2 32 4 7.5 18.1v27.8L32 60l19.5-11.2')); x.lineWidth = 1.7; x.stroke(new Path2D('M47.6 18.6 32 9.6 12.2 21v22L32 54.4l15.6-9'));
  x.translate(32, 34); x.rotate(-32 * Math.PI / 180); x.translate(-32, -34); x.lineWidth = 2.4; x.stroke(new Path2D('M28.6 20.5v8.1a9.6 9.6 0 1 0 6.8 0v-8.1')); x.stroke(new Path2D('M27 20.5h10')); x.lineWidth = 1.9; x.stroke(new Path2D('M23.4 36.5c3-1.6 5.6 1.4 8.6 0s5.6-1.3 8.6.2')); x.restore(); }
function wordmark(x, X, Y, size, col, at, align){ x.font = `800 ${size}px Inter, Arial`; x.textBaseline = 'middle'; const p = ['i', 'Lab', '@', 'Home']; const ws = p.map(s => x.measureText(s).width); let px = align === 'center' ? X - (ws[0] + ws[1] + ws[2] + ws[3]) / 2 : X; p.forEach((s, i) => { x.fillStyle = i === 0 || i === 2 ? at : col; x.fillText(s, px, Y); px += ws[i]; }); }
const bg = (stops) => ctex(16, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const radialBg = (inner, outer) => ctex(512, 512, (x, w, h) => { const g = x.createRadialGradient(w * .62, h * .42, 10, w * .55, h * .5, w * .75); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, w, h); });
function shadowDisc(r, o = .28){ const t = ctex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(10,20,40,${o})`); g.addColorStop(1, 'rgba(10,20,40,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; }

/* ---------- studio environment for reflections ---------- */
function studioEnv(renderer){
  const s = new THREE.Scene(); const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: bg([[0, '#cfe0ff'], [.45, '#f7fbff'], [.55, '#b9c6dc'], [1, '#2b3346']]) })); s.add(sky);
  const panel = (w, h, p, c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); s.add(m); };
  panel(30, 10, [0, 30, 10], '#ffffff', 4); panel(14, 24, [-30, 6, 8], '#ffe6c4', 2.2); panel(14, 24, [30, 6, -6], '#cfe2ff', 2.6); panel(20, 6, [0, 4, -30], '#ffffff', 1.4);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(s, .04).texture; pm.dispose(); return env;
}

/* ---------- models ---------- */
function vanSideTex(){ return ctex(2048, 512, (x, w, h) => {
  hexMark(x, 40, 110, 290, '#ffffff'); wordmark(x, 360, 200, 190, '#ffffff', '#7cc0ff');
  x.font = '600 92px "IBM Plex Sans Arabic", Arial'; x.fillStyle = '#cfe0ff'; x.textBaseline = 'middle'; x.fillText('آي لاب@هوم · فحوصات منزلية', 370, 360);
  x.strokeStyle = 'rgba(124,192,255,.9)'; x.lineWidth = 10; x.beginPath(); x.moveTo(1620, 420); x.bezierCurveTo(1700, 300, 1820, 520, 1990, 380); x.stroke(); }); }
function vanRearTex(){ return ctex(512, 512, (x, w, h) => { hexMark(x, 156, 70, 200, '#ffffff'); wordmark(x, 256, 330, 76, '#ffffff', '#7cc0ff', 'center'); x.font = '600 34px Inter, Arial'; x.fillStyle = '#9fc4ff'; x.textAlign = 'center'; x.fillText('labathome-oman.vercel.app', 256, 410); }); }
function wheel(){
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; prof.push(new THREE.Vector2(.3 + Math.cos(a) * .14, Math.sin(a) * .16)); }
  const tire = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), std('#15171c', { roughness: .92 })); tire.rotation.x = Math.PI / 2; tire.castShadow = true; g.add(tire);
  const side = mesh(new THREE.CylinderGeometry(.31, .31, .3, 36), std('#1b1e24', { roughness: .9 })); side.rotation.x = Math.PI / 2; g.add(side);
  const rim = mesh(new THREE.CylinderGeometry(.24, .24, .32, 30), phys('#c9d2de', { metalness: 1, roughness: .22 })); rim.rotation.x = Math.PI / 2; g.add(rim);
  const hub = mesh(new THREE.CylinderGeometry(.08, .08, .34, 16), phys('#6b7686', { metalness: 1, roughness: .3 })); hub.rotation.x = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.BoxGeometry(.05, .2, .02), phys('#8892a2', { metalness: 1, roughness: .3 }), [0, 0, .165]); sp.rotation.z = i / 6 * TAU; sp.position.x = Math.sin(i / 6 * TAU) * .12; sp.position.y = Math.cos(i / 6 * TAU) * .12; g.add(sp); const sp2 = sp.clone(); sp2.position.z = -.165; g.add(sp2); }
  return g;
}
function van(){
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const s = new THREE.Shape();
  s.moveTo(-2.3, .5); s.lineTo(2.32, .5); s.quadraticCurveTo(2.5, .52, 2.5, .72); s.lineTo(2.5, 1.0); s.quadraticCurveTo(2.48, 1.2, 2.2, 1.3);
  s.lineTo(1.82, 1.38); s.quadraticCurveTo(1.55, 1.9, 1.2, 2.28); s.quadraticCurveTo(1.05, 2.42, .8, 2.42); s.lineTo(-2.15, 2.44); s.quadraticCurveTo(-2.36, 2.44, -2.36, 2.2); s.lineTo(-2.36, .64); s.quadraticCurveTo(-2.36, .5, -2.3, .5);
  const D = 1.72, BT = .13; const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: BT, bevelSize: .12, bevelSegments: 5, curveSegments: 14 }); geo.translate(0, 0, -D / 2);
  const paint = phys('#13254b', { metalness: .45, roughness: .32, clearcoat: 1, clearcoatRoughness: .06 });
  body.add(mesh(geo, paint));
  const half = D / 2 + BT;
  // lower skirt + blue stripe
  body.add(mesh(new THREE.BoxGeometry(4.86, .2, half * 2 + .02), phys('#2563eb', { metalness: .3, roughness: .35, clearcoat: 1, clearcoatRoughness: .1 }), [.05, 1.0, 0]));
  body.add(mesh(new THREE.BoxGeometry(4.9, .22, half * 2 + .04), std('#20242c', { roughness: .7 }), [.05, .56, 0]));
  // glass
  const glass = phys('#0a1222', { metalness: .1, roughness: .04, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide });
  const ws = mesh(new THREE.PlaneGeometry(half * 2 - .22, 1.1), glass, [0, 0, 0], false); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), .6);
  ws.position.set(1.51 + Math.cos(.6) * .14, 1.83 + Math.sin(.6) * .14, 0); body.add(ws);
  const sideWin = new THREE.ShapeGeometry((() => { const q = new THREE.Shape(); q.moveTo(.55, 1.42); q.lineTo(1.62, 1.42); q.quadraticCurveTo(1.45, 1.85, 1.12, 2.2); q.lineTo(.55, 2.2); q.closePath(); return q; })());
  for (const z of [-1, 1]) {
    body.add(mesh(sideWin, glass, [0, 0, z * (half + .004)], false));
    const w2 = mesh(new THREE.PlaneGeometry(.8, .5), glass, [-1.75, 2.0, z * (half + .004)], false); if (z < 0) w2.rotation.y = Math.PI; body.add(w2);
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(3.3, .82), new THREE.MeshPhysicalMaterial({ map: R.texVan, transparent: true, roughness: .3, clearcoat: 1, metalness: 0 }));
    dec.position.set(-.95, 1.55, z * (half + .006)); if (z < 0) dec.rotation.y = Math.PI; body.add(dec);
    const handle = mesh(new THREE.BoxGeometry(.22, .05, .03), phys('#c0c8d4', { metalness: 1, roughness: .25 }), [.75, 1.3, z * (half + .02)], false); body.add(handle);
    const mirror = new THREE.Group(); mirror.position.set(1.72, 1.55, z * (half + .1)); mirror.add(mesh(new THREE.BoxGeometry(.08, .26, .2), paint)); mirror.add(mesh(new THREE.BoxGeometry(.02, .2, .15), phys('#cfe0ff', { metalness: 1, roughness: .05 }), [.045, 0, 0], false)); body.add(mirror);
  }
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: R.texRear, transparent: true })); rear.position.set(-2.37 - .13, 1.55, 0); rear.rotation.y = -Math.PI / 2; body.add(rear);
  // lights + grille
  const head = phys('#ffffff', { emissive: '#fff6dc', emissiveIntensity: 2.2, roughness: .1 });
  for (const z of [-.68, .68]) { body.add(mesh(new THREE.BoxGeometry(.06, .16, .38), head, [2.6, 1.08, z], false)); body.add(mesh(new THREE.BoxGeometry(.06, .3, .12), phys('#ff3b3b', { emissive: '#ff2a2a', emissiveIntensity: 1.6 }), [-2.5, 1.65, z * 1.18], false)); }
  body.add(mesh(new THREE.BoxGeometry(.05, .26, .9), std('#0b0f17', { roughness: .5 }), [2.6, .82, 0], false));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.5, .14), new THREE.MeshBasicMaterial({ map: ctex(256, 72, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#0d1628'; x.font = '800 40px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('12345 · LH', w / 2, h / 2 + 2); x.fillStyle = '#c8102e'; x.fillRect(0, 0, 18, h); }) })); plate.position.set(2.64, .62, 0); plate.rotation.y = Math.PI / 2; body.add(plate);
  // roof: cold unit + light bar
  body.add(mesh(rbox(1.2, .22, 1.1, .08, .03), std('#eef2f8', { roughness: .4 }), [-1.2, 2.6, 0]));
  const bar = new THREE.Group(); bar.position.set(.55, 2.53, 0); body.add(bar);
  bar.add(mesh(rbox(.36, .14, 1.0, .06, .02), std('#1c2433', { roughness: .4 })));
  R.beacon = [mesh(new THREE.BoxGeometry(.3, .1, .4), phys('#ff2b2b', { emissive: '#ff2020', emissiveIntensity: 1, transparent: true, opacity: .95 }), [0, .09, -.25], false), mesh(new THREE.BoxGeometry(.3, .1, .4), phys('#2b6bff', { emissive: '#2a62ff', emissiveIntensity: 1, transparent: true, opacity: .95 }), [0, .09, .25], false)];
  R.beacon.forEach(b => bar.add(b));
  // wheel arches + wheels
  const arch = std('#0d1118', { roughness: .8, side: THREE.DoubleSide });
  const wheels = [];
  for (const [x, z] of [[1.48, -1], [1.48, 1], [-1.45, -1], [-1.45, 1]]) {
    const a = mesh(new THREE.CircleGeometry(.56, 32, 0, Math.PI), arch, [x, .5, z * (half + .003)], false); body.add(a);
    const w = wheel(); w.position.set(x, .45, z * (half - .1)); g.add(w); wheels.push(w);
  }
  const sh = shadowDisc(3.4, .55); sh.scale.set(1.0, .55, 1); sh.position.y = .012; g.add(sh);
  g.userData = { body, wheels }; return g;
}
function tube(cap, fill){ const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(.11, .11, .9, 28, 1, true), phys('#ffffff', { transmission: 0, transparent: true, opacity: .32, roughness: .05, clearcoat: 1, side: THREE.DoubleSide }), [0, 0, 0], false));
  g.add(mesh(new THREE.SphereGeometry(.11, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), phys('#ffffff', { transparent: true, opacity: .32, roughness: .05 }), [0, -.45, 0], false));
  g.add(mesh(new THREE.CylinderGeometry(.095, .095, .5, 22), phys(fill, { roughness: .25, clearcoat: .6 }), [0, -.17, 0], false));
  g.add(mesh(new THREE.CylinderGeometry(.13, .13, .22, 28), phys(cap, { roughness: .35, clearcoat: .8 }), [0, .53, 0]));
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(.113, .113, .36, 28, 1, true, -1.2, 2.4), new THREE.MeshStandardMaterial({ map: R.texLabel, roughness: .6, transparent: true })); lab.position.y = .05; g.add(lab);
  return g; }
function kitBag(){
  const g = new THREE.Group(); const fab = phys('#14264d', { roughness: .72, sheen: 1, sheenColor: new THREE.Color('#3d6fd6'), sheenRoughness: .5 });
  const b = mesh(rbox(2.4, 1.5, 1.3, .32, .1), fab, [0, .85, 0]); g.add(b);
  g.add(mesh(new THREE.BoxGeometry(2.42, .1, 1.32), phys('#2563eb', { roughness: .4 }), [0, 1.35, 0]));
  const zip = mesh(new THREE.TorusGeometry(.62, .04, 10, 40, Math.PI), phys('#c9d2de', { metalness: 1, roughness: .25 }), [0, 1.6, 0]); g.add(zip);
  const handle = mesh(new THREE.TorusGeometry(.42, .07, 14, 40, Math.PI), phys('#0d1628', { roughness: .5 }), [0, 1.62, 0]); g.add(handle);
  const cross = new THREE.Group(); cross.position.set(-.55, .95, .66); g.add(cross);
  cross.add(mesh(new THREE.CircleGeometry(.36, 40), phys('#ffffff', { roughness: .4 }), [0, 0, .001], false));
  cross.add(mesh(new THREE.BoxGeometry(.14, .44, .03), phys('#e2474f', { roughness: .35 }), [0, 0, .02], false)); cross.add(mesh(new THREE.BoxGeometry(.44, .14, .03), phys('#e2474f', { roughness: .35 }), [0, 0, .02], false));
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .34), new THREE.MeshStandardMaterial({ map: R.texBagLabel, transparent: true, roughness: .5 })); lab.position.set(.42, .95, .66); g.add(lab);
  const sh = shadowDisc(2, .45); sh.scale.set(1.1, .7, 1); sh.position.y = .01; g.add(sh);
  return g;
}
function phone(){
  const g = new THREE.Group();
  g.add(mesh(rbox(1.5, 3.05, .16, .24, .05), phys('#d6dce6', { metalness: 1, roughness: .2 })));
  g.add(mesh(rbox(1.42, 2.97, .17, .2, .03), phys('#0b0f17', { roughness: .1, clearcoat: 1 })));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 2.86), new THREE.MeshBasicMaterial({ map: R.texScreen, toneMapped: false })); scr.position.z = .092; g.add(scr);
  return g;
}
function card(tex, w, h){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })); return m; }
function stethoscope(){ const g = new THREE.Group(); const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push(new THREE.Vector3(Math.sin(u * TAU * .9) * (1.1 - u * .4), 0, Math.cos(u * TAU * .9) * (.9 - u * .3) - u * .8)); }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, .045, 10), std('#1f2633', { roughness: .45 })));
  const cp = mesh(new THREE.CylinderGeometry(.24, .26, .1, 32), phys('#d9e0ea', { metalness: 1, roughness: .18 }), [pts[40].x, .03, pts[40].z]); g.add(cp); g.add(mesh(new THREE.CylinderGeometry(.18, .18, .02, 32), std('#111827'), [pts[40].x, .09, pts[40].z], false)); return g; }
function bpMonitor(){ const g = new THREE.Group(); g.add(mesh(rbox(1.6, 1.15, .7, .22, .06), phys('#f6f8fb', { roughness: .32, clearcoat: .8 }), [0, .6, 0]));
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .62), new THREE.MeshBasicMaterial({ map: R.texBP, toneMapped: false })); lcd.position.set(0, .72, .356); g.add(lcd);
  for (const [x, c] of [[-.4, '#2563eb'], [0, '#0fae9b'], [.4, '#e2474f']]) g.add(mesh(new THREE.CylinderGeometry(.07, .07, .05, 20), phys(c, { roughness: .3 }), [x, .28, .36], false).rotateX(Math.PI / 2));
  const cuff = mesh(new THREE.TorusGeometry(.55, .2, 20, 50, Math.PI * 1.5), phys('#16305e', { roughness: .7, sheen: 1, sheenColor: new THREE.Color('#5b8cff') }), [1.65, .4, -.2]); cuff.rotation.set(Math.PI / 2, 0, .4); g.add(cuff);
  const pts = [new THREE.Vector3(.8, .5, 0), new THREE.Vector3(1.1, .25, .3), new THREE.Vector3(1.4, .3, .1)]; g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .03, 8), std('#1f2633')));
  const sh = shadowDisc(1.6, .4); sh.scale.set(1.5, .7, 1); sh.position.y = .01; g.add(sh); return g; }
function vial(){ const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.32, .32, .9, 32), phys('#ffffff', { transparent: true, opacity: .35, roughness: .04, clearcoat: 1 }), [0, .45, 0], false));
  g.add(mesh(new THREE.CylinderGeometry(.28, .28, .55, 30), phys('#9fd8ff', { roughness: .1, transparent: true, opacity: .85 }), [0, .32, 0], false));
  g.add(mesh(new THREE.CylinderGeometry(.2, .2, .16, 24), phys('#c9d2de', { metalness: 1, roughness: .25 }), [0, .98, 0])); g.add(mesh(new THREE.CylinderGeometry(.34, .34, .14, 32), phys('#0fae9b', { roughness: .4 }), [0, 1.12, 0]));
  const l = new THREE.Mesh(new THREE.CylinderGeometry(.325, .325, .4, 32, 1, true, -1.3, 2.6), new THREE.MeshStandardMaterial({ map: R.texVial, transparent: true })); l.position.y = .5; g.add(l); return g; }
function syringe(){ const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.13, .13, 1.6, 28), phys('#ffffff', { transparent: true, opacity: .4, roughness: .05, clearcoat: 1 }), [0, 0, 0], false));
  g.add(mesh(new THREE.CylinderGeometry(.11, .11, .7, 24), phys('#9fd8ff', { transparent: true, opacity: .8 }), [0, -.4, 0], false)); g.add(mesh(new THREE.CylinderGeometry(.05, .05, .9, 12), std('#e2e8f0'), [0, 1.1, 0])); g.add(mesh(new THREE.CylinderGeometry(.25, .25, .05, 24), std('#e2e8f0'), [0, 1.55, 0]));
  g.add(mesh(new THREE.CylinderGeometry(.01, .01, .7, 8), phys('#d9e0ea', { metalness: 1, roughness: .2 }), [0, -1.15, 0])); g.add(mesh(new THREE.BoxGeometry(.5, .04, .16), std('#e2e8f0'), [0, .8, 0])); return g; }
function house(){ const g = new THREE.Group(); const wall = std('#f5efe2', { roughness: .9 });
  g.add(mesh(new THREE.BoxGeometry(3, 1.8, 2.2), wall, [0, .9, 0])); for (let i = 0; i < 5; i++) if (i % 2 === 0) { g.add(mesh(new THREE.BoxGeometry(.5, .3, .25), wall, [-1.2 + i * .6, 1.95, 1])); g.add(mesh(new THREE.BoxGeometry(.5, .3, .25), wall, [-1.2 + i * .6, 1.95, -1])); }
  g.add(mesh(new THREE.BoxGeometry(3.1, .1, 2.3), std('#e2d3b5'), [0, 1.78, 0])); g.add(mesh(new THREE.BoxGeometry(.7, 1.2, .08), std('#7a4a26', { roughness: .6 }), [0, .6, 1.12]));
  const ar = mesh(new THREE.CylinderGeometry(.35, .35, .08, 16, 1, false, 0, Math.PI), std('#7a4a26', { roughness: .6 }), [0, 1.2, 1.12]); ar.rotation.set(Math.PI / 2, Math.PI / 2, Math.PI / 2); g.add(ar);
  for (const x of [-1, 1]) { g.add(mesh(new THREE.BoxGeometry(.5, .55, .06), std('#ffffff'), [x, 1.0, 1.12], false)); g.add(mesh(new THREE.BoxGeometry(.38, .42, .08), phys('#2a4a7a', { roughness: .2 }), [x, 1.0, 1.13], false)); }
  return g; }
function palm(h = 2.6){ const g = new THREE.Group(); let y = 0, x = 0; const lean = (rnd() - .5) * .3; for (let i = 0; i < 6; i++) { const s = mesh(new THREE.CylinderGeometry(.09 - i * .007, .11 - i * .007, h / 6 + .04, 7), std('#8a6a45'), [x, y + h / 12, 0]); s.rotation.z = -lean; g.add(s); y += h / 6; x += lean * h / 6; }
  const top = new THREE.Group(); top.position.set(x, y, 0); g.add(top); for (let i = 0; i < 9; i++) { const f = mesh(new THREE.ConeGeometry(.2, 1.5, 4), std(i % 2 ? '#3f9b5a' : '#2f7d47', { flatShading: true })); f.scale.set(1, 1, .3); f.position.set(Math.cos(i / 9 * TAU) * .55, -.15, Math.sin(i / 9 * TAU) * .55); f.rotation.set(0, -i / 9 * TAU, 0); f.rotateZ(-Math.PI / 2 + .45); top.add(f); } return g; }

/* ---------- textures ---------- */
function makeTextures(){
  R.texVan = vanSideTex(); R.texRear = vanRearTex();
  R.texLabel = ctex(256, 128, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 46; i++) { x.fillStyle = '#111'; x.fillRect(18 + i * 4.6, 18, (i * 7 % 3) + 1, 60); } x.fillStyle = '#0d1628'; x.font = '700 22px Inter, Arial'; x.fillText('LAH-10254', 20, 106); });
  R.texBagLabel = ctex(512, 170, (x, w, h) => { wordmark(x, 24, 70, 92, '#ffffff', '#7cc0ff'); x.font = '600 40px "IBM Plex Sans Arabic", Arial'; x.fillStyle = '#9fc4ff'; x.textBaseline = 'middle'; x.fillText('آي لاب@هوم', 30, 140); });
  R.texBP = ctex(512, 280, (x, w, h) => { x.fillStyle = '#c9e7dc'; rr(x, 0, 0, w, h, 26); x.fill(); x.fillStyle = '#0c2b22'; x.font = '800 116px Inter, Arial'; x.textBaseline = 'alphabetic'; x.fillText('120', 30, 128); x.font = '800 92px Inter, Arial'; x.fillText('80', 60, 238); x.font = '700 26px Inter, Arial'; x.fillText('SYS mmHg', 270, 60); x.fillText('DIA mmHg', 270, 170);
    x.fillStyle = '#e2474f'; x.font = '800 54px Inter, Arial'; x.fillText('♥ 72', 300, 250); });
  R.texVial = ctex(512, 160, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#0fae9b'; x.fillRect(0, 0, w, 34); x.fillStyle = '#0d1628'; x.font = '800 44px Inter, Arial'; x.fillText('VACCINE', 24, 96); x.font = '600 26px Inter, Arial'; x.fillStyle = '#56657f'; x.fillText('iLab@Home · soon', 24, 136); });
  R.texScreen = ctex(660, 1430, (x, w, h) => {
    x.fillStyle = '#f4f7fc'; x.fillRect(0, 0, w, h); x.fillStyle = '#0d1628'; x.fillRect(0, 0, w, 230); hexMark(x, 34, 70, 96, '#7cc0ff'); wordmark(x, 146, 118, 58, '#ffffff', '#7cc0ff');
    x.fillStyle = '#9fb3d6'; x.font = '600 26px Inter, Arial'; x.fillText('LAH-10254 · Report', 148, 176);
    const card = (y, hh) => { x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(13,22,40,.08)'; x.shadowBlur = 18; rr(x, 30, y, w - 60, hh, 26); x.fill(); x.shadowBlur = 0; };
    card(260, 170); x.fillStyle = '#e3f7f4'; rr(x, 30, 260, w - 60, 170, 26); x.fill(); x.fillStyle = '#0fae9b'; x.beginPath(); x.arc(100, 345, 40, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(82, 346); x.lineTo(96, 360); x.lineTo(120, 330); x.stroke();
    x.fillStyle = '#0b5c52'; x.font = '800 34px Inter, Arial'; x.fillText('Mostly normal', 160, 335); x.font = '500 25px Inter, Arial'; x.fillStyle = '#2d6f66'; x.fillText('1 result needs review', 160, 378);
    const rows = [['Haemoglobin', '14.2', 'g/dL', .55, '#0fae9b', 'Normal'], ['Vitamin D', '22.1', 'ng/mL', .18, '#f2a516', 'Low'], ['HbA1c', '5.2', '%', .45, '#0fae9b', 'Normal'], ['TSH', '1.9', 'mIU/L', .5, '#0fae9b', 'Normal']];
    rows.forEach((r, i) => { const y = 470 + i * 150; card(y, 130); x.fillStyle = '#0d1628'; x.font = '700 30px Inter, Arial'; x.fillText(r[0], 60, y + 50); x.font = '800 34px Inter, Arial'; x.textAlign = 'right'; x.fillText(r[1], w - 160, y + 52); x.font = '500 22px Inter, Arial'; x.fillStyle = '#56657f'; x.fillText(r[2], w - 60, y + 52); x.textAlign = 'left';
      x.fillStyle = '#e6ecf5'; rr(x, 60, y + 84, w - 260, 12, 6); x.fill(); x.fillStyle = r[4]; x.beginPath(); x.arc(60 + (w - 260) * r[3], y + 90, 13, 0, TAU); x.fill();
      x.fillStyle = r[4] === '#0fae9b' ? '#e3f7f4' : '#fff4dc'; rr(x, w - 180, y + 72, 120, 38, 19); x.fill(); x.fillStyle = r[4]; x.font = '700 22px Inter, Arial'; x.textAlign = 'center'; x.fillText(r[5], w - 120, y + 99); x.textAlign = 'left'; });
    card(1080, 230); x.fillStyle = '#0d7c6c'; x.font = '800 28px Inter, Arial'; x.fillText('🩺  Doctor’s advice', 60, 1135); x.fillStyle = '#3b4a66'; x.font = '500 24px Inter, Arial'; ['Vitamin D is low. 15 minutes of', 'morning sun + supplement.', 'Retest in 3 months.'].forEach((l, i) => x.fillText(l, 60, 1185 + i * 36));
    x.fillStyle = '#2563eb'; rr(x, 30, 1340, w - 60, 66, 33); x.fill(); x.fillStyle = '#fff'; x.font = '800 28px Inter, Arial'; x.textAlign = 'center'; x.fillText('Download PDF', w / 2, 1383); x.textAlign = 'left'; });
  const chip = (icon, t1, t2, col, bgc) => ctex(640, 200, (x, w, h) => { x.shadowColor = 'rgba(13,22,40,.25)'; x.shadowBlur = 30; x.shadowOffsetY = 10; x.fillStyle = '#ffffff'; rr(x, 20, 16, w - 40, h - 44, 40); x.fill(); x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = bgc; x.beginPath(); x.arc(100, 94, 50, 0, TAU); x.fill(); x.fillStyle = col; x.font = '700 52px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 100, 98); x.textAlign = 'left'; x.fillStyle = '#0d1628'; x.font = '800 40px Inter, Arial'; x.fillText(t1, 172, 74); x.fillStyle = '#56657f'; x.font = '500 30px Inter, Arial'; x.fillText(t2, 172, 122); });
  R.chips = [chip('✓', 'Normal', 'Haemoglobin 14.2', '#0fae9b', '#e3f7f4'), chip('!', 'Review', 'Vitamin D 22.1', '#b77a00', '#fff4dc'), chip('+', 'Ibra Hospital', '6.7 km · open 24 h', '#e2474f', '#fdecec'), chip('♥', 'Doctor', 'Advice in 24 h', '#0d7c6c', '#dff5ef')];
}

/* ---------- scenes ---------- */
function dunes(){ const g = new THREE.PlaneGeometry(260, 140, 160, 80); const p = g.attributes.position; const col = []; const c1 = new THREE.Color('#e7c58f'), c2 = new THREE.Color('#d9a96a'), c3 = new THREE.Color('#f3dcb0'); const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.abs(y) < 5 ? 0 : (Math.sin(x * .08 + y * .05) * 1.6 + Math.sin(x * .19 - y * .13) * .7 + Math.sin(y * .07) * 1.2) * clamp((Math.abs(y) - 5) / 12); p.setZ(i, d); c.copy(c1).lerp(d > 0 ? c3 : c2, clamp(Math.abs(d) / 2.5)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; }
function ridge(col, z, h, rough, seedOff){ const N = 220, pos = [], idx = []; for (let i = 0; i <= N; i++) { const x = -170 + i / N * 340; const u = x * .045 + seedOff; let y = h * (.55 + .25 * Math.sin(u) + .14 * Math.sin(u * 2.7 + 1.3) + .07 * Math.sin(u * 6.1 + .4) * rough + .04 * Math.sin(u * 13.7) * rough);
    pos.push(x, Math.max(1, y), z, x, -2, z); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); }
function skyDome(stops){ const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { a: { value: new THREE.Color(stops[0]) }, b: { value: new THREE.Color(stops[1]) }, c: { value: new THREE.Color(stops[2]) }, d: { value: new THREE.Color(stops[3]) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 a,b,c,d; varying vec3 vP; void main(){ float y = vP.y; vec3 col = y > .25 ? mix(b, a, smoothstep(.25,.75,y)) : y > .04 ? mix(c, b, smoothstep(.04,.25,y)) : mix(d, c, smoothstep(-.05,.04,y)); gl_FragColor = vec4(col,1.0); }' });
  return new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), m); }
function mountains(col, z, n, h){ const g = new THREE.Group(); for (let i = 0; i < n; i++) { const r = 8 + rnd() * 10, hh = h * (.6 + rnd() * .6); const geo = new THREE.ConeGeometry(r, hh, 6, 2); const p = geo.attributes.position; for (let k = 0; k < p.count; k++) if (p.getY(k) < hh / 2 - .1) { p.setX(k, p.getX(k) * (1 + (rnd() - .5) * .4)); p.setZ(k, p.getZ(k) * (1 + (rnd() - .5) * .4)); } geo.computeVertexNormals(); const m = new THREE.Mesh(geo, std(col, { flatShading: true, roughness: 1 })); m.position.set(-120 + i * (240 / n) + rnd() * 10, hh / 2 - 1, z - rnd() * 10); g.add(m); } return g; }
function sceneVan(){
  const s = new THREE.Scene(); s.add(skyDome(['#3a5596', '#a9a3c9', '#f7c28e', '#ffe6bd'])); s.fog = new THREE.Fog('#f4c999', 40, 210);
  s.add(new THREE.HemisphereLight('#ffe7c9', '#a77a4a', 1.1));
  const sun = new THREE.DirectionalLight('#ffd2a1', 3.4); sun.position.set(-30, 14, -24); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 80 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; s.add(sun);
  const rim = new THREE.DirectionalLight('#9cc2ff', 1.2); rim.position.set(20, 10, 20); s.add(rim);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(11, 48), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false, toneMapped: false })); sunDisc.position.set(-70, 22, -200); s.add(sunDisc);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshBasicMaterial({ map: ctex(256, 256, (x, w, h) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,230,180,.9)'); g.addColorStop(1, 'rgba(255,190,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, fog: false, toneMapped: false })); glow.position.set(-70, 22, -199); s.add(glow);
  s.add(ridge('#c9a08c', -160, 34, 1, 0)); s.add(ridge('#a98068', -120, 24, 1.2, 4)); s.add(ridge('#8f6a55', -85, 13, 1.5, 9));
  const world = new THREE.Group(); s.add(world); const d = dunes(); world.add(d);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 6.4), std('#3b414d', { roughness: .85 })); road.rotation.x = -Math.PI / 2; road.position.y = .02; road.receiveShadow = true; s.add(road);
  const edge = (z) => { const e = new THREE.Mesh(new THREE.PlaneGeometry(260, .14), std('#f2efe6', { roughness: .6 })); e.rotation.x = -Math.PI / 2; e.position.set(0, .03, z); s.add(e); }; edge(3); edge(-3);
  const dashT = ctex(256, 16, (x, w, h) => { x.fillStyle = '#f6c544'; x.fillRect(0, 0, w * .5, h); }); dashT.wrapS = THREE.RepeatWrapping; dashT.repeat.set(52, 1);
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(260, .16), new THREE.MeshStandardMaterial({ map: dashT, transparent: true, roughness: .6 })); dash.rotation.x = -Math.PI / 2; dash.position.y = .031; s.add(dash);
  const v = van(); v.position.set(0, 0, .2); s.add(v);
  const palms = new THREE.Group(); s.add(palms); for (let i = 0; i < 14; i++) { const p = palm(2.4 + rnd() * 1.6); p.position.set(-60 + i * 9 + rnd() * 3, 0, -(5.5 + rnd() * 9)); palms.add(p); }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(90 * 3), 3)), new THREE.PointsMaterial({ color: '#ead3ab', size: .26, transparent: true, opacity: .6, depthWrite: false, map: ctex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }) })); s.add(dust);
  const dp = dust.geometry.attributes.position; const life = Array.from({ length: 90 }, () => rnd());
  const cam = new THREE.PerspectiveCamera(30, 2, .1, 400);
  return { s, cam, update(t, dt, mode){
      const sp = 9; dashT.offset.x = (t * sp / 5) % 1; d.position.x = -((t * sp) % 40); palms.children.forEach(p => { p.position.x -= dt * sp; if (p.position.x < -70) p.position.x += 126; });
      v.userData.wheels.forEach(w => w.rotation.z = -t * sp / .45); v.userData.body.position.y = Math.sin(t * 9) * .012 + Math.sin(t * 2.3) * .01; v.userData.body.rotation.z = Math.sin(t * 1.7) * .004;
      R.beacon.forEach((b, i) => b.material.emissiveIntensity = (Math.sin(t * 10 + i * Math.PI) > 0 ? 2.4 : .3));
      for (let i = 0; i < 90; i++) { life[i] += dt * .9; if (life[i] > 1) life[i] -= 1; const l = life[i]; dp.setXYZ(i, -2.6 - l * 6 + Math.sin(i) * .3, .15 + l * 1.1 + (i % 5) * .05, (i % 2 ? .9 : -.9) * (1 + l * .6) + Math.cos(i * 3) * .3); } dp.needsUpdate = true;
      if (mode === 'splash') { const k = eo(clamp(t / 2.2)); v.position.x = -16 + k * 16; const far = R.portrait ? 15.5 : 10.5; cam.position.set(4.8 - k * 1.2, 1.9, far); cam.lookAt(v.position.x * .3 + (R.portrait ? -1.3 : 0), R.portrait ? 3.4 : 2.2, 0); }
      else { const a = Math.sin(t * .18) * .22; cam.position.set(8.4 * Math.cos(.62 + a), 1.5 + Math.sin(t * .25) * .12, 8.4 * Math.sin(.62 + a) + 3.4); cam.lookAt(-.3, 1.15, 0); }
    } };
}
function sceneKit(){
  const s = new THREE.Scene(); s.background = radialBg('#eaf2ff', '#b9cdf0');
  s.add(new THREE.HemisphereLight('#ffffff', '#9bb0d6', 1.1)); const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(4, 8, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); key.shadow.normalBias = .03; s.add(key);
  const rim = new THREE.DirectionalLight('#9cc2ff', 1.6); rim.position.set(-6, 4, -4); s.add(rim);
  const ped = mesh(new THREE.CylinderGeometry(2.6, 2.75, .4, 64), phys('#ffffff', { roughness: .25, clearcoat: 1 }), [0, -.2, 0]); s.add(ped);
  s.add(mesh(new THREE.TorusGeometry(2.62, .035, 8, 90), phys('#2563eb', { roughness: .3, emissive: '#1d4ed8', emissiveIntensity: .4 }), [0, 0, 0], false)); s.children.at(-1).rotation.x = Math.PI / 2;
  const bag = kitBag(); s.add(bag);
  const caps = [['#7a5af8', '#a21d2d'], ['#f2a516', '#b0242f'], ['#8a94a6', '#9d1d28'], ['#e2474f', '#a8202b'], ['#0fae9b', '#a3212c']];
  const tubes = caps.map(([c, f], i) => { const tb = tube(c, f); s.add(tb); return tb; });
  const cam = new THREE.PerspectiveCamera(30, 2, .1, 100);
  return { s, cam, update(t){ bag.rotation.y = -.45 + Math.sin(t * .4) * .18; tubes.forEach((tb, i) => { const a = t * .45 + i / tubes.length * TAU; tb.position.set(Math.cos(a) * 2.25, 1.6 + Math.sin(t * 1.3 + i) * .25 + (i % 2) * .4, Math.sin(a) * 1.6); tb.rotation.set(Math.sin(t + i) * .35, a, .25 + Math.cos(t * .8 + i) * .2); });
      cam.position.set(Math.sin(t * .15) * 1.2, 3.0, 9.6); cam.lookAt(0, 1.0, 0); } };
}
function scenePhone(){
  const s = new THREE.Scene(); s.background = radialBg('#e8fbf7', '#a9dccf');
  s.add(new THREE.HemisphereLight('#ffffff', '#88b7aa', 1.2)); const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(3, 7, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .03; s.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; floor.receiveShadow = true; s.add(floor);
  const ph = phone(); s.add(ph); const st = stethoscope(); st.position.set(-1.3, -1.86, .6); st.scale.setScalar(.9); s.add(st);
  const cards = R.chips.map((tx, i) => { const c = card(tx, 1.7, .53); s.add(c); return c; });
  const cam = new THREE.PerspectiveCamera(30, 2, .1, 100);
  return { s, cam, update(t){ ph.rotation.set(-.12 + Math.sin(t * .6) * .04, -.38 + Math.sin(t * .35) * .14, .05); ph.position.y = Math.sin(t * .9) * .08;
      cards.forEach((c, i) => { const a = t * .32 + i / cards.length * TAU; c.position.set(Math.cos(a) * 2.0, Math.sin(a * 1.0) * .2 + 1.15 - i * .75, Math.sin(a) * .9 + .6); c.lookAt(cam.position); });
      cam.position.set(Math.sin(t * .12) * .6, .3, 9.2); cam.lookAt(0, 0, 0); } };
}
function sceneSeniors(){
  const s = new THREE.Scene(); s.background = radialBg('#fff4e4', '#f1c99b');
  s.add(new THREE.HemisphereLight('#fff6e8', '#c99a6e', 1.15)); const key = new THREE.DirectionalLight('#ffe2bf', 2.8); key.position.set(-5, 8, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); key.shadow.normalBias = .03; s.add(key);
  const island = new THREE.Group(); s.add(island);
  island.add(mesh(new THREE.CylinderGeometry(4.2, 3.6, .7, 6), std('#ecd6ad', { roughness: 1 }), [0, -.35, 0])); island.add(mesh(new THREE.CylinderGeometry(4.25, 4.25, .08, 6), std('#d9b98a', { roughness: 1 }), [0, .02, 0]));
  const h = house(); h.position.set(-1.2, 0, -1.2); h.rotation.y = .5; island.add(h); const p1 = palm(2.8); p1.position.set(1.6, 0, -2); island.add(p1); const p2 = palm(2.2); p2.position.set(-3, 0, .4); island.add(p2);
  const bp = bpMonitor(); bp.position.set(.9, .05, 1.2); bp.rotation.y = -.35; island.add(bp);
  const heart = new THREE.Group(); const hs = new THREE.Shape(); hs.moveTo(0, -.5); hs.bezierCurveTo(-.9, .1, -.5, .9, 0, .45); hs.bezierCurveTo(.5, .9, .9, .1, 0, -.5);
  heart.add(mesh(new THREE.ExtrudeGeometry(hs, { depth: .2, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 4 }), phys('#e2474f', { roughness: .3, clearcoat: 1 }))); heart.position.set(2.4, 3.1, .4); s.add(heart);
  const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; const k = u > .4 && u < .6 ? [0, .5, -.35, 1, -.6, .2, 0][Math.floor((u - .4) / .2 * 6)] : 0; pts.push(new THREE.Vector3(-3 + u * 6, 3.4 + k * .9, -.5)); }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .05), 200, .045, 8), phys('#e2474f', { emissive: '#e2474f', emissiveIntensity: .5 })); s.add(line);
  const cam = new THREE.PerspectiveCamera(30, 2, .1, 100);
  return { s, cam, update(t){ island.rotation.y = .3 + Math.sin(t * .2) * .25; const b = 1 + Math.max(0, Math.sin(t * 6)) * .12; heart.scale.setScalar(b); heart.rotation.y = Math.sin(t) * .4; line.material.emissiveIntensity = .4 + Math.max(0, Math.sin(t * 6)) * 1.2;
      cam.position.set(Math.sin(t * .1) * 1.5, 5.6, 14); cam.lookAt(0, 1.3, 0); } };
}
function sceneSoon(){
  const s = new THREE.Scene(); s.background = radialBg('#f1ecff', '#c8bbf6');
  s.add(new THREE.HemisphereLight('#ffffff', '#a99ad6', 1.2)); const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .03; s.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.receiveShadow = true; s.add(floor);
  const v1 = vial(); v1.position.set(-.6, 0, 0); s.add(v1); const v2 = vial(); v2.position.set(.5, 0, -.8); v2.scale.setScalar(.8); s.add(v2);
  const sy = syringe(); sy.position.set(1.5, 1.5, .4); sy.scale.setScalar(.7); s.add(sy); v1.scale.setScalar(1.25);
  const stars = []; for (let i = 0; i < 14; i++) { const st = mesh(new THREE.OctahedronGeometry(.08 + rnd() * .08), phys(i % 3 ? '#ffffff' : '#7a5af8', { emissive: i % 3 ? '#ffffff' : '#7a5af8', emissiveIntensity: .8 }), [(rnd() - .5) * 5, .4 + rnd() * 3, (rnd() - .5) * 3], false); s.add(st); stars.push(st); }
  const cam = new THREE.PerspectiveCamera(30, 2, .1, 100);
  return { s, cam, update(t){ v1.rotation.y = t * .5; v2.rotation.y = -t * .4; sy.rotation.set(.3, t * .3, -.6 + Math.sin(t) * .1); sy.position.y = 1.5 + Math.sin(t * 1.2) * .15; stars.forEach((st, i) => { st.rotation.y = t * 2 + i; st.scale.setScalar(.6 + Math.abs(Math.sin(t * 2 + i)) * .8); });
      cam.position.set(Math.sin(t * .15) * 1, 2.4, 7.6); cam.lookAt(.3, 1.0, 0); } };
}

/* ---------- renderer ---------- */
async function fonts(){ try { await Promise.race([Promise.all(['800 100px Inter', '600 60px Inter', '600 60px "IBM Plex Sans Arabic"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch(e) {} }
function makeRenderer(canvas){
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace; return r;
}
const BUILD = [sceneVan, sceneKit, scenePhone, sceneSeniors, sceneSoon];
async function ensure(canvas){
  if (R.canvas === canvas && R.r) return;
  if (R.r) { R.r.dispose(); R.r.forceContextLoss(); R.r = null; }
  await fonts();
  R.canvas = canvas; R.r = makeRenderer(canvas); if (!R.env) R.env = studioEnv(R.r); else { R.env = studioEnv(R.r); }
  if (!R.texVan) makeTextures();
  if (!R.scenes) R.scenes = [];
}
function scene(i){ if (!R.scenes[i]) { R.scenes[i] = BUILD[i](); R.scenes[i].s.environment = R.env; } return R.scenes[i]; }
function size(){ const c = R.canvas; const w = c.clientWidth || 1, h = c.clientHeight || 1; if (c.width !== Math.round(w * R.r.getPixelRatio()) || c.height !== Math.round(h * R.r.getPixelRatio())) R.r.setSize(w, h, false); return [w, h]; }
function frame(sc, w, h, shift){
  const a = w / h; sc.cam.aspect = a; sc.cam.fov = a < 1 ? 42 : a < 1.5 ? 34 : 30;
  if (shift && a > 1.25) sc.cam.setViewOffset(w, h, -w * .2, 0, w, h); else if (shift && a <= 1.25) sc.cam.setViewOffset(w, h, 0, -h * .12, w, h); else sc.cam.clearViewOffset();
  sc.cam.updateProjectionMatrix();
}
let loopOn = false, last = 0, T0 = performance.now();
function loop(now){
  if (!R.r || !R.canvas || !R.canvas.isConnected) { loopOn = false; if (R.r) { R.r.dispose(); R.r.forceContextLoss(); R.r = null; R.canvas = null; } return; }
  requestAnimationFrame(loop);
  if (document.hidden || R.offscreen) { last = now; return; }
  const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; const t = (now - T0) / 1000;
  const sc = scene(R.cur || 0); const [w, h] = size(); frame(sc, w, h, true); sc.update(t, dt, 'banner'); R.r.render(sc.s, sc.cam);
}
export async function init(canvas){
  await ensure(canvas); scene(0);
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { R.offscreen = !es[0].isIntersecting; }); io.observe(canvas); }
  if (!loopOn) { loopOn = true; last = performance.now(); requestAnimationFrame(loop); }
  return true;
}
export function show(i){ R.cur = i; scene(i); }
export function count(){ return BUILD.length; }
/* opening splash: the van drives in, then the caller fades the overlay */
export async function splash(canvas, ms = 2600){
  await fonts(); const r = makeRenderer(canvas); const env = studioEnv(r); if (!R.texVan) makeTextures(); const sc = sceneVan(); sc.s.environment = env;
  const t0 = performance.now(); let lastT = t0;
  return new Promise(res => { const step = now => { const t = (now - t0) / 1000; const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
      const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; R.portrait = w / h < 1; if (canvas.width !== Math.round(w * r.getPixelRatio())) r.setSize(w, h, false);
      frame(sc, w, h, false); sc.cam.fov = w / h < 1 ? 40 : 30; sc.cam.updateProjectionMatrix(); sc.update(t, dt, 'splash'); r.render(sc.s, sc.cam);
      if (now - t0 < ms && canvas.isConnected) requestAnimationFrame(step); else { res(); setTimeout(() => { r.dispose(); r.forceContextLoss(); }, 800); } };
    requestAnimationFrame(step); });
}
/* film mode: fixed-size, frame-by-frame rendering for the explainer video */
export async function filmSetup(canvas, w, h){
  await fonts(); const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h, false);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  R.r = r; R.canvas = null; R.env = studioEnv(r); if (!R.texVan) makeTextures(); R.scenes = []; R.fw = w; R.fh = h;
}
export function filmRender(i, t, ox = 0, oy = 0, fov = 30){
  const sc = scene(i); const w = R.fw, h = R.fh; sc.cam.aspect = w / h; sc.cam.fov = fov;
  if (ox || oy) sc.cam.setViewOffset(w, h, -w * ox, -h * oy, w, h); else sc.cam.clearViewOffset(); sc.cam.updateProjectionMatrix();
  sc.update(t, 1 / 30, 'banner'); R.r.render(sc.s, sc.cam);
}
