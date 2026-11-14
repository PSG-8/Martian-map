/* =====================================================================
   flag.js  ·  Martian Map · Team Starseekers
   The national flag of Oman, drawn on a canvas.

   Layout follows the 2004 flag law (Royal Decree 53/2004):
   - proportions 4:7 (height : length)
   - a red band along the hoist, one third of the length
   - three equal horizontal stripes in the fly: white, red, green
   - the national emblem in white in the upper part of the hoist band:
     two crossed swords, a belt, and the khanjar (dagger) in its sheath,
     whose curved tip points towards the pole.
   ===================================================================== */

export const OMAN = { red: '#c8102e', green: '#009530', white: '#ffffff' };   // PMS 186 C red, PMS 355 C green (FOTW)
export const FLAG_RATIO = 7 / 4;             // length / height

/* The emblem, drawn inside a 100 x 100 box whose top-left corner is (x, y) and whose size is s pixels. */
export function drawOmanEmblem(g, x, y, s, color = OMAN.white, detail = OMAN.red) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = color;
  g.strokeStyle = color;

  // ---- two crossed swords in their scabbards (behind everything) ----
  const sword = flip => {
    g.save();
    if (flip) { g.translate(100, 0); g.scale(-1, 1); }
    // pommel and grip (top)
    g.beginPath(); g.arc(14, 8, 4.2, 0, Math.PI * 2); g.fill();
    g.lineWidth = 4.6;
    g.beginPath(); g.moveTo(15.5, 10.5); g.lineTo(23, 19); g.stroke();
    // cross guard
    g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(17.5, 24.5); g.lineTo(28.5, 13.5); g.stroke();
    // scabbard: wide at the top, slightly curved, tip turns outwards at the bottom
    g.beginPath();
    g.moveTo(22.5, 21.5);
    g.quadraticCurveTo(52, 52, 80.5, 81);
    g.quadraticCurveTo(86, 87, 90, 86.5);
    g.quadraticCurveTo(92, 91, 86.5, 92);
    g.quadraticCurveTo(80, 92, 76, 85.5);
    g.quadraticCurveTo(48, 56, 19, 25.5);
    g.closePath();
    g.fill();
    // scabbard bands (thin red lines so the shape reads at small sizes)
    g.strokeStyle = detail; g.lineWidth = 1.3;
    for (const t of [0.3, 0.62]) {
      const cx = 21 + (80 - 21) * t, cy = 23.5 + (83 - 23.5) * t;
      g.beginPath(); g.moveTo(cx - 2.6, cy + 2.6); g.lineTo(cx + 2.6, cy - 2.6); g.stroke();
    }
    g.restore();
  };
  sword(false);
  sword(true);

  // ---- the belt (horizontal, with the dagger hanging from it) ----
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(12, 41); g.lineTo(88, 41); g.lineTo(92, 45); g.lineTo(88, 49); g.lineTo(12, 49); g.lineTo(8, 45); g.closePath();
  g.fill();
  g.strokeStyle = detail; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(13, 45); g.lineTo(87, 45); g.stroke();          // stitched centre line
  for (const bx of [24, 76]) {                                            // buckle rings
    g.beginPath(); g.rect(bx - 3, 42.2, 6, 5.6); g.stroke();
  }

  // ---- the khanjar: hilt above the belt, sheath below, tip curving towards the pole (left) ----
  g.fillStyle = color;
  // hilt: wide flat pommel and a grip
  g.beginPath();
  g.moveTo(40, 18); g.quadraticCurveTo(50, 13, 60, 18); g.lineTo(57, 23); g.lineTo(43, 23); g.closePath();
  g.fill();
  g.fillRect(45.5, 22.5, 9, 18.5);
  // sheath
  g.beginPath();
  g.moveTo(42, 49);
  g.lineTo(58, 49);
  g.quadraticCurveTo(58.5, 66, 56.5, 76);
  g.quadraticCurveTo(53, 92, 36, 94);           // outer curve of the hook
  g.quadraticCurveTo(26, 94.5, 22, 88);         // the point turns up towards the pole
  g.quadraticCurveTo(30, 90, 36, 86);
  g.quadraticCurveTo(43.5, 80, 44, 70);         // inner curve
  g.closePath();
  g.fill();
  // red detail lines on the hilt and the sheath
  g.strokeStyle = detail; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(45.5, 29); g.lineTo(54.5, 29); g.moveTo(45.5, 35); g.lineTo(54.5, 35); g.stroke();
  g.beginPath(); g.moveTo(44, 56); g.lineTo(57.5, 56); g.moveTo(44.2, 64); g.lineTo(57.4, 64); g.stroke();
  g.beginPath(); g.moveTo(46, 72); g.quadraticCurveTo(51, 74, 56, 72.5); g.stroke();
  g.restore();
}

/* Full flag on a canvas of width w (height follows the 4:7 ratio). Returns the canvas. */
export function drawOmanFlag(canvas, w = 700) {
  const h = Math.round(w / FLAG_RATIO);
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  const hoist = w / 3, stripe = h / 3;
  g.fillStyle = OMAN.white; g.fillRect(0, 0, w, Math.ceil(stripe));
  g.fillStyle = OMAN.red;   g.fillRect(0, Math.floor(stripe), w, Math.ceil(stripe) + 1);
  g.fillStyle = OMAN.green; g.fillRect(0, Math.floor(2 * stripe), w, h - Math.floor(2 * stripe));
  g.fillStyle = OMAN.red;   g.fillRect(0, 0, Math.ceil(hoist), h);
  // emblem: centred in the hoist band, in its upper part
  const s = Math.min(hoist * 0.74, h * 0.46);
  drawOmanEmblem(g, (hoist - s) / 2, h * 0.06, s);
  return canvas;
}
