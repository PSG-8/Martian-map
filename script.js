import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTravelerModel, animateModel, celebrateModel, resetCelebration, loadOptionalModels, makeMarsEnv, applyModelEnv, CELEBRATIONS, CELEBRATION_TEXT } from './models.js?v=5';
import * as HZ from './hazards.js?v=5';
import { initWorldMap, SITES } from './worldmap.js?v=5';

window.__mmStarted = true; // tells index.html that this file loaded (used by the start-up check)

/* =====================================================================
   MARTIAN MAP  ·  Team Starseekers
   Part 1: settings, terrain data, terrain analysis, A* routing, models
   Part 2: 3D scene, interface, dashboard, journey simulation
   ===================================================================== */

// @@LOGIC_START
/* ---------------------------------------------------------------------
   SETTINGS
   Real data: put heightmap.png and terrain.json next to index.html
   (make_heightmap.py creates both). Without them the site shows a
   simulated DEMO terrain and says so on the page.
   --------------------------------------------------------------------- */
const CONFIG = {
  regionName: 'Demo terrain (simulated)',
  terrainFile: 'terrain.json',
  heightmapFile: 'heightmap.png',

  // Used only when terrain.json is missing: what black and white mean in heightmap.png
  elevMin: -2800,
  elevMax: -2000,
  regionWidthM: 24000,      // real-world width of the whole map, in meters

  gridSize: 256,            // the terrain is resampled to gridSize x gridSize cells
  exaggeration: 3,          // makes relief look taller in 3D (does NOT change the calculations)
  worldSize: 100,           // size of the terrain in 3D units
  surfaceDetail: 1.0,       // strength of the fine ground texture (0 = off)
  textureSize: 1536,        // resolution of the map texture
  contourSize: 1024,        // resolution of the contour lines

  // Difficulty = 60% slope + 20% roughness + 20% soft-ground likelihood (each scaled 0 to 1)
  slopeRef: 25,             // 25 degrees counts as "maximum slope difficulty"
  roughRef: 3,              // 3 m of local height change counts as "maximum roughness"
  mediumLevel: 0.30,        // route risk above this = yellow
  hazardLevel: 0.55,        // route risk above this = red (hazard zone)
  riskGain: 12,             // how strongly the route avoids difficult ground

  // Assumed navigation model (NOT measured values)
  startSigmaM: 3,           // position error at the start point (m)
  fixSigmaM: 8,             // position error right after seeing a known crater (m)
  driftBase: 0.015,         // position drift: 1.5% of distance travelled
  driftSlip: 0.06,          // extra drift when the wheels/feet slip

  // Assumed vehicle values (NOT measured). Edit them freely.
  vehicles: {
    astronaut: { label: 'Astronaut on foot (EVA suit)', model: 'astronaut', maxSlope: 22, speed: 1.0, mass: 140, eff: 0.25, roll: 0.12,
      power: { type: 'suit', enduranceH: 8, label: 'Suit life support, assumed 8 h' } },
    rover: { label: 'Robotic rover (Perseverance style)', model: 'rover', maxSlope: 15, speed: 0.04, mass: 1025, eff: 0.50, roll: 0.10,
      power: { type: 'rtg', watts: 110, capacityWh: 2500, startPct: 90, housekeepingW: 70, label: 'Nuclear battery (RTG) 110 W + battery' } },
    crewed: { label: 'Crewed rover (concept)', model: 'crewed', maxSlope: 14, speed: 3.0, mass: 1200, eff: 0.50, roll: 0.08,
      power: { type: 'solar', areaM2: 8, eff: 0.28, capacityWh: 30000, startPct: 90, housekeepingW: 400, label: 'Solar roof 8 m² + 30 kWh battery' } }
  },

  landmarks: []             // filled from terrain.json, or detected automatically
};
const MARS_G = 3.71;

// Terrain classes shown on the difficulty layer (colors follow the Canva concept paper)
const TERRAIN_CLASSES = [
  { name: 'Easy',         desc: 'Firm ground, light incline', color: '#f5d547' },
  { name: 'Moderate',     desc: 'Scattered rocks',            color: '#f09a54' },
  { name: 'Difficult',    desc: 'Soft sand or high incline',  color: '#c8552b' },
  { name: 'Prohibited',   desc: 'Too steep for this vehicle', color: '#6b1d1d' },
  { name: 'Rock outcrop', desc: 'Solid, rough rock',          color: '#f4f1ea' }
];

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function fmtDist(m) {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}
function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.round(s / 60);
  if (s < 90) return `${Math.round(s)} s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
function fmtEnergy(wh) {
  return wh < 1000 ? `${wh.toFixed(0)} Wh` : `${(wh / 1000).toFixed(2)} kWh`;
}
function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
const accuracyLabel = sigma => (sigma < 30 ? 'High' : sigma < 100 ? 'Moderate' : 'Low');

/* ---------------------------------------------------------------------
   Demo terrain (only used when heightmap.png is not found). SIMULATED.
   A 24 km map with three craters, a ridge with two passes, sand fields
   with ripples, boulder fields and many small craters.
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

const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

// breaches = directions (radians, 0 = east) where the crater wall has a gap (a ramp in or out)
const DEMO_CRATERS = [
  { u: 0.25, v: 0.55, R: 3000, depth: 260, rim: 80, breaches: [0, Math.PI] },
  { u: 0.76, v: 0.42, R: 2300, depth: 200, rim: 65, breaches: [Math.PI, -0.7] },
  { u: 0.62, v: 0.80, R: 1100, depth: 120, rim: 40, breaches: [Math.PI, 0.4] }
];
const DEMO_LANDMARKS = [
  { name: 'Crater A', u: 0.25, v: 0.55, rM: 4300 },
  { name: 'Crater B', u: 0.76, v: 0.42, rM: 3400 },
  { name: 'Crater C', u: 0.62, v: 0.80, rM: 2200 }
];

function generateDemoTerrain(n, W) {
  const noise = makeNoise(11), noise2 = makeNoise(23), noise3 = makeNoise(37), rnd = mulberry32(5);

  const small = [];
  for (let guard = 0; small.length < 18 && guard < 500; guard++) {
    const u = 0.04 + rnd() * 0.92, v = 0.04 + rnd() * 0.92, R = 140 + Math.pow(rnd(), 2) * 560;
    if (DEMO_CRATERS.some(c => Math.hypot((u - c.u) * W, (v - c.v) * W) < c.R * 1.25 + R)) continue;
    small.push({ u, v, R, depth: 0.16 * R, rim: 0.05 * R });
  }

  const h = new Float32Array(n * n);
  const rippleAngle = 0.6;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1), v = y / (n - 1);
      let z = -2450 + 90 * (fbm(noise, u * 2.2, v * 2.2) - 0.5) + 28 * (fbm(noise, u * 8 + 20, v * 8 + 20) - 0.5);

      for (const c of DEMO_CRATERS) {
        const dx = u - c.u, dy = v - c.v, r = Math.hypot(dx, dy) * W;
        if (r > c.R * 4) continue;
        const theta = Math.atan2(dy, dx);
        let breach = 0;
        for (const b of c.breaches) breach = Math.max(breach, Math.exp(-Math.pow(angDiff(theta, b) / 0.3, 2)));
        z += craterZ(r, c.R, c.depth, c.rim, 1 - 0.78 * breach);
      }
      for (const s of small) {
        const r = Math.hypot(u - s.u, v - s.v) * W;
        if (r < s.R * 3) z += craterZ(r, s.R, s.depth, s.rim, 1);
      }

      // A rocky ridge between the two big craters, with two passes
      const ridgeU = 0.5 + 0.04 * Math.sin(v * 6);
      const gap = Math.max(Math.exp(-Math.pow((v - 0.30) / 0.045, 2)), Math.exp(-Math.pow((v - 0.74) / 0.045, 2)));
      z += 230 * Math.exp(-Math.pow(((u - ridgeU) * W) / 650, 2)) * (1 - 0.92 * gap);

      // Sand fields: slightly lower, with dune ripples
      const sand = smoothstep(0.55, 0.72, fbm(noise2, u * 3 + 7, v * 3 + 7, 3));
      z += sand * (2.0 * Math.sin((u * Math.cos(rippleAngle) + v * Math.sin(rippleAngle)) * W / 800 * 2 * Math.PI) - 6);

      // Boulder fields: small random bumps
      const rock = smoothstep(0.58, 0.74, fbm(noise3, u * 4 + 40, v * 4 + 40, 3));
      z += (rnd() - 0.5) * 2 * (0.2 + 2.8 * rock);

      h[y * n + x] = z;
    }
  }
  return h;
}

/* ---------------------------------------------------------------------
   Terrain analysis
   slope      = steepness from height differences between neighboring cells
   roughness  = how much a cell differs from the average of its neighbors
                (an ESTIMATE of rough ground, not a count of rocks)
   softness   = ESTIMATED likelihood of soft sand. Elevation data cannot measure
                soil, so this is a guess: sand tends to collect on flat, smooth
                ground that lies lower than its surroundings.
   difficulty = 0.6 * slope + 0.2 * roughness + 0.2 * softness   (0 easy ... 1 very hard)
   --------------------------------------------------------------------- */
function boxBlur(src, n, r) {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n), pre = new Float64Array(n + 1);
  for (let y = 0; y < n; y++) {
    pre[0] = 0;
    for (let x = 0; x < n; x++) pre[x + 1] = pre[x] + src[y * n + x];
    for (let x = 0; x < n; x++) {
      const a = Math.max(0, x - r), b = Math.min(n - 1, x + r);
      tmp[y * n + x] = (pre[b + 1] - pre[a]) / (b - a + 1);
    }
  }
  for (let x = 0; x < n; x++) {
    pre[0] = 0;
    for (let y = 0; y < n; y++) pre[y + 1] = pre[y] + tmp[y * n + x];
    for (let y = 0; y < n; y++) {
      const a = Math.max(0, y - r), b = Math.min(n - 1, y + r);
      out[y * n + x] = (pre[b + 1] - pre[a]) / (b - a + 1);
    }
  }
  return out;
}

function analyzeTerrain(h, n, cell) {
  const slope = new Float32Array(n * n);
  const rough = new Float32Array(n * n);
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
    }
  }

  const blur = boxBlur(h, n, Math.max(4, Math.round(n * 0.1)));
  const lowScale = Math.max(10, (hMax - hMin) * 0.08);
  const soft = new Float32Array(n * n);
  const diff = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const flat = 1 - smoothstep(4, 12, slope[i]);
    const smooth = 1 - smoothstep(0.12, 0.55, rough[i]);
    const low = clamp((blur[i] - h[i]) / lowScale, 0, 1);
    soft[i] = flat * smooth * (0.3 + 0.7 * low);
    diff[i] = clamp(0.6 * slope[i] / CONFIG.slopeRef + 0.2 * rough[i] + 0.2 * soft[i], 0, 1);
  }
  return { n, h, cell, slope, rough, soft, diff, hMin, hMax };
}

const riskClass = d => (d >= CONFIG.hazardLevel ? 2 : d >= CONFIG.mediumLevel ? 1 : 0); // route risk: 0 easy, 1 medium, 2 risky

// Terrain class for the difficulty layer (depends on the chosen vehicle's slope limit)
function classifyCell(T, i, v) {
  if (T.slope[i] > v.maxSlope) return 3;
  if (T.rough[i] >= 0.8 && T.soft[i] < 0.25) return 4;
  if (T.soft[i] >= 0.6 || T.diff[i] >= 0.5) return 2;
  if (T.rough[i] >= 0.35 || T.diff[i] >= 0.28) return 1;
  return 0;
}

// Finds big depressions (crater-like basins) when no landmarks are given
function detectBasins(T, max = 4) {
  const { n, h, hMin, hMax } = T;
  const R = Math.max(6, Math.round(n * 0.12));
  const blur = boxBlur(h, n, R);
  const range = (hMax - hMin) || 1;
  const w = Math.round(R * 0.6), margin = Math.round(R * 0.5);
  const cands = [];
  for (let y = margin; y < n - margin; y++) {
    for (let x = margin; x < n - margin; x++) {
      const i = y * n + x, s = blur[i] - h[i];
      if (s < 0.03 * range) continue;
      let isMax = true;
      for (let yy = Math.max(0, y - w); yy <= Math.min(n - 1, y + w) && isMax; yy += 2) {
        for (let xx = Math.max(0, x - w); xx <= Math.min(n - 1, x + w); xx += 2) {
          if (blur[yy * n + xx] - h[yy * n + xx] > s) { isMax = false; break; }
        }
      }
      if (isMax) cands.push({ gx: x, gy: y, s });
    }
  }
  cands.sort((a, b) => b.s - a.s);
  const out = [];
  for (const c of cands) {
    if (out.every(o => Math.hypot(o.gx - c.gx, o.gy - c.gy) > R * 1.3)) out.push(c);
    if (out.length >= max) break;
  }
  return out.map((c, k) => ({ name: `Basin ${k + 1}`, u: c.gx / (n - 1), v: c.gy / (n - 1), rM: 0.1 * (n - 1) * T.cell }));
}

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
      if (dx && dy && (blocked(cy * n + nx) || blocked(ny * n + cx))) continue; // do not cut corners through steep cells

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
   Route statistics (all values are ESTIMATES from assumed models)
   slip     : share of the effort lost to sliding. Grows with slope and soft ground.
   time     : distance / (assumed speed * slope factor * (1 - 0.6 * slip))
   energy   : (mass * g * (climb + rolling resistance * distance)) / efficiency
   position : error grows with distance (more when slipping) and resets
              when a known crater (landmark) is in view.
   --------------------------------------------------------------------- */
function slipAt(T, i, v) {
  const sN = clamp(T.slope[i] / v.maxSlope, 0, 1.3);
  return clamp(0.35 * sN * sN + 0.5 * T.soft[i] * (0.3 + 0.7 * Math.min(sN, 1)) + 0.1 * T.rough[i], 0, 0.95);
}

function routeMetrics(T, path, v, marks = [], ctl = null) {
  const { n, h, slope, diff, soft, cell } = T;
  let dist = 0, time = 0, gain = 0, energy = 0, maxSlope = 0, zones = 0, inHazard = false, riskSum = 0;
  let maxSlip = 0, sigma = CONFIG.startSigmaM, maxSigma = sigma, prevFix = false, prevSlip = 0;
  const profile = [], cumDist = [], cumTime = [], cumEnergy = [], slipArr = [], sigmaArr = [], fixIdx = [];

  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    maxSlope = Math.max(maxSlope, slope[c]);
    riskSum += diff[c];
    const hazard = diff[c] >= CONFIG.hazardLevel;
    if (hazard && !inHazard) zones++;
    inHazard = hazard;

    const slipHere = slipAt(T, c, v);
    if (i > 0) {
      const p = path[i - 1];
      const dx = (c % n) - (p % n), dy = ((c / n) | 0) - ((p / n) | 0);
      const run = Math.hypot(dx, dy) * cell, dz = h[c] - h[p];
      const d3 = Math.hypot(run, dz);
      const segSlope = Math.atan2(Math.abs(dz), run) * 180 / Math.PI;
      const factor = clamp(1 - 0.7 * segSlope / v.maxSlope, 0.25, 1);
      const slipSeg = (prevSlip + slipHere) / 2;
      const softSeg = (soft[p] + soft[c]) / 2;
      dist += d3;
      time += d3 / (v.speed * factor * (1 - 0.6 * slipSeg));
      if (dz > 0) gain += dz;
      energy += (v.mass * MARS_G * ((dz > 0 ? dz : 0) + v.roll * (1 + 2 * softSeg) * run)) / v.eff / 3600;
      sigma += d3 * (CONFIG.driftBase * (ctl ? ctl.driftMul : 1) + CONFIG.driftSlip * slipSeg);
    }
    prevSlip = slipHere;
    maxSlip = Math.max(maxSlip, slipHere);

    const gx = c % n, gy = (c / n) | 0;
    let fix = false;
    if (!ctl || ctl.fixOK(time)) for (const m of marks) if (Math.hypot(gx - m.gx, gy - m.gy) * cell <= m.rM) { fix = true; break; }
    if (fix) {
      sigma = Math.min(sigma, CONFIG.fixSigmaM);
      if (!prevFix) fixIdx.push(i);
    }
    prevFix = fix;
    maxSigma = Math.max(maxSigma, sigma);

    cumDist.push(dist); cumTime.push(time); cumEnergy.push(energy);
    slipArr.push(slipHere); sigmaArr.push(sigma);
    profile.push({ x: dist, y: h[c] });
  }
  return {
    path, dist, time, gain, energy, maxSlope, zones, maxSlip, maxSigma, endSigma: sigma,
    avgRisk: riskSum / path.length * 100,
    profile, cumDist, cumTime, cumEnergy, slipArr, sigmaArr, fixIdx
  };
}
// @@LOGIC_END

/* =====================================================================
   PART 2: 3D scene, interface and dashboard
   ===================================================================== */
const $ = id => document.getElementById(id);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const hexRGB = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const CLASS_RGB = TERRAIN_CLASSES.map(c => hexRGB(c.color));

/* ---------- Visual helpers ---------- */
// Value noise that repeats seamlessly (used for the fine ground texture)
function tileNoise(seed, period) {
  const rnd = mulberry32(seed), g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const wrap = v => ((v % period) + period) % period;
  const at = (i, j) => g[wrap(j) * period + wrap(i)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

// A small grainy texture, repeated many times over the terrain: gives dusty, gritty ground
function makeDetailCanvas() {
  const S = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const octaves = [[8, 0.5, 31], [16, 0.25, 32], [32, 0.15, 33], [64, 0.1, 34]].map(([p, w, sd]) => [p, w, tileNoise(sd, p)]);
  const grain = mulberry32(77);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const [p, w, f] of octaves) v += w * f(x / S * p, y / S * p);
      v = clamp(v * 0.85 + grain() * 0.15, 0, 1);
      const gray = 190 + 65 * v, k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = gray;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}


/* ---------- Loading data ---------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image not found'));
    img.src = src;
  });
}

async function fetchMeta(base = '') {
  try {
    const r = await fetch(base + CONFIG.terrainFile, { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j === 'object') ? j : null;
  } catch (e) { return null; }
}

// Reads an image at full resolution, decodes elevation, and averages it down to n x n cells
function imageToGrid(img, n, elevMin, elevMax, encoding) {
  const maxSide = 2048;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, maxSide / Math.max(iw, ih));
  const W = Math.max(2, Math.round(iw * k)), H = Math.max(2, Math.round(ih * k));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const val = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    val[i] = encoding === 'rg16' ? (px[i * 4] * 256 + px[i * 4 + 1]) / 65535 : px[i * 4] / 255;
  }
  const out = new Float32Array(n * n);
  const hw = Math.max(0.5, 0.5 * W / (n - 1)), hh = Math.max(0.5, 0.5 * H / (n - 1));
  for (let gy = 0; gy < n; gy++) {
    const sy = gy / (n - 1) * (H - 1);
    const y0 = Math.max(0, Math.floor(sy - hh)), y1 = Math.min(H - 1, Math.ceil(sy + hh));
    for (let gx = 0; gx < n; gx++) {
      const sx = gx / (n - 1) * (W - 1);
      const x0 = Math.max(0, Math.floor(sx - hw)), x1 = Math.min(W - 1, Math.ceil(sx + hw));
      let s = 0, c = 0;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { s += val[yy * W + xx]; c++; }
      out[gy * n + gx] = elevMin + (s / c) * (elevMax - elevMin);
    }
  }
  return out;
}

/* ---------- Main ---------- */
async function main() {
  const setLoading = t => { $('loading').classList.remove('hidden'); $('loading').textContent = t; };
  await loadOptionalModels();

  /* ----- Renderer, scene, sky, lights ----- */
  const viewport = $('viewport');
  // Device profile: phones and weaker laptops get lighter settings automatically
  const dprNow = window.devicePixelRatio || 1;
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const PROFILE = {
    weak: coarse || window.innerWidth < 800 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4,
  };
  PROFILE.maxDpr = PROFILE.weak ? 1.25 : 1.75;
  PROFILE.shadow = PROFILE.weak ? 1024 : 2048;
  let curDpr = Math.min(dprNow, PROFILE.maxDpr);
  const maxDpr = curDpr;
  const renderer = new THREE.WebGLRenderer({ antialias: dprNow < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(curDpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PROFILE.weak ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color('#d9a681'), ZENITH = new THREE.Color('#7b5444');
  scene.background = HORIZON.clone();
  scene.fog = new THREE.Fog(HORIZON, 140, 340);
  const skyGeo = new THREE.SphereGeometry(600, 32, 16);
  {
    const sp = skyGeo.attributes.position, skyCols = new Float32Array(sp.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < sp.count; i++) {
      const t = clamp(sp.getY(i) / 600, 0, 1);
      tmp.copy(HORIZON).lerp(ZENITH, Math.pow(t, 0.55));
      skyCols[i * 3] = tmp.r; skyCols[i * 3 + 1] = tmp.g; skyCols[i * 3 + 2] = tmp.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
  }
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const HOME_POS = new THREE.Vector3(0, 78, 100);
  camera.position.copy(HOME_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 8;
  controls.maxDistance = 230;

  const hemi = new THREE.HemisphereLight('#f0c3a0', '#40261c', 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe3c6', 2.6);
  sun.position.set(-80, 45, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(PROFILE.shadow, PROFILE.shadow);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 300 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  // soft cool fill light from the opposite side, so shaded faces (and the flag) never go black
  const fill = new THREE.DirectionalLight('#aebfff', 0.0);
  fill.position.set(80, 30, -50);
  scene.add(fill);
  const marsEnv = makeMarsEnv(renderer);

  const DUST_N = PROFILE.weak ? 140 : 320, dustPos = new Float32Array(DUST_N * 3), dustRnd = mulberry32(3);
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i * 3] = (dustRnd() - 0.5) * 130;
    dustPos[i * 3 + 1] = 1 + dustRnd() * 28;
    dustPos[i * 3 + 2] = (dustRnd() - 0.5) * 130;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#e8b896', size: 0.3, transparent: true, opacity: 0.3, depthWrite: false })));

  // Dusty plain around the map
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#6b3d28', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -4.02;
  scene.add(ground);

  function resize() {
    const w = viewport.clientWidth, hgt = viewport.clientHeight;
    if (!w || !hgt) return;
    renderer.setPixelRatio(curDpr);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  /* ----- World state (rebuilt whenever new terrain data is loaded) ----- */
  const detailCanvas = makeDetailCanvas();
  const detailTex = new THREE.CanvasTexture(detailCanvas);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.repeat.set(26, 26);
  detailTex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), PROFILE.weak ? 4 : 8);

  const size = CONFIG.worldSize, half = size / 2;
  let n = CONFIG.gridSize, h = null, T = null, step = size / (n - 1), ky = 1, hMin = 0, hMax = 1;
  let geo = null, terrainMesh = null, skirtMesh = null, terrainTex = null, compCanvas = null, baseCanvas = null, contourCanvas = null, layerCanvas = null;
  let landmarks = [], contourInterval = 50;
  const layers = { overlay: 'difficulty', contours: true, labels: true };
  const env = HZ.makeEnv();
  let svf = null, texImg = null, lastSource = null, currentView = 'world', lastRegionName = '', lastBadge = '';
  const state = { celebrate: null, path: null, basePath: null, haz: null, bhaz: null, start: null, end: null, vehicle: 'astronaut', w: 0.6, route: null, base: null, playing: false, progress: 0, sim: null };
  const baseCache = new Map();
  const DURATION = 18; // seconds the journey animation takes

  function sampleH(gx, gy) {
    const x0 = clamp(Math.floor(gx), 0, n - 2), y0 = clamp(Math.floor(gy), 0, n - 2);
    const fx = clamp(gx - x0, 0, 1), fy = clamp(gy - y0, 0, 1);
    const a = h[y0 * n + x0], b = h[y0 * n + x0 + 1], c = h[(y0 + 1) * n + x0], d = h[(y0 + 1) * n + x0 + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  const toWorld = (gx, gy) => new THREE.Vector3(-half + gx * step, (sampleH(gx, gy) - hMin) * ky, -half + gy * step);
  const cellWorld = idx => toWorld(idx % n, (idx / n) | 0);
  const vehicle = () => CONFIG.vehicles[state.vehicle];
  const marksForMetrics = () => landmarks.map(l => ({ gx: l.gx, gy: l.gy, rM: l.rM }));

  /* ----- Textures: colors, contour lines, difficulty layer ----- */
  const PALETTE = ['#432a20', '#85482b', '#b87648', '#dcae7c'].map(hexRGB);
  const ROCK = hexRGB('#2e2420'), SAND = hexRGB('#d6aa78');
  const mottle = makeNoise(21);
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function paletteAt(t) {
    const f = clamp(t, 0, 1) * (PALETTE.length - 1), i = Math.min(Math.floor(f), PALETTE.length - 2);
    return mix(PALETTE[i], PALETTE[i + 1], f - i);
  }
  const makeCanvas = (w, hgt) => { const c = document.createElement('canvas'); c.width = w; c.height = hgt; return c; };

  function buildBaseCanvas() {
    const TS = CONFIG.textureSize;
    if (texImg) { // real image of the site (for example from the CTX mosaic) replaces the painted surface
      const tc = makeCanvas(TS, TS), tctx = tc.getContext('2d');
      tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(texImg, 0, 0, TS, TS);
      return tc;
    }
    const cellC = makeCanvas(n, n), cctx = cellC.getContext('2d');
    const img = cctx.createImageData(n, n), px = img.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        let c = paletteAt((h[i] - hMin) / (hMax - hMin || 1));
        c = mix(c, ROCK, clamp(smoothstep(7, 30, T.slope[i]) * 0.7 + T.rough[i] * 0.25, 0, 0.85));
        c = mix(c, SAND, T.soft[i] * 0.45);
        const m = 0.82 + 0.36 * mottle(x * 0.3, y * 0.3), k = i * 4;
        px[k] = clamp(c[0] * m, 0, 255); px[k + 1] = clamp(c[1] * m, 0, 255); px[k + 2] = clamp(c[2] * m, 0, 255); px[k + 3] = 255;
      }
    }
    cctx.putImageData(img, 0, 0);
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const off = -0.5 * TS / (n - 1), span = n * TS / (n - 1); // grid points sit on cell centers
    ctx.drawImage(cellC, off, off, span, span);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.45;
    ctx.fillStyle = ctx.createPattern(detailCanvas, 'repeat');
    ctx.fillRect(0, 0, TS, TS);
    return c;
  }

  function buildContourCanvas() {
    const S = CONFIG.contourSize;
    const c = makeCanvas(S, S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S), d = img.data;
    contourInterval = niceStep((hMax - hMin) / 14);
    let zPrev = new Float32Array(S + 1), zCur = new Float32Array(S + 1);
    const rowZ = (py, out) => {
      const gy = (py + 0.5) / S * (n - 1);
      for (let px = 0; px <= S; px++) out[px] = sampleH((px + 0.5) / S * (n - 1), gy);
    };
    rowZ(0, zPrev);
    for (let py = 0; py < S; py++) {
      rowZ(Math.min(py + 1, S - 1), zCur);
      for (let px = 0; px < S; px++) {
        const z = zPrev[px];
        const g = Math.max(Math.abs(zPrev[px + 1] - z), Math.abs(zCur[px] - z), 0.01);
        const q = z / contourInterval, idx = Math.round(q);
        const line = 1 - smoothstep(0.35 * g, 0.9 * g, Math.abs(q - idx) * contourInterval);
        if (line > 0.01) {
          const k = (py * S + px) * 4;
          d[k] = 43; d[k + 1] = 20; d[k + 2] = 9;
          d[k + 3] = Math.round(line * (idx % 5 === 0 ? 0.55 : 0.28) * 255);
        }
      }
      const t = zPrev; zPrev = zCur; zCur = t;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const rampColor = (stops, t) => {
    t = clamp(t, 0, 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
      if (t <= p1) { const f = (t - p0) / ((p1 - p0) || 1); return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)]; }
    }
    return stops[stops.length - 1][1];
  };
  const UV_STOPS = [[0, [60, 200, 110]], [0.19, [60, 200, 110]], [0.375, [255, 214, 64]], [0.5, [255, 150, 50]], [0.69, [240, 70, 60]], [1, [170, 40, 200]]];
  const TEMP_STOPS = [[0, [59, 76, 192]], [0.4, [170, 200, 250]], [0.62, [240, 240, 240]], [0.8, [250, 170, 120]], [1, [180, 4, 38]]];
  const SHIELD_STOPS = [[0, [61, 220, 132]], [0.5, [255, 210, 63]], [1, [255, 77, 77]]];
  const cssGrad = stops => `linear-gradient(90deg, ${stops.map(([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${(p * 100).toFixed(0)}%`).join(', ')})`;

  function updateLegend() {
    const mode = layers.overlay, box = $('legend-mode');
    $('legend-terrain').hidden = mode !== 'difficulty';
    const bar = (stops, a, b, extra = '') => `<div class="gradbar" style="background:${cssGrad(stops)}"></div><div class="gradlabels"><span>${a}</span><span>${b}</span></div>${extra}`;
    if (mode === 'sun') box.innerHTML = bar(UV_STOPS, 'UV low', 'UV extreme', '<p class="hint"><i class="dot" style="background:#1c245c"></i> Dark blue = shadow or night. UV is an assumed model.</p>');
    else if (mode === 'temp') box.innerHTML = bar(TEMP_STOPS, '−90 °C', '+20 °C', '<p class="hint">Assumed temperature model for the chosen time, season and dust.</p>');
    else if (mode === 'shield') box.innerHTML = bar(SHIELD_STOPS, 'More shielded', 'Open sky', '<p class="hint">Crater walls and cliffs block part of the sky, so they block part of the cosmic radiation (estimate).</p>');
    else box.innerHTML = '';
  }

  function buildLayerCanvas() {
    const mode = layers.overlay, v = vehicle();
    if (!layerCanvas || layerCanvas.width !== n) layerCanvas = makeCanvas(n, n);
    const ctx = layerCanvas.getContext('2d'), img = ctx.createImageData(n, n), px = img.data;
    let lit = null, sp = null;
    if (mode === 'sun' || mode === 'temp') { sp = HZ.sunPosition(env.lat, env.ls, env.hour); lit = HZ.computeShadowMap(T, sp); }
    for (let i = 0; i < n * n; i++) {
      let c;
      if (mode === 'difficulty') c = CLASS_RGB[classifyCell(T, i, v)];
      else if (mode === 'sun') {
        if (sp.elev <= 0) c = [18, 24, 60];
        else if (!lit[i]) c = [28, 36, 92];
        else c = rampColor(UV_STOPS, HZ.uvIndex(sp.elev, env.tau, h[i], true, 1) / 16);
      } else if (mode === 'temp') c = rampColor(TEMP_STOPS, (HZ.temperatureC(env.lat, env.tau, sp.elev, !!lit[i]) + 90) / 110);
      else c = rampColor(SHIELD_STOPS, ((0.35 + 0.65 * svf[i]) - 0.8) / 0.2);
      const k = i * 4;
      px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function composeTexture() {
    const TS = CONFIG.textureSize, ctx = compCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (layers.overlay !== 'none') {
      const off = -0.5 * TS / (n - 1), span = n * TS / (n - 1);
      ctx.globalAlpha = texImg ? 0.45 : 0.58;
      ctx.drawImage(layerCanvas, off, off, span, span);
      ctx.globalAlpha = 1;
    }
    if (layers.contours) ctx.drawImage(contourCanvas, 0, 0, TS, TS);
    terrainTex.needsUpdate = true;
  }

  function refreshLayer() {
    if (!T) return;
    if (layers.overlay !== 'none') buildLayerCanvas();
    composeTexture();
    updateLegend();
  }

  /* ----- Terrain mesh ----- */
  function buildSkirt() {
    if (skirtMesh) { scene.remove(skirtMesh); skirtMesh.geometry.dispose(); skirtMesh.material.dispose(); skirtMesh = null; }
    const bottom = -4, edge = [];
    for (let x = 0; x < n; x++) edge.push([x, 0]);
    for (let y = 1; y < n; y++) edge.push([n - 1, y]);
    for (let x = n - 2; x >= 0; x--) edge.push([x, n - 1]);
    for (let y = n - 2; y >= 0; y--) edge.push([0, y]);
    const positions = [], index = [];
    edge.forEach(([gx, gy], i) => {
      const x = -half + gx * step, z = -half + gy * step, top = (h[gy * n + gx] - hMin) * ky;
      positions.push(x, top, z, x, bottom, z);
      if (i < edge.length - 1) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    skirtMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2a1812', roughness: 1, side: THREE.DoubleSide }));
    scene.add(skirtMesh);
  }

  function applyHeights() {
    const pos = geo.attributes.position;
    for (let i = 0; i < n * n; i++) pos.setY(i, (h[i] - hMin) * ky);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    buildSkirt();
  }

  /* ----- Landmarks (known craters) ----- */
  function labelSprite(text) {
    const c = makeCanvas(512, 96), g = c.getContext('2d');
    g.font = 'bold 40px system-ui, sans-serif';
    const w = Math.min(500, g.measureText(text).width + 56);
    g.fillStyle = 'rgba(14, 20, 38, 0.82)';
    g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    g.lineWidth = 3;
    g.beginPath();
    if (g.roundRect) g.roundRect(256 - w / 2, 14, w, 68, 18); else g.rect(256 - w / 2, 14, w, 68);
    g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 49);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, toneMapped: false }));
    s.scale.set(9, 1.7, 1);
    s.renderOrder = 11;
    return s;
  }

  function clearLandmarks() {
    for (const l of landmarks) { scene.remove(l.sprite); l.sprite.material.map.dispose(); l.sprite.material.dispose(); }
    landmarks = [];
  }
  function placeLandmarks() {
    for (const l of landmarks) {
      const p = toWorld(l.gx, l.gy);
      l.sprite.position.set(p.x, p.y + 5.5, p.z);
      l.sprite.visible = layers.labels;
    }
  }
  function setupLandmarks(list) {
    clearLandmarks();
    for (const m of list) {
      const gx = clamp(Math.round(m.u * (n - 1)), 0, n - 1), gy = clamp(Math.round(m.v * (n - 1)), 0, n - 1);
      const sprite = labelSprite(m.name);
      scene.add(sprite);
      landmarks.push({ name: m.name, gx, gy, rM: m.rM || 0.1 * (n - 1) * T.cell, sprite });
    }
    placeLandmarks();
    const opts = landmarks.map((l, i) => `<option value="${i}">${l.name}</option>`).join('');
    $('qr-from').innerHTML = opts; $('qr-to').innerHTML = opts;
    if (landmarks.length > 1) $('qr-to').value = '1';
    $('quick-route').hidden = landmarks.length < 2;
  }

  /* ----- A / B markers ----- */
  function labelTexture(text, color) {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
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
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    pole.position.y = 2.5;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, color), depthTest: false, toneMapped: false }));
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

  /* ----- Traveler (3D astronaut or rover) and position-uncertainty ring ----- */
  const traveler = new THREE.Group();
  let travelerModel = null;
  const travelerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.9, 32),
    new THREE.MeshBasicMaterial({ color: '#e2673a', side: THREE.DoubleSide, toneMapped: false })
  );
  travelerRing.rotation.x = -Math.PI / 2;
  travelerRing.position.y = 0.25;
  traveler.add(travelerRing);
  traveler.visible = false;
  scene.add(traveler);
  function setTravelerModel(vehicleKey) {
    if (travelerModel) traveler.remove(travelerModel);
    travelerModel = buildTravelerModel(CONFIG.vehicles[vehicleKey].model);
    applyModelEnv(travelerModel, marsEnv, 1);
    traveler.add(travelerModel);
  }
  setTravelerModel('astronaut');

  const uncRing = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.16, depthWrite: false, depthTest: false, toneMapped: false }));
    const edge = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false, toneMapped: false }));
    disc.renderOrder = 4; edge.renderOrder = 4;
    uncRing.add(disc, edge);
    uncRing.rotation.x = -Math.PI / 2;
    uncRing.visible = false;
    scene.add(uncRing);
  }

  /* ----- Small rotating 3D preview of the chosen vehicle (in the control panel) ----- */
  let preview = null;
  try {
    const box = $('vehicle-preview');
    const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    pr.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    pr.toneMapping = THREE.ACESFilmicToneMapping;
    const prevEnv = makeMarsEnv(pr);
    box.appendChild(pr.domElement);
    const ps = new THREE.Scene();
    ps.add(new THREE.HemisphereLight('#f0c3a0', '#40261c', 0.9));
    const pl = new THREE.DirectionalLight('#ffe3c6', 2.4);
    pl.position.set(-4, 6, 5);
    ps.add(pl);
    const pc = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    pc.position.set(5.2, 3.0, 6.2);
    pc.lookAt(0, 1.4, 0);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.2, 40), new THREE.MeshStandardMaterial({ color: '#7a4a30', roughness: 1 }));
    pad.position.y = -0.1;
    ps.add(pad);
    const holder = new THREE.Group();
    ps.add(holder);
    let current = null;
    const fit = () => {
      const w = box.clientWidth || 260, hgt = box.clientHeight || 160;
      pr.setSize(w, hgt, false);
      pc.aspect = w / hgt;
      pc.updateProjectionMatrix();
    };
    new ResizeObserver(fit).observe(box);
    fit();
    preview = {
      set(key) {
        if (current) holder.remove(current);
        current = buildTravelerModel(CONFIG.vehicles[key].model);
        applyModelEnv(current, prevEnv, 1);
        holder.add(current);
      },
      shown: () => box.offsetParent !== null,
      render(t) { holder.rotation.y = t * 0.6; animateModel(current, t, 0.016, true); pr.render(ps, pc); }
    };
    preview.set('astronaut');
  } catch (err) {
    console.warn('Vehicle preview is not available', err);
    $('vehicle-preview').hidden = true;
  }

  /* ----- Route ribbons ----- */
  const CLASS_COLORS = [new THREE.Color('#3ddc84'), new THREE.Color('#ffd23f'), new THREE.Color('#ff4d4d')];
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
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: opacity < 1, opacity, toneMapped: false });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
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

  /* ----- Charts (Chart.js) ----- */
  const RISK_CSS = ['#3ddc84', '#ffd23f', '#ff4d4d'];
  let chartRisk = [], chart = null, chart2 = null, chart3 = null;
  const tick = '#b9a79c', gridC = 'rgba(255,255,255,0.06)';
  const axisTitle = text => ({ display: true, text, color: tick });
  if (typeof Chart !== 'undefined') {
    chart = new Chart($('elevChart'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'Selected route', data: [], parsing: false, borderWidth: 3, pointRadius: 0, fill: 'start', backgroundColor: 'rgba(226,103,58,0.12)', borderColor: '#e2673a', segment: { borderColor: c => RISK_CSS[chartRisk[c.p1DataIndex] ?? 0] }, order: 1 },
          { label: 'Shortest route', data: [], parsing: false, borderWidth: 1.5, pointRadius: 0, borderColor: 'rgba(255,255,255,0.5)', borderDash: [5, 4], order: 2 },
          { label: 'Traveler', data: [], parsing: false, showLine: false, pointRadius: 6, pointBackgroundColor: '#ffffff', pointBorderColor: '#e2673a', pointBorderWidth: 3, order: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { type: 'linear', title: axisTitle('Distance along route (m)'), ticks: { color: tick }, grid: { color: gridC } },
          y: { title: axisTitle('Elevation (m)'), ticks: { color: tick }, grid: { color: gridC } }
        },
        plugins: { legend: { labels: { color: '#d9c9bf', usePointStyle: true } } }
      }
    });
    chart2 = new Chart($('accChart'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'Expected slip (%)', data: [], parsing: false, borderWidth: 2, pointRadius: 0, borderColor: '#ff8a5c', yAxisID: 'y', order: 2 },
          { label: 'Position error (m)', data: [], parsing: false, borderWidth: 2, pointRadius: 0, borderColor: '#6fd0ff', backgroundColor: 'rgba(111,208,255,0.12)', fill: 'start', yAxisID: 'y1', order: 3 },
          { label: 'Known crater in view', data: [], parsing: false, showLine: false, pointRadius: 6, pointStyle: 'triangle', pointBackgroundColor: '#ffffff', pointBorderColor: '#6fd0ff', yAxisID: 'y1', order: 1 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { type: 'linear', title: axisTitle('Distance along route (m)'), ticks: { color: tick }, grid: { color: gridC } },
          y: { position: 'left', min: 0, max: 100, title: axisTitle('Slip (%)'), ticks: { color: tick }, grid: { color: gridC } },
          y1: { position: 'right', min: 0, title: axisTitle('Error (m)'), ticks: { color: tick }, grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { labels: { color: '#d9c9bf', usePointStyle: true } } }
      }
    });
    chart3 = new Chart($('hazChart'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'UV index (est.)', data: [], parsing: false, borderWidth: 2, pointRadius: 0, borderColor: '#c77dff', yAxisID: 'y' },
          { label: 'Temperature (°C, est.)', data: [], parsing: false, borderWidth: 2, pointRadius: 0, borderColor: '#6fd0ff', yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { type: 'linear', title: axisTitle('Distance along route (m)'), ticks: { color: tick }, grid: { color: gridC } },
          y: { position: 'left', min: 0, max: 16, title: axisTitle('UV index'), ticks: { color: tick }, grid: { color: gridC } },
          y1: { position: 'right', title: axisTitle('°C'), ticks: { color: tick }, grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { labels: { color: '#d9c9bf', usePointStyle: true } } }
      }
    });
  } else {
    for (const id of ['elevChart', 'accChart', 'hazChart']) $(id).parentElement.innerHTML = '<p class="muted">The chart library could not be loaded (check your internet connection).</p>';
  }

  /* ----- UI elements ----- */
  const vehicleSel = $('vehicle'), riskSlider = $('risk'), btnPlay = $('btn-play');
  const setPlayEnabled = on => { btnPlay.disabled = !on; $('tb-play').disabled = !on; };
  for (const [key, v] of Object.entries(CONFIG.vehicles)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = v.label;
    vehicleSel.appendChild(opt);
  }
  $('legend-terrain').innerHTML = TERRAIN_CLASSES.map(c =>
    `<li><i class="dot" style="background:${c.color}"></i><span><b>${c.name}</b> · ${c.desc}</span></li>`).join('');
  $('assumptions-body').innerHTML =
    '<p>All numbers below are <b>assumptions</b> for this prototype, not measurements, unless marked "real".</p><ul>' +
    Object.values(CONFIG.vehicles).map(v => `<li><b>${v.label}</b>: slope limit ${v.maxSlope}°, speed ${v.speed} m/s on flat ground, mass ${v.mass} kg, efficiency ${(v.eff * 100).toFixed(0)}%. Power: ${v.power.label}.</li>`).join('') +
    `<li><b>Soft ground</b> is estimated from the shape of the land. Elevation data cannot measure soil.</li>` +
    `<li><b>Slip</b> grows with slope and soft ground. Travel time and energy include it.</li>` +
    `<li><b>Position error</b> starts at ${CONFIG.startSigmaM} m, grows by ${(CONFIG.driftBase * 100).toFixed(1)}% of the distance (more when slipping or in dust), and drops to ${CONFIG.fixSigmaM} m when a known crater is seen. Camera fixes need daylight and a not-too-dusty sky.</li>` +
    `<li><b>Radiation</b>: baseline about ${HZ.MARS.gcrBaseMSvDay} mSv per day (real, measured by the Curiosity rover's RAD instrument at Gale crater, Hassler et al. 2014). Lower ground gets slightly less, and terrain that blocks the sky gets less. A solar storm is an assumed ×${HZ.SPE_FACTOR}.</li>` +
    `<li><b>UV, temperature, sunlight</b> use simple assumed models of the Sun's height, season, latitude and dust. Mars has no ozone layer, so UV is only stopped by the suit.</li>` +
    `<li><b>Sun</b>: tilt of ${HZ.MARS.obliquityDeg}° and a sol of 24 h 39 min are real. Shadows are computed from the terrain heights.</li>` +
    `<li><b>Signal delay</b> = Earth distance × ${HZ.MARS.lightMinPerAU} min per AU (light speed).</li></ul>`;
  $('needs-body').innerHTML = '<table class="needs">' + [
    ['Mars EVA suit', 'part', 'Cold limit (−80 °C) and assumed 8 h supply are checked'],
    ['Radiation shielding', 'part', 'Dose estimate per trip with terrain shielding. No shelter design'],
    ['Autonomous navigation + AI dashboard', 'yes', 'The core of this project: routes, slip, position uncertainty'],
    ['Solar and nuclear power', 'yes', 'RTG vs solar rover, dust effect, battery at arrival'],
    ['Rovers and drones', 'part', 'Three traveler types. Drones are not modeled'],
    ['Closed-loop life support, ISRU', 'no', 'Not modeled'],
    ['Food and space farming', 'no', 'Not modeled'],
    ['Medical and low-gravity health', 'no', 'Only gravity (3.71 m/s²) is used, for energy'],
    ['Emergency and abort systems', 'part', 'Alerts only. A "nearest safe shelter" feature is a future idea'],
    ['Geological tools', 'no', 'Not modeled'],
    ['Psychological support', 'no', 'Not modeled (the 3D sky follows a day/night cycle)'],
    ['Spare parts and repair', 'no', 'Not modeled'],
    ['Dust control and air-locks', 'no', 'Dust opacity affects power, sky and navigation only']
  ].map(([a, st, t]) => `<tr><td>${a}</td><td class="s-${st}">${st === 'yes' ? 'Covered' : st === 'part' ? 'Partly' : 'Not yet'}</td><td>${t}</td></tr>`).join('') + '</table>';

  function setStatus(text, kind = 'info') {
    const el = $('status');
    el.textContent = text;
    el.className = `status ${kind}`;
  }

  function updateInfoTexts() {
    const v = vehicle();
    $('vehicle-info').textContent = `Slope limit: ${v.maxSlope}°. Speed on flat ground: ${v.speed} m/s. Power: ${v.power.label}.`;
    const pct = Math.round(state.w * 100);
    const name = pct === 0 ? 'Fastest route' : pct >= 90 ? 'Lowest-risk route' : pct < 40 ? 'Mostly fastest' : pct > 65 ? 'Mostly low-risk' : 'Balanced';
    $('risk-info').textContent = `${name} (${pct}% weight on terrain risk)`;
    $('assumption').textContent = `Estimates use assumed values (see "Model assumptions"). Travel time uses ${v.speed} m/s on flat ground, slower on steep or soft ground.`;
  }

  /* ----- Dashboard ----- */
  const CARD_IDS = ['m-dist', 'm-time', 'm-gain', 'm-slope', 'm-zones', 'm-risk', 'm-energy', 'm-slip', 'm-sigma', 'h-dose', 'h-uv', 'h-temp', 'h-shade', 'h-supply'];
  const fmtHour = hr => { const t = Math.round(hr * 60) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  const fmtTemp = c => `${c.toFixed(0)} °C`;

  function clearDashboard() {
    for (const id of CARD_IDS) $(id).textContent = '—';
    $('h-delay').textContent = `${HZ.commDelayMin(env.au).toFixed(1)} min`;
    $('compare').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="muted">Choose a start and a destination to compare routes.</td></tr>';
    $('verdict').textContent = '';
    $('live').hidden = true;
    $('alerts').innerHTML = '';
    $('alert-bar').hidden = true;
    for (const c of [chart, chart2, chart3]) if (c) { c.data.datasets.forEach(d => { d.data = []; }); c.update('none'); }
  }

  function buildAlerts(m, hz, v) {
    const out = [], p = v.power, delay = HZ.commDelayMin(env.au);
    if (hz.coldAlert) out.push(['bad', `Temperature falls to ${fmtTemp(hz.minT)}, below the ${HZ.LIMITS.suitColdC} °C suit limit.`]);
    if (p.type === 'suit') {
      if (m.time > p.enduranceH * 3600) out.push(['bad', `The trip takes ${fmtTime(m.time)} but the assumed suit supply is ${p.enduranceH} h. Plan a shelter stop.`]);
      else if (hz.minSupply < 20) out.push(['bad', `Suit supplies drop to ${hz.minSupply.toFixed(0)}%.`]);
    } else if (hz.minSupply < 20) out.push(['bad', `Battery drops to ${hz.minSupply.toFixed(0)}%.`]);
    if (hz.peakUV >= 11 && p.type === 'suit') out.push(['info', `Extreme UV (index ${hz.peakUV.toFixed(0)}): the gold visor and suit coating are essential. Mars has no ozone layer.`]);
    if (env.spe) out.push(['bad', `Solar particle storm scenario: dose rate ×${HZ.SPE_FACTOR}. Real missions would seek shelter.`]);
    if (env.tau >= 3) out.push(['info', `Dust storm: camera landmark fixes are off, position drift ×${HZ.driftMultiplier(env.tau).toFixed(1)}, and sunlight is cut sharply.`]);
    if (hz.nightShare > 5) out.push(['info', `${hz.nightShare.toFixed(0)}% of the trip is at night: no camera fixes and it is colder.`]);
    if (m.zones > 0) out.push(['info', `The route crosses ${m.zones} hazard zone(s) of difficult ground.`]);
    if (m.maxSigma > 100) out.push(['info', `Position error grows to ±${m.maxSigma.toFixed(0)} m. Plan a landmark fix.`]);
    if (delay >= 12) out.push(['info', `Signal delay is ${delay.toFixed(0)} min one way: decisions must be made on board, not by Earth.`]);
    if (!out.some(a => a[0] === 'bad')) out.push(['good', p.type === 'suit' ? `Suit supplies left at arrival: ${hz.endSupply.toFixed(0)}%.` : `Battery at arrival: ${hz.endSupply.toFixed(0)}%.`]);
    return out;
  }

  function updateDashboard(m, b) {
    const hz = state.haz, bh = state.bhaz, v = vehicle();
    $('m-dist').textContent = fmtDist(m.dist);
    $('m-time').textContent = fmtTime(m.time);
    $('m-gain').textContent = `${m.gain.toFixed(0)} m`;
    $('m-slope').textContent = `${m.maxSlope.toFixed(1)}°`;
    $('m-zones').textContent = m.zones;
    $('m-risk').textContent = `${m.avgRisk.toFixed(0)}%`;
    $('m-energy').textContent = fmtEnergy(m.energy);
    $('m-slip').textContent = `${(m.maxSlip * 100).toFixed(0)}%`;
    $('m-sigma').textContent = `±${m.maxSigma.toFixed(0)} m`;
    $('h-dose').textContent = `${hz.dose < 0.1 ? hz.dose.toFixed(3) : hz.dose.toFixed(2)} mSv`;
    $('h-uv').textContent = `${hz.peakUV.toFixed(0)} · ${HZ.uvCategory(hz.peakUV)}`;
    $('h-temp').textContent = `${hz.minT.toFixed(0)} to ${hz.maxT.toFixed(0)} °C`;
    $('h-shade').textContent = `${hz.shadeShare.toFixed(0)}% / ${hz.nightShare.toFixed(0)}%`;
    $('h-supply-label').textContent = v.power.type === 'suit' ? 'Suit supplies at arrival' : 'Battery at arrival';
    $('h-supply').textContent = `${hz.endSupply.toFixed(0)}%`;
    $('h-delay').textContent = `${HZ.commDelayMin(env.au).toFixed(1)} min`;

    const rows = [
      ['Distance', fmtDist(m.dist), fmtDist(b.dist)],
      ['Travel time (est.)', fmtTime(m.time), fmtTime(b.time)],
      ['Energy (est.)', fmtEnergy(m.energy), fmtEnergy(b.energy)],
      ['Max slip (est.)', `${(m.maxSlip * 100).toFixed(0)}%`, `${(b.maxSlip * 100).toFixed(0)}%`],
      ['Radiation dose (est.)', `${hz.dose.toFixed(3)} mSv`, `${bh.dose.toFixed(3)} mSv`],
      ['Peak UV index (est.)', hz.peakUV.toFixed(0), bh.peakUV.toFixed(0)],
      ['Supplies at arrival', `${hz.endSupply.toFixed(0)}%`, `${bh.endSupply.toFixed(0)}%`],
      ['Hazard zones', m.zones, b.zones],
      ['Average risk', `${m.avgRisk.toFixed(0)}%`, `${b.avgRisk.toFixed(0)}%`]
    ];
    $('compare').querySelector('tbody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');

    if (m.path.join() === b.path.join()) {
      $('verdict').textContent = 'The selected route is also the shortest route. Move the slider toward "Lowest risk" to see the trade-off.';
    } else {
      const dd = (m.dist / b.dist - 1) * 100;
      $('verdict').textContent = `Trade-off: the selected route is ${Math.abs(dd).toFixed(0)}% ${dd >= 0 ? 'longer' : 'shorter'} than the shortest route, with ${m.zones} hazard zone(s) instead of ${b.zones}, and its highest expected slip is ${(m.maxSlip * 100).toFixed(0)}% instead of ${(b.maxSlip * 100).toFixed(0)}%.`;
    }

    const alerts = buildAlerts(m, hz, v);
    $('alerts').innerHTML = alerts.map(a => `<li class="${a[0] === 'bad' ? '' : a[0]}">${a[1]}</li>`).join('');
    const bar = $('alert-bar'), top = alerts.filter(a => a[0] !== 'good').slice(0, 3);
    bar.innerHTML = top.map(a => `<div class="a ${a[0] === 'bad' ? '' : 'info'}">${a[1]}</div>`).join('');
    bar.hidden = !top.length;

    if (chart) {
      chartRisk = m.path.map(c => riskClass(T.diff[c]));
      chart.data.datasets[0].data = m.profile;
      chart.data.datasets[1].data = m.path.join() === b.path.join() ? [] : b.profile;
      chart.data.datasets[2].data = [];
      chart.update('none');
    }
    if (chart2) {
      chart2.data.datasets[0].data = m.cumDist.map((x, i) => ({ x, y: m.slipArr[i] * 100 }));
      chart2.data.datasets[1].data = m.cumDist.map((x, i) => ({ x, y: m.sigmaArr[i] }));
      chart2.data.datasets[2].data = m.fixIdx.map(i => ({ x: m.cumDist[i], y: m.sigmaArr[i] }));
      chart2.update('none');
    }
    if (chart3) {
      chart3.data.datasets[0].data = m.cumDist.map((x, i) => ({ x, y: hz.uv[i] }));
      chart3.data.datasets[1].data = m.cumDist.map((x, i) => ({ x, y: hz.temp[i] }));
      chart3.update('none');
    }
  }

  /* ----- Journey simulation + live tracking panel ----- */
  function setProgress(p) {
    const m = state.route, sim = state.sim;
    if (!m || !sim) return;
    state.progress = clamp(p, 0, 1);
    const t = state.progress * m.time, ct = m.cumTime;
    let i = 1;
    while (i < ct.length - 1 && ct[i] < t) i++;
    const i0 = i - 1, f = clamp((t - ct[i0]) / ((ct[i] - ct[i0]) || 1), 0, 1);

    const pt = sim.pts[i0].clone().lerp(sim.pts[i], f);
    traveler.position.set(pt.x, pt.y + 0.5, pt.z);
    const ahead = sim.pts[Math.min(i + 2, sim.pts.length - 1)], behind = sim.pts[Math.max(i0 - 2, 0)];
    traveler.rotation.y = Math.atan2(-(ahead.z - behind.z), ahead.x - behind.x); // face the direction of travel

    const dist = lerp(m.cumDist[i0], m.cumDist[i], f);
    const elev = lerp(m.profile[i0].y, m.profile[i].y, f);
    const energy = lerp(m.cumEnergy[i0], m.cumEnergy[i], f);
    const slip = lerp(m.slipArr[i0], m.slipArr[i], f);
    const sigma = lerp(m.sigmaArr[i0], m.sigmaArr[i], f);

    $('hud-dist').textContent = fmtDist(dist);
    $('hud-time').textContent = fmtTime(m.time - t);
    $('hud-energy').textContent = fmtEnergy(energy);
    $('hud-slip').textContent = `${(slip * 100).toFixed(0)}%`;
    $('hud-slip-cell').classList.toggle('alert', slip > 0.25);
    $('hud-acc').textContent = `Position accuracy: ${accuracyLabel(sigma)} (±${sigma.toFixed(0)} m) · Elevation ${elev.toFixed(0)} m · Local slope ${T.slope[m.path[i0]].toFixed(1)}°`;
    const hz = state.haz;
    if (hz) {
      const hr = hz.hour[i0], uv = lerp(hz.uv[i0], hz.uv[i], f), sup = lerp(hz.supplyPct[i0], hz.supplyPct[i], f);
      $('hud-env').textContent = `Local time ${fmtHour(hr)} · Sun ${lerp(hz.sunEl[i0], hz.sunEl[i], f).toFixed(0)}° · UV ${uv.toFixed(0)} (${HZ.uvCategory(uv)}) · ${fmtTemp(lerp(hz.temp[i0], hz.temp[i], f))} · Dose ${lerp(hz.doseCum[i0], hz.doseCum[i], f).toFixed(3)} mSv · ${vehicle().power.type === 'suit' ? 'Suit' : 'Battery'} ${sup.toFixed(0)}%`;
    }

    const r = Math.max(0.7, sigma * size / CONFIG.regionWidthM);
    uncRing.scale.set(r, r, 1);
    uncRing.position.set(pt.x, pt.y + 0.35, pt.z);
    uncRing.visible = true;

    if (chart) { chart.data.datasets[2].data = [{ x: dist, y: elev }]; chart.update('none'); }
  }

  // Arrival celebration: only after a SAFE arrival (no red alerts) and only for the astronaut
  function stopCelebration() {
    state.celebrate = null;
    resetCelebration(travelerModel);
  }
  function startCelebration(force = false) {
    const mode = $('celebrate').value;
    if (mode === 'off' && !force) return;
    if (vehicle().model !== 'astronaut') { if (force) setStatus('Only the astronaut celebrates. Choose the astronaut as the traveler.', 'warn'); return; }
    if (!force) {
      const hz = state.haz, m = state.route;
      if (!hz || !m || buildAlerts(m, hz, vehicle()).some(a => a[0] === 'bad')) {
        setStatus('The astronaut arrived, but the trip had red warnings, so there is no celebration. Check the dashboard.', 'warn');
        return;
      }
    }
    const use = mode === 'off' ? 'flag' : mode;
    state.celebrate = { t0: performance.now() / 1000, mode: use, autoCam: true };
    setStatus(`${force ? 'Preview: ' : 'Arrived safely! '}${CELEBRATION_TEXT[use] || ''}`, 'ok');
  }

  function setPlaying(on) {
    state.playing = on;
    btnPlay.textContent = on ? '⏸ Pause' : '▶ Play journey';
    $('tb-play').textContent = on ? '⏸ Pause' : '▶ Play';
  }

  // The chosen vehicle (3D astronaut or rover) waits at the start point A until the journey is played
  function placeTravelerAtStart() {
    if (state.start === null) { traveler.visible = false; return; }
    const p = cellWorld(state.start);
    traveler.position.set(p.x, p.y + 0.5, p.z);
    if (state.end !== null) {
      const q = cellWorld(state.end);
      traveler.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
    }
    traveler.visible = true;
  }

  function clearRouteGraphics() {
    stopCelebration();
    removeRibbons();
    uncRing.visible = false;
    state.route = null; state.sim = null; state.progress = 0; state.path = null; state.basePath = null; state.haz = null; state.bhaz = null;
    setPlaying(false);
    setPlayEnabled(false);
    clearDashboard();
    placeTravelerAtStart();
  }

  function ctlForEnv() {
    return {
      driftMul: HZ.driftMultiplier(env.tau),
      fixOK: t => HZ.fixPossible(HZ.sunPosition(env.lat, env.ls, HZ.hourAt(env.hour, t)).elev, env.tau)
    };
  }
  // (re)computes the numbers for the current route. Called again when time, dust or season change.
  function buildMetrics() {
    const v = vehicle(), marks = marksForMetrics(), ctl = ctlForEnv();
    const m = routeMetrics(T, state.path, v, marks, ctl);
    const same = state.path === state.basePath;
    const b = same ? m : routeMetrics(T, state.basePath, v, marks, ctl);
    state.route = m; state.base = b;
    state.haz = HZ.routeHazards(T, state.path, m.cumTime, m.cumEnergy, v, env, svf);
    state.bhaz = same ? state.haz : HZ.routeHazards(T, state.basePath, b.cumTime, b.cumEnergy, v, env, svf);
    return { m, b };
  }
  function recomputeEnvDependent() {
    if (!state.route || !state.path) return;
    const { m, b } = buildMetrics();
    updateDashboard(m, b);
    setProgress(state.progress);
  }

  function computeRoute() {
    if (state.start === null || state.end === null) return;
    const v = vehicle();
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

    state.path = path; state.basePath = basePath;
    const { m, b } = buildMetrics();

    removeRibbons();
    const pts = smoothPoints(path);
    routeMesh = buildRibbon(pts, path.map(c => CLASS_COLORS[riskClass(T.diff[c])]), 1.0, 0.7, 1);
    scene.add(routeMesh);
    if (path.join() !== basePath.join()) {
      const bp = smoothPoints(basePath);
      baseMesh = buildRibbon(bp, bp.map(() => new THREE.Color('#ffffff')), 0.5, 0.55, 0.55);
      scene.add(baseMesh);
    }

    state.sim = { pts };
    traveler.visible = true;
    $('live').hidden = false;
    setPlaying(false);
    setProgress(0);
    setPlayEnabled(true);
    updateDashboard(m, b);
    setStatus(`Route ready: ${fmtDist(m.dist)}, about ${fmtTime(m.time)}, ${m.zones} hazard zone(s). Click the terrain again to start a new route.`, 'ok');
  }

  let routeQueued = false;
  function requestRoute() {
    if (routeQueued) return;
    routeQueued = true;
    requestAnimationFrame(() => { routeQueued = false; computeRoute(); });
  }

  /* ----- Placing points ----- */
  function setStart(idx) {
    clearRouteGraphics();
    state.start = idx; state.end = null;
    markerA.position.copy(cellWorld(idx)); markerA.visible = true; markerB.visible = false;
    placeTravelerAtStart();
  }
  function setEnd(idx) {
    state.end = idx;
    markerB.position.copy(cellWorld(idx)); markerB.visible = true;
    computeRoute();
  }
  function resetPoints() {
    state.start = state.end = null;
    markerA.visible = markerB.visible = false;
    clearRouteGraphics();
  }

  // Nearest cell to (gx, gy) that this vehicle is allowed to stand on
  function nearestPassable(gx, gy) {
    const limit = vehicle().maxSlope * 0.85;
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = gx + dx, y = gy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          if (T.slope[y * n + x] <= limit && Math.hypot(dx, dy) < bestD) { bestD = Math.hypot(dx, dy); best = y * n + x; }
        }
      }
      if (best !== null && r > bestD + 1) break;
    }
    return best;
  }

  /* ----- Picking points on the terrain (ray marching over the height field) ----- */
  const raycaster = new THREE.Raycaster();
  function pickTerrain(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const surfaceY = (x, z) => (sampleH((x + half) / step, (z + half) / step) - hMin) * ky;
    let prevT = 0;
    for (let t = 0; t < 700; t += 0.4) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (x < -half || x > half || z < -half || z > half) { prevT = t; continue; }
      if (y <= surfaceY(x, z)) {
        let a = prevT, b = t;
        for (let k = 0; k < 12; k++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m <= surfaceY(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
        }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      prevT = t;
    }
    return null;
  }
  const hitToCell = hit => {
    const gx = clamp(Math.round((hit.x + half) / step), 0, n - 1), gy = clamp(Math.round((hit.z + half) / step), 0, n - 1);
    return { gx, gy, idx: gy * n + gx };
  };

  const tip = $('tip');
  const hideTip = () => { tip.hidden = true; };
  const dom = renderer.domElement;
  let downInfo = null, lastTip = 0;
  dom.addEventListener('pointerdown', e => { downInfo = { x: e.clientX, y: e.clientY }; hideTip(); });
  dom.addEventListener('pointerup', e => {
    if (!downInfo || !T) return;
    const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
    downInfo = null;
    if (moved > (e.pointerType === 'touch' ? 12 : 5)) return; // it was a drag (rotate/pan), not a tap
    const hit = pickTerrain(e.clientX, e.clientY);
    if (!hit) return;
    const { idx } = hitToCell(hit);
    if (state.start === null || state.end !== null) {
      setStart(idx);
      setStatus('Start point (A) set. Now click the destination (B).', 'info');
    } else {
      setEnd(idx);
    }
  });

  // Hover tooltip: details of the ground under the mouse
  dom.addEventListener('pointerleave', hideTip);
  dom.addEventListener('pointermove', e => {
    if (e.buttons || e.pointerType === 'touch') { hideTip(); return; }
    const now = performance.now();
    if (now - lastTip < 60 || !T) return;
    lastTip = now;
    const hit = pickTerrain(e.clientX, e.clientY);
    if (!hit) { hideTip(); return; }
    const { idx } = hitToCell(hit), cls = TERRAIN_CLASSES[classifyCell(T, idx, vehicle())];
    tip.innerHTML = `<b style="color:${cls.color}">${cls.name}</b> · ${cls.desc}<br>` +
      `Elevation ${T.h[idx].toFixed(0)} m · Slope ${T.slope[idx].toFixed(1)}°<br>` +
      `Roughness ${(T.rough[idx] * 100).toFixed(0)}% · Soft ground ${(T.soft[idx] * 100).toFixed(0)}% (est.)`;
    const rect = viewport.getBoundingClientRect();
    tip.style.left = `${clamp(e.clientX - rect.left + 16, 8, rect.width - 250)}px`;
    tip.style.top = `${clamp(e.clientY - rect.top + 16, 8, rect.height - 80)}px`;
    tip.hidden = false;
  });

  /* ----- Building (or rebuilding) the world from an elevation grid ----- */
  async function buildWorld(grid, meta) {
    setLoading('Analyzing terrain…');
    await nextFrame();
    n = CONFIG.gridSize; step = size / (n - 1);
    h = grid;
    CONFIG.cellM = CONFIG.regionWidthM / (n - 1);
    T = analyzeTerrain(h, n, CONFIG.cellM);
    hMin = T.hMin; hMax = T.hMax;
    setLoading('Measuring how much sky each spot can see…');
    await nextFrame();
    svf = HZ.skyViewFactor(T);
    ky = (size / CONFIG.regionWidthM) * CONFIG.exaggeration;
    baseCache.clear();
    resetPoints();

    setLoading('Painting the map…');
    await nextFrame();
    if (terrainMesh) {
      scene.remove(terrainMesh); terrainMesh.geometry.dispose(); terrainMesh.material.dispose();
      if (terrainTex) terrainTex.dispose();
    }
    texImg = meta.texImg || null;
    baseCanvas = buildBaseCanvas();
    contourCanvas = buildContourCanvas();
    layerCanvas = null;
    compCanvas = makeCanvas(CONFIG.textureSize, CONFIG.textureSize);
    terrainTex = new THREE.CanvasTexture(compCanvas);
    terrainTex.colorSpace = THREE.SRGBColorSpace;
    terrainTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    refreshLayer();

    geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    terrainMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: terrainTex, roughness: 1, metalness: 0, bumpMap: CONFIG.surfaceDetail > 0 ? detailTex : null, bumpScale: CONFIG.surfaceDetail
    }));
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    terrainMesh.frustumCulled = false;
    scene.add(terrainMesh);
    applyHeights();

    const list = (meta.landmarks && meta.landmarks.length) ? meta.landmarks : (meta.demo ? DEMO_LANDMARKS : detectBasins(T));
    setupLandmarks(list);

    lastRegionName = meta.name; lastBadge = meta.badge;
    $('region-badge').textContent = `Region: ${meta.name}`;
    const badge = $('data-badge');
    badge.textContent = meta.badge;
    badge.className = `badge ${meta.demo || meta.warn ? 'demo' : 'real'}`;
    $('map-info').textContent = `Map ${(CONFIG.regionWidthM / 1000).toFixed(1)} × ${(CONFIG.regionWidthM / 1000).toFixed(1)} km · cell ${CONFIG.cellM.toFixed(0)} m · contours every ${contourInterval} m · elevation ${hMin.toFixed(0)} to ${hMax.toFixed(0)} m`;
    $('data-note').textContent = meta.note;

    applyEnvironment();
    camera.position.copy(HOME_POS);
    controls.target.set(0, 0, 0);
    setStatus('Click on the terrain to place the start point (A), or use "Plan route" in the panel.', 'info');
    $('loading').classList.add('hidden');
  }

  /* ----- Choosing and loading a site ----- */
  async function loadSource(src) {
    lastSource = src;
    const qv = $('quality').value;
    const q = qv === 'auto' ? (PROFILE.weak ? 192 : 256) : (parseInt(qv, 10) || 256);
    CONFIG.gridSize = q;
    CONFIG.textureSize = { 192: 1024, 256: 1536, 384: 2048, 512: 3072 }[q] || 1536;
    CONFIG.contourSize = { 192: 768, 256: 1024, 384: 1280, 512: 1792 }[q] || 1024;
    const site = src.site || null;

    if (src.kind === 'image') {
      const m = src.meta || {};
      const hasScale = typeof m.elevMin === 'number' && typeof m.elevMax === 'number' && typeof m.regionWidthM === 'number';
      if (hasScale) { CONFIG.elevMin = m.elevMin; CONFIG.elevMax = m.elevMax; CONFIG.regionWidthM = m.regionWidthM; }
      const grid = imageToGrid(src.img, q, CONFIG.elevMin, CONFIG.elevMax, m.encoding || 'gray8');
      env.lat = typeof m.lat === 'number' ? m.lat : (site ? site.lat : 18.4);
      await buildWorld(grid, {
        name: m.name || (site ? site.name : 'Heightmap region'),
        landmarks: m.landmarks, texImg: src.texImg,
        badge: hasScale ? `Data: ${m.source || 'elevation heightmap'}` : 'Data: heightmap loaded, but terrain.json is missing (scale is a guess)',
        warn: !hasScale,
        note: (hasScale ? `Elevation source: ${m.source || 'heightmap.png'}.` : 'terrain.json was not found, so the elevation range and map width are default guesses. Add terrain.json (make_heightmap.py creates it).') +
          (src.texImg ? ` Surface image: ${m.textureSource || 'texture.jpg'}.` : '')
      });
    } else if (src.kind === 'upload') {
      CONFIG.elevMin = src.lo; CONFIG.elevMax = src.hi; CONFIG.regionWidthM = src.wkm * 1000;
      const grid = imageToGrid(src.img, q, src.lo, src.hi, 'gray8');
      await buildWorld(grid, {
        name: src.name, badge: `Data: your heightmap (${src.name})`,
        note: `Your file ${src.name}: elevation ${src.lo} to ${src.hi} m, map width ${src.wkm} km. These numbers come from what you typed.`
      });
    } else {
      CONFIG.regionWidthM = 24000;
      const grid = generateDemoTerrain(q, CONFIG.regionWidthM);
      const off = site && site.elevM != null ? site.elevM + 2450 : 0;
      if (off) for (let i = 0; i < grid.length; i++) grid[i] += off;
      env.lat = site ? site.lat : 18.4;
      await buildWorld(grid, {
        demo: true,
        name: site ? `${site.name} (simulated)` : 'Demo terrain (simulated)',
        badge: 'Data: SIMULATED terrain for this place. Add a data pack for real elevation',
        note: 'This is a simulated terrain used for testing. It is not NASA data. Only the latitude' + (off ? ' and rough ground level' : '') + ' come from the chosen place. Real elevation data replaces it when a data pack for the site exists (see regions/README.txt).'
      });
    }
  }

  let siteLoading = false;
  async function loadSite(site) {
    if (siteLoading) return;
    siteLoading = true;
    try {
      site = site || SITES[0];
      showView('3d');
      setLoading(`Looking for terrain data for ${site.name}…`);
      await nextFrame();
      const candidates = site.pack ? [site.pack] : [];
      if (site.id === 'jezero') candidates.push('');            // older layout: files next to index.html
      let found = null;
      for (const base of candidates) {
        const meta = await fetchMeta(base);
        let img = null;
        try { img = await loadImage(base + ((meta && meta.heightmap) || CONFIG.heightmapFile)); } catch (e) { img = null; }
        if (img) { found = { base, meta: meta || {}, img }; break; }
      }
      if (found) {
        let texImg = null;
        try { texImg = await loadImage(found.base + (found.meta.texture || 'texture.jpg')); } catch (e) { texImg = null; }
        await loadSource({ kind: 'image', site, ...found, texImg });
      } else {
        await loadSource({ kind: 'demo', site });
      }
    } catch (err) {
      console.error(err);
      $('loading').classList.remove('hidden');
      $('loading').textContent = 'Could not build this site. Open the browser console (F12) for details.';
    } finally { siteLoading = false; }
  }

  // "Load your own heightmap" (a grayscale PNG: dark = low, bright = high)
  $('btn-load-hm').addEventListener('click', async () => {
    const msg = $('hm-msg'), file = $('file-hm').files[0];
    const lo = parseFloat($('in-min').value), hi = parseFloat($('in-max').value), wkm = parseFloat($('in-width').value);
    if (!file) { msg.textContent = 'Choose a PNG file first.'; return; }
    if (!(hi > lo) || !(wkm > 0)) { msg.textContent = 'Enter the lowest and highest elevation (highest must be bigger) and the map width in km.'; return; }
    msg.textContent = 'Loading…';
    setLoading('Loading your heightmap…');
    let img = null;
    const url = URL.createObjectURL(file);
    try { img = await loadImage(url); } catch (e) { img = null; }
    URL.revokeObjectURL(url);
    if (!img) { $('loading').classList.add('hidden'); msg.textContent = 'Could not read that image. Use a PNG file.'; return; }
    await loadSource({ kind: 'upload', img, lo, hi, wkm, name: file.name });
    msg.textContent = 'Done. Your heightmap is on the map.';
  });

  /* ----- Controls ----- */
  vehicleSel.addEventListener('change', () => {
    state.vehicle = vehicleSel.value;
    stopCelebration();
    setTravelerModel(state.vehicle);
    if (preview) preview.set(state.vehicle);
    updateInfoTexts();
    refreshLayer();
    computeRoute();
  });
  riskSlider.addEventListener('input', () => { state.w = riskSlider.value / 100; updateInfoTexts(); requestRoute(); });
  $('qr-go').addEventListener('click', () => {
    const a = landmarks[+$('qr-from').value], b = landmarks[+$('qr-to').value];
    if (!a || !b) return;
    if (a === b) { setStatus('Choose two different craters.', 'warn'); return; }
    const sIdx = nearestPassable(a.gx, a.gy), eIdx = nearestPassable(b.gx, b.gy);
    if (sIdx === null || eIdx === null) { setStatus('No standable ground near one of the craters for this vehicle.', 'bad'); return; }
    setStart(sIdx);
    setEnd(eIdx);
  });
  btnPlay.addEventListener('click', () => {
    if (!state.route) return;
    if (!state.playing && state.progress >= 1) { setProgress(0); }
    stopCelebration();
    setPlaying(!state.playing);
  });
  $('btn-clear').addEventListener('click', () => {
    resetPoints();
    setStatus('Click on the terrain to place the start point (A).', 'info');
  });
  $('overlay-mode').addEventListener('change', e => { layers.overlay = e.target.value; refreshLayer(); });
  $('quality').addEventListener('change', () => { if (lastSource) loadSource(lastSource); });
  $('chk-contours').addEventListener('change', e => { layers.contours = e.target.checked; composeTexture(); });
  $('chk-labels').addEventListener('change', e => { layers.labels = e.target.checked; placeLandmarks(); });
  $('exag').addEventListener('input', e => {
    CONFIG.exaggeration = parseFloat(e.target.value);
    $('exag-val').textContent = `${CONFIG.exaggeration}×`;
    ky = (size / CONFIG.regionWidthM) * CONFIG.exaggeration;
    applyHeights();
    placeLandmarks();
    if (state.start !== null) markerA.position.copy(cellWorld(state.start));
    if (state.end !== null) markerB.position.copy(cellWorld(state.end));
    if (state.start !== null && state.end !== null) requestRoute(); else placeTravelerAtStart();
  });
  $('btn-celebrate').addEventListener('click', () => {
    stopCelebration();
    if (!traveler.visible && T) { const idx = nearestPassable(n >> 1, n >> 1); if (idx !== null) setStart(idx); }   // preview works even before a route exists
    startCelebration(true);
    closeSheetOnPhone();
  });
  const celSel = $('celebrate');
  celSel.innerHTML = CELEBRATIONS.map(c => `<option value="${c.id}">${c.label}</option>`).join('') + '<option value="off">Nothing</option>';
  celSel.value = 'flag';
  celSel.addEventListener('change', () => {
    if (state.celebrate && celSel.value !== 'off') { state.celebrate.mode = celSel.value; state.celebrate.t0 = performance.now() / 1000; resetCelebration(travelerModel); setStatus(CELEBRATION_TEXT[celSel.value] || '', 'ok'); }
  });

  // One-tap demo: pick two points, plan the route and start walking
  $('btn-demo').addEventListener('click', () => {
    if (!T) return;
    stopCelebration();
    let sIdx = null, eIdx = null;
    if (landmarks.length >= 2) {
      const a = landmarks[0], b = landmarks[landmarks.length > 2 ? 2 : 1];
      sIdx = nearestPassable(a.gx, a.gy); eIdx = nearestPassable(b.gx, b.gy);
    }
    if (sIdx === null || eIdx === null || sIdx === eIdx) { sIdx = nearestPassable(Math.round(n * 0.22), Math.round(n * 0.7)); eIdx = nearestPassable(Math.round(n * 0.78), Math.round(n * 0.32)); }
    if (sIdx === null || eIdx === null) { setStatus('No standable ground found for this vehicle here. Try the astronaut.', 'bad'); return; }
    setStart(sIdx); setEnd(eIdx);
    closeSheetOnPhone();
    $('view-3d').classList.remove('dash-open'); $('dashboard').hidden = true;
    if (state.route) { setProgress(0); setPlaying(true); }
  });
  $('btn-reset-view').addEventListener('click', () => {
    camera.position.copy(HOME_POS);
    controls.target.set(0, 0, 0);
  });

  /* ----- Mission conditions: sun, sky, dust, time ----- */
  const NIGHT_H = new THREE.Color('#0b0d1c'), NIGHT_Z = new THREE.Color('#04050c');
  const DUST_H = new THREE.Color('#b78457'), DUST_Z = new THREE.Color('#8a5d3d');
  const seasonName = ls => (ls < 90 ? 'northern spring' : ls < 180 ? 'northern summer' : ls < 270 ? 'northern autumn' : 'northern winter') + (ls >= 180 && ls <= 330 ? ', dust season' : '');
  const tauName = t => (t < 0.8 ? 'clear' : t < 1.5 ? 'hazy' : t < 3 ? 'dusty' : 'storm');
  let overlayTimer = 0, envTimer = 0;

  function envTexts(sp) {
    $('env-hour-val').textContent = fmtHour(env.hour);
    $('env-ls-val').textContent = `${env.ls}° (${seasonName(env.ls)})`;
    $('env-tau-val').textContent = `${env.tau.toFixed(1)} (${tauName(env.tau)})`;
    $('env-au-val').textContent = `${env.au.toFixed(2)} AU`;
    const d = HZ.commDelayMin(env.au);
    $('env-delay').textContent = `One-way signal delay: ${d.toFixed(1)} min (a question and its answer take ${(2 * d).toFixed(0)} min).`;
    const ground = T ? T.h[((n / 2) | 0) * n + ((n / 2) | 0)] : -2500;
    const temp = HZ.temperatureC(env.lat, env.tau, sp.elev, true);
    if (sp.elev <= 0) $('env-sun-info').textContent = `Night at latitude ${env.lat.toFixed(1)}°: the Sun is ${(-sp.elev).toFixed(0)}° below the horizon. Air about ${temp.toFixed(0)} °C.`;
    else {
      const uv = HZ.uvIndex(sp.elev, env.tau, ground, true, 1);
      $('env-sun-info').textContent = `Latitude ${env.lat.toFixed(1)}°: Sun ${sp.elev.toFixed(0)}° high · UV index ${uv.toFixed(0)} (${HZ.uvCategory(uv)}) · about ${temp.toFixed(0)} °C. Estimates.`;
    }
  }

  function applyEnvironment(skipOverlay = false) {
    const sp = HZ.sunPosition(env.lat, env.ls, env.hour);
    const el = sp.elev * Math.PI / 180, az = sp.azim * Math.PI / 180;
    const day = smoothstep(-6, 12, sp.elev), dust = clamp((env.tau - 0.5) / 3.5, 0, 1);
    const trans = HZ.irradiance(sp.elev, env.tau) / HZ.irradiance(60, 0.5);
    // map north is the top edge (-z), east is +x
    sun.position.set(Math.cos(el) * Math.sin(az) * 140, Math.max(Math.sin(el), 0.04) * 140, -Math.cos(el) * Math.cos(az) * 140);
    sun.intensity = sp.elev > 0 ? 0.25 + 2.5 * clamp(trans, 0, 1.2) : 0;
    sun.color.set(sp.elev < 12 ? '#ffb27a' : '#ffe3c6');
    hemi.intensity = 0.08 + 0.72 * day * (1 - 0.3 * dust);
    fill.intensity = 0.38 * day;
    const hCol = NIGHT_H.clone().lerp(HORIZON.clone().lerp(DUST_H, dust), day);
    const zCol = NIGHT_Z.clone().lerp(ZENITH.clone().lerp(DUST_Z, dust), day);
    scene.background.copy(hCol); scene.fog.color.copy(hCol);
    scene.fog.near = lerp(140, 25, dust); scene.fog.far = lerp(340, 130, dust);
    const spos = skyGeo.attributes.position, scol = skyGeo.attributes.color, tmpc = new THREE.Color();
    for (let i = 0; i < spos.count; i++) {
      tmpc.copy(hCol).lerp(zCol, Math.pow(clamp(spos.getY(i) / 600, 0, 1), 0.55));
      scol.setXYZ(i, tmpc.r, tmpc.g, tmpc.b);
    }
    scol.needsUpdate = true;
    renderer.toneMappingExposure = 1.05 + 0.5 * (1 - day);
    envTexts(sp);
    if (!skipOverlay && T && (layers.overlay === 'sun' || layers.overlay === 'temp')) {
      clearTimeout(overlayTimer);
      overlayTimer = setTimeout(() => refreshLayer(), 120);
    }
  }
  function onEnvChanged() {
    applyEnvironment();
    clearTimeout(envTimer);
    envTimer = setTimeout(recomputeEnvDependent, 80);
  }
  function setEnv(o) {
    Object.assign(env, o);
    $('env-hour').value = env.hour; $('env-ls').value = env.ls; $('env-tau').value = env.tau; $('env-au').value = env.au; $('env-spe').checked = env.spe;
    onEnvChanged();
  }
  for (const [id, key] of [['env-hour', 'hour'], ['env-ls', 'ls'], ['env-tau', 'tau'], ['env-au', 'au']]) {
    $(id).addEventListener('input', e => { env[key] = parseFloat(e.target.value); onEnvChanged(); });
  }
  $('env-spe').addEventListener('change', e => { env.spe = e.target.checked; onEnvChanged(); });
  $('preset-clear').addEventListener('click', () => setEnv({ hour: 11, tau: 0.5, spe: false }));
  $('preset-storm').addEventListener('click', () => setEnv({ hour: 12, tau: 4.5 }));
  $('preset-night').addEventListener('click', () => setEnv({ hour: 23 }));

  /* ----- Views: global map <-> 3D mission, panels, full screen ----- */
  const worldmap = initWorldMap({ onOpen: site => loadSite(site) });
  function showView(v) {
    currentView = v;
    $('view-world').hidden = v !== 'world';
    $('view-3d').hidden = v !== '3d';
    $('tab-world').classList.toggle('active', v === 'world');
    $('tab-3d').classList.toggle('active', v === '3d');
    if (v === 'world') {
      worldmap.show();
      $('data-badge').textContent = 'Global map';
      $('region-badge').textContent = 'Region: whole planet';
    } else {
      resize();
      if (T) {
        $('region-badge').textContent = `Region: ${lastRegionName}`;
        $('data-badge').textContent = lastBadge;
      }
    }
  }
  $('tab-world').addEventListener('click', () => showView('world'));
  $('tab-3d').addEventListener('click', () => { if (T) showView('3d'); else loadSite(); });
  $('btn-back-world').addEventListener('click', () => showView('world'));
  const isPhone = () => window.matchMedia('(max-width: 900px)').matches;
  function closeSheetOnPhone() { if (isPhone()) $('panel').classList.add('collapsed'); syncToolbar(); }
  function syncToolbar() {
    $('btn-panel').classList.toggle('on', !$('panel').classList.contains('collapsed'));
    $('btn-dash').classList.toggle('on', !$('dashboard').hidden);
    $('view-3d').classList.toggle('sheet-open', !$('panel').classList.contains('collapsed'));
  }
  function setDashboard(open) {
    $('dashboard').hidden = !open;
    $('view-3d').classList.toggle('dash-open', open);
    if (open && isPhone()) $('panel').classList.add('collapsed');
    syncToolbar();
  }
  $('btn-panel').addEventListener('click', () => {
    const open = $('panel').classList.contains('collapsed');
    $('panel').classList.toggle('collapsed', !open);
    if (open && isPhone()) setDashboard(false);
    syncToolbar();
  });
  $('panel-close').addEventListener('click', () => { $('panel').classList.add('collapsed'); syncToolbar(); });
  $('btn-dash').addEventListener('click', () => setDashboard($('dashboard').hidden));
  $('dash-close').addEventListener('click', () => setDashboard(false));
  $('tb-play').addEventListener('click', () => { btnPlay.click(); if (state.playing) closeSheetOnPhone(); });
  function setPanelTab(name) {
    document.querySelectorAll('#panel [data-tab]').forEach(el => { el.hidden = el.dataset.tab !== name; });
    document.querySelectorAll('#panel [data-go]').forEach(el => el.classList.toggle('active', el.dataset.go === name));
    try { sessionStorage.setItem('mm-tab', name); } catch (e) { /* storage may be blocked */ }
    $('panel-body').scrollTop = 0;
  }
  document.querySelectorAll('#panel [data-go]').forEach(el => el.addEventListener('click', () => setPanelTab(el.dataset.go)));
  let savedTab = 'trip';
  try { savedTab = sessionStorage.getItem('mm-tab') || 'trip'; } catch (e) { /* ignore */ }
  setPanelTab(['trip', 'cond', 'map', 'help'].includes(savedTab) ? savedTab : 'trip');
  if (isPhone()) $('panel').classList.add('collapsed');
  syncToolbar();
  if (!document.fullscreenEnabled) $('btn-fullscreen').hidden = true;      // e.g. iPhone Safari has no page full screen
  $('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
    else if (document.exitFullscreen) document.exitFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    $('btn-fullscreen').querySelector('.lbl').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    setTimeout(() => { resize(); if (worldmap.invalidate) worldmap.invalidate(); }, 150);
  });

  /* ----- Animation loop -----
     Smoothness: when nothing moves the scene is drawn only ~8 times a second, and while it is
     busy the render resolution adapts to the speed of the device (never below 0.75x). */
  const clock = new THREE.Clock();
  const follow = $('chk-follow'), needle = $('compass-needle');
  let lastActive = performance.now() / 1000, lastRender = 0, accT = 0, accN = 0, goodWindows = 0;
  const markActive = () => { lastActive = performance.now() / 1000; };
  controls.addEventListener('change', markActive);
  controls.addEventListener('start', () => { markActive(); if (state.celebrate) state.celebrate.autoCam = false; });
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) viewport.addEventListener(ev, markActive, { passive: true });
  function adaptQuality(avg) {
    if (avg > 0.036 && curDpr > 0.76) { curDpr = Math.max(0.75, curDpr - 0.25); goodWindows = 0; resize(); }
    else if (avg < 0.02 && curDpr < maxDpr - 0.01) { if (++goodWindows >= 3) { curDpr = Math.min(maxDpr, curDpr + 0.15); goodWindows = 0; resize(); } }
    else goodWindows = 0;
  }
  const camDir = new THREE.Vector3(), camWant = new THREE.Vector3(), camTgt = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    if (currentView !== '3d') { clock.getDelta(); return; }
    const tNow = performance.now() / 1000;
    const busy = state.playing || (state.celebrate && tNow - state.celebrate.t0 < 40) || (tNow - lastActive < 1.2);
    if (!busy && tNow - lastRender < 0.12) return;           // idle: about 8 frames per second
    lastRender = tNow;
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.1);
    if (busy && rawDt < 0.25) { accT += rawDt; if (++accN >= 45) { adaptQuality(accT / accN); accT = 0; accN = 0; } }
    else if (!busy) { accT = 0; accN = 0; }
    for (let i = 0; i < DUST_N; i++) {
      dustPos[i * 3] += dt * 1.5;
      if (dustPos[i * 3] > 65) dustPos[i * 3] -= 130;
      dustPos[i * 3 + 1] += Math.sin(tNow + i) * dt * 0.15;
    }
    dustGeo.attributes.position.needsUpdate = true;
    if (state.celebrate) {
      const c = state.celebrate;
      celebrateModel(travelerModel, tNow - c.t0, c.mode, camera.position);
      if (c.autoCam && traveler.visible) {                    // the camera glides in so the flag and the astronaut are easy to see
        const k = 1 - Math.exp(-dt * 2.2);
        camTgt.copy(traveler.position); camTgt.y += 2.4;
        controls.target.lerp(camTgt, k);
        camDir.set(camera.position.x - controls.target.x, 0, camera.position.z - controls.target.z);
        if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
        camDir.normalize();
        camWant.copy(controls.target).addScaledVector(camDir, 15); camWant.y = controls.target.y + 2.0;
        camera.position.lerp(camWant, k);
      }
    } else animateModel(travelerModel, tNow, dt, state.playing);
    if (state.playing && state.route) {
      const p = state.progress + dt / DURATION;
      setProgress(p);
      if (p >= 1) { setPlaying(false); startCelebration(); }
    }
    if (follow.checked && state.playing && traveler.visible) {
      const before = controls.target.clone();
      controls.target.lerp(traveler.position, 0.08);
      camera.position.add(controls.target.clone().sub(before));
    }
    controls.update();
    // the compass needle points to north (north is the top edge of the map)
    needle.style.transform = `rotate(${Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z)}rad)`;
    renderer.render(scene, camera);
  });
  // The small vehicle preview has its own light loop, only while it is on screen
  if (preview) {
    let lastPrev = 0;
    const gap = PROFILE.weak ? 0.09 : 0.05;
    const loop = () => {
      requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      if (currentView !== '3d' || t - lastPrev < gap || !preview.shown()) return;
      lastPrev = t;
      preview.render(t);
    };
    requestAnimationFrame(loop);
  }

  updateInfoTexts();
  $('exag').value = CONFIG.exaggeration;
  $('exag-val').textContent = `${CONFIG.exaggeration}×`;
  showView('world');
  applyEnvironment(true);
  window.__mmReady = true;
}

main().catch(err => {
  console.error(err);
  const el = $('loading');
  el.classList.remove('hidden');
  el.textContent = 'Something went wrong while starting the map. Open the browser console (F12) to see the error.';
});
