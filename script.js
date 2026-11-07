import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* =====================================================================
   MARTIAN MAP
   Part 1: settings + terrain data + terrain analysis + A* routing
   Part 2: 3D scene, interface, dashboard, journey simulation
   ===================================================================== */

// @@LOGIC_START
/* ---------------------------------------------------------------------
   SETTINGS  (change these to match your own data)
   --------------------------------------------------------------------- */
const CONFIG = {
  regionName: 'Jezero Crater',

  // Put your heightmap image in the same folder with this name.
  // Dark pixel = low ground, bright pixel = high ground. A square image works best.
  heightmapFile: 'heightmap.png',

  // The elevation (in meters) that black and white represent in YOUR heightmap.
  elevMin: -2800,
  elevMax: -2000,

  // Real-world width of the area covered by your heightmap, in meters.
  regionWidthM: 7600,

  gridSize: 128,        // the terrain is resampled to gridSize x gridSize cells
  exaggeration: 2,      // makes hills look taller in 3D (does NOT change the calculations)
  worldSize: 100,       // size of the terrain in 3D units

  // Terrain difficulty = 75% slope + 25% roughness (both scaled from 0 to 1)
  slopeRef: 25,         // a slope of 25 degrees counts as "maximum slope difficulty"
  roughRef: 3,          // 3 meters of local height change counts as "maximum roughness"
  mediumLevel: 0.30,    // difficulty above this = yellow
  hazardLevel: 0.55,    // difficulty above this = red (hazard)
  riskGain: 12,         // how strongly the route avoids difficult ground

  // Assumed values (not measured). Edit them freely.
  vehicles: {
    astronaut: { label: 'Astronaut on foot', maxSlope: 22, speed: 1.0 },
    rover:     { label: 'Crewed rover',      maxSlope: 14, speed: 3.0 }
  }
};
CONFIG.cellM = CONFIG.regionWidthM / (CONFIG.gridSize - 1);

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function fmtDist(m) {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}
function fmtTime(s) {
  const m = Math.round(s / 60);
  if (s < 90) return `${Math.round(s)} s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/* ---------------------------------------------------------------------
   Demo terrain (only used when heightmap.png is not found).
   It is SIMULATED: a crater with a delta, a rocky patch and small craters.
   --------------------------------------------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(65536);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const smooth = t => t * t * (3 - 2 * t);
  const at = (i, j) => grid[((j & 255) << 8) | (i & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function fbm(noise, x, y, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

function craterZ(r, R, depth, rim, wall) {
  let z = 0;
  if (r < R) z -= depth * wall * (1 - Math.pow(r / R, 4));
  const sigma = Math.max(60, R * 0.08);
  z += rim * wall * Math.exp(-Math.pow((r - R) / sigma, 2));
  if (r > R) z += 0.5 * rim * wall * Math.exp(-(r - R) / (R * 0.3));
  return z;
}

function generateDemoTerrain(n) {
  const W = CONFIG.regionWidthM;
  const noise = makeNoise(11), rnd = mulberry32(5);
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const small = [
    { u: 0.72, v: 0.30, R: 460, depth: 30, rim: 8 },
    { u: 0.30, v: 0.72, R: 560, depth: 36, rim: 9 },
    { u: 0.68, v: 0.72, R: 340, depth: 22, rim: 7 },
    { u: 0.40, v: 0.35, R: 300, depth: 18, rim: 6 }
  ];
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1), v = y / (n - 1);
      let z = -2450 + 140 * (fbm(noise, u * 2.5, v * 2.5) - 0.5) + 25 * (fbm(noise, u * 9 + 20, v * 9 + 20) - 0.5);

      // Main crater with a gap in the rim on the west (inlet) and east (outlet) sides
      const dx = u - 0.5, dy = v - 0.5;
      const rm = Math.hypot(dx, dy) * W;
      const theta = Math.atan2(dy, dx);
      const breach = Math.max(Math.exp(-Math.pow(theta / 0.28, 2)), Math.exp(-Math.pow((Math.abs(theta) - Math.PI) / 0.28, 2)));
      z += craterZ(rm, 2700, 220, 65, 1 - 0.75 * breach);

      // Small craters
      for (const c of small) {
        z += craterZ(Math.hypot(u - c.u, v - c.v) * W, c.R, c.depth, c.rim, 1);
      }

      // Delta-like mound on the west side of the crater floor
      const dd = Math.hypot(u - 0.25, v - 0.5) * W;
      z += 60 * Math.exp(-(dd * dd) / (2 * 450 * 450));

      // Rocky patches: small random bumps, stronger inside the patches
      const mask = smoothstep(0.5, 0.65, noise(u * 6 + 40, v * 6 + 40));
      z += (rnd() - 0.5) * 2 * (0.4 + 3.2 * mask);

      h[y * n + x] = z;
    }
  }
  return h;
}

/* ---------------------------------------------------------------------
   Terrain analysis: slope, roughness, difficulty
   slope      = steepness from height differences between neighboring cells
   roughness  = how much a cell differs from the average of its neighbors
                (an ESTIMATE of rough ground, not a count of rocks)
   difficulty = 0.75 * slope + 0.25 * roughness   (0 = easy, 1 = very hard)
   --------------------------------------------------------------------- */
function analyzeTerrain(h, n, cell) {
  const slope = new Float32Array(n * n);
  const rough = new Float32Array(n * n);
  const diff = new Float32Array(n * n);
  let hMin = Infinity, hMax = -Infinity;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      hMin = Math.min(hMin, h[i]); hMax = Math.max(hMax, h[i]);

      const x0 = Math.max(x - 1, 0), x1 = Math.min(x + 1, n - 1);
      const y0 = Math.max(y - 1, 0), y1 = Math.min(y + 1, n - 1);
      const dzdx = (h[y * n + x1] - h[y * n + x0]) / ((x1 - x0) * cell);
      const dzdy = (h[y1 * n + x] - h[y0 * n + x]) / ((y1 - y0) * cell);
      slope[i] = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;

      let sum = 0, count = 0;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (xx === x && yy === y) continue;
          sum += h[yy * n + xx]; count++;
        }
      }
      rough[i] = clamp(Math.abs(h[i] - sum / count) / CONFIG.roughRef, 0, 1);
      diff[i] = clamp(0.75 * slope[i] / CONFIG.slopeRef + 0.25 * rough[i], 0, 1);
    }
  }
  return { n, h, cell, slope, rough, diff, hMin, hMax };
}

const riskClass = d => (d >= CONFIG.hazardLevel ? 2 : d >= CONFIG.mediumLevel ? 1 : 0); // 0 easy, 1 medium, 2 risky

/* ---------------------------------------------------------------------
   A* pathfinding
   cost of a step = real 3D distance * (1 + w * riskGain * difficulty^2)
   w = 0  -> shortest route      w = 1 -> strongly avoids difficult ground
   Cells steeper than the vehicle limit are never entered.
   --------------------------------------------------------------------- */
class MinHeap {
  constructor() { this.keys = []; this.vals = []; }
  get size() { return this.keys.length; }
  push(key, val) {
    const k = this.keys, v = this.vals;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.keys, v = this.vals;
    const top = v[0], lastK = k.pop(), lastV = v.pop();
    if (k.length) {
      k[0] = lastK; v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function findRoute(T, start, end, vehicle, w) {
  const { n, h, slope, diff, cell } = T;
  const total = n * n;
  const g = new Float32Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const blocked = i => slope[i] > vehicle.maxSlope;
  const ex = end % n, ey = (end / n) | 0;
  const heuristic = (x, y) => Math.hypot(x - ex, y - ey) * cell;

  const open = new MinHeap();
  g[start] = 0;
  open.push(heuristic(start % n, (start / n) | 0), start);

  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === end) break;
    const cx = cur % n, cy = (cur / n) | 0;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const ni = ny * n + nx;
      if (closed[ni] || (blocked(ni) && ni !== end)) continue;
      // do not cut corners through steep cells
      if (dx && dy && (blocked(cy * n + nx) || blocked(ny * n + cx))) continue;

      const run = Math.hypot(dx, dy) * cell;
      const d3 = Math.hypot(run, h[ni] - h[cur]);
      const dAvg = (diff[cur] + diff[ni]) / 2;
      const ng = g[cur] + d3 * (1 + w * CONFIG.riskGain * dAvg * dAvg);
      if (ng < g[ni]) {
        g[ni] = ng; prev[ni] = cur;
        open.push(ng + heuristic(nx, ny), ni);
      }
    }
  }

  if (!closed[end]) return null;
  const path = [];
  for (let i = end; i !== -1; i = prev[i]) path.push(i);
  return path.reverse();
}

/* ---------------------------------------------------------------------
   Route statistics for the dashboard
   Travel time = distance / (assumed speed * slope factor)
   The slope factor slows the traveler down on steep ground.
   --------------------------------------------------------------------- */
function routeMetrics(T, path, vehicle) {
  const { n, h, slope, diff, cell } = T;
  let dist = 0, time = 0, gain = 0, maxSlope = 0, zones = 0, inHazard = false, riskSum = 0;
  const profile = [], cumDist = [], cumTime = [];

  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    maxSlope = Math.max(maxSlope, slope[c]);
    riskSum += diff[c];
    const hazard = diff[c] >= CONFIG.hazardLevel;
    if (hazard && !inHazard) zones++;
    inHazard = hazard;

    if (i > 0) {
      const p = path[i - 1];
      const dx = (c % n) - (p % n), dy = ((c / n) | 0) - ((p / n) | 0);
      const run = Math.hypot(dx, dy) * cell, dz = h[c] - h[p];
      const d3 = Math.hypot(run, dz);
      const segSlope = Math.atan2(Math.abs(dz), run) * 180 / Math.PI;
      const factor = clamp(1 - 0.7 * segSlope / vehicle.maxSlope, 0.25, 1);
      dist += d3; time += d3 / (vehicle.speed * factor);
      if (dz > 0) gain += dz;
    }
    cumDist.push(dist); cumTime.push(time);
    profile.push({ x: dist, y: h[c] });
  }
  return { path, dist, time, gain, maxSlope, zones, avgRisk: riskSum / path.length * 100, profile, cumDist, cumTime };
}
// @@LOGIC_END

/* =====================================================================
   PART 2: 3D scene, interface and dashboard
   ===================================================================== */
const $ = id => document.getElementById(id);

/* ---------- Loading the heightmap (or the demo terrain) ---------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image not found'));
    img.src = src;
  });
}

function blur3x3(h, n) {
  const out = new Float32Array(h.length);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(n - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(n - 1, x + 1); xx++) { s += h[yy * n + xx]; c++; }
      }
      out[y * n + x] = s / c;
    }
  }
  return out;
}

async function loadHeights() {
  const n = CONFIG.gridSize;
  try {
    const img = await loadImage(CONFIG.heightmapFile);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, n, n);
    const px = ctx.getImageData(0, 0, n, n).data;
    let h = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      h[i] = CONFIG.elevMin + (px[i * 4] / 255) * (CONFIG.elevMax - CONFIG.elevMin);
    }
    h = blur3x3(h, n); // softens the 256-level steps of an 8-bit image
    return { h, source: 'real' };
  } catch (err) {
    return { h: generateDemoTerrain(n), source: 'demo' };
  }
}

/* ---------- Main ---------- */
async function main() {
  const n = CONFIG.gridSize;
  const { h, source } = await loadHeights();
  const T = analyzeTerrain(h, n, CONFIG.cellM);

  const dataBadge = $('data-badge');
  $('region-badge').textContent = `Region: ${CONFIG.regionName}`;
  if (source === 'real') {
    dataBadge.textContent = 'Data: NASA heightmap loaded';
    dataBadge.classList.add('real');
  } else {
    dataBadge.textContent = 'Data: DEMO terrain (simulated) – add heightmap.png for real data';
    dataBadge.classList.add('demo');
  }

  /* ----- Scene ----- */
  const viewport = $('viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  viewport.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0605');
  scene.fog = new THREE.Fog('#0b0605', 150, 330);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const HOME_POS = new THREE.Vector3(0, 72, 92);
  camera.position.copy(HOME_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 8;
  controls.maxDistance = 220;

  scene.add(new THREE.HemisphereLight('#ffd9c2', '#3a1a12', 0.75));
  const sun = new THREE.DirectionalLight('#fff0e0', 1.9);
  sun.position.set(-70, 38, 45);
  scene.add(sun);

  function resize() {
    const w = viewport.clientWidth, hgt = viewport.clientHeight;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  /* ----- Terrain mesh ----- */
  const size = CONFIG.worldSize, half = size / 2, step = size / (n - 1);
  const ky = (size / ((n - 1) * CONFIG.cellM)) * CONFIG.exaggeration; // meters -> 3D height
  const hMin = T.hMin, hMax = T.hMax;

  const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < n * n; i++) pos.setY(i, (h[i] - hMin) * ky);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  scene.add(terrain);

  const palette = ['#3b1c14', '#7a3a21', '#b4663a', '#e0b077'].map(c => new THREE.Color(c));
  const CLASS_COLORS = [new THREE.Color('#3ddc84'), new THREE.Color('#ffd23f'), new THREE.Color('#ff4d4d')];

  function elevationColor(t, out) {
    const f = clamp(t, 0, 1) * (palette.length - 1);
    const i = Math.min(Math.floor(f), palette.length - 2);
    return out.copy(palette[i]).lerp(palette[i + 1], f - i);
  }

  function paintTerrain(hazardMode) {
    const col = geo.attributes.color, tmp = new THREE.Color();
    for (let i = 0; i < n * n; i++) {
      elevationColor((h[i] - hMin) / (hMax - hMin || 1), tmp);
      if (hazardMode) tmp.lerp(CLASS_COLORS[riskClass(T.diff[i])], 0.7);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  }
  paintTerrain(false);

  /* ----- Helpers: grid <-> 3D ----- */
  function sampleH(gx, gy) {
    const x0 = clamp(Math.floor(gx), 0, n - 2), y0 = clamp(Math.floor(gy), 0, n - 2);
    const fx = clamp(gx - x0, 0, 1), fy = clamp(gy - y0, 0, 1);
    const a = h[y0 * n + x0], b = h[y0 * n + x0 + 1], c = h[(y0 + 1) * n + x0], d = h[(y0 + 1) * n + x0 + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  const toWorld = (gx, gy) => new THREE.Vector3(-half + gx * step, (sampleH(gx, gy) - hMin) * ky, -half + gy * step);

  /* ----- A / B markers ----- */
  function labelTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fillStyle = color; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#10090a'; g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function makeMarker(text, color) {
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8), new THREE.MeshBasicMaterial({ color }));
    pole.position.y = 2.5;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, color), depthTest: false }));
    sprite.scale.set(4, 4, 1);
    sprite.position.y = 6;
    sprite.renderOrder = 10;
    grp.add(pole, sprite);
    grp.visible = false;
    scene.add(grp);
    return grp;
  }
  const markerA = makeMarker('A', '#4fc3ff');
  const markerB = makeMarker('B', '#ff4fd8');

  /* ----- Traveler (moving marker) ----- */
  const traveler = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  const travelerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.7, 32),
    new THREE.MeshBasicMaterial({ color: '#e2673a', side: THREE.DoubleSide })
  );
  travelerRing.rotation.x = -Math.PI / 2;
  traveler.add(travelerRing);
  traveler.visible = false;
  traveler.renderOrder = 9;
  scene.add(traveler);

  /* ----- Route ribbons ----- */
  function buildRibbon(points, colors, width, lift, opacity) {
    const positions = [], cols = [], index = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a); t.y = 0;
      if (t.lengthSq() < 1e-9) t.set(1, 0, 0);
      t.normalize();
      const sx = -t.z * width / 2, sz = t.x * width / 2, p = points[i], c = colors[i];
      positions.push(p.x + sx, p.y + lift, p.z + sz, p.x - sx, p.y + lift, p.z - sz);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < points.length - 1) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(index);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: opacity < 1, opacity });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 5;
    return mesh;
  }

  function smoothPoints(raw, passes = 2) {
    let pts = raw.map(c => [c % n, (c / n) | 0]);
    for (let k = 0; k < passes; k++) {
      pts = pts.map((p, i) => {
        if (i === 0 || i === pts.length - 1) return p;
        const a = pts[i - 1], b = pts[i + 1];
        return [0.25 * a[0] + 0.5 * p[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * p[1] + 0.25 * b[1]];
      });
    }
    return pts.map(p => toWorld(p[0], p[1]));
  }

  let routeMesh = null, baseMesh = null;
  function removeRibbons() {
    for (const m of [routeMesh, baseMesh]) {
      if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    }
    routeMesh = baseMesh = null;
  }

  /* ----- Elevation chart (Chart.js) ----- */
  const RISK_CSS = ['#3ddc84', '#ffd23f', '#ff4d4d'];
  let chartRisk = [];
  let chart = null;
  if (typeof Chart !== 'undefined') {
    const tick = '#b9a79c', grid = 'rgba(255,255,255,0.06)';
    chart = new Chart($('elevChart'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Selected route', data: [], parsing: false, borderWidth: 3, pointRadius: 0,
            fill: 'start', backgroundColor: 'rgba(226,103,58,0.12)', borderColor: '#e2673a',
            segment: { borderColor: c => RISK_CSS[chartRisk[c.p1DataIndex] ?? 0] }, order: 1
          },
          {
            label: 'Shortest route', data: [], parsing: false, borderWidth: 1.5, pointRadius: 0,
            borderColor: 'rgba(255,255,255,0.5)', borderDash: [5, 4], order: 2
          },
          {
            label: 'Traveler', data: [], parsing: false, showLine: false, pointRadius: 6,
            pointBackgroundColor: '#ffffff', pointBorderColor: '#e2673a', pointBorderWidth: 3, order: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Distance along route (m)', color: tick }, ticks: { color: tick }, grid: { color: grid } },
          y: { title: { display: true, text: 'Elevation (m)', color: tick }, ticks: { color: tick }, grid: { color: grid } }
        },
        plugins: { legend: { labels: { color: '#d9c9bf', usePointStyle: true } } }
      }
    });
  } else {
    $('elevChart').parentElement.innerHTML = '<p class="muted">The chart library could not be loaded (check your internet connection).</p>';
  }

  /* ----- State ----- */
  const state = { start: null, end: null, vehicle: 'astronaut', w: 0.6, route: null, base: null, playing: false, progress: 0, sim: null };
  const baseCache = new Map();
  const DURATION = 15; // seconds the journey animation takes

  /* ----- UI elements ----- */
  const vehicleSel = $('vehicle'), riskSlider = $('risk'), btnPlay = $('btn-play');
  for (const [key, v] of Object.entries(CONFIG.vehicles)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = v.label;
    vehicleSel.appendChild(opt);
  }

  function setStatus(text, kind = 'info') {
    const el = $('status');
    el.textContent = text;
    el.className = `status ${kind}`;
  }

  function updateInfoTexts() {
    const v = CONFIG.vehicles[state.vehicle];
    $('vehicle-info').textContent = `Slope limit: ${v.maxSlope}°. Assumed speed on flat ground: ${v.speed} m/s.`;
    const pct = Math.round(state.w * 100);
    const name = pct === 0 ? 'Fastest route' : pct >= 90 ? 'Lowest-risk route' : pct < 40 ? 'Mostly fastest' : pct > 65 ? 'Mostly low-risk' : 'Balanced';
    $('risk-info').textContent = `${name} (${pct}% weight on terrain risk)`;
    $('assumption').textContent = `Travel time is an estimate based on an assumed speed of ${v.speed} m/s on flat ground that decreases on steep ground.`;
  }

  /* ----- Dashboard ----- */
  function clearDashboard() {
    for (const id of ['m-dist', 'm-time', 'm-gain', 'm-slope', 'm-zones', 'm-risk']) $(id).textContent = '—';
    $('compare').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="muted">Choose a start and a destination to compare routes.</td></tr>';
    $('verdict').textContent = '';
    if (chart) {
      chart.data.datasets.forEach(d => { d.data = []; });
      chart.update('none');
    }
  }

  function updateDashboard(m, b) {
    $('m-dist').textContent = fmtDist(m.dist);
    $('m-time').textContent = fmtTime(m.time);
    $('m-gain').textContent = `${m.gain.toFixed(0)} m`;
    $('m-slope').textContent = `${m.maxSlope.toFixed(1)}°`;
    $('m-zones').textContent = m.zones;
    $('m-risk').textContent = `${m.avgRisk.toFixed(0)}%`;

    const rows = [
      ['Distance', fmtDist(m.dist), fmtDist(b.dist)],
      ['Travel time (est.)', fmtTime(m.time), fmtTime(b.time)],
      ['Hazard zones', m.zones, b.zones],
      ['Average risk', `${m.avgRisk.toFixed(0)}%`, `${b.avgRisk.toFixed(0)}%`]
    ];
    $('compare').querySelector('tbody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');

    if (m.path.join() === b.path.join()) {
      $('verdict').textContent = 'The selected route is also the shortest route. Move the slider toward "Lowest risk" to see the trade-off.';
    } else {
      const dd = (m.dist / b.dist - 1) * 100;
      $('verdict').textContent = `Trade-off: the selected route is ${Math.abs(dd).toFixed(0)}% ${dd >= 0 ? 'longer' : 'shorter'} than the shortest route, and has ${m.zones} hazard zone(s) instead of ${b.zones}.`;
    }

    if (chart) {
      chartRisk = m.path.map(c => riskClass(T.diff[c]));
      chart.data.datasets[0].data = m.profile;
      chart.data.datasets[1].data = m.path.join() === b.path.join() ? [] : b.profile;
      chart.data.datasets[2].data = [];
      chart.update('none');
    }
  }

  /* ----- Journey simulation ----- */
  function setProgress(p) {
    const m = state.route, sim = state.sim;
    if (!m || !sim) return;
    state.progress = clamp(p, 0, 1);
    const t = state.progress * m.time, ct = m.cumTime;
    let i = 1;
    while (i < ct.length - 1 && ct[i] < t) i++;
    const i0 = i - 1, f = clamp((t - ct[i0]) / ((ct[i] - ct[i0]) || 1), 0, 1);

    const pt = sim.pts[i0].clone().lerp(sim.pts[i], f);
    traveler.position.set(pt.x, pt.y + 1.2, pt.z);

    const dist = lerp(m.cumDist[i0], m.cumDist[i], f);
    const elev = lerp(m.profile[i0].y, m.profile[i].y, f);
    $('sim-hud').textContent = `Elapsed ${fmtTime(t)} · Distance ${fmtDist(dist)} · Elevation ${elev.toFixed(0)} m · Local slope ${T.slope[m.path[i0]].toFixed(1)}°`;
    if (chart) {
      chart.data.datasets[2].data = [{ x: dist, y: elev }];
      chart.update('none');
    }
  }

  function setPlaying(on) {
    state.playing = on;
    btnPlay.textContent = on ? '⏸ Pause' : '▶ Play journey';
  }

  /* ----- Compute and draw a route ----- */
  function clearRouteGraphics() {
    removeRibbons();
    traveler.visible = false;
    $('sim-hud').hidden = true;
    state.route = null; state.sim = null; state.progress = 0;
    setPlaying(false);
    btnPlay.disabled = true;
    clearDashboard();
  }

  function computeRoute() {
    if (state.start === null || state.end === null) return;
    const v = CONFIG.vehicles[state.vehicle];
    const s = state.start, e = state.end;
    if (s === e) { clearRouteGraphics(); setStatus('Start and destination are the same point. Pick another destination.', 'warn'); return; }

    for (const [idx, name] of [[s, 'start point'], [e, 'destination']]) {
      if (T.slope[idx] > v.maxSlope) {
        clearRouteGraphics();
        setStatus(`The ${name} is on ${T.slope[idx].toFixed(0)}° terrain, steeper than the ${v.maxSlope}° limit of this vehicle. Pick a flatter spot or change the vehicle.`, 'warn');
        return;
      }
    }

    const key = `${s}-${e}-${state.vehicle}`;
    if (!baseCache.has(key)) baseCache.set(key, findRoute(T, s, e, v, 0));
    const basePath = baseCache.get(key);
    const path = state.w === 0 ? basePath : findRoute(T, s, e, v, state.w);
    if (!basePath || !path) {
      clearRouteGraphics();
      setStatus('No route found for this vehicle between these points (steep terrain blocks the way). Try other points or another vehicle.', 'bad');
      return;
    }

    const m = routeMetrics(T, path, v);
    const b = path === basePath ? m : routeMetrics(T, basePath, v);
    state.route = m; state.base = b;

    removeRibbons();
    const pts = smoothPoints(path);
    const colors = path.map(c => CLASS_COLORS[riskClass(T.diff[c])]);
    routeMesh = buildRibbon(pts, colors, 1.0, 0.7, 1);
    scene.add(routeMesh);
    if (path !== basePath && path.join() !== basePath.join()) {
      const bp = smoothPoints(basePath);
      baseMesh = buildRibbon(bp, bp.map(() => new THREE.Color('#ffffff')), 0.5, 0.55, 0.55);
      scene.add(baseMesh);
    }

    state.sim = { pts };
    traveler.visible = true;
    $('sim-hud').hidden = false;
    setPlaying(false);
    setProgress(0);
    btnPlay.disabled = false;
    updateDashboard(m, b);
    setStatus(`Route ready: ${fmtDist(m.dist)}, about ${fmtTime(m.time)}, ${m.zones} hazard zone(s). Click the terrain again to start a new route.`, 'ok');
  }

  /* ----- Picking points on the terrain ----- */
  const raycaster = new THREE.Raycaster();
  let downInfo = null;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', e => { downInfo = { x: e.clientX, y: e.clientY }; });
  dom.addEventListener('pointerup', e => {
    if (!downInfo) return;
    const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
    downInfo = null;
    if (moved > 5) return; // it was a drag (rotate/pan), not a click

    const rect = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(terrain)[0];
    if (!hit) return;
    const gx = clamp(Math.round((hit.point.x + half) / step), 0, n - 1);
    const gy = clamp(Math.round((hit.point.z + half) / step), 0, n - 1);
    const idx = gy * n + gx;
    const wp = toWorld(gx, gy);

    if (state.start === null || (state.start !== null && state.end !== null)) {
      clearRouteGraphics();
      state.start = idx; state.end = null;
      markerA.position.copy(wp); markerA.visible = true; markerB.visible = false;
      setStatus('Start point (A) set. Now click the destination (B).', 'info');
    } else {
      state.end = idx;
      markerB.position.copy(wp); markerB.visible = true;
      computeRoute();
    }
  });

  /* ----- Controls ----- */
  vehicleSel.addEventListener('change', () => { state.vehicle = vehicleSel.value; updateInfoTexts(); computeRoute(); });
  riskSlider.addEventListener('input', () => { state.w = riskSlider.value / 100; updateInfoTexts(); computeRoute(); });
  btnPlay.addEventListener('click', () => {
    if (!state.route) return;
    if (!state.playing && state.progress >= 1) setProgress(0);
    setPlaying(!state.playing);
  });
  $('btn-clear').addEventListener('click', () => {
    clearRouteGraphics();
    state.start = state.end = null;
    markerA.visible = markerB.visible = false;
    setStatus('Click on the terrain to place the start point (A).', 'info');
  });
  $('chk-hazard').addEventListener('change', e => paintTerrain(e.target.checked));
  $('btn-reset-view').addEventListener('click', () => {
    camera.position.copy(HOME_POS);
    controls.target.set(0, 0, 0);
  });

  /* ----- Animation loop ----- */
  const clock = new THREE.Clock();
  const follow = $('chk-follow');
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (state.playing && state.route) {
      const p = state.progress + dt / DURATION;
      setProgress(p);
      if (p >= 1) setPlaying(false);
    }
    if (follow.checked && state.playing && traveler.visible) {
      const before = controls.target.clone();
      controls.target.lerp(traveler.position, 0.08);
      camera.position.add(controls.target.clone().sub(before));
    }
    controls.update();
    renderer.render(scene, camera);
  });

  updateInfoTexts();
  $('loading').classList.add('hidden');
  setStatus('Click on the terrain to place the start point (A).', 'info');
}

main().catch(err => {
  console.error(err);
  const el = $('loading');
  el.classList.remove('hidden');
  el.textContent = 'Something went wrong while starting the map. Open the browser console (F12) to see the error.';
});
