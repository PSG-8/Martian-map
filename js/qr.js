/* Lab@Home – QR code for https://labathome-oman.vercel.app/#/install (version 5, error correction H, so the logo in the middle is safe) */
(function(){
const N = 37, R = ["1fce71947f", "104925a941", "175a3b7a5d", "1752358f5d", "174ac2c45d", "1047f1b041", "1fd555557f", "b890b00", "361f3150c", "1ad695e38", "1dfb3c5af7", "70e73d4d6", "a57aca348", "390853794", "b40ed968f", "14baa8f0bc", "e67c2fa47", "1398045ba6", "1d76e4e2f5", "1d07948d2a", "1a561e47d0", "1d3a4fcf38", "1cff55421f", "1f8d1d93af", "363e2f063", "108a071790", "18ffd5de53", "1534c317a7", "13e0702bff", "1b6b891e", "1fd023f95d", "1048c1db1b", "17502b97f1", "1757c0164c", "174f4b763b", "104521641f", "1fc1ce0159"];
const bits = R.map(h => BigInt('0x' + h).toString(2).padStart(N, '0'));
const isFinder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
function svg(o = {}){
  const fg = o.fg || '#0d1628', acc = o.accent || '#1257d6', q = 4, S = N + q * 2, logo = o.logo !== false;
  const c0 = (N - 9) / 2, c1 = c0 + 9;                         // centre area kept clear for the logo
  let d = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (bits[y][x] !== '1' || isFinder(x, y)) continue;
    if (logo && x >= c0 && x < c1 && y >= c0 && y < c1) continue;
    d += `M${x + q + .3} ${y + q + .04}h.4a.26 .26 0 0 1 .26 .26v.4a.26 .26 0 0 1-.26 .26h-.4a.26 .26 0 0 1-.26-.26v-.4a.26 .26 0 0 1 .26-.26z`;
  }
  const eye = (x, y) => `<rect x="${x + q + .5}" y="${y + q + .5}" width="6" height="6" rx="1.7" fill="none" stroke="${fg}" stroke-width="1"/><rect x="${x + q + 2}" y="${y + q + 2}" width="3" height="3" rx=".9" fill="${acc}"/>`;
  const mark = logo ? `<g transform="translate(${c0 + q} ${c0 + q})"><rect x=".3" y=".3" width="8.4" height="8.4" rx="2.2" fill="#fff"/><rect x="1.1" y="1.1" width="6.8" height="6.8" rx="1.8" fill="${fg}"/>
    <path d="M4.5 2.15l2.05 1.18v2.36L4.5 6.87 2.45 5.69V3.33z" fill="none" stroke="#60a5fa" stroke-width=".5" stroke-linejoin="round"/><path d="M4 3.35h1M4.15 3.35v1.05l-.75 1.3h2.2l-.75-1.3V3.35" fill="none" stroke="#fff" stroke-width=".38" stroke-linecap="round" stroke-linejoin="round"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${o.size || 240}" height="${o.size || 240}" role="img" aria-label="QR"><rect width="${S}" height="${S}" rx="${o.round ? 3 : 0}" fill="${o.bg || '#fff'}"/><path d="${d}" fill="${fg}"/>${eye(0, 0)}${eye(N - 7, 0)}${eye(0, N - 7)}${mark}</svg>`;
}
window.LAHQR = { svg, url: 'https://labathome-oman.vercel.app/#/install' };
})();
