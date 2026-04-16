/**
 * 生成 QR 码图片的脚本
 * 用法: node scripts/generate-qr-codes.js <android-url> <ios-url>
 * 
 * 例如:
 * node scripts/generate-qr-codes.js \
 *   "https://eas-builds.s3.amazonaws.com/...apk" \
 *   "https://testflight.apple.com/join/xxx"
 */

import fs from 'fs';
import https from 'https';
import path from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ 缺少参数');
  console.log('用法: node scripts/generate-qr-codes.js <android-url> <ios-url>');
  process.exit(1);
}

const androidUrl = args[0];
const iosUrl = args[1];

const qrCodeDir = 'public/qr-codes';

// 创建输出目录
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

/**
 * 通过 URL 下载二维码图片
 */
function downloadQRCode(qrUrl, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(qrCodeDir, filename);
    const file = fs.createWriteStream(filepath);

    https.get(qrUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download QR code: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✅ 已生成: ${filepath}`);
        resolve(filepath);
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // 删除文件
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // 删除文件
      reject(err);
    });
  });
}

/**
 * 生成 QR 码 URL (使用 QR Server API)
 */
function getQRCodeUrl(targetUrl) {
  const qrServerUrl = new URL('https://api.qrserver.com/v1/create-qr-code/');
  qrServerUrl.searchParams.set('size', '300x300');
  qrServerUrl.searchParams.set('data', targetUrl);
  return qrServerUrl.toString();
}

/**
 * 更新 .env.local 文件
 */
function updateEnvFile(qrAndroidPath, qrIosPath) {
  const envFile = '.env.local';
  let envContent = '';

  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }

  // 如果已有相关配置，则替换；否则追加
  const lines = envContent.split('\n');
  let hasAndroidQR = false,
    hasIosQR = false;

  const newLines = lines
    .map((line) => {
      if (line.startsWith('VITE_ANDROID_QR_CODE=')) {
        hasAndroidQR = true;
        return `VITE_ANDROID_QR_CODE="${qrAndroidPath}"`;
      }
      if (line.startsWith('VITE_IOS_QR_CODE=')) {
        hasIosQR = true;
        return `VITE_IOS_QR_CODE="${qrIosPath}"`;
      }
      return line;
    })
    .filter((line) => line.trim() !== '');

  if (!hasAndroidQR) {
    newLines.push(`VITE_ANDROID_QR_CODE="${qrAndroidPath}"`);
  }
  if (!hasIosQR) {
    newLines.push(`VITE_IOS_QR_CODE="${qrIosPath}"`);
  }

  fs.writeFileSync(envFile, newLines.join('\n') + '\n');
  console.log(`✅ 已更新 ${envFile}`);
}

/**
 * 主流程
 */
async function main() {
  try {
    console.log('🔄 生成 QR 码中...\n');

    // 生成 Android QR 码
    const androidQRUrl = getQRCodeUrl(androidUrl);
    console.log('📱 Android 下载链接:');
    console.log(`   ${androidUrl}\n`);

    // 生成 iOS QR 码
    const iosQRUrl = getQRCodeUrl(iosUrl);
    console.log('🍎 iOS 下载链接:');
    console.log(`   ${iosUrl}\n`);

    console.log('⏳ 正在下载 QR 码图片...\n');

    const [androidQRPath, iosQRPath] = await Promise.all([
      downloadQRCode(androidQRUrl, 'android-qr.png'),
      downloadQRCode(iosQRUrl, 'ios-qr.png'),
    ]);

    // 更新环境变量
    const androidQRPublicPath = `/qr-codes/android-qr.png`;
    const iosQRPublicPath = `/qr-codes/ios-qr.png`;

    updateEnvFile(androidQRPublicPath, iosQRPublicPath);

    console.log('\n✨ 完成！\n');

    console.log('📝 已添加到 .env.local:');
    console.log(`   VITE_ANDROID_DOWNLOAD_URL="${androidUrl}"`);
    console.log(`   VITE_IOS_DOWNLOAD_URL="${iosUrl}"`);
    console.log(`   VITE_ANDROID_QR_CODE="${androidQRPublicPath}"`);
    console.log(`   VITE_IOS_QR_CODE="${iosQRPublicPath}"\n`);

    console.log('🚀 下次启动开发服务器时，下载页面会显示新的 QR 码。');
    console.log('   运行: npm run dev');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
