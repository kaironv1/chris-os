// Erzeugt die App-Icons für Chris OS aus einem SVG: C-Bogen in Creme auf Denimblau, Punkt in Cognac.
const fs = require('fs'), path = require('path');
let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = require('/opt/npm-tools/node_modules/sharp'); }
const out = process.argv[2];
const mark = '<path d="M341 171A120 120 0 1 0 341 341" fill="none" stroke="#F4F1EB" stroke-width="58" stroke-linecap="round"/><circle cx="364" cy="256" r="31" fill="#D39A6A"/>';
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#3E5C8A"/>${mark}</svg>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#3E5C8A"/>${mark}</svg>`;
(async () => {
  fs.writeFileSync(path.join(out, 'icon.svg'), rounded);
  await sharp(Buffer.from(rounded)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(Buffer.from(rounded)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(Buffer.from(full)).resize(512, 512).png().toFile(path.join(out, 'maskable-512.png'));
  await sharp(Buffer.from(full)).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  await sharp(Buffer.from(rounded)).resize(32, 32).png().toFile(path.join(out, 'favicon-32.png'));
  console.log(fs.readdirSync(out).join(', '));
})();
