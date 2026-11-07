/* =====================================================================
   hazards.js  ·  Martian Map · Team Starseekers
   Environment and hazard models: sun, shadows, UV, radiation, temperature,
   dust, power and Earth-Mars signal delay.

   IMPORTANT: these are SIMPLIFIED, ASSUMED models for a planning prototype.
   Only a few anchor numbers come from real missions (marked "real" below).
   Everything else is a labeled estimate and the site says so.
   ===================================================================== */

export const MARS = {
  g: 3.71,                    // real: surface gravity, m/s^2
  radiusM: 3396190,           // real: mean radius used by Mars map projections
  solarDayS: 88775,           // real: one sol in seconds
  solHourS: 88775 / 24,
  obliquityDeg: 25.19,        // real: axial tilt
  solarTOA: 590,              // real (approx.): sunlight at Mars' mean distance, W/m^2, top of atmosphere
  lightMinPerAU: 8.317,       // real: light travel time for 1 AU, minutes
  gcrBaseMSvDay: 0.67,        // real (approx.): dose equivalent measured by Curiosity's RAD at Gale crater, mSv/day (Hassler et al., 2014)
  gcrBaseElevM: -4400         // Gale crater floor, the place of that measurement
};
export const LIMITS = {
  suitColdC: -80              // from the team's needs list: suit must survive below -80 C
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- Sun ---------- */
export function declinationDeg(lsDeg) {
  return deg(Math.asin(Math.sin(rad(MARS.obliquityDeg)) * Math.sin(rad(lsDeg))));
}

// hour = local true solar time (0..24, noon = 12). Azimuth is measured from north, clockwise.
export function sunPosition(latDeg, lsDeg, hour) {
  const phi = rad(latDeg), dec = rad(declinationDeg(lsDeg)), H = rad((hour - 12) * 15);
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const elev = deg(Math.asin(clamp(sinAlt, -1, 1)));
  let az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H));
  if (az < 0) az += 2 * Math.PI;
  return { elev, azim: deg(az) };
}

export const hourAt = (startHour, tSec) => ((startHour + tSec / MARS.solHourS) % 24 + 24) % 24;

/* ---------- Light, UV, temperature (assumed models) ---------- */
// Sunlight on flat ground (W/m^2). Dust opacity tau cuts the direct beam and adds some diffuse light.
export function irradiance(elevDeg, tau) {
  if (elevDeg <= 0) return 0;
  const s = Math.sin(rad(elevDeg));
  const direct = MARS.solarTOA * Math.exp(-tau / Math.max(s, 0.08)) * s;
  const diffuse = MARS.solarTOA * s * 0.10 * Math.min(1 + tau, 4) / 2 * Math.exp(-0.12 * tau);
  return direct + diffuse;
}

// Relative UV index (WHO-style scale). ASSUMED model: strong sun, thin air, no ozone layer.
export function uvIndex(elevDeg, tau, elevM, lit, svf = 1) {
  if (elevDeg <= 0) return 0;
  const s = Math.sin(rad(elevDeg));
  const atmos = Math.exp((elevM - MARS.gcrBaseElevM) / 90000);
  const clear = 16 * Math.pow(s, 1.2) * Math.exp(-0.3 * tau / Math.max(s, 0.15)) * atmos;
  return lit ? clear : clear * 0.22 * svf; // in shadow only scattered sky light arrives
}
export const uvCategory = u => (u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme');

// Air/ground temperature in C. ASSUMED: swings from about -90 C at night to a few degrees above 0 at midday.
export function temperatureC(latDeg, tau, elevDeg, lit) {
  const c = Math.cos(rad(latDeg));
  const peak = 2 + 18 * c, night = -90 + 15 * c;
  const mean = (peak + night) / 2, amp = (peak - night) / 2;
  const damp = 1 / (1 + 0.3 * Math.max(0, tau - 0.5)); // dust storms flatten the day-night swing
  const sinEl = Math.sin(rad(elevDeg));
  let s = 2 * smooth(-0.15, 0.9, sinEl) - 1;
  if (!lit && elevDeg > 0) s -= 0.45;                   // shaded ground stays colder
  return mean + amp * damp * clamp(s, -1, 1);
}

/* ---------- Radiation (ASSUMED scaling around one real measured number) ---------- */
// Galactic cosmic ray dose, mSv per sol. Lower ground has more air above it, so slightly less dose.
// svf = sky view factor (0..1): crater walls and cliffs block part of the sky.
export function gcrDoseRate(elevM, svf, scenarioFactor = 1) {
  const atmos = Math.exp((elevM - MARS.gcrBaseElevM) / 60000);
  const shield = 0.35 + 0.65 * clamp(svf, 0, 1);
  return MARS.gcrBaseMSvDay * atmos * shield * scenarioFactor;
}

/* ---------- Power ---------- */
export function solarPowerW(power, elevDeg, tau) {
  return power.areaM2 * power.eff * irradiance(elevDeg, tau);
}
export function housekeepingW(power, tempC) {
  const base = power.housekeepingW || 0;
  return base * (1 + clamp((-20 - tempC) / 80, 0, 0.6));
}

/* ---------- Earth to Mars signal delay ---------- */
export const commDelayMin = au => au * MARS.lightMinPerAU;

/* ---------- Terrain based: shadows and sky view ---------- */
// Is the cell (x, y) in direct sunlight? Walks toward the sun across the height grid.
// Map north is the top edge (decreasing y), east is +x.
export function isLit(h, n, cell, x, y, sun, hMax) {
  if (sun.elev <= 0) return false;
  const az = rad(sun.azim), dx = Math.sin(az), dy = -Math.cos(az);
  const t = Math.tan(rad(Math.max(sun.elev, 0.3)));
  const h0 = h[y * n + x] + 0.5;
  const kMax = Math.min(Math.ceil(8000 / cell), Math.ceil((hMax - h0) / (t * cell)) + 1);
  for (let k = 1; k <= kMax; k++) {
    const gx = Math.round(x + dx * k), gy = Math.round(y + dy * k);
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) return true;
    if (h[gy * n + gx] > h0 + t * k * cell) return false;
  }
  return true;
}

export function computeShadowMap(T, sun) {
  const { n, h, cell, hMax } = T;
  const lit = new Uint8Array(n * n);
  if (sun.elev <= 0) return lit;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) lit[y * n + x] = isLit(h, n, cell, x, y, sun, hMax) ? 1 : 0;
  return lit;
}

// How much of the sky each cell can see (1 = open plain, lower = crater wall or canyon).
export function skyViewFactor(T) {
  const { n, h, cell } = T;
  const svf = new Float32Array(n * n);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071], [-0.7071, -0.7071]];
  const dists = [];
  for (let k = 1; k <= 10; k++) dists.push(k);
  for (let k = 12; k <= 40; k += 2) dists.push(k);
  for (let k = 44; k <= 80; k += 4) dists.push(k);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const h0 = h[y * n + x];
      let sum = 0;
      for (const [dx, dy] of dirs) {
        let best = 0;
        for (const k of dists) {
          const gx = Math.round(x + dx * k), gy = Math.round(y + dy * k);
          if (gx < 0 || gy < 0 || gx >= n || gy >= n) break;
          const tan = (h[gy * n + gx] - h0) / (k * cell);
          if (tan > best) best = tan;
        }
        sum += best * best / (1 + best * best); // sin^2 of the horizon angle
      }
      svf[y * n + x] = 1 - sum / dirs.length;
    }
  }
  return svf;
}

/* ---------- Environment object used by the whole site ---------- */
export function makeEnv(o = {}) {
  return Object.assign({
    lat: 18.4,        // site latitude (degrees north)
    ls: 90,           // season: solar longitude, 0..360 (180-330 is the dusty season)
    hour: 10,         // local solar time at the start of the trip
    tau: 0.5,         // dust opacity (0.3 = clear sky, 5 = global dust storm)
    au: 1.5,          // Earth-Mars distance, AU
    spe: false        // solar particle event scenario (ASSUMED dose multiplier)
  }, o);
}
export const SPE_FACTOR = 5; // assumed multiplier for the "solar storm" scenario, not a forecast

// Landmark photo fixes (camera) need daylight and a not-too-dusty sky.
export const fixPossible = (sunElevDeg, tau) => sunElevDeg > 3 && tau < 3;
// More dust and darkness make dead-reckoning drift larger.
export const driftMultiplier = tau => 1 + 0.5 * Math.max(0, tau - 1.5);

/* ---------- Everything along a route ---------- */
export function routeHazards(T, path, cumTime, cumEnergy, v, env, svf) {
  const n = T.n, N = path.length, p = v.power;
  const out = {
    hour: new Float32Array(N), sunEl: new Float32Array(N), lit: new Uint8Array(N), uv: new Float32Array(N), temp: new Float32Array(N),
    doseCum: new Float32Array(N), supplyPct: new Float32Array(N), genW: new Float32Array(N)
  };
  let dose = 0, gen = 0, hk = 0, peakUV = 0, minT = Infinity, maxT = -Infinity, shadeS = 0, nightS = 0, minSupply = 100;
  const capacity = p.type === 'suit' ? p.enduranceH * 3600 : p.capacityWh;
  const start = (p.startPct != null ? p.startPct : 100) / 100;

  for (let i = 0; i < N; i++) {
    const t = cumTime[i], c = path[i], x = c % n, y = (c / n) | 0;
    const hr = hourAt(env.hour, t), sun = sunPosition(env.lat, env.ls, hr);
    const lit = sun.elev > 0 && isLit(T.h, n, T.cell, x, y, sun, T.hMax);
    const uv = uvIndex(sun.elev, env.tau, T.h[c], lit, svf[c]);
    const temp = temperatureC(env.lat, env.tau, sun.elev, lit);
    const rate = gcrDoseRate(T.h[c], svf[c], env.spe ? SPE_FACTOR : 1);       // mSv per sol
    const dt = i ? t - cumTime[i - 1] : 0;
    dose += rate * dt / MARS.solarDayS;
    let g = 0;
    if (p.type === 'solar') g = lit ? solarPowerW(p, sun.elev, env.tau) : irradiance(sun.elev, env.tau) * 0.1 * p.areaM2 * p.eff;
    else if (p.type === 'rtg') g = p.watts;
    gen += g * dt / 3600;
    hk += housekeepingW(p, temp) * dt / 3600;
    if (dt) { if (!lit) shadeS += dt; if (sun.elev <= 0) nightS += dt; }

    let supply;
    if (p.type === 'suit') supply = clamp(1 - t / capacity, 0, 1) * 100;
    else supply = clamp((start * capacity + gen - hk - cumEnergy[i]) / capacity, 0, 1) * 100;

    out.hour[i] = hr; out.sunEl[i] = sun.elev; out.lit[i] = lit ? 1 : 0; out.uv[i] = uv; out.temp[i] = temp;
    out.doseCum[i] = dose; out.supplyPct[i] = supply; out.genW[i] = g;
    peakUV = Math.max(peakUV, uv); minT = Math.min(minT, temp); maxT = Math.max(maxT, temp); minSupply = Math.min(minSupply, supply);
  }
  const total = cumTime[N - 1] || 1;
  return Object.assign(out, {
    dose, peakUV, minT, maxT, minSupply, endSupply: out.supplyPct[N - 1],
    shadeShare: shadeS / total * 100, nightShare: nightS / total * 100,
    genWh: gen, housekeepingWh: hk,
    coldAlert: minT < LIMITS.suitColdC, supplyAlert: minSupply < 20
  });
}
