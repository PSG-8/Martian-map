/* =====================================================================
   nasa.js  ·  Martian Map · Team Starseekers
   Live data from NASA, loaded in the browser:
   - newest raw images from Perseverance and Curiosity (through our own
     /api/rover-images function on Vercel, with a direct fallback)
   - the NASA Image and Video Library (images-api.nasa.gov), no key needed
   Every call has a timeout and a short in-memory cache, and never throws:
   on failure it returns { ok: false, error }.
   ===================================================================== */

const cache = new Map();
const TTL = 10 * 60 * 1000;

async function getJSON(url, ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await fn();
  if (v && v.ok) cache.set(key, { t: Date.now(), v });
  return v;
}

/* ---------- Rover raw images ---------- */
const DIRECT = {
  perseverance: 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=24&page=0&order=sol+desc&extended=sample_type::full,',
  curiosity: 'https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,date_taken%20desc&per_page=60&page=0&condition_1=msl:mission'
};
const pick = (...v) => v.find(x => typeof x === 'string' && x.length > 0) || '';
const abs = u => (u && u.startsWith('/') ? 'https://mars.nasa.gov' + u : u);
function normalizeDirect(rover, json) {
  const list = (json && (json.images || json.items)) || [];
  return list.filter(it => it && it.is_thumbnail !== true && !String(it.sample_type || '').toLowerCase().includes('thumb')).map(it => {
    const f = it.image_files || {}, cam = it.camera || {};
    return {
      rover, sol: +it.sol, date: pick(it.date_taken_utc, it.date_taken), camera: pick(cam.instrument, it.instrument),
      title: pick(it.title, it.caption), img: abs(pick(f.medium, f.large, it.https_url, it.url)),
      full: abs(pick(f.full_res, f.large, it.https_url, it.url)), link: abs(pick(it.link)), credit: pick(it.credit, it.image_credit, 'NASA/JPL-Caltech')
    };
  }).filter(x => x.img).slice(0, 24);
}

export function roverImages(rover) {
  return cached('rover:' + rover, async () => {
    // 1) our Vercel function (fast, cached, no CORS issues)
    if (location.protocol !== 'file:') {
      try {
        const j = await getJSON(`/api/rover-images?rover=${encodeURIComponent(rover)}&num=24`);
        if (j && Array.isArray(j.images) && j.images.length) return { ok: true, images: j.images, via: 'proxy' };
      } catch (e) { /* fall through to the direct request */ }
    }
    // 2) straight to NASA (works only if NASA allows it from this browser)
    try {
      const images = normalizeDirect(rover, await getJSON(DIRECT[rover]));
      if (images.length) return { ok: true, images, via: 'direct' };
      return { ok: false, error: 'NASA returned no images.' };
    } catch (e) {
      return { ok: false, error: 'NASA raw images are not reachable right now.' };
    }
  });
}

/* ---------- NASA Image and Video Library ---------- */
export function libraryImages(query, n = 8) {
  return cached('lib:' + query + ':' + n, async () => {
    try {
      const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${Math.max(n * 2, 12)}`;
      const j = await getJSON(url);
      const items = (j && j.collection && j.collection.items) || [];
      const images = items.map(it => {
        const d = (it.data && it.data[0]) || {}, l = (it.links && it.links.find(x => x.render === 'image')) || (it.links && it.links[0]) || {};
        return { id: d.nasa_id, title: d.title || '', date: (d.date_created || '').slice(0, 10), center: d.center || 'NASA',
                 img: l.href, link: d.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}` : 'https://images.nasa.gov/' };
      }).filter(x => x.img && /^https:/.test(x.img)).slice(0, n);
      return images.length ? { ok: true, images } : { ok: false, error: 'No NASA images found for this place.' };
    } catch (e) {
      return { ok: false, error: 'The NASA image library is not reachable right now.' };
    }
  });
}

/* Escape text before putting it in HTML. */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
