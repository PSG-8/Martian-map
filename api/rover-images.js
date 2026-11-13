/* =====================================================================
   /api/rover-images?rover=perseverance|curiosity&num=24
   Vercel serverless function (Node). Fetches the newest raw images that
   NASA/JPL publish for the Mars rovers and returns a small, clean JSON list.
   Running it on the server avoids browser CORS limits, and Vercel's edge
   cache keeps NASA's servers from being called on every page view.
   ===================================================================== */

const SOURCES = {
  perseverance: n => `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=${n}&page=0&order=sol+desc`,
  curiosity: n => `https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,date_taken%20desc&per_page=${n}&page=0&condition_1=msl:mission&extended=thumbnail::sample_type::noteq`
};

const pick = (...v) => v.find(x => typeof x === 'string' && x.length > 0) || '';
const abs = u => (u && u.startsWith('/') ? 'https://mars.nasa.gov' + u : u);

function normalize(rover, json) {
  const list = Array.isArray(json && json.images) ? json.images : Array.isArray(json && json.items) ? json.items : [];
  const out = [];
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const type = String(it.sample_type || (it.extended && it.extended.sample_type) || '').toLowerCase();
    if (type.includes('thumb') || it.is_thumbnail === true) continue;
    const files = it.image_files || {};
    const full = abs(pick(files.full_res, files.large, it.https_url, it.url));
    const img = abs(pick(files.medium, files.large, files.small, it.https_url, it.url));
    if (!img) continue;
    const cam = it.camera && typeof it.camera === 'object' ? it.camera : {};
    out.push({
      rover,
      id: String(pick(it.imageid, String(it.id || ''))),
      sol: Number.isFinite(+it.sol) ? +it.sol : null,
      date: pick(it.date_taken_utc, it.date_taken, it.date_received),
      camera: pick(cam.instrument, it.instrument, it.camera_name),
      title: pick(it.title, it.caption).slice(0, 200),
      img, full,
      link: abs(pick(it.link, it.page_url)) || (rover === 'perseverance'
        ? 'https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/'
        : 'https://science.nasa.gov/mission/msl-curiosity/raw-images/'),
      credit: pick(it.credit, it.image_credit, 'NASA/JPL-Caltech')
    });
  }
  return out;
}

module.exports = async function handler(req, res) {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const rover = String(q.rover || 'perseverance').toLowerCase();
  const num = Math.max(4, Math.min(48, parseInt(q.num, 10) || 24));
  const send = (code, body, cache) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.end(JSON.stringify(body));
  };
  if (!SOURCES[rover]) return send(400, { error: 'Unknown rover. Use perseverance or curiosity.' }, 'no-store');

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    // thumbnails are filtered out below, so ask for a few more than we show
    const r = await fetch(SOURCES[rover](num * 2), {
      signal: ctl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'MartianMap/1.0 (Team Starseekers; educational)' }
    });
    clearTimeout(timer);
    if (!r.ok) return send(502, { error: `NASA answered ${r.status}` }, 'public, s-maxage=60');
    const images = normalize(rover, await r.json()).slice(0, num);
    return send(200, { rover, fetched: new Date().toISOString(), source: 'NASA/JPL-Caltech raw images', images },
      'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (e) {
    return send(502, { error: 'Could not reach NASA right now.'}, 'public, s-maxage=60');
  }
};

module.exports.normalize = normalize;
