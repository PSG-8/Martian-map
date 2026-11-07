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
  { id: 'jezero',   name: 'Jezero Crater',      lat: 18.44,  lonE: 77.45,  elevM: -2600, pack: 'regions/jezero/',   note: 'Perseverance landing site. Ancient river delta.' },
  { id: 'gale',     name: 'Gale Crater',        lat: -4.59,  lonE: 137.44, elevM: -4400, pack: 'regions/gale/',     note: 'Curiosity landing site, with the tall Mount Sharp.' },
  { id: 'meridiani',name: 'Meridiani Planum',   lat: -1.95,  lonE: 354.47, elevM: -1400, pack: 'regions/meridiani/',note: 'Opportunity landing site. Flat plains.' },
  { id: 'gusev',    name: 'Gusev Crater',       lat: -14.57, lonE: 175.48, elevM: -1900, pack: 'regions/gusev/',    note: 'Spirit landing site.' },
  { id: 'olympus',  name: 'Olympus Mons',       lat: 18.65,  lonE: 226.2,  elevM: 21000, pack: 'regions/olympus/',  note: 'Tallest volcano known in the solar system.' },
  { id: 'valles',   name: 'Valles Marineris',   lat: -13.9,  lonE: 301.0,  elevM: -4000, pack: 'regions/valles/',   note: 'A canyon system thousands of kilometers long.' },
  { id: 'hellas',   name: 'Hellas Basin',       lat: -42.4,  lonE: 70.5,   elevM: -7000, pack: 'regions/hellas/',   note: 'Deepest region: thickest air, least cosmic radiation.' },
  { id: 'utopia',   name: 'Utopia Planitia',    lat: 47.0,   lonE: 134.0,  elevM: -4100, pack: 'regions/utopia/',   note: 'Northern plains (Viking 2 area).' }
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

  function showCard(site) {
    selected = site;
    const data = site.hasData ? '<span class="ok">Real elevation data available</span>' : '<span class="warn">No elevation data pack yet: 3D opens with simulated terrain</span>';
    const elev = site.elevM != null ? ` · ground about ${site.elevM} m (approx.)` : '';
    card.innerHTML = `<h3>${site.name}</h3><p>${fmtLat(site.lat)}, ${fmtLon(lonToLng(site.lonE))}${elev}</p>` +
      `<p>${site.note || ''}</p><p>${data}</p><button class="btn primary wide" id="site-open">Open 3D mission here</button>`;
    card.hidden = false;
    $('site-open').onclick = () => onOpen(site);
    sel.value = SITES.includes(site) ? site.id : '';
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

  map = L.map('worldmap', { minZoom: 1, maxZoom: 9, worldCopyJump: true, zoomSnap: 0.5, attributionControl: true, zoomControl: true }).setView([10, 40], 3);
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
  sw.innerHTML = LAYERS.map(l => `<label class="check"><input type="radio" name="wlayer" value="${l.id}" ${l.id === active ? 'checked' : ''}> ${l.name}</label>`).join('');
  sw.addEventListener('change', e => {
    if (e.target.name !== 'wlayer') return;
    map.removeLayer(layers[active]);
    active = e.target.value;
    layers[active].addTo(map);
  });

  // markers
  for (const s of SITES) {
    const m = L.circleMarker([s.lat, lonToLng(s.lonE)], { radius: 8, color: '#ffffff', weight: 2, fillColor: '#e2673a', fillOpacity: 0.95 }).addTo(map);
    m.bindTooltip(s.name, { direction: 'top' });
    m.on('click', ev => { L.DomEvent.stopPropagation(ev); showCard(s); });
  }

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
    setStatus
  };
}
