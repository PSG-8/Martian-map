/* =====================================================================
   worldmap.js  ·  Martian Map · Team Starseekers
   The global Mars map (Google-Maps style): drag, zoom, switch layers,
   pick a site, and open it as a 3D mission.

   Imagery comes from public tile sets (NASA/USGS data served by the
   OpenPlanetary basemaps project). Tiles load in YOUR browser, so they
   need an internet connection. If they cannot load, the page says so.

   NOTE about the Caltech Murray Lab CTX mosaic (5 m/px): that site offers
   it as DOWNLOADABLE tiles only (no streaming address), and it is an image,
   not an elevation model. Use make_texture.py to cut your site out of it.
   ===================================================================== */

import { MISSIONS, missionSol } from './marsclock.js?v=6';
import { libraryImages, esc } from './nasa.js?v=6';

const S3 = 'https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/';
export const LAYERS = [
  { id: 'viking', name: 'Viking color mosaic', url: S3 + 'viking_mdim21_global/{z}/{x}/{y}.png', maxNative: 7 },
  { id: 'mola',   name: 'Elevation (MOLA, colored)', url: S3 + 'mola-color/{z}/{x}/{y}.png', maxNative: 6 },
  { id: 'gray',   name: 'Elevation (gray, shaded)', url: S3 + 'mola-gray/{z}/{x}/{y}.png', maxNative: 6 },
  { id: 'hill',   name: 'Hillshade', url: 'https://s3.us-east-2.amazonaws.com/opmmarstiles/hillshade-tiles/{z}/{x}/{y}.png', maxNative: 6 }
];
const ATTRIBUTION = 'Mars data: NASA / JPL / USGS (Viking MDIM 2.1, MGS MOLA) · tiles by OpenPlanetary';
const MARS_R = 3396190;

// Approximate centers (planetocentric, east longitude). elevM = rough ground level, used only to scale the
// simulated terrain when no real data pack exists for that site.
export const SITES = [
  { id: 'jezero',   name: 'Jezero Crater',      lat: 18.44,  lonE: 77.45,  elevM: -2600, pack: 'regions/jezero/',   note: 'Perseverance landing site. Ancient river delta.', q: 'Jezero Crater', rover: 'perseverance' },
  { id: 'gale',     name: 'Gale Crater',        lat: -4.59,  lonE: 137.44, elevM: -4400, pack: 'regions/gale/',     note: 'Curiosity landing site, with the tall Mount Sharp.', q: 'Gale Crater Mount Sharp', rover: 'curiosity' },
  { id: 'meridiani',name: 'Meridiani Planum',   lat: -1.95,  lonE: 354.47, elevM: -1400, pack: 'regions/meridiani/',note: 'Opportunity landing site. Flat plains.', q: 'Meridiani Planum Opportunity' },
  { id: 'gusev',    name: 'Gusev Crater',       lat: -14.57, lonE: 175.48, elevM: -1900, pack: 'regions/gusev/',    note: 'Spirit landing site.', q: 'Gusev Crater Spirit' },
  { id: 'olympus',  name: 'Olympus Mons',       lat: 18.65,  lonE: 226.2,  elevM: 21000, pack: 'regions/olympus/',  note: 'Tallest volcano known in the solar system.', q: 'Olympus Mons' },
  { id: 'valles',   name: 'Valles Marineris',   lat: -13.9,  lonE: 301.0,  elevM: -4000, pack: 'regions/valles/',   note: 'A canyon system thousands of kilometers long.', q: 'Valles Marineris' },
  { id: 'hellas',   name: 'Hellas Basin',       lat: -42.4,  lonE: 70.5,   elevM: -7000, pack: 'regions/hellas/',   note: 'Deepest region: thickest air, least cosmic radiation.', q: 'Hellas Planitia' },
  { id: 'utopia',   name: 'Utopia Planitia',    lat: 47.0,   lonE: 134.0,  elevM: -4100, pack: 'regions/utopia/',   note: 'Northern plains (Viking 2 area).', q: 'Utopia Planitia' }
];

const lonToLng = e => (e > 180 ? e - 360 : e);
const lngToLon = l => ((l % 360) + 360) % 360;
const fmtLat = v => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`;
const fmtLon = v => `${lngToLon(v).toFixed(2)}°E`;

async function hasPack(site) {
  if (!site.pack) return false;
  try {
    const r = await fetch(site.pack + 'terrain.json', { method: 'GET', cache: 'no-cache' });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j && typeof j === 'object';
  } catch (e) { return false; }
}

export function initWorldMap({ onOpen }) {
  const $ = id => document.getElementById(id);
  const status = $('world-status'), card = $('site-card'), coords = $('world-coords'), sel = $('site-select'), sw = $('layer-switch');
  let map = null, selected = null;

  const setStatus = (t, kind = '') => { status.textContent = t; status.className = `chip ${kind}`; status.hidden = !t; };

  // site picker works even if the map library did not load
  sel.innerHTML = '<option value="">Choose a site…</option>' + SITES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  for (const s of SITES) hasPack(s).then(ok => { s.hasData = ok; if (selected === s) showCard(s); });

  function showCard(site, mission = null) {
    selected = site;
    const data = site.hasData ? '<span class="ok">Real elevation data available</span>' : '<span class="warn">No elevation data pack yet: 3D opens with simulated terrain</span>';
    const elev = site.elevM != null ? ` · ground about ${site.elevM} m (approx.)` : '';
    let mis = '';
    if (mission) {
      const status = mission.active ? `<span class="ok">Active · Sol ${missionSol(mission).toLocaleString('en-US')}</span>` : '<span class="muted">Mission ended</span>';
      mis = `<p class="mis-line"><b>${esc(mission.name)}</b> (${esc(mission.agency)}) · landed ${mission.landed.slice(0, 10)} · ${status}</p>`;
    }
    const q = site.q || (mission && `${mission.name} Mars`) || '';
    card.innerHTML = `<button class="icon-btn card-x" id="site-close" aria-label="Close">✕</button><h3>${esc(site.name)}</h3>` +
      `<p>${fmtLat(site.lat)}, ${fmtLon(lonToLng(site.lonE))}${elev}</p>${mis}` +
      `<p>${esc(mission ? mission.note : site.note || '')}</p><p>${data}</p>` +
      (q ? `<div class="mini-gallery" id="site-photos" aria-label="NASA images of this place"></div>` : '') +
      `<div class="card-actions"><button class="btn primary" id="site-open">🛰 Open 3D mission here</button>` +
      (site.rover || (mission && mission.active) ? `<button class="btn" id="site-raw">📷 Latest photos</button>` : '') +
      (mission ? `<a class="btn" href="${esc(mission.url)}" target="_blank" rel="noopener">NASA page ↗</a>` : '') + `</div>`;
    card.hidden = false;
    $('site-open').onclick = () => onOpen(site);
    $('site-close').onclick = () => { card.hidden = true; };
    const raw = $('site-raw');
    if (raw) raw.onclick = () => {
      document.getElementById('tab-today').click();
      if (window.MarsToday) window.MarsToday.loadRover(site.rover || mission.id);
      setTimeout(() => { const g = document.getElementById('t-gallery'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
    };
    sel.value = SITES.includes(site) ? site.id : '';
    if (q) loadStrip(q);
  }

  // a strip of NASA library photos of the place (loaded only when a card opens)
  async function loadStrip(q) {
    const el = $('site-photos');
    if (!el) return;
    el.innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div>';
    const r = await libraryImages(q, 4);
    if ($('site-photos') !== el) return;
    if (!r.ok) { el.remove(); return; }
    el.innerHTML = r.images.map((im, i) => `<button class="mini" data-i="${i}" aria-label="${esc(im.title)}"><img loading="lazy" src="${esc(im.img)}" alt="" referrerpolicy="no-referrer"></button>`).join('');
    el.querySelectorAll('.mini').forEach(b => b.addEventListener('click', () => {
      import('./marstoday.js?v=6').then(m => m.openLightbox(r.images[+b.dataset.i]));
    }));
  }

  sel.addEventListener('change', () => {
    const s = SITES.find(x => x.id === sel.value);
    if (!s) return;
    showCard(s);
    if (map) map.flyTo([s.lat, lonToLng(s.lonE)], 6, { duration: 1.2 });
  });

  if (typeof L === 'undefined') {
    setStatus('The map library could not load (offline or blocked). You can still pick a site and open it in 3D.', 'warn');
    $('worldmap').classList.add('nomap');
    $('worldmap').innerHTML = '<div class="fallback"><h2>Global Mars map</h2><p>The interactive map needs the Leaflet library from the internet. Choose a site from the list above to continue.</p></div>';
    return { show() {}, setStatus };
  }

  const phone = window.matchMedia('(max-width: 900px)').matches;
  map = L.map('worldmap', { minZoom: 1, maxZoom: 9, worldCopyJump: true, zoomSnap: 0.5, attributionControl: true, zoomControl: false, tapTolerance: 20 })
    .setView(phone ? [8, 100] : [10, 40], phone ? 1.5 : 3);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.setPrefix(false);

  const layers = {};
  let loaded = 0, failed = 0;
  for (const l of LAYERS) {
    const tl = L.tileLayer(l.url, { tms: true, maxNativeZoom: l.maxNative, maxZoom: 9, attribution: ATTRIBUTION, crossOrigin: false });
    tl.on('tileload', () => { loaded++; });
    tl.on('tileerror', () => {
      failed++;
      if (failed > 6 && loaded === 0) setStatus('Map imagery is not reachable (no internet, or the tile server is blocked). Sites and 3D still work.', 'warn');
    });
    layers[l.id] = tl;
  }
  let active = 'viking';
  layers[active].addTo(map);
  const wide = window.matchMedia('(min-width: 901px)').matches;
  sw.innerHTML = `<details class="layers"${wide ? ' open' : ''}><summary>🗺 Map layers</summary><div class="layers-body" id="layers-body">` +
    LAYERS.map(l => `<label class="check"><input type="radio" name="wlayer" value="${l.id}" ${l.id === active ? 'checked' : ''}> ${l.name}</label>`).join('') + '</div></details>';
  sw.addEventListener('change', e => {
    if (e.target.name !== 'wlayer') return;
    map.removeLayer(layers[active]);
    active = e.target.value;
    layers[active].addTo(map);
  });

  // markers: planning sites (orange) and landers / rovers (green = active, gray = ended)
  const touch = window.matchMedia('(pointer: coarse)').matches;
  for (const s of SITES) {
    const m = L.circleMarker([s.lat, lonToLng(s.lonE)], { radius: touch ? 11 : 8, color: '#ffffff', weight: 2, fillColor: '#e2673a', fillOpacity: 0.95 }).addTo(map);
    m.bindTooltip(s.name, { direction: 'top' });
    m.on('click', ev => { L.DomEvent.stopPropagation(ev); showCard(s); });
  }
  const missionLayer = L.layerGroup();
  const missionSite = mi => {
    const near = SITES.find(s => Math.abs(s.lat - mi.lat) < 1.5 && Math.abs(((s.lonE - mi.lonE + 540) % 360) - 180) < 1.5);
    return near ? Object.assign({}, near, { name: `${mi.name} · ${near.name}` })
      : { id: 'custom', name: `${mi.name} · ${mi.site}`, lat: mi.lat, lonE: mi.lonE, elevM: null, pack: null, hasData: false, note: mi.note };
  };
  for (const mi of MISSIONS) {
    const icon = L.divIcon({ className: 'mis-icon' + (mi.active ? ' active' : ''), html: `<span>${mi.rover ? '🚙' : '📡'}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    const mk = L.marker([mi.lat, lonToLng(mi.lonE)], { icon, keyboard: true, title: mi.name }).addTo(missionLayer);
    mk.bindTooltip(`${mi.name}${mi.active ? ' (active)' : ''}`, { direction: 'top', offset: [0, -10] });
    mk.on('click', ev => { L.DomEvent.stopPropagation(ev); showCard(missionSite(mi), mi); });
  }
  missionLayer.addTo(map);
  $('layers-body').insertAdjacentHTML('beforeend', '<hr><label class="check"><input type="checkbox" id="chk-missions" checked> 🚙 Landers &amp; rovers</label>');
  $('chk-missions').addEventListener('change', e => { if (e.target.checked) missionLayer.addTo(map); else map.removeLayer(missionLayer); });

  // click anywhere: custom site
  map.on('click', e => {
    const lat = Math.max(-85, Math.min(85, e.latlng.lat));
    const site = { id: 'custom', name: `Custom site ${fmtLat(lat)}, ${fmtLon(e.latlng.lng)}`, lat, lonE: lngToLon(e.latlng.lng), elevM: null, pack: null, hasData: false, note: 'A point you picked on the map.' };
    showCard(site);
  });

  // coordinates and approximate scale readout (scale uses Mars' radius, not Earth's)
  map.on('mousemove', e => {
    const mpp = 2 * Math.PI * MARS_R * Math.cos(e.latlng.lat * Math.PI / 180) / (256 * Math.pow(2, map.getZoom()));
    coords.textContent = `${fmtLat(e.latlng.lat)}, ${fmtLon(e.latlng.lng)} · about ${mpp < 1000 ? mpp.toFixed(0) + ' m' : (mpp / 1000).toFixed(1) + ' km'} per pixel`;
  });

  setStatus('');
  return {
    show() { setTimeout(() => map.invalidateSize(), 50); },
    invalidate() { map.invalidateSize(); },
    focusMission(mi) {
      setTimeout(() => { map.invalidateSize(); map.flyTo([mi.lat, lonToLng(mi.lonE)], 5, { duration: 1.2 }); }, 60);
      if (!map.hasLayer(missionLayer)) { missionLayer.addTo(map); $('chk-missions').checked = true; }
      showCard(missionSite(mi), mi);
    },
    setStatus
  };
}
