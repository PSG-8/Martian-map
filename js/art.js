/* Lab@Home – original illustrations and icons (hand-made SVG) */
(function(){
const P = {
  home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  flask:'<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  list:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  card:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h4"/>',
  truck:'<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  building:'<rect x="4" y="3" width="11" height="18" rx="1.5"/><path d="M15 9h4a1 1 0 0 1 1 1v11h-5"/><path d="M8 7h3M8 11h3M8 15h3"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  phone:'<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  chat:'<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z"/><path d="M8 9h8M8 12.5h5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  heart:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/><path d="M6 12h3l1.5-2.5 2 5 1.5-2.5h4"/>',
  butterfly:'<path d="M12 8v12"/><path d="M12 10c-1-4-6-6-8-4s0 7 4 7c-3 1-3 5 0 5s4-4 4-6"/><path d="M12 10c1-4 6-6 8-4s0 7-4 7c3 1 3 5 0 5s-4-4-4-6"/>',
  organs:'<path d="M8.5 4C5 4 4 8 4 11s1.5 7 4.5 7 3-3 3-6V6c0-1.2-1.3-2-3-2z"/><path d="M15.5 4C19 4 20 8 20 11s-1.5 7-4.5 7-3-3-3-6V6c0-1.2 1.3-2 3-2z"/>',
  glucose:'<rect x="6" y="3" width="12" height="18" rx="3"/><rect x="8.5" y="6" width="7" height="5" rx="1"/><path d="M10 15h4M12 13v4"/>',
  pill:'<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.2 7.8l5.6 8.4"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  thermo:'<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 17v-6"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.7l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1.1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  play:'<path d="M7 4.5v15l12-7.5z"/>', next:'<path d="M5 5v14l9-7z"/><path d="M18 5v14"/>',
  syringe:'<path d="M18 2l4 4M15 5l4 4M17 7l-9.5 9.5-3-3L14 4"/><path d="M4.5 13.5l-2.5 2.5M8 11l2 2M10.5 8.5l2 2"/>',
  van:'<path d="M2 7h12v9H2z"/><path d="M14 10h4.5l3 3.2V16H14"/><circle cx="6" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M7 10.5h2M8 9.5v2"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wa:'<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-.9-.4-1.6-1.1-2-2l.8-1-1-2z"/>',
  cart:'<path d="M3 4h2.2l2.3 11h10.8l2.2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.6"/><circle cx="17" cy="19.5" r="1.6"/>',
  idcard:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.2 16.2a3.4 3.4 0 0 1 6.6 0M14 10h4.5M14 13.5h3"/>',
  bot:'<rect x="4" y="8" width="16" height="11" rx="4"/><path d="M12 4.5V8"/><circle cx="12" cy="3.6" r="1.1"/><circle cx="9" cy="13.2" r="1.3"/><circle cx="15" cy="13.2" r="1.3"/><path d="M2 12.5v3M22 12.5v3"/>',
  send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  hex:'<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/>',
  route:'<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6"/>',
  timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.8h5"/>',
  award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-2.5 5 2.5-1.5-7"/><path d="M9.6 9l1.6 1.6 3.2-3.2"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  steth:'<path d="M6 3H5v5a5 5 0 0 0 10 0V3h-1"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  hosp:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v6M9 10h6M10 21v-4h4v4"/>',
  gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3"/>',
  kid:'<circle cx="12" cy="5" r="2.6"/><path d="M8 21v-6l-3-3 1.6-1.6L9.5 12h5l2.9-1.6L19 12l-3 3v6"/>',
  male:'<circle cx="10" cy="14" r="5"/><path d="M14 10l6-6M15 4h5v5"/>'
};
function icon(name, size, sw){ return `<svg viewBox="0 0 24 24" width="${size||22}" height="${size||22}" fill="none" stroke="currentColor" stroke-width="${sw||1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]||''}</svg>`; }

let _lg=0;
function logoFn(){ return `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">  <path d="M51.5 15.2 32 4 7.5 18.1v27.8L32 60l19.5-11.2" stroke="#3b82f6" stroke-width="3.2"/>  <path d="M47.6 18.6 32 9.6 12.2 21v22L32 54.4l15.6-9" stroke="#3b82f6" stroke-width="1.6" opacity=".9"/>  <g transform="rotate(-32 32 34)" stroke="#3b82f6" stroke-width="2.2">    <path d="M28.6 20.5v8.1a9.6 9.6 0 1 0 6.8 0v-8.1"/>    <path d="M27 20.5h10"/>    <path d="M23.4 36.5c3-1.6 5.6 1.4 8.6 0s5.6-1.3 8.6.2" stroke-width="1.8"/>    <circle cx="29.6" cy="40.4" r="1.6" stroke-width="1.5"/>    <circle cx="34.6" cy="39.4" r="1" stroke-width="1.3"/>  </g>  <circle cx="20.6" cy="20.2" r="1.3" stroke="#3b82f6" stroke-width="1.4"/>  <circle cx="17.6" cy="15.6" r=".9" stroke="#3b82f6" stroke-width="1.2"/>  <path d="M41.5 13.2v3.4M39.8 14.9h3.4M38.9 12.3l1 1M44.1 12.3l-1 1" stroke="#3b82f6" stroke-width="1.3"/></svg>`; }
const WORDMARK = `<span class="wm" dir="ltr" role="img" aria-label="Lab@Home">Lab<i>@</i>Home</span>`;

const hero = `<svg viewBox="0 0 620 540" style="direction:ltr" role="img" aria-label="A nurse visiting a home with the Lab@Home app">
<defs>
 <linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcebff"/><stop offset="1" stop-color="#f4f8ff"/></linearGradient>
 <linearGradient id="hph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2b4f"/><stop offset="1" stop-color="#0b1730"/></linearGradient>
 <linearGradient id="hbtn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7bff"/><stop offset="1" stop-color="#1257d6"/></linearGradient>
 <linearGradient id="hsand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e2c3"/><stop offset="1" stop-color="#e7cfa4"/></linearGradient>
 <filter id="hsh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#10285a" flood-opacity=".16"/></filter>
</defs>
<circle cx="330" cy="250" r="230" fill="url(#hsky)"/>
<circle cx="505" cy="88" r="34" fill="#ffd36b" opacity=".9"/>
<!-- fort -->
<g fill="#e9d3a8" stroke="#d7b985" stroke-width="2">
 <path d="M372 330V236h22v-12h8v12h10v-12h8v12h12v94z"/>
 <rect x="432" y="262" width="96" height="68"/>
 <path d="M520 330V214l18-10 18 10v116z"/>
 <path d="M432 262v-10h8v10h10v-10h8v10h10v-10h8v10h10v-10h8v10h10v-10h8v10"/>
 <path d="M520 214l18-14 18 14"/>
</g>
<g fill="#c99e60"><rect x="384" y="262" width="7" height="13" rx="3"/><rect x="452" y="282" width="7" height="13" rx="3"/><rect x="482" y="282" width="7" height="13" rx="3"/><rect x="533" y="236" width="8" height="14" rx="4"/><path d="M470 330v-24a10 10 0 0 1 20 0v24z"/></g>
<!-- palms -->
<g><path d="M574 334c-3-40 2-74 10-100" stroke="#a3753d" stroke-width="7" fill="none" stroke-linecap="round"/>
<g fill="#2f9a68"><path d="M584 234c-24-14-48-8-62 6 20-4 40-2 62-6z"/><path d="M584 234c20-18 44-18 60-6-20 0-40 2-60 6z"/><path d="M584 234c-6-22-26-36-44-36 14 10 28 22 44 36z"/><path d="M584 234c10-22 30-32 48-30-16 8-30 18-48 30z"/><path d="M584 234c-16 6-28 22-30 42 10-16 18-28 30-42z"/></g></g>
<!-- ground -->
<path d="M40 330h560v8c-120 26-440 26-560 0z" fill="url(#hsand)"/>
<!-- house -->
<g filter="url(#hsh)"><path d="M70 330V250l70-52 70 52v80z" fill="#fff"/><path d="M58 258l82-66 82 66" fill="none" stroke="#1257d6" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="122" y="280" width="36" height="50" rx="6" fill="#cfe0ff"/><rect x="86" y="268" width="24" height="22" rx="4" fill="#dce9ff"/><rect x="170" y="268" width="24" height="22" rx="4" fill="#dce9ff"/>
<path d="M140 222s12 12.5 12 21a12 12 0 0 1-24 0c0-8.5 12-21 12-21z" fill="#2f7bff"/></g>
<!-- van -->
<g transform="translate(222 286)" filter="url(#hsh)"><path d="M0 8a8 8 0 0 1 8-8h70l26 22v22a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="#fff"/><path d="M78 2l24 20H78z" fill="#cfe0ff"/>
<rect x="14" y="12" width="18" height="18" rx="3" fill="#e2474f"/><path d="M23 15v12M17 21h12" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
<path d="M40 30h32" stroke="#1257d6" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="48" r="9" fill="#24324d"/><circle cx="84" cy="48" r="9" fill="#24324d"/><circle cx="22" cy="48" r="3.5" fill="#cbd6ea"/><circle cx="84" cy="48" r="3.5" fill="#cbd6ea"/></g>
<!-- nurse -->
<g transform="translate(318 186)">
 <ellipse cx="34" cy="146" rx="34" ry="6" fill="#0b2350" opacity=".08"/>
 <path d="M14 140V92c0-14 9-24 20-24s20 10 20 24v48z" fill="#1d4fb8"/>
 <path d="M18 140l4-46h24l4 46z" fill="#2a63d6"/>
 <path d="M22 140v-16h8v16zM38 140v-16h8v16z" fill="#14336e"/>
 <path d="M18 34a16 16 0 0 1 32 0v10a16 16 0 0 1-32 0z" fill="#2b3b66"/>
 <ellipse cx="34" cy="40" rx="11" ry="12.5" fill="#c98b62"/>
 <path d="M16 38c0-14 8-22 18-22s18 8 18 22c-4-8-10-12-18-12s-14 4-18 12z" fill="#2b3b66"/>
 <path d="M14 70c4 10 16 14 20 14s16-4 20-14" fill="#2b3b66"/>
 <path d="M54 96l20 18-6 8-22-14z" fill="#1d4fb8"/>
 <rect x="62" y="104" width="34" height="26" rx="5" fill="#fff" stroke="#cfe0ff" stroke-width="2"/>
 <path d="M74 117h10M79 112v10" stroke="#e2474f" stroke-width="3" stroke-linecap="round"/>
 <circle cx="30" cy="40" r="1.6" fill="#3a2418"/><circle cx="39" cy="40" r="1.6" fill="#3a2418"/><path d="M31 47c2 1.6 5 1.6 7 0" stroke="#3a2418" stroke-width="1.6" fill="none" stroke-linecap="round"/>
 <rect x="27" y="72" width="14" height="10" rx="2" fill="#fff"/><path d="M34 74v6M31 77h6" stroke="#1257d6" stroke-width="1.8"/>
</g>
<!-- phone -->
<g transform="translate(408 26)" filter="url(#hsh)">
 <rect x="0" y="0" width="168" height="300" rx="26" fill="url(#hph)"/>
 <rect x="8" y="8" width="152" height="284" rx="20" fill="#fff"/>
 <rect x="58" y="14" width="52" height="10" rx="5" fill="#0b1730"/>
 <text x="20" y="48" font-family="Inter,Arial" font-size="9" font-weight="700" fill="#0b2350">Request #10241</text>
 <rect x="20" y="56" width="128" height="58" rx="12" fill="#eaf2ff"/>
 <circle cx="38" cy="74" r="10" fill="#1257d6"/><path d="M34 74l3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
 <text x="54" y="72" font-family="Inter,Arial" font-size="8.5" font-weight="700" fill="#0b2350">Nurse on the way</text>
 <text x="54" y="84" font-family="Inter,Arial" font-size="7.5" fill="#5b6b88">Arriving in ~15 min</text>
 <rect x="30" y="96" width="108" height="6" rx="3" fill="#d4e3ff"/><rect x="30" y="96" width="70" height="6" rx="3" fill="#1257d6"/>
 <g font-family="Inter,Arial" font-size="7.5" fill="#33415c">
  <circle cx="30" cy="132" r="6" fill="#0fae9b"/><text x="42" y="135">Booking confirmed</text>
  <circle cx="30" cy="152" r="6" fill="#0fae9b"/><text x="42" y="155">Nurse assigned</text>
  <circle cx="30" cy="172" r="6" fill="#1257d6"/><text x="42" y="175" font-weight="700" fill="#1257d6">On the way</text>
  <circle cx="30" cy="192" r="6" fill="#dfe7f5"/><text x="42" y="195" fill="#9aa8c0">Sample collected</text>
  <circle cx="30" cy="212" r="6" fill="#dfe7f5"/><text x="42" y="215" fill="#9aa8c0">In the lab</text>
  <circle cx="30" cy="232" r="6" fill="#dfe7f5"/><text x="42" y="235" fill="#9aa8c0">Results ready</text>
 </g>
 <path d="M30 138v8M30 158v8M30 178v8M30 198v8M30 218v8" stroke="#dfe7f5" stroke-width="2"/>
 <rect x="20" y="250" width="128" height="28" rx="10" fill="url(#hbtn)"/><text x="84" y="268" text-anchor="middle" font-family="Inter,Arial" font-size="9" font-weight="700" fill="#fff">Contact nurse</text>
</g>
<!-- floating cards -->
<g transform="translate(36 96)" filter="url(#hsh)"><rect width="168" height="64" rx="16" fill="#fff"/><circle cx="30" cy="32" r="16" fill="#e3f7f4"/><path d="M23 32l5 5 9-10" stroke="#0fae9b" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="54" y="28" font-family="Inter,Arial" font-size="11" font-weight="800" fill="#0b2350">Results ready</text><text x="54" y="44" font-family="Inter,Arial" font-size="9" fill="#5b6b88">Vitamin D · B12 · CBC</text></g>
<g transform="translate(210 400)" filter="url(#hsh)"><rect width="188" height="64" rx="16" fill="#fff"/><circle cx="30" cy="32" r="16" fill="#eaf2ff"/><rect x="21" y="23" width="18" height="17" rx="3" fill="none" stroke="#1257d6" stroke-width="2.4"/><path d="M21 29h18" stroke="#1257d6" stroke-width="2.4"/>
<text x="54" y="28" font-family="Inter,Arial" font-size="11" font-weight="800" fill="#0b2350">Tomorrow · 10:00</text><text x="54" y="44" font-family="Inter,Arial" font-size="9" fill="#5b6b88">Home visit · Ibra</text></g>
<g transform="translate(470 360)" filter="url(#hsh)"><rect width="120" height="58" rx="16" fill="#0b2350"/><text x="16" y="25" font-family="Inter,Arial" font-size="9" fill="#9fb6e6">Sample box</text><text x="16" y="44" font-family="Inter,Arial" font-size="15" font-weight="800" fill="#fff">4.2 °C</text><circle cx="98" cy="30" r="9" fill="#0fae9b"/></g>
</svg>`;

const cats = { vitamins:['sun','#f2a516','#fff4dc'], blood:['drop','#e2474f','#fdecec'], diabetes:['glucose','#7a5af8','#efeaff'], heart:['heart','#e8466f','#fdeaf0'], thyroid:['butterfly','#0fae9b','#e3f7f4'], organs:['organs','#1257d6','#eaf2ff'], packages:['box','#1257d6','#eaf2ff'], vitals:['gauge','#0fae9b','#e3f7f4'], kids:['kid','#f2a516','#fff4dc'], men:['male','#1257d6','#eaf2ff'] };
function catIcon(c, size){ const x = cats[c]||cats.organs; return `<span class="ti" style="background:${x[2]};color:${x[1]}">${icon(x[0], size||26, 2)}</span>`; }

const roleArt = {
  patient:['user','#1257d6','#eaf2ff'], nurse:['syringe','#0fae9b','#e3f7f4'], courier:['van','#f2a516','#fff4dc'],
  lab:['flask','#7a5af8','#efeaff'], company:['building','#e8466f','#fdeaf0'], admin:['shield','#0b2350','#e6ebf5'], doctor:['steth','#0d7c6c','#dff5ef']
};
function roleIcon(r, size){ const x = roleArt[r === 'staff' ? 'admin' : r]||roleArt.patient; const s=size||64;
  return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true" style="flex:none"><circle cx="32" cy="32" r="30" fill="${x[2]}"/><g transform="translate(16 16) scale(1.3333)" fill="none" stroke="${x[1]}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[x[0]]}</g></svg>`; }

const emptyArt = `<svg viewBox="0 0 200 140" aria-hidden="true"><ellipse cx="100" cy="126" rx="70" ry="8" fill="#e6ecf6"/>
<rect x="40" y="70" width="120" height="44" rx="10" fill="#fff" stroke="#d6e0f0" stroke-width="2"/>
<g><rect x="56" y="30" width="16" height="66" rx="8" fill="#fff" stroke="#c7d6ef" stroke-width="2"/><rect x="58" y="62" width="12" height="32" rx="6" fill="#e2474f" opacity=".85"/><rect x="54" y="26" width="20" height="10" rx="3" fill="#e2474f"/></g>
<g><rect x="92" y="30" width="16" height="66" rx="8" fill="#fff" stroke="#c7d6ef" stroke-width="2"/><rect x="94" y="56" width="12" height="38" rx="6" fill="#f2a516" opacity=".85"/><rect x="90" y="26" width="20" height="10" rx="3" fill="#7a5af8"/></g>
<g><rect x="128" y="30" width="16" height="66" rx="8" fill="#fff" stroke="#c7d6ef" stroke-width="2"/><rect x="130" y="68" width="12" height="26" rx="6" fill="#2f7bff" opacity=".85"/><rect x="126" y="26" width="20" height="10" rx="3" fill="#0fae9b"/></g>
<rect x="40" y="88" width="120" height="26" rx="8" fill="#eaf2ff"/></svg>`;

const welcomeArt = `<svg viewBox="0 0 220 180" aria-hidden="true"><circle cx="130" cy="100" r="80" fill="#fff" opacity=".08"/>
<g transform="translate(60 30)"><rect width="96" height="130" rx="16" fill="#fff"/><rect x="10" y="12" width="76" height="28" rx="8" fill="#eaf2ff"/><circle cx="22" cy="26" r="7" fill="#1257d6"/><rect x="34" y="20" width="44" height="5" rx="2.5" fill="#1257d6"/><rect x="34" y="29" width="30" height="4" rx="2" fill="#9fb6e6"/>
<rect x="10" y="50" width="76" height="6" rx="3" fill="#e6ecf6"/><rect x="10" y="50" width="50" height="6" rx="3" fill="#0fae9b"/>
<g fill="#cfe0ff"><rect x="10" y="66" width="60" height="5" rx="2.5"/><rect x="10" y="78" width="70" height="5" rx="2.5"/><rect x="10" y="90" width="52" height="5" rx="2.5"/></g>
<rect x="10" y="106" width="76" height="14" rx="6" fill="#1257d6"/></g>
<g transform="translate(150 96)"><rect x="0" y="0" width="16" height="54" rx="8" fill="#fff"/><rect x="2" y="24" width="12" height="28" rx="6" fill="#e2474f"/><rect x="-2" y="-6" width="20" height="10" rx="3" fill="#e2474f"/></g>
<path d="M30 70s10 10.7 10 17.5a10 10 0 0 1-20 0C20 80.7 30 70 30 70z" fill="#5cc8ff"/></svg>`;

const steps = ['user','search','cal','card','pin','syringe','van','flask','check','file'];

window.ART = { icon, get logo(){ return logoFn(); }, wordmark: WORDMARK, hero, catIcon, roleIcon, emptyArt, welcomeArt, steps };
})();
