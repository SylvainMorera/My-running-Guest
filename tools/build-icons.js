#!/usr/bin/env node
// Génère les icônes PNG de Renfo Cross (180, 192, 512 px) sans dépendance ni service externe.
// Dessin : fond bleu marine, barre de musculation blanche, disques bleu azur, flèche montante azur.
// Le motif reste dans la zone sûre centrale de 80 % (icône « maskable » Android, coins arrondis iOS).
// Usage : node tools/build-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MARINE = [16, 28, 72];    // #101C48
const AZUR = [56, 132, 200];    // #3884C8
const BLANC = [255, 255, 255];

// Formes en coordonnées normalisées (0 à 1). Chaque forme dit si un point est dedans.
function rectArrondi(x, y, w, h, r) {
  return (px, py) => {
    const dx = Math.max(x + r - px, 0, px - (x + w - r));
    const dy = Math.max(y + r - py, 0, py - (y + h - r));
    return dx * dx + dy * dy <= r * r && px >= x && px <= x + w && py >= y && py <= y + h;
  };
}
function segment(x1, y1, x2, y2, e) { // trait épais à bouts ronds
  return (px, py) => {
    const vx = x2 - x1, vy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
    const qx = x1 + t * vx - px, qy = y1 + t * vy - py;
    return qx * qx + qy * qy <= (e / 2) * (e / 2);
  };
}
// Ordre de dessin : du fond vers le dessus.
const FORMES = [
  [BLANC, rectArrondi(0.17, 0.425, 0.66, 0.05, 0.02)],          // barre
  [AZUR, rectArrondi(0.25, 0.30, 0.075, 0.30, 0.02)],           // disques gauches
  [AZUR, rectArrondi(0.185, 0.35, 0.055, 0.20, 0.02)],
  [AZUR, rectArrondi(0.675, 0.30, 0.075, 0.30, 0.02)],          // disques droits
  [AZUR, rectArrondi(0.76, 0.35, 0.055, 0.20, 0.02)],
  [BLANC, segment(0.36, 0.76, 0.50, 0.66, 0.045)],              // flèche montante (progression)
  [BLANC, segment(0.50, 0.66, 0.64, 0.76, 0.045)]
];

function pixel(px, py) {
  let c = MARINE;
  for (const [coul, dedans] of FORMES) if (dedans(px, py)) c = coul;
  return c;
}

function dessiner(taille) {
  const SS = 4; // sur-échantillonnage 4 × 4 pour lisser les bords
  const lignes = Buffer.alloc((taille * 3 + 1) * taille);
  for (let y = 0; y < taille; y++) {
    lignes[y * (taille * 3 + 1)] = 0; // filtre PNG « aucun »
    for (let x = 0; x < taille; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = pixel((x + (sx + 0.5) / SS) / taille, (y + (sy + 0.5) / SS) / taille);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (taille * 3 + 1) + 1 + x * 3, n = SS * SS;
      lignes[o] = Math.round(r / n); lignes[o + 1] = Math.round(g / n); lignes[o + 2] = Math.round(b / n);
    }
  }
  return png(taille, taille, lignes);
}

// Encodage PNG minimal (RVB 8 bits, sans transparence : iOS remplit la transparence en noir).
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function bloc(type, data) {
  const lg = Buffer.alloc(4); lg.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([lg, td, crc]);
}
function png(w, h, brut) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut, { level: 9 })), bloc('IEND', Buffer.alloc(0))]);
}

const dossier = path.join(__dirname, '..', 'renfo-cross', 'icons');
fs.mkdirSync(dossier, { recursive: true });
for (const t of [180, 192, 512]) {
  fs.writeFileSync(path.join(dossier, 'icon-' + t + '.png'), dessiner(t));
  console.log('icons/icon-' + t + '.png');
}
