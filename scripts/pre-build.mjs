#!/usr/bin/env node
/**
 * Pre-build script: upload APK to R2 and bake download URL into .env.local
 * before Vite starts compiling the web page.
 *
 * Run automatically via package.json "build" script:
 *   node scripts/pre-build.mjs && vite build
 *
 * Behaviour:
 *  1. If APK exists at public/downloads/app-release.apk AND credentials are set,
 *     upload it to R2 and set VITE_ANDROID_DOWNLOAD_URL in .env.local.
 *  2. If APK is missing or credentials are absent, skip upload gracefully –
 *     the existing VITE_ANDROID_DOWNLOAD_URL (if any) is kept unchanged.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateApkFile } from './lib/validate-apk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─────────────────────────────────────────────
// Load .env.local so creds are available
// ─────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
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

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const API_BASE = (process.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const OWNER    = process.env.VITE_OWNER_ADDRESS || process.env.OWNER_ADDRESS || '';
const APK_PATH = path.join(ROOT, 'public/downloads/app-release.apk');

function getPreferredIosDownloadUrl() {
  const candidates = [
    process.env.TESTFLIGHT_PUBLIC_URL,
    process.env.IOS_TESTFLIGHT_PUBLIC_URL,
    process.env.APP_STORE_IOS_URL,
    process.env.APPLE_APP_STORE_URL,
    process.env.VITE_IOS_DOWNLOAD_URL,
  ];

  for (const value of candidates) {
    const normalized = String(value || '').trim();
    if (normalized && normalized !== '#') {
      return normalized;
    }
  }

  return '';
}

// ─────────────────────────────────────────────
// Write / update a key in .env.local
// ─────────────────────────────────────────────
function writeEnvKey(key, value) {
  const envFile = path.join(ROOT, '.env.local');
  let content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const line = `${key}="${value}"`;
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.endsWith('\n') ? content + line + '\n' : content + '\n' + line + '\n';
  }
  fs.writeFileSync(envFile, content, 'utf8');
  console.log(`✅ ${key} → ${value}`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('\n🔨 pre-build: 同步下载地址并检查安装包状态...');

  const iosDownloadUrl = getPreferredIosDownloadUrl();
  if (iosDownloadUrl) {
    writeEnvKey('VITE_IOS_DOWNLOAD_URL', iosDownloadUrl);
    console.log(`🍎 iOS 首页链接已同步：${iosDownloadUrl}`);
  } else {
    console.log('ℹ️  未检测到 iOS 公网分发链接，保留现有 VITE_IOS_DOWNLOAD_URL。');
    console.log('   可配置 TESTFLIGHT_PUBLIC_URL / IOS_TESTFLIGHT_PUBLIC_URL / APP_STORE_IOS_URL。');
  }

  if (!fs.existsSync(APK_PATH)) {
    console.log('ℹ️  未找到 APK (public/downloads/app-release.apk)，跳过上传。');
    return;
  }

  try {
    validateApkFile(APK_PATH);
  } catch (error) {
    console.error(`❌ APK 校验失败，跳过上传：${error.message}`);
    return;
  }

  const sizeMB = (fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(2);

  if (!API_BASE || !OWNER) {
    console.log('⚠️  VITE_API_BASE_URL 或 VITE_OWNER_ADDRESS 未设置，跳过 R2 上传。');
    console.log('   如需自动上传，请在 .env.local 中配置这两个变量。');
    return;
  }

  // Read version from app-client/app.json
  let version = '1.0.0';
  try {
    const appJsonPath = path.join(ROOT, 'app-client/app.json');
    if (fs.existsSync(appJsonPath)) {
      version = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo?.version || version;
    }
  } catch { /* keep default */ }

  console.log(`📦 上传 APK (${sizeMB} MB, v${version}) → R2 ...`);

  const apkBuffer = fs.readFileSync(APK_PATH);
  const uploadUrl = new URL(`${API_BASE}/api/downloads/android`);
  uploadUrl.searchParams.set('version', version);

  const resp = await fetch(uploadUrl.toString(), {
    method: 'PUT',
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'x-wallet': OWNER,
    },
    body: apkBuffer,
  });

  const result = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.error(`❌ APK 上传失败 (${resp.status}):`, result);
    // Non-fatal: let build continue with previous URL
    return;
  }

  // Derive public download URL
  const downloadUrl = `${API_BASE}/api/downloads/android`;

  console.log(`✅ APK 已上传：v${result.version || version}，${((result.size || 0) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   下载地址：${downloadUrl}`);

  // Bake URL into .env.local so Vite picks it up during this build
  writeEnvKey('VITE_ANDROID_DOWNLOAD_URL', downloadUrl);
}

main().catch((err) => {
  console.error('❌ pre-build 异常:', err.message || err);
  // Exit 0 so that a failed upload does NOT abort the whole build
  process.exit(0);
});
