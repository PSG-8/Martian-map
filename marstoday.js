/* =====================================================================
   marstoday.js  ·  Martian Map · Team Starseekers
   The "Mars today" page: live Mars clock and season, Earth-Mars distance
   with a small orbit diagram, the rovers' current sols and local times,
   the newest raw images from Perseverance and Curiosity, and the NASA
   image library for each site.
   This file does not need Three.js, so the page works even if 3D fails.
   ===================================================================== */
import { mars24, earthMars, missionSol, localTime, seasonOf, fmtHM, fmtHMS, MISSIONS } from './marsclock.js?v=6';
import { roverImages, libraryImages, esc } from './nasa.js?v=6';

const $ = id => document.getElementById(id);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nf = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- Image viewer (full screen, works with touch) ---------- */
export function openLightbox(item) {
  const lb = $('lightbox');
  $('lb-img').src = item.full || item.img;
  $('lb-img').alt = item.title || 'NASA image';
  const meta = [item.rover ? cap(item.rover) : '', item.sol != null && !Number.isNaN(item.sol) ? `Sol ${item.sol}` : '', item.camera, (item.date || '').slice(0, 10)].filter(Boolean).join(' · ');
  $('lb-cap').innerHTML = `<strong>${esc(item.title || 'NASA image')}</strong><span>${esc(meta)}</span><span class="credit">Credit: ${esc(item.credit || item.center || 'NASA')}</span>`;
  $('lb-link').href = item.link || item.full || item.img;
  lb.hidden = false;
  document.body.classList.add('lb-open');
  $('lb-close').focus();
}
function closeLightbox() {
  $('lightbox').hidden = true;
  $('lb-img').src = '';
  document.body.classList.remove('lb-open');
}

function gallery(el, images, kind) {
  el.innerHTML = images.map((im, i) => `
    <button class="thumb" data-i="${i}" aria-label="Open image ${i + 1}">
      <img loading="lazy" decoding="async" src="${esc(im.img)}" alt="${esc(im.title || 'NASA image')}" referrerpolicy="no-referrer">
      <span class="tmeta">${kind === 'rover' ? esc(`Sol ${im.sol ?? '?'} · ${im.camera || ''}`) : esc(im.date || '')}</span>
    </button>`).join('');
  el.querySelectorAll('.thumb').forEach(b => b.addEventListener('click', () => openLightbox(images[+b.dataset.i])));
  el.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.closest('.thumb').classList.add('broken'); }));
}

const skeleton = n => Array.from({ length: n }, () => '<div class="thumb sk"></div>').join('');

/* ---------- Orbit diagram (top view of the inner solar system) ---------- */
function orbitSVG(now) {
  const S = 62, pts = (body, days, step) => {
    const out = [];
    for (let d = 0; d <= days; d += step) {
      const p = earthMars(new Date(now.getTime() + d * 864e5))[body];
      out.push(`${(p.x * S).toFixed(1)},${(-p.y * S).toFixed(1)}`);
    }
    return out.join(' ');
  };
  const g = earthMars(now), e = g.earth, m = g.mars;
  const ex = e.x * S, ey = -e.y * S, mx = m.x * S, my = -m.y * S;
  return `<svg viewBox="-120 -120 240 240" role="img" aria-label="Positions of the Sun, Earth and Mars today">
    <polyline points="${pts('earth', 366, 6)}" class="orb e" />
    <polyline points="${pts('mars', 688, 8)}" class="orb m" />
    <line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" class="link" />
    <circle r="7" class="sun" /><text y="20" class="lab">Sun</text>
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5" class="earth" /><text x="${ex.toFixed(1)}" y="${(ey - 9).toFixed(1)}" class="lab">Earth</text>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" class="mars" /><text x="${mx.toFixed(1)}" y="${(my - 9).toFixed(1)}" class="lab">Mars</text>
  </svg>`;
}

export function initMarsToday() {
  const view = $('view-today');
  if (!view) return null;
  let started = false, tick = 0, roverNow = 'perseverance';

  /* --- live clock (updates every second while the page is visible) --- */
  function renderClock() {
    const now = new Date(), c = mars24(now), s = seasonOf(c.ls);
    $('t-mtc').textContent = fmtHMS(c.mtc);
    $('t-msd').textContent = `Mars Sol Date ${nf(Math.floor(c.msd))}`;
    $('t-date').textContent = `Mars Year ${c.marsYear} · Ls ${c.ls.toFixed(1)}°`;
    $('t-season').innerHTML = `${cap(s.north)} in the north · ${s.south} in the south${s.dusty ? ' · <b class="warn">dust storm season</b>' : ''}`;
    $('t-sun').textContent = `Sun–Mars distance ${c.rSun.toFixed(3)} AU · Sun overhead at ${Math.abs(c.subSolarLat).toFixed(1)}°${c.subSolarLat >= 0 ? 'N' : 'S'}`;
    // missions: sol and local true solar time
    for (const m of MISSIONS.filter(x => x.active)) {
      const el = $('t-m-' + m.id);
      if (!el) continue;
      const lt = localTime(c, m.lonE).ltst, day = lt >= 6 && lt < 18;
      el.querySelector('.sol').textContent = `Sol ${nf(missionSol(m, now))}`;
      el.querySelector('.lt').textContent = `${day ? '☀️' : '🌙'} ${fmtHM(lt)} local time`;
    }
  }

  function renderEarth() {
    const now = new Date(), g = earthMars(now);
    const conj = g.elongation < 6;
    $('t-dist').textContent = `${nf(g.km / 1e6, 1)} million km`;
    $('t-au').textContent = `${g.au.toFixed(3)} AU`;
    $('t-light').textContent = `${g.lightMin.toFixed(1)} min`;
    $('t-rtt').textContent = `${(2 * g.lightMin).toFixed(0)} min`;
    $('t-elong').innerHTML = conj
      ? '<b class="warn">Mars is behind the Sun as seen from Earth (solar conjunction): radio contact is paused.</b>'
      : `Mars is ${g.elongation.toFixed(0)}° from the Sun in Earth's sky.`;
    $('t-orbit').innerHTML = orbitSVG(now);
    $('t-use-text').textContent = `Season Ls ${Math.round(mars24(now).ls)}° and Earth distance ${g.au.toFixed(2)} AU.`;
  }

  function renderMissions() {
    $('t-active').innerHTML = MISSIONS.filter(m => m.active).map(m => `
      <li class="mission" id="t-m-${m.id}">
        <div><strong>${esc(m.name)}</strong> <span class="ag">${esc(m.agency)}</span><br><span class="muted">${esc(m.site)}</span></div>
        <div class="right"><span class="sol">Sol —</span><span class="lt muted"></span></div>
        <p class="note">${esc(m.note)}</p>
        <div class="row">
          <button class="btn small" data-map="${m.id}">🌍 Show on map</button>
          <a class="btn small" href="${esc(m.url)}" target="_blank" rel="noopener">NASA page ↗</a>
        </div>
      </li>`).join('');
    $('t-past').innerHTML = MISSIONS.filter(m => !m.active).map(m => `
      <li><button class="linklike" data-map="${m.id}"><strong>${esc(m.name)}</strong></button>
        <span class="muted">· ${esc(m.site)} · landed ${m.landed.slice(0, 4)}</span><br><span class="note">${esc(m.note)}</span></li>`).join('');
    view.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
      const m = MISSIONS.find(x => x.id === b.dataset.map);
      if (m && window.MM && window.MM.focusMission) window.MM.focusMission(m);
    }));
  }

  async function loadRover(rover) {
    roverNow = rover;
    view.querySelectorAll('[data-rover]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rover === rover)));
    const el = $('t-gallery'), msg = $('t-gallery-msg');
    el.innerHTML = skeleton(8); msg.textContent = '';
    const r = await roverImages(rover);
    if (roverNow !== rover) return;
    if (!r.ok) {
      el.innerHTML = '';
      msg.innerHTML = `${esc(r.error)} <a href="${rover === 'perseverance' ? 'https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/' : 'https://science.nasa.gov/mission/msl-curiosity/raw-images/'}" target="_blank" rel="noopener">Open NASA's raw image page ↗</a>`;
      return;
    }
    gallery(el, r.images, 'rover');
    const sol = r.images[0] && r.images[0].sol;
    msg.textContent = `${r.images.length} newest images${sol != null ? `, up to sol ${sol}` : ''}. Raw, unprocessed frames as they arrive from Mars. Credit: NASA/JPL-Caltech.`;
  }

  async function loadLibrary(q) {
    const el = $('t-lib'), msg = $('t-lib-msg');
    el.innerHTML = skeleton(8); msg.textContent = '';
    const r = await libraryImages(q, 8);
    if ($('t-lib-q').value !== q) return;
    if (!r.ok) { el.innerHTML = ''; msg.textContent = r.error; return; }
    gallery(el, r.images, 'lib');
    msg.innerHTML = `From the <a href="https://images.nasa.gov/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">NASA Image and Video Library ↗</a>`;
  }

  function start() {
    if (started) return;
    started = true;
    renderMissions();
    renderClock(); renderEarth();
    loadRover('perseverance');
    loadLibrary($('t-lib-q').value);
  }

  view.querySelectorAll('[data-rover]').forEach(b => b.addEventListener('click', () => loadRover(b.dataset.rover)));
  $('t-lib-q').addEventListener('change', e => loadLibrary(e.target.value));
  $('t-use').addEventListener('click', () => {
    const now = new Date();
    if (window.MM && window.MM.useToday) window.MM.useToday(mars24(now).ls, earthMars(now).au);
  });
  $('lb-close').addEventListener('click', closeLightbox);
  $('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('lightbox').hidden) closeLightbox(); });

  function show() {
    start();
    renderClock(); renderEarth();
    clearInterval(tick);
    tick = setInterval(() => { if (!view.hidden && !document.hidden) renderClock(); else if (view.hidden) clearInterval(tick); }, 1000);
  }
  return { show, loadRover };
}

/* Works on its own when the main 3D app could not start: then this file switches the views itself. */
const today = initMarsToday();
window.MarsToday = today;
const tab = document.getElementById('tab-today');
if (tab && today) tab.addEventListener('click', () => {
  if (window.MM && window.MM.showView) { window.MM.showView('today'); return; }
  for (const v of ['view-world', 'view-3d']) { const el = document.getElementById(v); if (el) el.hidden = true; }
  document.getElementById('view-today').hidden = false;
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
  today.show();
});
