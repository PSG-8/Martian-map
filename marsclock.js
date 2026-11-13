/* =====================================================================
   marsclock.js  ·  Martian Map · Team Starseekers
   Time and position on Mars, computed in the browser (no internet needed).

   - Mars date and time: the NASA GISS "Mars24" algorithm
     (Allison & McEwen 2000, Planet. Space Sci. 48, 215-235; Allison 1997, GRL 24, 1967).
   - Earth and Mars positions: JPL approximate Keplerian elements, valid 1800-2050
     (Standish & Williams, "Keplerian Elements for Approximate Positions of the Major Planets").
     Distances are good to about 0.001 AU, which is plenty for signal delay.
   ===================================================================== */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sind = d => Math.sin(d * D2R), cosd = d => Math.cos(d * D2R);
const mod = (a, n) => ((a % n) + n) % n;

export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
const TT_MINUS_UTC = 69.184;                   // seconds (37 leap seconds + 32.184 s), valid since 2017

/* Mars missions on the surface: landing time (UTC) and site, used to count mission sols. */
export const MISSIONS = [
  { id: 'perseverance', name: 'Perseverance', agency: 'NASA', landed: '2021-02-18T20:55:00Z', lat: 18.4447, lonE: 77.4508, site: 'Jezero Crater', active: true, rover: true,
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/', note: 'Collecting rock cores in Jezero Crater for a future sample return.' },
  { id: 'curiosity', name: 'Curiosity', agency: 'NASA', landed: '2012-08-06T05:17:57Z', lat: -4.5895, lonE: 137.4417, site: 'Gale Crater', active: true, rover: true,
    url: 'https://science.nasa.gov/mission/msl-curiosity/', note: 'Climbing Mount Sharp to read the layers of ancient lakes.' },
  { id: 'zhurong', name: 'Zhurong', agency: 'CNSA', landed: '2021-05-14T23:18:00Z', lat: 25.066, lonE: 109.925, site: 'Utopia Planitia', active: false, rover: true,
    url: 'https://en.wikipedia.org/wiki/Zhurong_(rover)', note: 'China\'s first Mars rover. Dormant since May 2022.' },
  { id: 'insight', name: 'InSight', agency: 'NASA', landed: '2018-11-26T19:52:59Z', lat: 4.502, lonE: 135.623, site: 'Elysium Planitia', active: false, rover: false,
    url: 'https://science.nasa.gov/mission/insight/', note: 'Lander that measured marsquakes. Mission ended December 2022.' },
  { id: 'opportunity', name: 'Opportunity', agency: 'NASA', landed: '2004-01-25T05:05:00Z', lat: -1.9462, lonE: 354.4734, site: 'Meridiani Planum', active: false, rover: true,
    url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/', note: 'Drove 45 km in 14 years. Last contact June 2018.' },
  { id: 'spirit', name: 'Spirit', agency: 'NASA', landed: '2004-01-04T04:35:00Z', lat: -14.5684, lonE: 175.4726, site: 'Gusev Crater', active: false, rover: true,
    url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/', note: 'Found signs of ancient hot springs. Last contact March 2010.' },
  { id: 'phoenix', name: 'Phoenix', agency: 'NASA', landed: '2008-05-25T23:38:00Z', lat: 68.2188, lonE: 234.2508, site: 'Vastitas Borealis', active: false, rover: false,
    url: 'https://science.nasa.gov/mission/phoenix/', note: 'Dug up water ice near the north pole in 2008.' },
  { id: 'pathfinder', name: 'Mars Pathfinder', agency: 'NASA', landed: '1997-07-04T16:56:55Z', lat: 19.13, lonE: 326.78, site: 'Ares Vallis', active: false, rover: true,
    url: 'https://science.nasa.gov/mission/mars-pathfinder/', note: 'Carried Sojourner, the first rover on Mars.' },
  { id: 'viking1', name: 'Viking 1', agency: 'NASA', landed: '1976-07-20T11:53:06Z', lat: 22.27, lonE: 312.05, site: 'Chryse Planitia', active: false, rover: false,
    url: 'https://science.nasa.gov/mission/viking-1/', note: 'First successful US Mars landing.' },
  { id: 'viking2', name: 'Viking 2', agency: 'NASA', landed: '1976-09-03T22:58:20Z', lat: 47.64, lonE: 134.29, site: 'Utopia Planitia', active: false, rover: false,
    url: 'https://science.nasa.gov/mission/viking-2/', note: 'Saw frost on the ground in northern winter.' }
];

/* ---------- Mars24: date, time and season ---------- */
export function mars24(date = new Date()) {
  const ms = date.getTime();
  const jdUT = 2440587.5 + ms / 86400000;
  const jdTT = jdUT + TT_MINUS_UTC / 86400;
  const dt = jdTT - 2451545.0;                              // days since J2000 (TT)

  const M = mod(19.3871 + 0.52402073 * dt, 360);            // Mars mean anomaly
  const aFMS = mod(270.3871 + 0.524038496 * dt, 360);       // angle of the fictitious mean sun
  const A = [0.0071, 0.0057, 0.0039, 0.0037, 0.0021, 0.0020, 0.0018];
  const tau = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493];
  const phi = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095];
  let pbs = 0;
  for (let i = 0; i < 7; i++) pbs += A[i] * cosd(0.985626 * dt / tau[i] + phi[i]);
  const vMinusM = (10.691 + 3.0e-7 * dt) * sind(M) + 0.623 * sind(2 * M) + 0.050 * sind(3 * M)
                + 0.005 * sind(4 * M) + 0.0005 * sind(5 * M) + pbs;
  const ls = mod(aFMS + vMinusM, 360);                      // areocentric solar longitude (season)
  const eot = 2.861 * sind(2 * ls) - 0.071 * sind(4 * ls) + 0.002 * sind(6 * ls) - vMinusM; // degrees
  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = mod(24 * msd, 24);                            // Coordinated Mars Time (hours, at 0°E)
  const rSun = 1.52367934 * (1.00436 - 0.09309 * cosd(M) - 0.004336 * cosd(2 * M) - 0.00031 * cosd(3 * M) - 0.00003 * cosd(4 * M));
  const subSolarLat = Math.asin(0.42565 * sind(ls)) * R2D + 0.25 * sind(ls);

  // Mars Year (Clancy et al. 2000: MY 1 began on 1955-04-11, at Ls 0)
  const years = (jdTT - 2435208.5) / 686.9711;
  let my = Math.floor(years) + 1;
  const frac = years - Math.floor(years);
  if (ls > 300 && frac < 0.15) my -= 1;
  else if (ls < 60 && frac > 0.85) my += 1;

  return { jdUT, jdTT, dt, M, ls, eot, msd, mtc, rSun, subSolarLat, marsYear: my };
}

/* Local times at a site (east longitude, degrees). LMST = mean solar time, LTST = true (sundial) time. */
export function localTime(clock, lonE) {
  const lmst = mod(clock.mtc + lonE / 15, 24);
  const ltst = mod(lmst + clock.eot / 15, 24);
  return { lmst, ltst };
}

/* Sol number of a mission (sol 0 = landing day, counted in local mean solar time at the site). */
export function missionSol(mission, date = new Date()) {
  const now = mars24(date).msd + mission.lonE / 360;
  const land = mars24(new Date(mission.landed)).msd + mission.lonE / 360;
  return Math.floor(now) - Math.floor(land);
}

/* Season names for both hemispheres. */
export function seasonOf(ls) {
  const north = ['spring', 'summer', 'autumn', 'winter'][Math.floor(mod(ls, 360) / 90)];
  const south = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[north];
  const dusty = ls >= 180 && ls <= 330;
  return { north, south, dusty };
}

/* ---------- Planet positions (JPL approximate elements, 1800-2050) ---------- */
const ELEMENTS = {
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
           L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] },
  mars:  { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131],
           L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] }
};
function helio(name, T) {
  const el = ELEMENTS[name], v = k => el[k][0] + el[k][1] * T;
  const a = v('a'), e = v('e'), I = v('I'), L = v('L'), w = v('w'), O = v('O');
  const Mdeg = mod(L - w + 180, 360) - 180;
  const M = Mdeg * D2R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w - O) * D2R, Or = O * D2R, Ir = I * D2R;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Or), sO = Math.sin(Or), cI = Math.cos(Ir), sI = Math.sin(Ir);
  return {
    x: (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    y: (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    z: (so * sI) * xp + (co * sI) * yp
  };
}

/* Earth-Mars geometry: distance (AU and km), one-way light time, and the Sun-Earth-Mars angle. */
export function earthMars(date = new Date()) {
  const jdTT = 2440587.5 + date.getTime() / 86400000 + TT_MINUS_UTC / 86400;
  const T = (jdTT - 2451545.0) / 36525;
  const e = helio('earth', T), m = helio('mars', T);
  const dx = m.x - e.x, dy = m.y - e.y, dz = m.z - e.z;
  const au = Math.hypot(dx, dy, dz);
  const rE = Math.hypot(e.x, e.y, e.z), rM = Math.hypot(m.x, m.y, m.z);
  // elongation: angle Sun-Earth-Mars as seen from Earth (near 0° = solar conjunction, radio blackout)
  const cosEl = (-e.x * dx - e.y * dy - e.z * dz) / (rE * au);
  const elongation = Math.acos(Math.max(-1, Math.min(1, cosEl))) * R2D;
  return { au, km: au * AU_KM, lightMin: au * AU_KM / C_KM_S / 60, rEarth: rE, rMars: rM, elongation, earth: e, mars: m };
}

export const fmtHM = h => {
  const t = Math.floor(mod(h, 24) * 60 + 1e-6);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
export const fmtHMS = h => {
  const t = Math.floor(mod(h, 24) * 3600 + 1e-6);
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
