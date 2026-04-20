#!/usr/bin/env node
/**
 * Build and upload APK to R2 after Vite build completes.
 * 
 * Automatically called by the Vite build plugin.
 * Uses environment variables from .env.local if available.
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
const OWNER = process.env.VITE_OWNER_ADDRESS || process.env.OWNER_ADDRESS;
const APK_PATH = path.join(ROOT, 'public/downloads/app-release.apk');
const DIST_APK_PATH = path.join(ROOT, 'dist/downloads/app-release.apk');

async function removeDistApk(logMessage) {
  if (!fs.existsSync(DIST_APK_PATH)) return;
  await fs.promises.rm(DIST_APK_PATH, { force: true });
  if (logMessage) console.log(logMessage);
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
async function main() {
  // Check if APK exists in source
  if (!fs.existsSync(APK_PATH)) {
    console.log('ℹ️  No APK found at public/downloads/app-release.apk - skipping upload');
    return;
  }

  // Check if we have API credentials
  if (!API_BASE || !OWNER) {
    console.log('⚠️  VITE_API_BASE_URL or VITE_OWNER_ADDRESS not set - skipping R2 upload');
    console.log('   Set these in .env.local to enable automatic APK uploads.');
    
    // Remove APK from dist to comply with Cloudflare Pages 25 MiB limit
    try {
      await removeDistApk('ℹ️  Removed dist APK (>25 MiB Pages limit)');
    } catch (e) {
      // Ignore errors
    }
    return;
  }

  // Read APK file
  const apkBuffer = fs.readFileSync(APK_PATH);
  const size = apkBuffer.byteLength;
  const sizeInMB = (size / 1024 / 1024).toFixed(2);

  console.log(`📦 Uploading APK to R2 (${sizeInMB} MB) …`);

  try {
    const url = new URL(`${API_BASE}/api/downloads/android`);
    // Optionally get version from package.json
    const pkgPath = path.join(ROOT, 'app-client/app.json');
    let version = '1.0.0';
    if (fs.existsSync(pkgPath)) {
      try {
        const appJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        version = appJson.expo?.version || version;
      } catch (e) {
        // Use default version
      }
    }
    url.searchParams.set('version', version);

    const resp = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'content-type': 'application/vnd.android.package-archive',
        'x-wallet': OWNER,
      },
      body: apkBuffer,
    });

    const result = await resp.json();
    
    if (!resp.ok) {
      console.error(`❌ Upload failed (${resp.status}):`, result);
      process.exit(1);
    }

    console.log(`✅ APK uploaded to R2 successfully!`);
    console.log(`   Version: ${result.version}`);
    console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Key: ${result.key}`);
    console.log(`   Download: ${API_BASE}/api/downloads/android`);

    // Remove APK from dist to comply with Cloudflare Pages 25 MiB limit
    try {
      await removeDistApk('ℹ️  Cleaned dist folder (removed local APK)');
    } catch (e) {
      // Ignore errors
    }

  } catch (err) {
    console.error('❌ Upload error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});