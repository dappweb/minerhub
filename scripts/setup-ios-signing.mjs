#!/usr/bin/env node

/**
 * iOS App Store Connect 签名设置脚本
 * 
 * 使用方法：
 * npm run setup:ios-signing
 * 
 * 此脚本将：
 * 1. 验证 Apple 私钥文件
 * 2. 将凭证注册到 EAS
 * 3. 更新 .env.local 配置
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const PROJECT_ROOT = path.dirname(path.dirname(process.cwd()));
const APP_CLIENT_DIR = process.cwd();
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, '.env.local');
const PRIVATE_KEY_PATH = path.join(PROJECT_ROOT, 'AuthKey_76553GW25U.p8');
const SETUP_GUIDE = path.join(PROJECT_ROOT, 'IOS_SIGNING_SETUP_GUIDE.md');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function main() {
  console.log('🍎 iOS App Store Connect 签名配置脚本\n');

  // 1. 检查私钥文件
  console.log('📋 第1步：验证私钥文件...');
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`❌ 错误：私钥文件未找到：${PRIVATE_KEY_PATH}`);
    console.log(`\n请确保文件 AuthKey_76553GW25U.p8 位于项目根目录：${PROJECT_ROOT}`);
    process.exit(1);
  }

  const keyContent = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  if (!keyContent.includes('BEGIN PRIVATE KEY') || !keyContent.includes('END PRIVATE KEY')) {
    console.error('❌ 错误：私钥文件格式不正确');
    process.exit(1);
  }
  console.log('✅ 私钥文件有效\n');

  // 2. 获取 Apple 凭证信息
  console.log('📋 第2步：获取 Apple App Store Connect 凭证信息\n');
  console.log('请访问 https://appstoreconnect.apple.com/access/users 获取以下信息：');
  console.log('- Team ID: 在右上角的账户菜单中');
  console.log('- Issuer ID & Key ID: 在 "Users and Access" → "Keys" 中\n');

  const teamId = await question('请输入 Apple Team ID (例如 ABC123DEFG): ');
  const issuerId = await question('请输入 Apple Issuer ID (例如 12345678-1234-1234-1234-123456789012): ');
  const keyId = await question('请输入 Key ID (默认 76553GW25U) [按回车使用默认值]: ') || '76553GW25U';

  // 验证输入
  if (!teamId || !issuerId) {
    console.error('❌ Team ID 和 Issuer ID 不能为空');
    process.exit(1);
  }

  console.log();
  console.log('✅ 获取凭证信息：');
  console.log(`   - Team ID: ${teamId}`);
  console.log(`   - Issuer ID: ${issuerId}`);
  console.log(`   - Key ID: ${keyId}\n`);

  // 3. 更新 .env.local
  console.log('📋 第3步：更新 .env.local 文件...');
  let envContent = '';
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
  }

  const envUpdates = {
    'APPLE_TEAM_ID': teamId,
    'APPLE_KEY_ID': keyId,
    'APPLE_ISSUER_ID': issuerId,
    'EAS_BUILD_EXECUTION_CONTEXT': 'eas-cli',
  };

  let newEnvContent = envContent;
  for (const [key, value] of Object.entries(envUpdates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(newEnvContent)) {
      newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
    } else {
      newEnvContent += (newEnvContent ? '\n' : '') + `${key}=${value}`;
    }
  }

  fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent, 'utf-8');
  console.log(`✅ 已更新 .env.local\n`);

  // 4. 提示用户使用 EAS CLI
  console.log('📋 第4步：使用 EAS CLI 注册凭证...\n');
  console.log('现在需要运行 EAS CLI 来注册 App Store Connect API 密钥。');
  console.log('执行以下命令：\n');
  console.log('  cd app-client');
  console.log('  npx eas credentials\n');
  console.log('按照提示：');
  console.log('  1. 选择 "iOS" 平台');
  console.log('  2. 选择 "App Store Connect API Key"');
  console.log('  3. 上传私钥文件：AuthKey_76553GW25U.p8');
  console.log('  4. 输入 Team ID, Key ID 和 Issuer ID（从 .env.local 复制）\n');

  const continueSetup = await question('现在是否运行 EAS CLI 凭证设置？(y/n) [n]: ') || 'n';
  
  if (continueSetup.toLowerCase() === 'y') {
    try {
      console.log('\n🚀 启动 EAS credentials CLI...\n');
      execSync('npx eas credentials', {
        cwd: APP_CLIENT_DIR,
        stdio: 'inherit',
        env: {
          ...process.env,
          ...envUpdates,
        },
      });
      console.log('\n✅ EAS 凭证已注册\n');
    } catch (error) {
      console.error('❌ EAS CLI 执行失败');
      console.log('请手动运行：cd app-client && npx eas credentials');
    }
  } else {
    console.log('\n⏭️  跳过 EAS CLI，稍后手动运行。');
  }

  // 5. 显示后续步骤
  console.log('📋 第5步：后续步骤\n');
  console.log('✅ 已完成的配置：');
  console.log('  - .env.local 已更新 Apple 凭证');
  console.log('  - eas.json 已配置为使用本地凭证\n');

  console.log('📚 详细说明请查看：IOS_SIGNING_SETUP_GUIDE.md\n');

  console.log('🎯 后续操作：\n');
  console.log('  1. 如未运行 EAS CLI，请运行：cd app-client && npx eas credentials');
  console.log('  2. 测试构建：eas build --platform ios --profile production');
  console.log('  3. 构建完成后上传到 App Store：eas submit --platform ios --latest\n');

  console.log('✨ iOS 签名配置已初始化！\n');

  rl.close();
}

main().catch((error) => {
  console.error('❌ 错误：', error.message);
  process.exit(1);
});
