/**
 * 从 EAS Build 获取最新构建的下载链接并更新 .env.local
 * 
 * 用法: node scripts/sync-eas-links.js
 * 
 * 前置条件:
 * 1. 安装 EAS CLI: npm install -g eas-cli
 * 2. 登录 Expo: eas login
 * 3. 运行过 EAS 构建: eas build
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * 获取最新的构建信息
 */
async function getLatestBuilds() {
  try {
    console.log('🔄 从 EAS Build 获取构建信息...\n');

    const { stdout } = await execPromise('eas build:list --limit 2 --json', {
      cwd: path.join(PROJECT_ROOT, 'app-client'),
    });

    const builds = JSON.parse(stdout);

    if (!builds || builds.length === 0) {
      console.error('❌ 未找到构建。请先运行: eas build');
      process.exit(1);
    }

    // 查找最新的 Android 和 iOS 构建
    let androidBuild = null;
    let iosBuild = null;

    for (const build of builds) {
      if (build.platform === 'android' && !androidBuild) {
        androidBuild = build;
      }
      if (build.platform === 'ios' && !iosBuild) {
        iosBuild = build;
      }

      if (androidBuild && iosBuild) break;
    }

    return { androidBuild, iosBuild };
  } catch (error) {
    console.error('❌ 获取 EAS 构建信息失败:');
    console.error(error.message);
    console.log('\n💡 请确保:');
    console.log('  1. 已安装 EAS CLI: npm install -g eas-cli');
    console.log('  2. 已登录 Expo: eas login');
    console.log('  3. 已运行过构建: cd app-client && eas build');
    process.exit(1);
  }
}

/**
 * 提取下载链接
 */
function getDownloadUrls(androidBuild, iosBuild) {
  let androidUrl = '';
  let iosUrl = '';

  if (androidBuild) {
    // APK 类型直接下载
    if (androidBuild.buildType === 'apk' && androidBuild.artifacts?.buildUrl) {
      androidUrl = androidBuild.artifacts.buildUrl;
    }

    console.log('📱 Android 最新构建:');
    console.log(`   ID: ${androidBuild.id}`);
    console.log(`   状态: ${androidBuild.status}`);
    console.log(`   类型: ${androidBuild.buildType}`);

    if (androidUrl) {
      console.log(`   下载: ${androidUrl}`);
    } else if (androidBuild.status === 'FINISHED') {
      console.log('   ⚠️  构建完成但无直接下载链接（可能是 AAB）');
      console.log('   💡 可运行: eas build:download --id ' + androidBuild.id);
    }
    console.log();
  } else {
    console.log('⚠️  未找到 Android 构建\n');
  }

  if (iosBuild) {
    console.log('🍎 iOS 最新构建:');
    console.log(`   ID: ${iosBuild.id}`);
    console.log(`   状态: ${iosBuild.status}`);

    // iOS 通常需要提交到 TestFlight 获取公测链接
    if (iosBuild.status === 'FINISHED') {
      console.log('   💡 运行以下命令提交到 TestFlight:');
      console.log(`      eas submit --platform ios --latest`);
      iosUrl = 'https://testflight.apple.com/join/YOUR_TESTFLIGHT_ID';
    }
    console.log();
  } else {
    console.log('⚠️  未找到 iOS 构建\n');
  }

  return { androidUrl, iosUrl };
}

/**
 * 更新 .env.local 文件
 */
function updateEnvFile(androidUrl, iosUrl) {
  const envFile = path.join(PROJECT_ROOT, '.env.local');
  let envContent = '';

  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }

  const lines = envContent.split('\n');
  let hasAndroidUrl = false,
    hasIosUrl = false;

  const newLines = lines
    .map((line) => {
      if (line.startsWith('VITE_ANDROID_DOWNLOAD_URL=')) {
        hasAndroidUrl = true;
        return androidUrl ? `VITE_ANDROID_DOWNLOAD_URL="${androidUrl}"` : line;
      }
      if (line.startsWith('VITE_IOS_DOWNLOAD_URL=')) {
        hasIosUrl = true;
        return iosUrl ? `VITE_IOS_DOWNLOAD_URL="${iosUrl}"` : line;
      }
      return line;
    })
    .filter((line) => line.trim() !== '');

  if (!hasAndroidUrl && androidUrl) {
    newLines.push(`VITE_ANDROID_DOWNLOAD_URL="${androidUrl}"`);
  }
  if (!hasIosUrl && iosUrl) {
    newLines.push(`VITE_IOS_DOWNLOAD_URL="${iosUrl}"`);
  }

  fs.writeFileSync(envFile, newLines.join('\n') + '\n');
  console.log(`✅ 已更新 .env.local`);
}

/**
 * 打印摘要
 */
function printSummary(androidUrl, iosUrl) {
  console.log('\n' + '='.repeat(60));
  console.log('📝 配置摘要');
  console.log('='.repeat(60));

  if (androidUrl) {
    console.log('\n✅ Android 下载链接已配置');
    console.log(`   VITE_ANDROID_DOWNLOAD_URL="${androidUrl}"`);
  } else {
    console.log(
      '\n⚠️  Android 下载链接未配置（请手动运行 eas build 并设置链接）'
    );
  }

  if (iosUrl && iosUrl !== 'https://testflight.apple.com/join/YOUR_TESTFLIGHT_ID') {
    console.log('\n✅ iOS 下载链接已配置');
    console.log(`   VITE_IOS_DOWNLOAD_URL="${iosUrl}"`);
  } else {
    console.log('\n⚠️  iOS 下载链接未配置');
    console.log('   💡 运行以下命令获取 TestFlight 链接:');
    console.log('      cd app-client');
    console.log('      eas submit --platform ios --latest');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🚀 后续步骤');
  console.log('='.repeat(60));
  console.log('1. 如需生成二维码，运行:');
  console.log(
    '   node scripts/generate-qr-codes.mjs <android-url> <ios-url>'
  );
  console.log('\n2. 重启开发服务器查看更改:');
  console.log('   npm run dev');
  console.log('\n3. 访问下载页面:');
  console.log('   http://localhost:5173/#download');
}

/**
 * 主流程
 */
async function main() {
  try {
    console.log('🔍 EAS Build 下载链接同步工具\n');

    const { androidBuild, iosBuild } = await getLatestBuilds();

    const { androidUrl, iosUrl } = getDownloadUrls(androidBuild, iosBuild);

    if (androidUrl || iosUrl) {
      updateEnvFile(androidUrl, iosUrl);
      printSummary(androidUrl, iosUrl);
    } else {
      console.log('⚠️  未找到有效的下载链接');
      printSummary('', '');
    }
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  }
}

main();
