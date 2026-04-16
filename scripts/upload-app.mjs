#!/usr/bin/env node
/**
 * Upload APK / update iOS URL to the Worker API.
 *
 * Usage:
 *   node scripts/upload-app.mjs android <path-to.apk> [version]
 *   node scripts/upload-app.mjs ios <testflight-or-appstore-url>
 *
 * Requires:
 *   OWNER_ADDRESS  — env var or set in .env.local
 *   VITE_API_BASE_URL — Worker base URL (e.g. https://coin-planet-api.xxx.workers.dev)
 *
 * Example:
 *   OWNER_ADDRESS=0xABC... \
 *   VITE_API_BASE_URL=https://coin-planet-api.xxx.workers.dev \
 *   node scripts/upload-app.mjs android ./app-client/coin-planet.apk 1.2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ──────────────────────────────────────────
// Load env from .env.local if present
// ──────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ──────────────────────────────────────────
// Config
// ──────────────────────────────────────────
const API_BASE = process.env.VITE_API_BASE_URL;
const OWNER   = process.env.OWNER_ADDRESS;

if (!API_BASE) {
  console.error('❌ VITE_API_BASE_URL is not set');
  process.exit(1);
}
if (!OWNER) {
  console.error('❌ OWNER_ADDRESS is not set');
  process.exit(1);
}

const [, , platform, ...rest] = process.argv;

if (!platform || !['android', 'ios'].includes(platform)) {
  console.error('❌ Usage: node upload-app.mjs <android|ios> <file-or-url> [version]');
  process.exit(1);
}

// ──────────────────────────────────────────
// Upload
// ──────────────────────────────────────────
async function uploadAndroid(apkPath, version) {
  if (!fs.existsSync(apkPath)) {
    console.error(`❌ File not found: ${apkPath}`);
    process.exit(1);
  }

  const apkBuffer = fs.readFileSync(apkPath);
  const size = apkBuffer.byteLength;
  console.log(`📦 Uploading ${path.basename(apkPath)} (${(size / 1024 / 1024).toFixed(1)} MB) …`);

  const url = new URL(`${API_BASE}/api/downloads/android`);
  if (version) url.searchParams.set('version', version);

  const resp = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'x-wallet': OWNER,
    },
    body: apkBuffer,
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error(`❌ Upload failed (${resp.status}):`, json);
    process.exit(1);
  }

  console.log('✅ Upload successful!');
  console.table({ version: json.version, size: `${(json.size / 1024 / 1024).toFixed(1)} MB`, key: json.key });
  console.log(`\n🔗 Download URL: ${API_BASE}/api/downloads/android`);
}

async function updateIos(iosUrl) {
  if (!iosUrl.startsWith('https://')) {
    console.error('❌ iOS URL must start with https://');
    process.exit(1);
  }
  console.log(`📱 Updating iOS download URL to: ${iosUrl} …`);

  const resp = await fetch(`${API_BASE}/api/downloads/ios`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-wallet': OWNER,
    },
    body: JSON.stringify({ url: iosUrl }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error(`❌ Update failed (${resp.status}):`, json);
    process.exit(1);
  }

  console.log('✅ iOS URL updated!');
  console.log(`🔗 Saved: ${json.url}`);
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
if (platform === 'android') {
  const [apkPath, version] = rest;
  if (!apkPath) {
    console.error('❌ Usage: upload-app.mjs android <path-to.apk> [version]');
    process.exit(1);
  }
  await uploadAndroid(apkPath, version);
} else {
  const [iosUrl] = rest;
  if (!iosUrl) {
    console.error('❌ Usage: upload-app.mjs ios <https://testflight...>');
    process.exit(1);
  }
  await updateIos(iosUrl);
}
