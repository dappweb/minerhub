#!/usr/bin/env node

/**
 * iOS 签名配置验证脚本
 * 
 * 使用方法：
 * npm run verify:ios-signing
 * 或
 * node scripts/verify-ios-signing.mjs
 * 
 * 验证以下内容：
 * 1. 私钥文件是否存在和有效
 * 2. .env.local 是否包含必需的 Apple 凭证
 * 3. eas.json 是否正确配置
 * 4. EAS 凭证存储是否已初始化
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const APP_CLIENT_DIR = path.join(PROJECT_ROOT, 'app-client');

let hasErrors = false;
let hasWarnings = false;

function checkError(message) {
  console.log('❌ ' + message);
  hasErrors = true;
}

function checkWarning(message) {
  console.log('⚠️  ' + message);
  hasWarnings = true;
}

function checkSuccess(message) {
  console.log('✅ ' + message);
}

function divider(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

console.log('🔍 iOS 签名配置验证\n');

// 检查 1: 私钥文件
divider('检查1：Apple 私钥文件');

const privateKeyPath = path.join(PROJECT_ROOT, 'AuthKey_76553GW25U.p8');
if (fs.existsSync(privateKeyPath)) {
  const stats = fs.statSync(privateKeyPath);
  const content = fs.readFileSync(privateKeyPath, 'utf-8');

  if (content.includes('BEGIN PRIVATE KEY') && content.includes('END PRIVATE KEY')) {
    checkSuccess(`私钥文件有效: ${privateKeyPath}`);
    checkSuccess(`文件大小: ${stats.size} bytes`);
  } else {
    checkError('私钥文件格式不正确（不是 PKCS#8 格式）');
  }
} else {
  checkError(`私钥文件未找到: ${privateKeyPath}`);
}

// 检查 2: .env.local 配置
divider('检查2：.env.local 配置');

const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
let envContent = '';
let envVars = {};

if (fs.existsSync(envLocalPath)) {
  envContent = fs.readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      envVars[match[1]] = match[2];
    }
  });
  checkSuccess(`.env.local 文件存在`);
} else {
  checkWarning('.env.local 文件不存在，使用 npm run setup:ios-signing 创建');
}

// 检查必需的环境变量
const requiredEnvVars = [
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_ISSUER_ID',
];

console.log();
requiredEnvVars.forEach(varName => {
  if (envVars[varName]) {
    checkSuccess(`${varName} = ${varName === 'APPLE_ISSUER_ID' ? envVars[varName].substring(0, 20) + '...' : envVars[varName]}`);
  } else {
    checkWarning(`${varName} 未设置`);
  }
});

// 检查 3: eas.json 配置
divider('检查3：eas.json 配置');

const easJsonPath = path.join(APP_CLIENT_DIR, 'eas.json');
if (fs.existsSync(easJsonPath)) {
  try {
    const easConfig = JSON.parse(fs.readFileSync(easJsonPath, 'utf-8'));
    checkSuccess('eas.json 文件有效');

    // 检查 production 配置
    if (easConfig.build?.production?.ios?.distribution === 'store') {
      checkSuccess('iOS production 配置设置为 "store" 分发');
    } else {
      checkWarning('iOS production 配置未设置为 "store" 分发');
    }

    if (easConfig.build?.production?.ios?.credentialsSource === 'local') {
      checkSuccess('iOS credentials 源设置为 "local"');
    } else {
      checkWarning('iOS credentials 源未设置为 "local"');
    }

    // 检查 submit 配置
    if (easConfig.submit?.production?.ios) {
      checkSuccess('submit 配置已设置');
      const submitConfig = easConfig.submit.production.ios;
      if (submitConfig.bundleIdentifier === 'com.coinplanet.mobile') {
        checkSuccess(`Bundle Identifier: ${submitConfig.bundleIdentifier}`);
      }
    } else {
      checkWarning('submit 配置未设置');
    }
  } catch (error) {
    checkError(`eas.json 文件无效: ${error.message}`);
  }
} else {
  checkError(`eas.json 文件未找到: ${easJsonPath}`);
}

// 检查 4: app.json 配置
divider('检查4：app.json 配置');

const appJsonPath = path.join(APP_CLIENT_DIR, 'app.json');
if (fs.existsSync(appJsonPath)) {
  try {
    const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    checkSuccess('app.json 文件有效');

    const bundleId = appConfig.expo?.ios?.bundleIdentifier;
    if (bundleId === 'com.coinplanet.mobile') {
      checkSuccess(`iOS Bundle ID: ${bundleId}`);
    } else {
      checkWarning(`iOS Bundle ID: ${bundleId}（期望: com.coinplanet.mobile）`);
    }

    if (appConfig.expo?.eas?.projectId) {
      checkSuccess(`EAS Project ID: ${appConfig.expo.eas.projectId}`);
    } else {
      checkWarning('EAS Project ID 未设置');
    }
  } catch (error) {
    checkError(`app.json 文件无效: ${error.message}`);
  }
} else {
  checkError(`app.json 文件未找到: ${appJsonPath}`);
}

// 检查 5: EAS CLI 安装
divider('检查5：EAS CLI 安装');

try {
  const version = execSync('npx eas --version', { encoding: 'utf-8' }).trim();
  checkSuccess(`EAS CLI 已安装: ${version}`);
} catch (error) {
  checkError('EAS CLI 未安装或无法执行');
}

// 检查 6: EAS 凭证存储状态
divider('检查6：EAS 凭证存储');

try {
  process.chdir(APP_CLIENT_DIR);
  const credentials = execSync('npx eas credentials --non-interactive --list 2>/dev/null || true', {
    encoding: 'utf-8',
  });

  if (credentials.includes('iOS') && credentials.includes('App Store')) {
    checkSuccess('EAS 凭证存储已初始化');
  } else {
    checkWarning('EAS iOS App Store 凭证未找到');
    console.log('运行以下命令初始化：npm run setup:ios-signing');
  }
} catch (error) {
  checkWarning('无法检查 EAS 凭证存储状态');
}

// 总结
divider('检查结果总结');

if (hasErrors) {
  console.log('\n❌ 检查失败，存在错误需要修复');
  console.log('\n建议操作：');
  console.log('1. 运行 npm run setup:ios-signing 初始化配置');
  console.log('2. 查看 IOS_SIGNING_SETUP_GUIDE.md 获取详细说明');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  检查完成，存在一些警告');
  console.log('\n建议操作：');
  console.log('1. 运行 npm run setup:ios-signing 确保配置完整');
  console.log('2. 查看 IOS_SIGNING_SETUP_GUIDE.md 获取详细说明');
  process.exit(0);
} else {
  console.log('\n✅ 所有检查通过！');
  console.log('\n下一步操作：');
  console.log('1. 运行 npm run eas:build:ios 构建 iOS 应用');
  console.log('2. 构建完成后运行 npm run eas:submit:ios 提交到 App Store');
  process.exit(0);
}
