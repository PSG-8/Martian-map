// iLab@home – character film. 3D cast, sets and reactions; setT(t) draws frame t (seconds).
import * as THREE from './three.module.js';
const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const eo = x => 1 - Math.pow(1 - x, 3);
const back = x => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
let seed = 21; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const MC = {};
const std = (c, o) => { const k = 's' + c + JSON.stringify(o || {}); return MC[k] || (MC[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .75 }, o || {}))); };
const phys = (c, o) => { const k = 'p' + c + JSON.stringify(o || {}); return MC[k] || (MC[k] = new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: .4 }, o || {}))); };
const mesh = (g, m, p, sh = true) => { const x = new THREE.Mesh(g, m); if (p) x.position.set(p[0], p[1], p[2]); x.castShadow = sh; x.receiveShadow = true; return x; };
function ctex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function rr(x, X, Y, w, h, r){ x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function roundShape(w, h, r){ const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function rbox(w, h, d, r, bv = .03){ const g = new THREE.ExtrudeGeometry(roundShape(w, h, r), { depth: Math.max(.001, d - bv * 2), bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 8 }); g.translate(0, 0, -(d - bv * 2) / 2); return g; }
function wordmark(x, X, Y, size, col, at, align){ x.font = `800 ${size}px Poppins, Inter, Arial`; x.textBaseline = 'middle'; const p = ['i', 'Lab', '@', 'home']; const ws = p.map(s => x.measureText(s).width); let px = align === 'center' ? X - ws.reduce((a, b) => a + b, 0) / 2 : X; p.forEach((s, i) => { x.fillStyle = i === 0 || i === 2 ? at : col; x.fillText(s, px, Y); px += ws[i]; }); }

/* ======================= CHARACTERS ======================= */
const SKIN = { a: '#C68E62', b: '#B98055', c: '#D9A37A', d: '#8E5B3C', fair: '#F1CDB1', tan: '#A86F4A' };
const TEX = {};
function texKumma(){ return TEX.k || (TEX.k = ctex(512, 128, (x, w, h) => { x.fillStyle = '#FBFAF6'; x.fillRect(0, 0, w, h); const cols = ['#C8102E', '#1F6FB2', '#E8A317', '#2E8B57'];
  for (let i = 0; i < 32; i++) { const cx = i * 16 + 8; x.strokeStyle = cols[i % 4]; x.lineWidth = 2.4; x.beginPath(); x.moveTo(cx, 18); x.lineTo(cx + 7, 30); x.lineTo(cx, 42); x.lineTo(cx - 7, 30); x.closePath(); x.stroke(); x.fillStyle = cols[(i + 2) % 4]; x.fillRect(cx - 2, 28, 4, 4); }
  x.fillStyle = '#1F6FB2'; x.fillRect(0, 52, w, 3); for (let i = 0; i < 64; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.arc(i * 8 + 4, 72, 2.2, 0, TAU); x.fill(); } x.fillStyle = '#C8102E'; x.fillRect(0, 88, w, 2);
  for (let i = 0; i < 21; i++) { x.strokeStyle = '#E8A317'; x.lineWidth = 2; x.beginPath(); x.arc(i * 25 + 12, 110, 7, 0, TAU); x.stroke(); } })); }
function texMassar(){ return TEX.m || (TEX.m = ctex(512, 256, (x, w, h) => { x.fillStyle = '#EAD9B5'; x.fillRect(0, 0, w, h); const st = ['#7A1F2B', '#1E4E79', '#3C7A3B', '#C9A227', '#7A1F2B'];
  for (let y = 0; y < h; y += 26) { x.fillStyle = st[(y / 26) % st.length]; x.fillRect(0, y, w, 7); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, y + 9, w, 2); }
  for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(122,31,43,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(i * 13, 0); x.lineTo(i * 13 + 30, h); x.stroke(); } })); }
function texFiligree(){ return TEX.f || (TEX.f = ctex(256, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#8E96A3'); g.addColorStop(.5, '#F4F6F9'); g.addColorStop(1, '#9AA3B0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(70,78,92,.85)'; x.lineWidth = 2.2; for (let y = 10; y < h; y += 30) { for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(28 + i * 50, y, 11, 0, TAU); x.stroke(); x.beginPath(); x.arc(28 + i * 50, y, 4, 0, TAU); x.stroke(); } x.beginPath(); x.moveTo(0, y + 15); for (let i = 0; i <= 10; i++) x.lineTo(i * 26, y + 15 + (i % 2 ? 5 : -5)); x.stroke(); }
  for (let y = 0; y < h; y += 120) { x.fillStyle = 'rgba(60,66,78,.7)'; x.fillRect(0, y, w, 5); } })); }
function texBadge(){ return TEX.b || (TEX.b = ctex(256, 96, (x, w, h) => { x.fillStyle = '#fff'; rr(x, 2, 2, w - 4, h - 4, 14); x.fill(); wordmark(x, w / 2, 40, 40, '#0D1628', '#2563EB', 'center'); x.fillStyle = '#56657f'; x.font = '600 18px Inter'; x.textAlign = 'center'; x.fillText('NURSE', w / 2, 76); })); }
function texShirtLogo(dark){ return ctex(256, 96, (x, w, h) => { wordmark(x, w / 2, 48, 46, dark ? '#0D1628' : '#ffffff', dark ? '#2563EB' : '#7CC0FF', 'center'); }); }

function makeChar(o){
  const g = new THREE.Group(); const P = { root: g }; const sk = std(o.skin || SKIN.a, { roughness: .62 }); const s = o.scale || 1;
  const hips = new THREE.Group(); hips.position.y = o.kid ? .62 : .92; g.add(hips); P.hips = hips;
  const torso = new THREE.Group(); hips.add(torso); P.torso = torso;
  const cloth = std(o.cloth || '#F7F4EC', { roughness: .85 });
  // body
  if (o.robe) { // dishdasha / abaya – flowing to the floor
    const prof = [[0, .66], [.13, .66], [.2, .62], [.29, .52], [.3, .32], [.28, .12], [.3, -.2], [.34, -.55], [.37, -.86], [.3, -.9], [0, -.9]].map(([r, y]) => new THREE.Vector2(r * (o.kid ? .9 : 1), y * (o.kid ? .68 : 1)));
    torso.add(mesh(new THREE.LatheGeometry(prof, 40), cloth));
    if (o.tassel) { const tl = mesh(new THREE.CylinderGeometry(.012, .016, .26, 8), std(o.tassel, { roughness: .6 }), [0, o.kid ? .3 : .46, .285]); tl.rotation.x = -.12; torso.add(tl); torso.add(mesh(new THREE.SphereGeometry(.025, 10, 8), std(o.tassel), [0, o.kid ? .17 : .33, .3])); }
    if (o.abayaTrim) { torso.add(mesh(new THREE.CylinderGeometry(.372, .37, .035, 40, 1, true), std(o.abayaTrim, { metalness: .5, roughness: .4, side: THREE.DoubleSide }), [0, -.84, 0])); }
  } else { // shirt / scrubs / coat + trousers
    const sh = new THREE.LatheGeometry([[0, .66], [.13, .66], [.21, .62], [.27, .52], [.27, .2], [.25, 0], [.24, -.08], [0, -.08]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
    torso.add(mesh(sh, cloth));
    if (o.coat) { const cg = new THREE.LatheGeometry([[.0, .66], [.14, .66], [.22, .62], [.285, .52], [.29, .2], [.3, -.1], [.32, -.42]].map(([r, y]) => new THREE.Vector2(r, y)), 36, -Math.PI * .82, Math.PI * 1.64); torso.add(mesh(cg, std('#FFFFFF', { roughness: .7, side: THREE.DoubleSide }))); }
    if (o.logo) { const lg = new THREE.Mesh(new THREE.PlaneGeometry(.2, .075), new THREE.MeshStandardMaterial({ map: o.logo, transparent: true, roughness: .7 })); lg.position.set(-.11, .45, .262); lg.rotation.y = -.25; torso.add(lg); }
    if (o.badge) { const bd = new THREE.Mesh(new THREE.PlaneGeometry(.13, .05), new THREE.MeshStandardMaterial({ map: texBadge(), roughness: .5 })); bd.position.set(.12, .44, .263); bd.rotation.y = .25; torso.add(bd); }
    const pants = std(o.pants || '#2B3445', { roughness: .8 });
    for (const sx of [-1, 1]) { const lp = new THREE.Group(); lp.position.set(sx * .12, -.04, 0); hips.add(lp); lp.add(mesh(new THREE.CapsuleGeometry(.1, .62, 6, 14), pants, [0, -.42, 0])); lp.add(mesh(new THREE.SphereGeometry(.11, 14, 10), std(o.shoes || '#1B1F27', { roughness: .5 }), [0, -.86, .05])).scale.set(1, .6, 1.5); P[sx < 0 ? 'legR' : 'legL'] = lp; }
  }
  if (o.belt === 'khanjar') { // leather belt with silver work + a Suri-style khanjar, fully silver-clad
    const leather = ctex(1024, 64, (x, w, h) => { x.fillStyle = '#5A3418'; x.fillRect(0, 0, w, h); x.fillStyle = '#D9DEE5'; for (let i = 0; i < w; i += 16) { x.fillRect(i, 6, 8, 4); x.fillRect(i + 8, h - 10, 8, 4); } x.strokeStyle = '#C9CED6'; x.lineWidth = 3; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 20); x.lineTo(i + 16, 44); x.lineTo(i + 32, 20); x.stroke(); } });
    torso.add(mesh(new THREE.CylinderGeometry(.302, .306, .085, 48, 1, true), std('#ffffff', { map: leather, roughness: .55, side: THREE.DoubleSide }), [0, .2, 0]));
    const kh = new THREE.Group(); kh.position.set(0, .2, .315); kh.scale.setScalar(1.22); torso.add(kh); P.khanjar = kh;
    const silver = phys('#E9EDF2', { metalness: 1, roughness: .2, map: texFiligree(), clearcoat: .7, clearcoatRoughness: .1 });
    const bright = phys('#F4F6F9', { metalness: 1, roughness: .14 });
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.1, .008), new THREE.Vector3(.012, -.2, .02), new THREE.Vector3(.05, -.27, .03), new THREE.Vector3(.11, -.3, .037), new THREE.Vector3(.17, -.27, .042), new THREE.Vector3(.2, -.19, .046), new THREE.Vector3(.205, -.13, .046)]);
    const sheath = new THREE.TubeGeometry(curve, 90, .05, 20, false); const pos = sheath.attributes.position, uv = sheath.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const u = uv.getX(i); const p = new THREE.Vector3().fromBufferAttribute(pos, i); const c = curve.getPointAt(Math.min(u, .999)); const k = lerp(1.35, .36, Math.pow(u, .8)); p.sub(c).multiplyScalar(k); p.z *= .5; p.add(c); pos.setXYZ(i, p.x, p.y, p.z); }
    sheath.computeVertexNormals(); kh.add(mesh(sheath, silver));
    for (let j = 0; j < 9; j++) { const u = .04 + j * .1; const c = curve.getPointAt(u), tg = curve.getTangentAt(u); const r = mesh(new THREE.TorusGeometry(lerp(.064, .022, Math.pow(u, .8)), .008, 8, 28), bright, [c.x, c.y, c.z]); r.scale.z = .5; r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); kh.add(r); }
    for (const sx of [-1, 1]) { const ring = mesh(new THREE.TorusGeometry(.028, .007, 8, 20), bright, [sx * .07, -.02, -.005]); ring.rotation.y = Math.PI / 2; kh.add(ring); }
    const tip = curve.getPointAt(1); kh.add(mesh(new THREE.SphereGeometry(.026, 16, 12), bright, [tip.x, tip.y + .012, tip.z])); kh.add(mesh(new THREE.ConeGeometry(.012, .04, 10), bright, [tip.x, tip.y + .045, tip.z]));
    kh.add(mesh(new THREE.CylinderGeometry(.07, .068, .03, 28), bright, [0, .012, 0])).scale.set(1.15, 1, .6);
    const grip = mesh(new THREE.LatheGeometry([[0, 0], [.04, 0], [.033, .04], [.036, .08], [.045, .11], [0, .11]].map(([r, y]) => new THREE.Vector2(r, y)), 24), silver, [0, .025, 0]); grip.scale.z = .75; kh.add(grip);
    const crown = mesh(new THREE.CylinderGeometry(.088, .062, .03, 32), bright, [0, .148, 0]); crown.scale.set(1.2, 1, .62); kh.add(crown);
    const dome = mesh(new THREE.SphereGeometry(.05, 20, 10, 0, TAU, 0, Math.PI / 2), silver, [0, .162, 0]); dome.scale.set(1.5, .5, .8); kh.add(dome);
    for (let i = 0; i < 12; i++) kh.add(mesh(new THREE.SphereGeometry(.0085, 8, 6), bright, [Math.cos(i / 12 * TAU) * .1, .15, Math.sin(i / 12 * TAU) * .052]));
  }
  // neck + head
  torso.add(mesh(new THREE.CylinderGeometry(.075, .085, .12, 16), sk, [0, .7, 0]));
  const head = new THREE.Group(); head.position.y = o.kid ? .72 : .98; torso.add(head); P.head = head; if (o.kid) head.position.y = .62;
  const hs = o.kid ? 1.12 : 1; head.scale.setScalar(hs);
  const skull = mesh(new THREE.SphereGeometry(.29, 32, 24), sk); skull.scale.set(1, 1.08, 1); head.add(skull);
  for (const sx of [-1, 1]) { head.add(mesh(new THREE.SphereGeometry(.055, 12, 10), sk, [sx * .285, -.01, 0])); }
  head.add(mesh(new THREE.SphereGeometry(.045, 12, 10), sk, [0, -.04, .285]));
  const eyes = []; for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * .105, .045, .245); head.add(e);
    e.add(mesh(new THREE.SphereGeometry(.058, 18, 14), std('#FFFFFF', { roughness: .25 }), [0, 0, 0], false)); const ir = mesh(new THREE.SphereGeometry(.034, 16, 12), std(o.eye || '#3B2416', { roughness: .3 }), [0, 0, .035], false); e.add(ir);
    e.add(mesh(new THREE.SphereGeometry(.011, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), [.012, .014, .066], false)); eyes.push(e);
    const lid = mesh(new THREE.SphereGeometry(.061, 18, 10, 0, TAU, 0, Math.PI / 2), sk, [0, 0, 0], false); lid.rotation.x = -1.4; e.add(lid); e.userData.lid = lid;
    const br = mesh(new THREE.CapsuleGeometry(.014, .07, 4, 8), std(o.brow || '#2A1A10'), [sx * .105, .135, .262], false); br.rotation.z = Math.PI / 2 + sx * .12; head.add(br); P[sx < 0 ? 'browR' : 'browL'] = br; }
  P.eyes = eyes;
  const mouth = new THREE.Group(); mouth.position.set(0, -.115, .262); head.add(mouth); P.mouth = mouth;
  const smile = mesh(new THREE.TorusGeometry(.06, .013, 8, 20, Math.PI), std('#6B2A20'), [0, 0, 0], false); smile.rotation.z = Math.PI; mouth.add(smile); P.smile = smile;
  const open = mesh(new THREE.CircleGeometry(.055, 20, Math.PI, Math.PI), std('#4A1712'), [0, .002, .006], false); open.scale.y = 0; mouth.add(open); P.open = open;
  head.add(mesh(new THREE.CircleGeometry(.04, 16), new THREE.MeshBasicMaterial({ color: '#F08A8A', transparent: true, opacity: .28 }), [-.17, -.07, .245], false)); head.add(mesh(new THREE.CircleGeometry(.04, 16), new THREE.MeshBasicMaterial({ color: '#F08A8A', transparent: true, opacity: .28 }), [.17, -.07, .245], false));
  if (o.beard) { const bd = mesh(new THREE.SphereGeometry(.27, 28, 14, 0, TAU, Math.PI * .64, Math.PI * .3), std(o.beard, { roughness: .95 }), [0, -.03, .035]); bd.scale.set(1.05, 1.15, 1.04); head.add(bd);
    const mus = mesh(new THREE.CapsuleGeometry(.018, .09, 4, 8), std(o.beard), [0, -.08, .27], false); mus.rotation.z = Math.PI / 2; head.add(mus); }
  if (o.glasses) { for (const sx of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(.07, .009, 8, 24), std('#1B1F27', { roughness: .3 }), [sx * .105, .045, .3], false); head.add(r); } head.add(mesh(new THREE.BoxGeometry(.06, .01, .01), std('#1B1F27'), [0, .05, .3], false)); }
  // headwear / hair
  const hw = o.head;
  if (hw === 'kumma') { const k = mesh(new THREE.CylinderGeometry(.285, .3, .2, 40, 1, true), std('#ffffff', { map: texKumma(), roughness: .8, side: THREE.DoubleSide }), [0, .21, -.01]); head.add(k); head.add(mesh(new THREE.CircleGeometry(.285, 40), std('#FBFAF6'), [0, .31, -.01]).rotateX(-Math.PI / 2)); }
  if (hw === 'massar') { const base = mesh(new THREE.CylinderGeometry(.31, .32, .22, 40), std('#ffffff', { map: texMassar(), roughness: .9 }), [0, .2, -.015]); head.add(base);
    for (let i = 0; i < 3; i++) { const t = mesh(new THREE.TorusGeometry(.3 - i * .025, .06, 12, 40), std('#ffffff', { map: texMassar(), roughness: .9 }), [0, .2 + i * .07, -.015]); t.rotation.x = Math.PI / 2; t.rotation.z = i * .7; head.add(t); }
    const tail = mesh(new THREE.ConeGeometry(.07, .18, 10), std('#ffffff', { map: texMassar() }), [.2, .36, -.15]); tail.rotation.z = -1; head.add(tail); }
  if (hw === 'hijab') { const hj = mesh(new THREE.SphereGeometry(.335, 40, 24, Math.PI / 2 + .82, TAU - 1.64), std(o.hijab || '#1E3A7A', { roughness: .85, side: THREE.DoubleSide }), [0, .02, -.03]); hj.scale.set(1, 1.08, 1); head.add(hj);
    const fr = mesh(new THREE.TorusGeometry(.245, .05, 12, 40), std(o.hijab || '#1E3A7A', { roughness: .85 }), [0, .015, .17]); fr.scale.set(.92, 1.12, 1); head.add(fr);
    torso.add(mesh(new THREE.LatheGeometry([[.0, .9], [.22, .85], [.3, .7], [.34, .55], [.3, .5]].map(([r, y]) => new THREE.Vector2(r, y)), 36), std(o.hijab || '#1E3A7A', { roughness: .85, side: THREE.DoubleSide }))); }
  if (hw === 'short') { const hr = mesh(new THREE.SphereGeometry(.3, 28, 16, 0, TAU, 0, Math.PI * .45), std(o.hair || '#1B140F', { roughness: .9 }), [0, .03, -.02]); hr.scale.set(1.04, 1.1, 1.06); head.add(hr); }
  if (hw === 'bun' || hw === 'long' || hw === 'braid') { const hr = mesh(new THREE.SphereGeometry(.305, 28, 18, 0, TAU, 0, Math.PI * .55), std(o.hair, { roughness: .8 }), [0, .02, -.03]); hr.scale.set(1.05, 1.12, 1.08); head.add(hr);
    if (hw === 'bun') head.add(mesh(new THREE.SphereGeometry(.13, 18, 14), std(o.hair, { roughness: .8 }), [0, .27, -.2]));
    if (hw === 'long') { const lh = mesh(new THREE.CapsuleGeometry(.24, .32, 6, 18), std(o.hair, { roughness: .8 }), [0, -.22, -.12]); lh.scale.set(1.1, 1, .55); head.add(lh); }
    if (hw === 'braid') for (let i = 0; i < 6; i++) head.add(mesh(new THREE.SphereGeometry(.065 - i * .004, 12, 10), std(o.hair, { roughness: .8 }), [.08, -.22 - i * .1, -.2 - i * .01])); }
  if (o.cap) { head.add(mesh(new THREE.SphereGeometry(.305, 28, 14, 0, TAU, 0, Math.PI * .45), std(o.cap, { roughness: .7 }), [0, .05, -.02])); const vz = mesh(new THREE.CylinderGeometry(.2, .2, .02, 24, 1, false, -Math.PI / 2, Math.PI), std(o.cap), [0, .15, .2]); vz.rotation.x = .25; head.add(vz);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(.22, .08), new THREE.MeshBasicMaterial({ map: texShirtLogo(false), transparent: true })); lg.position.set(0, .23, .265); lg.rotation.x = -.35; head.add(lg); }
  // arms (shoulder -> elbow -> hand)
  const sleeve = std(o.sleeve || o.cloth || '#F7F4EC', { roughness: .85 });
  for (const sx of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(sx * (o.kid ? .25 : .29), o.kid ? .4 : .55, 0); torso.add(sh);
    sh.add(mesh(new THREE.CapsuleGeometry(.075, .26, 6, 12), o.coat ? std('#ffffff', { roughness: .7 }) : sleeve, [0, -.17, 0]));
    const el = new THREE.Group(); el.position.y = -.34; sh.add(el); el.add(mesh(new THREE.CapsuleGeometry(.066, .22, 6, 12), o.shortSleeve ? sk : (o.coat ? std('#ffffff', { roughness: .7 }) : sleeve), [0, -.14, 0]));
    const hand = new THREE.Group(); hand.position.y = -.31; el.add(hand); hand.add(mesh(new THREE.SphereGeometry(.075, 16, 12), sk)); const th = mesh(new THREE.CapsuleGeometry(.024, .05, 4, 8), sk, [sx * -.06, .02, .04]); th.rotation.z = sx * .6; hand.add(th); hand.userData.thumb = th;
    sh.rotation.z = sx * .1; P[sx < 0 ? 'shR' : 'shL'] = sh; P[sx < 0 ? 'elR' : 'elL'] = el; P[sx < 0 ? 'handR' : 'handL'] = hand; }
  if (o.steth) { const pts = [new THREE.Vector3(-.16, .62, .2), new THREE.Vector3(-.2, .35, .27), new THREE.Vector3(-.06, .2, .3), new THREE.Vector3(.08, .3, .29), new THREE.Vector3(.15, .62, .2)]; torso.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .014, 8), std('#1F2633', { roughness: .4 }))); torso.add(mesh(new THREE.CylinderGeometry(.045, .045, .02, 20), phys('#D9E0EA', { metalness: 1, roughness: .2 }), [-.06, .19, .31]).rotateX(Math.PI / 2)); }
  // soft contact shadow
  const shd = new THREE.Mesh(new THREE.CircleGeometry(.45, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .22, depthWrite: false })); shd.rotation.x = -Math.PI / 2; shd.position.y = .005; g.add(shd);
  g.scale.setScalar(s); g.userData.P = P; g.userData.o = o; return g;
}
/* poses – everything is a pure function of time so frames render deterministically */
function pose(ch, t, a = {}){
  const P = ch.userData.P, o = ch.userData.o;
  const br = Math.sin(t * 2.2 + (o.ph || 0)) * .012; P.torso.position.y = br; P.torso.rotation.z = Math.sin(t * 1.1 + (o.ph || 0)) * .015;
  P.head.rotation.set(Math.sin(t * .9 + (o.ph || 0)) * .04 + (a.nod ? Math.sin(a.nod * TAU * 2) * .22 * Math.sin(a.nod * Math.PI) : 0) + (a.look ? a.look[1] : 0), (a.look ? a.look[0] : 0) + Math.sin(t * .6 + (o.ph || 0)) * .06, a.tilt || 0);
  // blink every ~3.5 s
  const bl = ((t + (o.ph || 0)) % 3.7); const lid = bl < .12 ? 1 - Math.abs(bl - .06) / .06 : 0; P.eyes.forEach(e => { e.userData.lid.rotation.x = -1.4 + lid * 1.3; });
  const happy = a.happy || 0; P.smile.scale.set(1 + happy * .35, 1 + happy * .5, 1); P.open.scale.y = clamp(a.open || happy * .9); P.browL.position.y = P.browR.position.y = .135 + happy * .02;
  // arms
  const set = (side, s0, e0) => { const sh = P['sh' + side], el = P['el' + side]; sh.rotation.set(s0[0], s0[1] || 0, s0[2]); el.rotation.set(e0[0], 0, e0[1] || 0); };
  const sL = a.armL || [0, 0, .1], sR = a.armR || [0, 0, -.1];
  set('L', sL, a.elL || [-.15]); set('R', sR, a.elR || [-.15]);
  if (a.wave != null) { const w = a.wave; const up = eo(clamp(w * 3)); const sd = a.waveSide || 'L', sg = sd === 'L' ? 1 : -1; P['sh' + sd].rotation.z = sg * lerp(.1, 2.6, up); P['sh' + sd].rotation.x = -.2 * up; P['el' + sd].rotation.z = sg * up * (.3 + Math.sin(t * 9) * .35); }
  if (a.cheer != null) { const up = eo(clamp(a.cheer * 3)); P.shL.rotation.z = lerp(.1, 2.75, up); P.shR.rotation.z = lerp(-.1, -2.75, up); P.elL.rotation.z = up * (.2 + Math.sin(t * 10) * .15); P.elR.rotation.z = -up * (.2 + Math.sin(t * 10 + 1) * .15); }
  if (a.thumbs != null) { const up = back(clamp(a.thumbs * 2.5)); P.shR.rotation.x = -1.1 * up; P.shR.rotation.z = -.25 * up; P.elR.rotation.x = -1.2 * up; P.handR.userData.thumb.rotation.z = lerp(-.6, -.1, up); P.handR.userData.thumb.position.y = lerp(.02, .08, up); }
  if (a.salute != null) { const up = eo(clamp(a.salute * 3)); P.shR.rotation.z = lerp(-.1, -2.1, up); P.shR.rotation.x = -.6 * up; P.elR.rotation.z = -2.1 * up; }
  if (a.hold) { P.shR.rotation.x = -.75; P.shR.rotation.z = -.15; P.elR.rotation.x = -1.0; }
  if (a.holdL) { P.shL.rotation.x = -.75; P.shL.rotation.z = .15; P.elL.rotation.x = -1.0; }
  if (a.carry) { P.shL.rotation.x = -.6; P.shR.rotation.x = -.6; P.shL.rotation.z = .35; P.shR.rotation.z = -.35; P.elL.rotation.x = -.9; P.elR.rotation.x = -.9; }
  if (a.hi5 != null) { const up = eo(clamp(a.hi5 * 3)); const side = a.hi5side || 'R'; const sgn = side === 'L' ? 1 : -1; P['sh' + side].rotation.z = sgn * lerp(.1, 2.3, up); P['sh' + side].rotation.y = sgn * -.4 * up; P['el' + side].rotation.z = sgn * .2 * up; }
  // body
  const jump = a.jump != null ? Math.max(0, Math.sin(clamp(a.jump) * Math.PI * 3)) * .28 * (1 - clamp(a.jump) * .3) : 0;
  P.hips.position.y = (o.kid ? .62 : .92) + jump;
  if (P.legL && a.walk != null) { const w = Math.sin(a.walk * TAU); P.legL.rotation.x = w * .45; P.legR.rotation.x = -w * .45; P.hips.position.y += Math.abs(Math.cos(a.walk * TAU)) * .03; P.shL.rotation.x = -w * .3; P.shR.rotation.x = w * .3; }
}

/* ======================= PROPS & SETS ======================= */
function studioEnv(r){ const s = new THREE.Scene(); const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: ctex(16, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfe0ff'); g.addColorStop(.48, '#fff8ee'); g.addColorStop(.55, '#c9b9a0'); g.addColorStop(1, '#3b3a3a'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) })); s.add(sky);
  const panel = (w, h, p, c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); s.add(m); };
  panel(30, 10, [0, 30, 10], '#ffffff', 3.5); panel(14, 24, [-30, 6, 8], '#ffe6c4', 2); panel(14, 24, [30, 6, -6], '#cfe2ff', 2.2);
  const pm = new THREE.PMREMGenerator(r); const e = pm.fromScene(s, .04).texture; pm.dispose(); return e; }
function phoneProp(screen){ const g = new THREE.Group(); g.userData.isProp = true; g.add(mesh(rbox(.16, .32, .022, .03, .006), phys('#1B1F27', { roughness: .25, metalness: .4 }))); const sc = new THREE.Mesh(new THREE.PlaneGeometry(.145, .3), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false })); sc.position.z = .0125; g.add(sc); return g; }
function phoneScreen(title, lines, col){ return ctex(290, 600, (x, w, h) => { x.fillStyle = '#F4F7FC'; x.fillRect(0, 0, w, h); x.fillStyle = '#0D1628'; x.fillRect(0, 0, w, 110); wordmark(x, 20, 64, 34, '#fff', '#7CC0FF');
  x.fillStyle = col; x.beginPath(); x.arc(w / 2, 210, 56, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(w / 2 - 24, 212); x.lineTo(w / 2 - 6, 230); x.lineTo(w / 2 + 26, 190); x.stroke();
  x.fillStyle = '#0D1628'; x.font = '800 30px Poppins, Inter'; x.textAlign = 'center'; x.fillText(title, w / 2, 316); x.font = '600 21px Inter'; x.fillStyle = '#3A4862'; lines.forEach((l, i) => { x.fillStyle = '#fff'; rr(x, 20, 350 + i * 66, w - 40, 54, 14); x.fill(); x.fillStyle = '#3A4862'; x.fillText(l, w / 2, 384 + i * 66); }); }); }
function vanSideTex(){ return ctex(2048, 512, (x, w, h) => { wordmark(x, 120, 200, 210, '#ffffff', '#7CC0FF'); x.font = '600 92px Inter'; x.fillStyle = '#cfe0ff'; x.textBaseline = 'middle'; x.fillText('Home lab tests · Oman', 130, 360); }); }
function van(){ const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const s = new THREE.Shape(); s.moveTo(-2.3, .5); s.lineTo(2.32, .5); s.quadraticCurveTo(2.5, .52, 2.5, .72); s.lineTo(2.5, 1.0); s.quadraticCurveTo(2.48, 1.2, 2.2, 1.3); s.lineTo(1.82, 1.38); s.quadraticCurveTo(1.55, 1.9, 1.2, 2.28); s.quadraticCurveTo(1.05, 2.42, .8, 2.42); s.lineTo(-2.15, 2.44); s.quadraticCurveTo(-2.36, 2.44, -2.36, 2.2); s.lineTo(-2.36, .64); s.quadraticCurveTo(-2.36, .5, -2.3, .5);
  const D = 1.72, BT = .13; const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: BT, bevelSize: .12, bevelSegments: 5, curveSegments: 14 }); geo.translate(0, 0, -D / 2);
  const paint = phys('#13254b', { metalness: .45, roughness: .32, clearcoat: 1, clearcoatRoughness: .06 }); body.add(mesh(geo, paint)); const half = D / 2 + BT;
  body.add(mesh(new THREE.BoxGeometry(4.86, .2, half * 2 + .02), phys('#2563eb', { metalness: .3, roughness: .35, clearcoat: 1 }), [.05, 1.0, 0])); body.add(mesh(new THREE.BoxGeometry(4.9, .22, half * 2 + .04), std('#20242c'), [.05, .56, 0]));
  const glass = phys('#0a1222', { metalness: .1, roughness: .04, clearcoat: 1, side: THREE.DoubleSide });
  const ws = mesh(new THREE.PlaneGeometry(half * 2 - .22, 1.1), glass, [0, 0, 0], false); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), .6); ws.position.set(1.51 + Math.cos(.6) * .14, 1.83 + Math.sin(.6) * .14, 0); body.add(ws);
  const sideWin = new THREE.ShapeGeometry((() => { const q = new THREE.Shape(); q.moveTo(.55, 1.42); q.lineTo(1.62, 1.42); q.quadraticCurveTo(1.45, 1.85, 1.12, 2.2); q.lineTo(.55, 2.2); q.closePath(); return q; })());
  const vt = vanSideTex();
  for (const z of [-1, 1]) { body.add(mesh(sideWin, glass, [0, 0, z * (half + .004)], false)); const dec = new THREE.Mesh(new THREE.PlaneGeometry(3.3, .82), new THREE.MeshPhysicalMaterial({ map: vt, transparent: true, roughness: .3, clearcoat: 1 })); dec.position.set(-.95, 1.6, z * (half + .006)); if (z < 0) dec.rotation.y = Math.PI; body.add(dec); }
  for (const z of [-.68, .68]) body.add(mesh(new THREE.BoxGeometry(.06, .16, .38), phys('#fff', { emissive: '#fff6dc', emissiveIntensity: 2 }), [2.6, 1.08, z], false));
  body.add(mesh(rbox(1.2, .22, 1.1, .08), std('#eef2f8', { roughness: .4 }), [-1.2, 2.6, 0]));
  const wheels = []; for (const [x, z] of [[1.48, -1], [1.48, 1], [-1.45, -1], [-1.45, 1]]) { body.add(mesh(new THREE.CircleGeometry(.56, 32, 0, Math.PI), std('#0d1118', { side: THREE.DoubleSide }), [x, .5, z * (half + .003)], false));
    const w = new THREE.Group(); w.position.set(x, .45, z * (half - .1)); const tire = mesh(new THREE.CylinderGeometry(.45, .45, .3, 32), std('#15171c', { roughness: .9 })); tire.rotation.x = Math.PI / 2; w.add(tire); const rim = mesh(new THREE.CylinderGeometry(.25, .25, .32, 24), phys('#c9d2de', { metalness: 1, roughness: .22 })); rim.rotation.x = Math.PI / 2; w.add(rim); g.add(w); wheels.push(w); }
  g.userData = { body, wheels }; return g; }
function coldBox(){ const g = new THREE.Group(); g.userData.isProp = true; g.add(mesh(rbox(.5, .34, .34, .05), phys('#2563EB', { roughness: .35, clearcoat: .6 }), [0, .17, 0])); g.add(mesh(rbox(.54, .07, .38, .03), std('#ffffff', { roughness: .4 }), [0, .36, 0]));
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(.3, .14), new THREE.MeshBasicMaterial({ map: ctex(256, 120, (x, w, h) => { x.fillStyle = '#E8F1FF'; rr(x, 0, 0, w, h, 16); x.fill(); x.fillStyle = '#0D1628'; x.font = '800 54px Poppins, Inter'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('4.2 °C', w / 2, 60); }), toneMapped: false })); lb.position.set(0, .18, .171); g.add(lb); return g; }
function kitBag(){ const g = new THREE.Group(); g.userData.isProp = true; g.add(mesh(rbox(.46, .3, .24, .07), phys('#14264d', { roughness: .7, sheen: 1, sheenColor: new THREE.Color('#3d6fd6') }), [0, .15, 0])); const c = new THREE.Group(); c.position.set(-.1, .16, .121); g.add(c); c.add(mesh(new THREE.CircleGeometry(.065, 24), std('#fff'), [0, 0, 0], false)); c.add(mesh(new THREE.BoxGeometry(.026, .08, .005), std('#e2474f'), [0, 0, .003], false)); c.add(mesh(new THREE.BoxGeometry(.08, .026, .005), std('#e2474f'), [0, 0, .003], false)); g.add(mesh(new THREE.TorusGeometry(.09, .016, 8, 20, Math.PI), std('#0D1628'), [0, .3, 0])); return g; }
function bpMonitor(){ const g = new THREE.Group(); g.add(mesh(rbox(.42, .3, .2, .05), phys('#F6F8FB', { roughness: .3, clearcoat: .8 }), [0, .15, 0])); const lcd = new THREE.Mesh(new THREE.PlaneGeometry(.3, .16), new THREE.MeshBasicMaterial({ map: ctex(300, 160, (x, w, h) => { x.fillStyle = '#C9E7DC'; rr(x, 0, 0, w, h, 14); x.fill(); x.fillStyle = '#0C2B22'; x.font = '800 66px Inter'; x.fillText('128', 16, 74); x.font = '800 50px Inter'; x.fillText('82', 30, 140); x.fillStyle = '#e2474f'; x.font = '800 34px Inter'; x.fillText('♥ 74', 180, 140); }), toneMapped: false })); lcd.position.set(0, .18, .101); g.add(lcd);
  const cuff = mesh(new THREE.TorusGeometry(.16, .06, 12, 30, Math.PI * 1.4), phys('#16305e', { roughness: .7 }), [.42, .08, 0]); cuff.rotation.x = Math.PI / 2; g.add(cuff); return g; }
function palm(h = 2.6){ const g = new THREE.Group(); let y = 0, x = 0; const lean = (rnd() - .5) * .3; for (let i = 0; i < 6; i++) { const s = mesh(new THREE.CylinderGeometry(.09 - i * .007, .11 - i * .007, h / 6 + .04, 7), std('#8a6a45'), [x, y + h / 12, 0]); s.rotation.z = -lean; g.add(s); y += h / 6; x += lean * h / 6; }
  const top = new THREE.Group(); top.position.set(x, y, 0); g.add(top); for (let i = 0; i < 9; i++) { const f = mesh(new THREE.ConeGeometry(.2, 1.5, 4), std(i % 2 ? '#3f9b5a' : '#2f7d47', { flatShading: true })); f.scale.set(1, 1, .3); f.position.set(Math.cos(i / 9 * TAU) * .55, -.15, Math.sin(i / 9 * TAU) * .55); f.rotation.set(0, -i / 9 * TAU, 0); f.rotateZ(-Math.PI / 2 + .45); top.add(f); } return g; }
function house(w = 3.4, h = 2.2, col = '#F5EFE2'){ const g = new THREE.Group(); const wall = std(col, { roughness: .95 }); g.add(mesh(new THREE.BoxGeometry(w, h, 2.4), wall, [0, h / 2, 0]));
  for (let i = 0; i < 6; i++) if (i % 2 === 0) { g.add(mesh(new THREE.BoxGeometry(.5, .32, .25), wall, [-w / 2 + .3 + i * .58, h + .15, 1.08])); }
  g.add(mesh(new THREE.BoxGeometry(w + .1, .1, 2.5), std('#E2D3B5'), [0, h - .02, 0])); const door = mesh(new THREE.BoxGeometry(.8, 1.4, .08), std('#7A4A26', { roughness: .55 }), [0, .7, 1.22]); g.add(door);
  const ar = mesh(new THREE.CylinderGeometry(.4, .4, .08, 18, 1, false, 0, Math.PI), std('#7A4A26', { roughness: .55 }), [0, 1.4, 1.22]); ar.rotation.set(Math.PI / 2, Math.PI / 2, Math.PI / 2); g.add(ar);
  for (const x of [-1.15, 1.15]) { g.add(mesh(new THREE.BoxGeometry(.56, .62, .06), std('#fff'), [x, 1.25, 1.22], false)); g.add(mesh(new THREE.BoxGeometry(.44, .5, .08), phys('#2a4a7a', { roughness: .2 }), [x, 1.25, 1.23], false)); }
  return g; }
function ridge(col, z, h, seedOff, w = 120){ const N = 160, pos = [], idx = []; for (let i = 0; i <= N; i++) { const x = -w / 2 + i / N * w; const u = x * .09 + seedOff; const y = h * (.55 + .25 * Math.sin(u) + .14 * Math.sin(u * 2.7 + 1.3) + .08 * Math.sin(u * 6.1 + .4) + .04 * Math.sin(u * 13.7)); pos.push(x, Math.max(.5, y), z, x, -1, z); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: true })); }
function room(floorCol, wallCol, opt = {}){ const g = new THREE.Group(); const fl = mesh(new THREE.PlaneGeometry(16, 12), std(floorCol, { roughness: .8, map: opt.floorTex || null })); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const back = mesh(new THREE.PlaneGeometry(16, 7), std(wallCol, { roughness: .95 }), [0, 3.5, -3]); g.add(back); const side = mesh(new THREE.PlaneGeometry(12, 7), std(wallCol, { roughness: .95 }), [-5, 3.5, 2]); side.rotation.y = Math.PI / 2; g.add(side);
  g.add(mesh(new THREE.BoxGeometry(16, .12, .06), std('#ffffff'), [0, .06, -2.97])); return g; }
function windowView(w, h, draw){ const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(w + .16, h + .16, .1), std('#ffffff'), [0, 0, 0], false)); const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ctex(512, Math.round(512 * h / w), draw), toneMapped: false })); v.position.z = .06; g.add(v); g.add(mesh(new THREE.BoxGeometry(.05, h, .12), std('#ffffff'), [0, 0, .04], false)); return g; }
const skyline = (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8EC5FF'); g.addColorStop(1, '#FCE7C8'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#C9A27A'; x.beginPath(); x.moveTo(0, h * .7); for (let i = 0; i <= 10; i++) x.lineTo(i * w / 10, h * (.55 + (i % 3) * .06)); x.lineTo(w, h); x.lineTo(0, h); x.fill(); x.fillStyle = '#F5EFE2'; for (let i = 0; i < 9; i++) { const bw = 30 + (i * 37) % 40, bh = 40 + (i * 53) % 90; x.fillRect(i * 58, h - bh, bw, bh); } };
function carpetTex(){ return ctex(512, 512, (x, w, h) => { x.fillStyle = '#8B1E2D'; x.fillRect(0, 0, w, h); x.strokeStyle = '#E8C46A'; x.lineWidth = 10; x.strokeRect(24, 24, w - 48, h - 48); x.strokeStyle = '#1E3A6E'; x.lineWidth = 6; x.strokeRect(50, 50, w - 100, h - 100); for (let i = 0; i < 4; i++) { x.save(); x.translate(w / 2, h / 2); x.rotate(i * Math.PI / 2); x.fillStyle = '#E8C46A'; x.beginPath(); x.moveTo(0, -150); x.lineTo(40, -90); x.lineTo(0, -30); x.lineTo(-40, -90); x.closePath(); x.fill(); x.restore(); } x.fillStyle = '#1E3A6E'; x.beginPath(); x.arc(w / 2, h / 2, 34, 0, TAU); x.fill(); }); }
function dallah(){ const g = new THREE.Group(); const gold = phys('#D4A63A', { metalness: 1, roughness: .25 }); g.add(mesh(new THREE.LatheGeometry([[0, 0], [.12, 0], [.14, .05], [.1, .16], [.06, .2], [.07, .26], [.04, .32], [0, .34]].map(([r, y]) => new THREE.Vector2(r, y)), 28), gold)); const sp = mesh(new THREE.ConeGeometry(.025, .2, 10), gold, [.13, .2, 0]); sp.rotation.z = -1; g.add(sp); return g; }

/* ======================= WORLD ======================= */
export const W = {};
const CAST = {};
const SETS = {}; const HOME = {};
export async function build(canvas){
  await Promise.all(['800 100px Poppins', '600 40px Inter', '700 40px Inter'].map(f => document.fonts.load(f))); await document.fonts.ready;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(1920, 1080, false);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace; W.r = r;
  W.env = studioEnv(r); W.cam = new THREE.PerspectiveCamera(30, 16 / 9, .1, 400);
  // cast
  CAST.salim = makeChar({ robe: true, cloth: '#FAF8F2', tassel: '#E9E2D2', head: 'kumma', beard: '#21160F', skin: SKIN.a, ph: .3 });
  CAST.maryam = makeChar({ robe: true, cloth: '#1E1A28', abayaTrim: '#C9A227', head: 'hijab', hijab: '#5B2A4E', skin: SKIN.c, sleeve: '#1E1A28', ph: 1.1 });
  CAST.yousef = makeChar({ robe: true, kid: true, cloth: '#FFFFFF', head: 'kumma', skin: SKIN.c, ph: 2.1 });
  CAST.hamad = makeChar({ robe: true, cloth: '#D3BF99', head: 'massar', beard: '#E8E6E1', brow: '#D8D4CC', skin: SKIN.b, belt: 'khanjar', ph: .7 });
  CAST.nour = makeChar({ cloth: '#13254B', pants: '#13254B', head: 'hijab', hijab: '#0D1A36', skin: SKIN.c, badge: true, shortSleeve: false, shoes: '#FFFFFF', ph: 1.6 });
  CAST.khalid = makeChar({ cloth: '#13254B', pants: '#13254B', head: 'short', hair: '#15100C', beard: '#15100C', skin: SKIN.a, badge: true, shoes: '#FFFFFF', ph: 2.4 });
  CAST.saeed = makeChar({ cloth: '#F97316', sleeve: '#F97316', pants: '#1B2537', cap: '#13254B', head: 'short', hair: '#15100C', beard: '#2A1D14', skin: SKIN.tan, logo: texShirtLogo(false), shortSleeve: true, ph: .9 });
  CAST.aisha = makeChar({ cloth: '#0F766E', pants: '#2B3445', coat: true, head: 'hijab', hijab: '#0B4F4A', skin: SKIN.c, steth: true, ph: 1.3 });
  CAST.emma = makeChar({ cloth: '#93C5FD', sleeve: '#93C5FD', pants: '#D6C7A8', head: 'bun', hair: '#E2C27A', skin: SKIN.fair, eye: '#3E6A8A', brow: '#B08A4A', ph: .4 });
  CAST.david = makeChar({ cloth: '#2F7D4F', sleeve: '#2F7D4F', pants: '#2B3445', head: 'short', hair: '#6B4A2B', skin: SKIN.fair, eye: '#4A6B3A', brow: '#5A3E24', glasses: true, shortSleeve: true, ph: 2.7 });
  CAST.priya = makeChar({ cloth: '#E8566A', sleeve: '#E8566A', pants: '#F5E6D3', head: 'braid', hair: '#120C0A', skin: SKIN.d, ph: 1.9 });
  W.CAST = CAST;
  // emote sprites
  const em = (draw) => new THREE.SpriteMaterial({ map: ctex(256, 256, (x, w, h) => { x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 16; x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 128, 104, 0, TAU); x.fill(); x.shadowBlur = 0; draw(x); }), depthTest: false, transparent: true });
  W.EM = {
    heart: em(x => { x.fillStyle = '#E8466F'; x.beginPath(); x.moveTo(128, 196); x.bezierCurveTo(30, 130, 70, 50, 128, 96); x.bezierCurveTo(186, 50, 226, 130, 128, 196); x.fill(); }),
    star: em(x => { x.fillStyle = '#F5B300'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 36 : 82, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(128 + Math.cos(a) * r, 130 + Math.sin(a) * r); } x.fill(); }),
    check: em(x => { x.fillStyle = '#14B8A6'; x.beginPath(); x.arc(128, 128, 80, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 22; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(92, 132); x.lineTo(118, 158); x.lineTo(166, 102); x.stroke(); }),
    thumb: em(x => { x.fillStyle = '#2563EB'; x.beginPath(); x.moveTo(84, 120); x.lineTo(112, 120); x.lineTo(128, 64); x.quadraticCurveTo(150, 60, 148, 90); x.lineTo(144, 116); x.lineTo(178, 116); x.quadraticCurveTo(196, 120, 188, 140); x.lineTo(172, 188); x.quadraticCurveTo(166, 198, 150, 198); x.lineTo(84, 198); x.closePath(); x.fill(); }),
    snow: em(x => { x.strokeStyle = '#2563EB'; x.lineWidth = 14; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { x.save(); x.translate(128, 128); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -74); x.moveTo(0, -46); x.lineTo(-20, -64); x.moveTo(0, -46); x.lineTo(20, -64); x.stroke(); x.restore(); } }),
    steth: em(x => { x.strokeStyle = '#0D7C6C'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.moveTo(80, 70); x.lineTo(80, 110); x.quadraticCurveTo(80, 160, 128, 160); x.quadraticCurveTo(176, 160, 176, 110); x.lineTo(176, 70); x.stroke(); x.beginPath(); x.moveTo(128, 160); x.lineTo(128, 190); x.stroke(); x.fillStyle = '#0D7C6C'; x.beginPath(); x.arc(128, 196, 16, 0, TAU); x.fill(); }),
    spark: em(x => { x.fillStyle = '#7A5AF8'; for (const [cx, cy, s] of [[128, 120, 60], [176, 176, 26], [80, 172, 20]]) { x.beginPath(); x.moveTo(cx, cy - s); x.quadraticCurveTo(cx, cy, cx + s, cy); x.quadraticCurveTo(cx, cy, cx, cy + s); x.quadraticCurveTo(cx, cy, cx - s, cy); x.quadraticCurveTo(cx, cy, cx, cy - s); x.fill(); } })
  };
  buildSets();
  for (const k in CAST) HOME[k] = { parent: CAST[k].parent, p: CAST[k].position.clone(), r: CAST[k].rotation.clone() };
  return W;
}
function lightRig(s, o = {}){ s.add(new THREE.HemisphereLight(o.sky || '#fff5e6', o.ground || '#9a8670', o.hemi ?? 1.0)); const k = new THREE.DirectionalLight(o.key || '#fff1dc', o.ki ?? 2.6); k.position.set(...(o.kp || [4, 8, 6])); k.castShadow = true; k.shadow.mapSize.set(2048, 2048); Object.assign(k.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 40 }); k.shadow.bias = -.0004; k.shadow.normalBias = .02; s.add(k);
  const rim = new THREE.DirectionalLight(o.rim || '#bcd4ff', o.ri ?? 1.2); rim.position.set(-6, 5, -4); s.add(rim); s.environment = W.env; }
function emote(s, mat){ const sp = new THREE.Sprite(mat); sp.scale.setScalar(.001); sp.renderOrder = 10; s.add(sp); return sp; }
function buildSets(){
  // 0 – intro street: van arrives in a village, golden hour
  { const s = new THREE.Scene(); s.background = new THREE.Color('#F2C998'); s.fog = new THREE.Fog('#F2C998', 25, 90); lightRig(s, { key: '#ffd2a1', ki: 3, kp: [-8, 6, 6], sky: '#ffe7c9', ground: '#a77a4a' });
    const ground = mesh(new THREE.PlaneGeometry(200, 200), std('#E7C58F', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; s.add(ground);
    const road = mesh(new THREE.PlaneGeometry(200, 6), std('#3b414d', { roughness: .85 })); road.rotation.x = -Math.PI / 2; road.position.y = .02; s.add(road);
    const dashT = ctex(256, 16, (x, w) => { x.fillStyle = '#f6c544'; x.fillRect(0, 0, w * .5, 16); }); dashT.wrapS = THREE.RepeatWrapping; dashT.repeat.set(40, 1); const dash = mesh(new THREE.PlaneGeometry(200, .16), new THREE.MeshStandardMaterial({ map: dashT, transparent: true }), [0, .03, 0], false); dash.rotation.x = -Math.PI / 2; s.add(dash);
    s.add(ridge('#C9A08C', -70, 18, 0, 240)); s.add(ridge('#A98068', -48, 11, 4, 240)); s.add(ridge('#8F6A55', -30, 6, 9, 240));
    for (let i = 0; i < 4; i++) { const h = house(3 + rnd(), 2 + rnd() * .6, ['#F5EFE2', '#EFE3CC', '#F8F1E4'][i % 3]); h.position.set(-9 + i * 6.5, 0, -6.5); s.add(h); } for (let i = 0; i < 7; i++) { const p = palm(2.6 + rnd()); p.position.set(-14 + i * 5 + rnd() * 2, 0, -4.2 - rnd() * 1.5); s.add(p); }
    const v = van(); s.add(v); SETS.intro = { s, v, dashT }; }
  // 1 – Salim's office
  { const s = new THREE.Scene(); s.background = new THREE.Color('#E9EEF6'); lightRig(s, { ki: 2.4 }); const rm = room('#B98A5E', '#EEF2F8'); s.add(rm);
    const win = windowView(3.2, 1.8, skyline); win.position.set(.6, 2.2, -2.94); s.add(win);
    const desk = new THREE.Group(); desk.add(mesh(rbox(2.2, .08, 1.0, .03), std('#E8D3B4', { roughness: .5 }), [0, .78, 0])); desk.children[0].rotation.x = Math.PI / 2; desk.children[0].position.y = .78; for (const x of [-1, 1]) desk.add(mesh(new THREE.BoxGeometry(.06, .76, .9), std('#2B3445'), [x * 1.02, .38, 0])); desk.position.set(-.2, 0, .6); s.add(desk);
    desk.add(mesh(new THREE.BoxGeometry(.7, .03, .45), std('#C9D2DE', { metalness: .6, roughness: .3 }), [-.5, .83, .05])); const lid = mesh(new THREE.BoxGeometry(.7, .45, .02), std('#C9D2DE', { metalness: .6, roughness: .3 }), [-.5, 1.05, -.18]); lid.rotation.x = -.25; desk.add(lid);
    const cup = mesh(new THREE.CylinderGeometry(.05, .045, .12, 16), std('#ffffff'), [.6, .88, .1]); desk.add(cup); const pl = palm(1.3); pl.position.set(2.6, 0, -2); pl.scale.setScalar(.7); s.add(pl);
    const ch = CAST.salim; ch.position.set(.35, 0, 1.25); ch.rotation.y = -.25; s.add(ch); const ph = phoneProp(phoneScreen('Booked', ['Annual Check-up', 'Sun · 07:00', 'Nurse: any'], '#14B8A6')); CAST.salim.userData.P.handR.add(ph); ph.position.set(0, -.05, .08); ph.rotation.set(-1.1, 0, 0); ph.scale.setScalar(1.1);
    SETS.office = { s, ch, ph, e: emote(s, W.EM.thumb), e2: emote(s, W.EM.check) }; }
  // 2 – Maryam & Yousef at home (majlis)
  { const s = new THREE.Scene(); s.background = new THREE.Color('#F4E7D3'); lightRig(s, { ki: 2.3, key: '#ffe8cc' }); const rm = room('#D9C3A0', '#F3E6CF'); s.add(rm);
    const cp = mesh(new THREE.PlaneGeometry(4.2, 3), std('#ffffff', { map: carpetTex(), roughness: .95 }), [0, .012, .6]); cp.rotation.x = -Math.PI / 2; s.add(cp);
    for (let i = 0; i < 5; i++) { const cu = mesh(rbox(1.0, .45, .55, .12, .04), std(i % 2 ? '#8B1E2D' : '#1E3A6E', { roughness: .9 }), [-3 + i * 1.3, .25, -2.5]); s.add(cu); const bk = mesh(rbox(1.0, .55, .2, .1, .04), std(i % 2 ? '#1E3A6E' : '#8B1E2D', { roughness: .9 }), [-3 + i * 1.3, .7, -2.8]); s.add(bk); }
    const arch = windowView(1.4, 2.0, skyline); arch.position.set(2.4, 2.3, -2.94); s.add(arch); const tray = mesh(new THREE.CylinderGeometry(.35, .35, .03, 32), phys('#C9A227', { metalness: 1, roughness: .3 }), [-1.4, .45, .1]); s.add(tray); s.add(mesh(new THREE.CylinderGeometry(.06, .3, .43, 16), std('#6B4A2E'), [-1.4, .22, .1])); const d = dallah(); d.position.set(-1.45, .47, .1); s.add(d);
    const m = CAST.maryam; m.position.set(-.35, 0, .7); m.rotation.y = .35; s.add(m); const y = CAST.yousef; y.position.set(.45, 0, .95); y.rotation.y = -.2; s.add(y);
    const ph = phoneProp(phoneScreen('Kids package', ['Female nurse ✓', 'Sun · 09:00', 'Gentle draw'], '#F2A516')); m.userData.P.handR.add(ph); ph.position.set(0, -.05, .08); ph.rotation.set(-1.1, 0, 0); ph.scale.setScalar(1.1);
    SETS.home = { s, m, y, e: emote(s, W.EM.heart), e2: emote(s, W.EM.star), e3: emote(s, W.EM.heart) }; }
  // 3 – Grandpa Hamad in his mountain village
  { const s = new THREE.Scene(); s.background = new THREE.Color('#BFD9F2'); s.fog = new THREE.Fog('#CFE0EE', 18, 70); lightRig(s, { ki: 2.8, kp: [6, 9, 5], sky: '#eaf4ff', ground: '#9a8060' });
    const ground = mesh(new THREE.PlaneGeometry(80, 60), std('#CDAE84', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; s.add(ground);
    s.add(ridge('#8E7C74', -40, 22, 2, 140)); s.add(ridge('#7A6458', -26, 14, 6, 140)); s.add(ridge('#9C7B5E', -14, 6, 11, 140));
    for (let i = 0; i < 3; i++) { const t = mesh(new THREE.BoxGeometry(14, .5, 2.2), std(i % 2 ? '#7FA65A' : '#6E9A4C', { roughness: 1 }), [-2, .25 + i * .5, -4 - i * 2.2]); s.add(t); }
    const h = house(3.6, 2.4, '#EADFC9'); h.position.set(-2.4, 0, -1.6); h.rotation.y = .12; s.add(h); const pl = palm(3); pl.position.set(2.6, 0, -2.2); s.add(pl);
    const table = new THREE.Group(); table.add(mesh(new THREE.CylinderGeometry(.42, .42, .05, 24), std('#8A5A33', { roughness: .6 }), [0, .7, 0])); table.add(mesh(new THREE.CylinderGeometry(.05, .07, .7, 10), std('#6B4A2E'), [0, .35, 0])); table.position.set(.95, 0, 1.15); s.add(table);
    const bp = bpMonitor(); bp.position.set(.9, .73, 1.15); bp.rotation.y = -.5; s.add(bp);
    const ch = CAST.hamad; ch.position.set(-.15, 0, 1.3); ch.rotation.y = .25; s.add(ch);
    const cane = mesh(new THREE.CylinderGeometry(.022, .022, 1.15, 8), std('#5C3B22', { roughness: .5 }), [0, -.55, .05]); ch.userData.P.handL.add(cane);
    SETS.village = { s, ch, e: emote(s, W.EM.check), e2: emote(s, W.EM.heart) }; }
  // 4 – Nurses Nour & Khalid at the door with the van
  { const s = new THREE.Scene(); s.background = new THREE.Color('#F6D9AE'); s.fog = new THREE.Fog('#F6D9AE', 20, 70); lightRig(s, { key: '#ffe0b8', ki: 2.8, kp: [-6, 8, 6] });
    const ground = mesh(new THREE.PlaneGeometry(80, 60), std('#E2C49A', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; s.add(ground); const road = mesh(new THREE.PlaneGeometry(80, 5), std('#3b414d', { roughness: .85 }), [0, .02, 4.2]); road.rotation.x = -Math.PI / 2; s.add(road);
    const h = house(4.4, 2.6); h.position.set(0, 0, -2.4); s.add(h); for (const x of [-4.2, 4.6]) { const p = palm(3); p.position.set(x, 0, -1.6); s.add(p); }
    const v = van(); v.position.set(-4.6, 0, 4.0); v.rotation.y = 0; v.scale.setScalar(.95); s.add(v);
    const n = CAST.nour; n.position.set(-.55, 0, 1.0); n.rotation.y = .3; s.add(n); const k = CAST.khalid; k.position.set(.6, 0, 1.0); k.rotation.y = -.3; s.add(k);
    const bag = kitBag(); n.userData.P.handL.add(bag); bag.position.set(0, -.2, 0); bag.rotation.y = Math.PI / 2;
    const ph = phoneProp(phoneScreen('Accepted', ['LAH-10250 · Ibra', 'ID verified ✓', 'Sample collected'], '#14B8A6')); k.userData.P.handR.add(ph); ph.position.set(0, -.05, .08); ph.rotation.set(-1.1, 0, 0); ph.scale.setScalar(1.1);
    SETS.nurses = { s, n, k, e: emote(s, W.EM.check), e2: emote(s, W.EM.star), e3: emote(s, W.EM.spark) }; }
  // 5 – Saeed the courier with the cold box
  { const s = new THREE.Scene(); s.background = new THREE.Color('#DCE9F7'); s.fog = new THREE.Fog('#DCE9F7', 20, 80); lightRig(s, { ki: 2.6, kp: [5, 8, 6] });
    const ground = mesh(new THREE.PlaneGeometry(80, 60), std('#D8CBB4', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; s.add(ground); const road = mesh(new THREE.PlaneGeometry(80, 5), std('#3b414d', { roughness: .85 }), [0, .02, -1.2]); road.rotation.x = -Math.PI / 2; s.add(road);
    const lab = new THREE.Group(); lab.add(mesh(new THREE.BoxGeometry(7, 3.2, 3), std('#F7F9FC', { roughness: .6 }), [0, 1.6, 0])); lab.add(mesh(new THREE.BoxGeometry(7.2, .3, 3.2), std('#2563EB'), [0, 3.25, 0])); const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .6), new THREE.MeshBasicMaterial({ map: ctex(640, 120, (x, w, h) => { x.fillStyle = '#0D1628'; rr(x, 0, 0, w, h, 20); x.fill(); x.fillStyle = '#fff'; x.font = '800 54px Poppins, Inter'; x.textBaseline = 'middle'; x.fillText('Partner Laboratory', 34, 62); }), toneMapped: false })); sg.position.set(0, 2.6, 1.52); lab.add(sg);
    lab.add(mesh(new THREE.BoxGeometry(1.4, 2.1, .08), phys('#9CC2FF', { roughness: .1, metalness: .2 }), [0, 1.05, 1.52])); lab.position.set(1.5, 0, -6); s.add(lab);
    const v = van(); v.position.set(-3.6, 0, -1.2); v.scale.setScalar(.95); s.add(v);
    const ch = CAST.saeed; ch.position.set(.4, 0, 1.0); ch.rotation.y = -.15; s.add(ch); const cb = coldBox(); ch.userData.P.handL.add(cb); cb.position.set(.05, -.2, .12); cb.rotation.set(0, -.3, 0); cb.scale.setScalar(.72);
    SETS.courier = { s, ch, v, e: emote(s, W.EM.snow), e2: emote(s, W.EM.check) }; }
  // 6 – Dr Aisha in the clinic
  { const s = new THREE.Scene(); s.background = new THREE.Color('#E6F3F1'); lightRig(s, { ki: 2.3, key: '#f4fbff' }); const rm = room('#C9D6D3', '#EAF4F2'); s.add(rm);
    const desk = new THREE.Group(); desk.add(mesh(new THREE.BoxGeometry(2.2, .08, 1), std('#F4F7FA', { roughness: .4 }), [0, .78, 0])); for (const x of [-1, 1]) desk.add(mesh(new THREE.BoxGeometry(.06, .76, .9), std('#9AA6B8'), [x * 1.02, .38, 0])); desk.position.set(-1.0, 0, .3); s.add(desk);
    const mon = new THREE.Group(); mon.add(mesh(new THREE.BoxGeometry(.9, .55, .04), std('#1B1F27'), [0, 0, 0])); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.84, .49), new THREE.MeshBasicMaterial({ map: ctex(840, 490, (x, w, h) => { x.fillStyle = '#F4F7FC'; x.fillRect(0, 0, w, h); x.fillStyle = '#0D1628'; x.fillRect(0, 0, w, 70); wordmark(x, 24, 36, 34, '#fff', '#7CC0FF'); x.fillStyle = '#FDECEC'; rr(x, 24, 96, w - 48, 120, 18); x.fill(); x.fillStyle = '#C42B33'; x.font = '800 40px Poppins, Inter'; x.fillText('Urgent · Fasting glucose 23.4', 50, 168); x.fillStyle = '#E3F7F4'; rr(x, 24, 240, w - 48, 110, 18); x.fill(); x.fillStyle = '#0B5C52'; x.font = '700 34px Inter'; x.fillText('Advice: go to Ibra Hospital today', 50, 306); x.fillStyle = '#2563EB'; rr(x, 24, 380, 300, 70, 35); x.fill(); x.fillStyle = '#fff'; x.font = '800 32px Inter'; x.fillText('Send advice', 70, 426); }), toneMapped: false })); scr.position.z = .021; mon.add(scr); mon.position.set(-1.3, 1.25, .1); mon.rotation.y = .35; s.add(mon); mon.add(mesh(new THREE.BoxGeometry(.06, .4, .06), std('#1B1F27'), [0, -.45, -.03]));
    const shelf = mesh(new THREE.BoxGeometry(2, .06, .4), std('#ffffff'), [2.2, 2.2, -2.8]); s.add(shelf); for (let i = 0; i < 5; i++) s.add(mesh(new THREE.BoxGeometry(.18, .5, .3), std(['#2563EB', '#14B8A6', '#F97316', '#7A5AF8', '#E8466F'][i]), [1.5 + i * .3, 2.48, -2.8]));
    const ch = CAST.aisha; ch.position.set(.5, 0, 1.1); ch.rotation.y = -.35; s.add(ch); const tab = phoneProp(phoneScreen('Advice sent', ['Retest in 3 months', 'Diet tips ✓', 'Nearest hospital'], '#0D7C6C')); ch.userData.P.handR.add(tab); tab.position.set(0, -.05, .1); tab.rotation.set(-1.0, 0, 0); tab.scale.set(2, 1.5, 1);
    SETS.clinic = { s, ch, e: emote(s, W.EM.steth), e2: emote(s, W.EM.check) }; }
  // 7 – Emma, David and Priya in a modern apartment
  { const s = new THREE.Scene(); s.background = new THREE.Color('#EEF2FA'); lightRig(s, { ki: 2.4 }); const rm = room('#D8D2C8', '#F6F7FB'); s.add(rm);
    const win = windowView(4.6, 2.2, skyline); win.position.set(0, 2.2, -2.94); s.add(win);
    const sofa = new THREE.Group(); sofa.add(mesh(rbox(2.6, .4, .9, .12), std('#4C6A92', { roughness: .9 }), [0, .3, 0])); sofa.add(mesh(rbox(2.6, .6, .25, .12), std('#4C6A92', { roughness: .9 }), [0, .7, -.35])); sofa.position.set(-2.2, 0, -1.6); s.add(sofa);
    for (const [x, z] of [[2.8, -2.2], [-3.8, -2.2]]) { const pot = mesh(new THREE.CylinderGeometry(.22, .18, .4, 16), std('#E8E2D8'), [x, .2, z]); s.add(pot); for (let i = 0; i < 6; i++) { const lf = mesh(new THREE.SphereGeometry(.22, 10, 8), std('#3F8A57', { roughness: .8 }), [x + Math.cos(i) * .18, .6 + i * .07, z + Math.sin(i) * .18]); lf.scale.set(1, 1.6, .4); lf.rotation.z = i; s.add(lf); } }
    const e = CAST.emma, d = CAST.david, p = CAST.priya; e.position.set(-1.05, 0, .9); e.rotation.y = .3; d.position.set(0, 0, .7); p.position.set(1.05, 0, .9); p.rotation.y = -.3; s.add(e, d, p);
    const mk = (who, t, l) => { const ph = phoneProp(phoneScreen(t, l, '#2563EB')); who.userData.P.handR.add(ph); ph.position.set(0, -.05, .08); ph.rotation.set(-1.1, 0, 0); ph.scale.setScalar(1.1); return ph; };
    mk(e, 'Paid by card', ['Visa •••• 4242', 'Home visit · 07:00']); mk(d, 'Booked', ['English ✓', 'Male nurse']); mk(p, 'Results ready', ['All normal ✓', 'Download PDF']);
    SETS.flat = { s, e, d, p, e1: emote(s, W.EM.thumb), e2: emote(s, W.EM.check), e3: emote(s, W.EM.star) }; }
  // 8 – the whole cast on one live route
  { const s = new THREE.Scene(); s.background = new THREE.Color('#0F1C38'); s.fog = new THREE.Fog('#0F1C38', 18, 50); lightRig(s, { ki: 2.4, kp: [3, 9, 8], sky: '#cfe0ff', ground: '#22324f', hemi: .9, rim: '#7cc0ff', ri: 2 });
    const plat = mesh(new THREE.CylinderGeometry(7.8, 8.2, .4, 6), phys('#16264A', { roughness: .5, clearcoat: .6 }), [0, -.2, 0]); s.add(plat); const ring = mesh(new THREE.TorusGeometry(7.85, .05, 8, 6), new THREE.MeshBasicMaterial({ color: '#3B82F6' }), [0, .01, 0]); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; s.add(ring);
    const order = ['saeed', 'khalid', 'nour', 'salim', 'maryam', 'yousef', 'hamad', 'aisha', 'emma', 'david', 'priya'];
    const slots = order.map((k, i) => { const f = i / (order.length - 1) - .5; return [f * 11, -Math.cos(f * Math.PI) * 1.6 + .6]; });
    const pts = slots.map(([x, z]) => new THREE.Vector3(x, 2.65, z)); const curve = new THREE.CatmullRomCurve3(pts); const tube = mesh(new THREE.TubeGeometry(curve, 200, .03, 8), new THREE.MeshBasicMaterial({ color: '#60A5FA', transparent: true, opacity: .9 }), [0, 0, 0], false); s.add(tube);
    const glow = []; for (let i = 0; i < 14; i++) { const gm = mesh(new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshBasicMaterial({ color: '#BFE0FF' }), [0, 0, 0], false); s.add(gm); glow.push(gm); }
    SETS.all = { s, order, slots, curve, glow, tube }; }
}
/* ======================= TIMELINE ======================= */
// voice-over starts at 1.2 s; shots follow the narration
export const SHOTS = [
  { a: 0.0, b: 6.0, set: 'intro' }, { a: 6.0, b: 11.7, set: 'office' }, { a: 11.7, b: 18.2, set: 'home' }, { a: 18.2, b: 23.3, set: 'village' },
  { a: 23.3, b: 29.9, set: 'nurses' }, { a: 29.9, b: 36.6, set: 'courier' }, { a: 36.6, b: 42.3, set: 'clinic' }, { a: 42.3, b: 49.9, set: 'flat' }, { a: 49.9, b: 53.7, set: 'all' }, { a: 53.7, b: 61.0, set: 'all', end: true }
];
const pop = (sp, t, a, d = 1.6, pos, size = .42) => { const k = seg(t, a, a + .35), out = 1 - seg(t, a + d, a + d + .3); const sc = back(k) * out * size; sp.scale.setScalar(Math.max(.0001, sc)); sp.position.copy(pos); sp.position.y += eo(k) * .25 + Math.sin(t * 3) * .02; sp.material.opacity = out; };
const headPos = (ch, dy = .62) => { const v = new THREE.Vector3(); ch.userData.P.head.getWorldPosition(v); v.y += dy; return v; };
const camAt = (p, l, fov = 30) => { W.cam.position.set(...p); W.cam.lookAt(...l); if (W.cam.fov !== fov) { W.cam.fov = fov; W.cam.updateProjectionMatrix(); } };
export function update(t){
  const sh = SHOTS.find(x => t >= x.a && t < x.b) || SHOTS[SHOTS.length - 1]; const u = t - sh.a, L = sh.b - sh.a; const S = SETS[sh.set]; W.scene = S.s; W.shot = sh; W.focus = [];
  if (sh.set !== 'all' && SETS.all.placed) { for (const k in HOME) { const h = HOME[k]; h.parent.add(CAST[k]); CAST[k].position.copy(h.p); CAST[k].rotation.copy(h.r); CAST[k].traverse(o => { if (o.userData && o.userData.isProp) o.visible = true; }); } SETS.all.placed = false; }
  if (sh.set === 'intro') { const k = eio(seg(u, 0, 4.2)); S.v.position.set(-26 + 26 * k, 0, .1); S.dashT.offset.x = -k * 6; S.v.userData.wheels.forEach(w => w.rotation.z = -k * 60); S.v.userData.body.position.y = Math.sin(u * 9) * .01 * (1 - k);
    camAt([lerp(9, 7.2, eio(seg(u, 0, 6))), lerp(2.4, 1.9, eio(seg(u, 0, 6))), lerp(11, 9.5, eio(seg(u, 0, 6)))], [S.v.position.x * .35, 1.3, 0], 32); }
  if (sh.set === 'office') { const ch = S.ch; pose(ch, t, { hold: u < 3.6, thumbs: u > 3.7 ? (u - 3.7) : null, happy: u > 3.7 ? 1 : .35, look: u < 3.6 ? [0, .28] : [.15, 0], nod: u > 1.6 && u < 2.6 ? (u - 1.6) : 0 });
    pop(S.e2, t, 6.0 + 2.6, 1.8, headPos(ch).add(new THREE.Vector3(.5, -.1, 0)), .34); pop(S.e, t, 6.0 + 3.9, 1.6, headPos(ch).add(new THREE.Vector3(-.45, 0, 0)));
    camAt([lerp(2.2, 1.6, eio(seg(u, 0, L))), 1.75, lerp(5.2, 4.4, eio(seg(u, 0, L)))], [.2, 1.45, 1.1], 30); W.focus = [['salim', ch]]; }
  if (sh.set === 'home') { const m = S.m, y = S.y; pose(m, t, { hold: u < 3.4, happy: u > 4.8 ? 1 : .5, look: u < 3.4 ? [0, .25] : [-.5, .1], nod: u > 2 && u < 3 ? u - 2 : 0, armL: u > 4.8 ? [-.3, 0, .9] : undefined });
    pose(y, t, { jump: u > 5.0 ? (u - 5.0) / 1.4 : null, cheer: u > 5.0 ? (u - 5.0) : null, happy: u > 4.6 ? 1 : .6, look: [.4, -.05] });
    pop(S.e, t, 11.7 + 2.4, 1.6, headPos(m).add(new THREE.Vector3(.35, 0, 0)), .32); pop(S.e2, t, 11.7 + 5.1, 1.3, headPos(y).add(new THREE.Vector3(-.3, .1, 0)), .3); pop(S.e3, t, 11.7 + 5.4, 1.0, headPos(y).add(new THREE.Vector3(.35, .2, 0)), .26);
    camAt([lerp(-.4, .2, eio(seg(u, 0, L))), 1.6, lerp(5.6, 4.7, eio(seg(u, 0, L)))], [.05, 1.3, .8], 32); W.focus = [['maryam', m], ['yousef', y]]; }
  if (sh.set === 'village') { const ch = S.ch; pose(ch, t, { holdL: false, armL: [-.25, 0, .25], elL: [-.3], wave: u > 2.6 ? (u - 2.6) : null, waveSide: 'R', happy: u > 1.6 ? 1 : .4, look: u < 1.6 ? [.55, .2] : [0, 0], nod: u > 1.2 && u < 2.2 ? u - 1.2 : 0 });
    pop(S.e, t, 18.2 + 1.5, 1.8, headPos(ch).add(new THREE.Vector3(.55, -.05, 0)), .34); pop(S.e2, t, 18.2 + 3.0, 1.6, headPos(ch).add(new THREE.Vector3(-.4, .05, 0)), .3);
    const cx = lerp(1.5, .9, eio(seg(u, 0, L))); camAt([cx, lerp(1.5, 1.35, eio(seg(u, 0, L))), lerp(5.9, 5.1, eio(seg(u, 0, L)))], [.1, 1.22, 1.3], 30); W.focus = [['hamad', ch]]; }
  if (sh.set === 'nurses') { const n = S.n, k = S.k; const hf = u > 5.5 ? (u - 5.5) : null;
    pose(n, t, { look: [.3, 0], happy: u > 2.5 ? 1 : .5, nod: u > 2.2 && u < 3.2 ? u - 2.2 : 0, hi5: hf, hi5side: 'R' }); pose(k, t, { hold: !hf, look: u < 2.6 ? [0, .25] : [-.3, 0], happy: u > 2.5 ? 1 : .4, hi5: hf, hi5side: 'L' });
    if (hf) { n.rotation.y = lerp(.3, .55, eo(clamp(hf * 3))); k.rotation.y = lerp(-.3, -.55, eo(clamp(hf * 3))); } else { n.rotation.y = .3; k.rotation.y = -.3; }
    pop(S.e, t, 23.3 + 1.0, 1.6, headPos(k).add(new THREE.Vector3(.4, 0, 0)), .32); pop(S.e2, t, 23.3 + 2.9, 1.6, headPos(n).add(new THREE.Vector3(-.4, 0, 0)), .3); pop(S.e3, t, 23.3 + 5.75, 1.2, new THREE.Vector3(0, 2.75, 1.05), .4);
    camAt([lerp(-.8, .3, eio(seg(u, 0, L))), 1.6, lerp(5.4, 4.6, eio(seg(u, 0, L)))], [0, 1.25, .9], 32); W.focus = [['nour', n], ['khalid', k]]; }
  if (sh.set === 'courier') { const ch = S.ch; const walk = u < 2.4; ch.position.x = walk ? lerp(-1.8, .4, eio(seg(u, 0, 2.4))) : .4;
    pose(ch, t, { carry: false, armL: [-.6, 0, .35], elL: [-.9], walk: walk ? u * 1.6 : null, salute: u > 4.4 ? (u - 4.4) : null, happy: u > 2.6 ? 1 : .5, look: u > 2.6 && u < 4.2 ? [.1, .25] : [0, 0] });
    pop(S.e, t, 29.9 + 2.6, 1.7, headPos(ch).add(new THREE.Vector3(.5, -.1, 0)), .34); pop(S.e2, t, 29.9 + 4.7, 1.5, headPos(ch).add(new THREE.Vector3(-.45, 0, 0)), .3);
    camAt([lerp(2.6, 1.8, eio(seg(u, 0, L))), 1.55, lerp(5.6, 4.4, eio(seg(u, 0, L)))], [ch.position.x * .6, 1.15, .8], 30); W.focus = [['saeed', ch]]; }
  if (sh.set === 'clinic') { const ch = S.ch; pose(ch, t, { hold: true, look: u < 2.6 ? [0, .3] : [.1, 0], nod: u > 2.6 && u < 3.8 ? (u - 2.6) / 1.2 : 0, happy: u > 2.6 ? 1 : .2, armL: u > 3.4 ? [-.9, 0, .2] : undefined, elL: u > 3.4 ? [-1.4] : undefined });
    pop(S.e, t, 36.6 + 1.0, 1.6, headPos(ch).add(new THREE.Vector3(-.45, 0, 0)), .32); pop(S.e2, t, 36.6 + 3.0, 1.8, headPos(ch).add(new THREE.Vector3(.45, 0, 0)), .34);
    camAt([lerp(1.8, 1.0, eio(seg(u, 0, L))), 1.65, lerp(4.8, 4.0, eio(seg(u, 0, L)))], [-.1, 1.45, .9], 32); W.focus = [['aisha', ch]]; }
  if (sh.set === 'flat') { const { e, d, p } = S; const ch3 = u > 5.4 ? u - 5.4 : null;
    pose(e, t, { hold: !ch3, wave: ch3, happy: u > 1 ? 1 : .5, look: u < 2 ? [0, .25] : [.3, 0] }); pose(d, t, { hold: !ch3 || ch3 < .2, thumbs: ch3 ? ch3 : null, happy: u > 2 ? 1 : .5, look: u < 3.4 ? [0, .25] : [0, 0], nod: u > 2.2 && u < 3.2 ? u - 2.2 : 0 }); pose(p, t, { hold: !ch3, cheer: ch3, happy: u > 3 ? 1 : .5, look: u < 4.4 ? [0, .25] : [-.3, 0], jump: ch3 ? ch3 / 1.4 : null });
    pop(S.e1, t, 42.3 + 3.1, 1.6, headPos(e).add(new THREE.Vector3(-.35, 0, 0)), .3); pop(S.e2, t, 42.3 + 4.4, 1.6, headPos(p).add(new THREE.Vector3(.35, 0, 0)), .3); pop(S.e3, t, 42.3 + 5.6, 1.5, headPos(d).add(new THREE.Vector3(0, .15, 0)), .34);
    camAt([lerp(-1.2, .4, eio(seg(u, 0, L))), 1.7, lerp(6.4, 5.5, eio(seg(u, 0, L)))], [0, 1.38, .7], 32); W.focus = [['emma', e], ['david', d], ['priya', p]]; }
  if (sh.set === 'all') { const S2 = SETS.all; if (!S2.placed) { S2.order.forEach((k, i) => { const ch = CAST[k]; ch.position.set(S2.slots[i][0], 0, S2.slots[i][1]); ch.rotation.set(0, -S2.slots[i][0] * .07, 0); ch.traverse(o => { if (o.userData && o.userData.isProp) o.visible = false; }); S2.s.add(ch); }); S2.placed = true; }
    S2.order.forEach((k, i) => { const ch = CAST[k]; const w = t - 50.2 - i * .12; const isKid = k === 'yousef'; pose(ch, t + i, { wave: w > 0 && (i % 3 !== 1) ? w : null, cheer: w > 0 && i % 3 === 1 ? w : null, happy: 1, jump: isKid && w > 0 ? (w % 1.4) / 1.4 : null, hold: false, holdL: false }); });
    S2.glow.forEach((gm, i) => { const v = ((t * .09 + i / S2.glow.length) % 1); gm.position.copy(S2.curve.getPointAt(v)); gm.scale.setScalar(.8 + Math.sin(t * 6 + i) * .25); });
    if (!sh.end) camAt([lerp(-3, 0, eio(seg(u, 0, L))), lerp(3.6, 3.0, eio(seg(u, 0, L))), lerp(15.5, 14, eio(seg(u, 0, L)))], [0, 1.25, .4], 34);
    else camAt([0, lerp(3.0, 4.6, eio(seg(u, 0, 2.5))), lerp(12, 15.5, eio(seg(u, 0, 2.5)))], [0, lerp(1.25, 2.4, eio(seg(u, 0, 2.5))), 0], 34);
    W.focus = []; }
  W.r.render(W.scene, W.cam);
}
export function project(obj, dy = 0){ const v = new THREE.Vector3(); obj.userData.P.head.getWorldPosition(v); v.y += dy; v.project(W.cam); return { x: (v.x + 1) / 2 * 1920, y: (1 - v.y) / 2 * 1080, vis: v.z < 1 }; }
