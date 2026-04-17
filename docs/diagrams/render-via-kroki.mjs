// Render local .mmd files to SVG via Kroki public service (https://kroki.io)
// No local dependencies required beyond Node 18+ (built-in fetch & zlib).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = [
  '01-system-architecture.mmd',
  '02-business-flow.mmd',
  '03-reward-engine.mmd',
];

function krokiEncode(src) {
  const compressed = deflateSync(Buffer.from(src, 'utf-8'), { level: 9 });
  return compressed
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function renderOne(name) {
  const src = readFileSync(resolve(__dirname, name), 'utf-8');
  const encoded = krokiEncode(src);
  const url = `https://kroki.io/mermaid/svg/${encoded}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroki failed for ${name}: ${res.status} ${body.slice(0, 200)}`);
  }
  const svg = await res.text();
  const outPath = resolve(__dirname, name.replace(/\.mmd$/, '.svg'));
  writeFileSync(outPath, svg, 'utf-8');
  console.log(`OK  ${name} -> ${outPath} (${svg.length} bytes)`);
}

for (const f of files) {
  try {
    await renderOne(f);
  } catch (err) {
    console.error(`FAIL ${f}:`, err.message);
    process.exitCode = 1;
  }
}
