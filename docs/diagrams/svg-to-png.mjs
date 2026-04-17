// Convert SVG -> high-res PNG using sharp (pure JS, no Chromium)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = [
  '01-system-architecture',
  '02-business-flow',
  '03-reward-engine',
];

// Target a crisp ~4K output, cap at 3840px wide.
const MAX_WIDTH = 3840;
const MIN_SCALE = 2;

for (const base of files) {
  const svgPath = resolve(__dirname, `${base}.svg`);
  const pngPath = resolve(__dirname, `${base}.png`);
  const svg = readFileSync(svgPath);

  const widthMatch = svg.toString().match(/<svg[^>]*\swidth="([\d.]+)(?:px)?"/i);
  const heightMatch = svg.toString().match(/<svg[^>]*\sheight="([\d.]+)(?:px)?"/i);
  const viewBoxMatch = svg.toString().match(/viewBox="([\d.\-\s]+)"/i);

  let w = widthMatch ? parseFloat(widthMatch[1]) : 0;
  let h = heightMatch ? parseFloat(heightMatch[1]) : 0;
  if ((!w || !h) && viewBoxMatch) {
    const [, , vw, vh] = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    w = w || vw;
    h = h || vh;
  }
  if (!w || !h) {
    w = 1920;
    h = 1080;
  }

  const targetW = Math.min(MAX_WIDTH, Math.round(w * 4));
  const scale = targetW / w;
  const density = Math.max(96, Math.round(96 * scale));

  await sharp(svg, { density })
    .resize({ width: targetW })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);

  console.log(`OK  ${base}.svg -> ${base}.png  (${targetW}px wide, density=${density})`);
}
