/* =====================================================================
   /api/traverse?rover=perseverance|curiosity
   The REAL path driven by the rover, from NASA's mission maps (MMGIS),
   as [lon, lat] points (thinned to about one point every 15 m), plus the
   latest published position. Cached by Vercel's CDN for 6 hours.
   ===================================================================== */
'use strict';
const SRC = {
  perseverance: { traverse: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json', waypoints: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json' },
  curiosity: { traverse: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json', waypoints: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json' }
};
const R = 3396190, D2R = Math.PI / 180;

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'MartianMap/1.0 (MR_PSG, Team Starseekers; educational)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

module.exports = async function handler(req, res) {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const rover = String(q.rover || 'perseverance').toLowerCase();
  const send = (code, body, cache) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', cache); res.end(JSON.stringify(body)); };
  if (!SRC[rover]) return send(400, { error: 'rover must be perseverance or curiosity' }, 'no-store');
  try {
    const gj = await getJSON(SRC[rover].traverse);
    const pts = [];
    let last = null;
    const add = c => {
      const lon = +c[0], lat = +c[1];
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      if (last) {
        const dx = (lon - last[0]) * D2R * R * Math.cos(lat * D2R), dy = (lat - last[1]) * D2R * R;
        if (dx * dx + dy * dy < 15 * 15) return;
      }
      last = [lon, lat];
      pts.push([Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]);
    };
    for (const f of gj.features || []) {
      const g = f.geometry || {};
      if (g.type === 'LineString') g.coordinates.forEach(add);
      else if (g.type === 'MultiLineString') g.coordinates.forEach(l => l.forEach(add));
    }
    let latest = null;
    try {
      const wp = await getJSON(SRC[rover].waypoints);
      for (const f of wp.features || []) {
        const p = f.properties || {}, g = f.geometry || {};
        const sol = parseFloat(p.sol);
        if (g.type === 'Point' && Number.isFinite(sol) && (!latest || sol > latest.sol)) latest = { sol, lon: +g.coordinates[0], lat: +g.coordinates[1] };
      }
    } catch (e) { /* waypoints are optional */ }
    if (!latest && pts.length) latest = { sol: null, lon: pts[pts.length - 1][0], lat: pts[pts.length - 1][1] };
    return send(200, { rover, source: 'NASA/JPL-Caltech mission map (MMGIS)', points: pts, latest }, 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
  } catch (e) {
    return send(502, { error: 'NASA traverse not reachable: ' + e.message }, 'public, s-maxage=120');
  }
};
