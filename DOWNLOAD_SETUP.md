# 应用下载功能集成指南

本文档说明如何将 Expo 打包的应用下载链接集成到网页下载页面。

## 🎯 功能亮点

- ✅ **双平台支持**：Android / iOS 一键下载
- ✅ **动态链接配置**：环境变量管理，无需修改代码
- ✅ **二维码扫码**：快速分享和下载
- ✅ **自动化脚本**：一键获取 EAS Build 链接
- ✅ **响应式设计**：完美适配各种设备

## 🚀 快速开始

### 步骤 1：构建应用

```bash
cd app-client

# 构建 Android APK
eas build --platform android --type apk

# 构建 iOS
eas build --platform ios

# 或者查看已有的构建
eas build:list
```

### 步骤 2：获取下载链接

#### 方式 A：自动获取（推荐）

```bash
# 自动从 EAS Build 获取最新构建链接
npm run sync-eas-links

# 这会自动更新 .env.local 中的:
# - VITE_ANDROID_DOWNLOAD_URL
# - VITE_IOS_DOWNLOAD_URL
```

#### 方式 B：手动配置

编辑 `.env.local`：

```env
# Android APK 下载链接
VITE_ANDROID_DOWNLOAD_URL="https://eas-builds.s3.amazonaws.com/your-build/coin-planet.apk"

# iOS TestFlight 链接
VITE_IOS_DOWNLOAD_URL="https://testflight.apple.com/join/your-testflight-id"
```

### 步骤 3：生成二维码（可选）

```bash
npm run generate-qr-codes "https://your-android-url" "https://your-ios-url"

# 这会:
# 1. 生成二维码图片
# 2. 保存到 public/qr-codes/
# 3. 自动更新 .env.local 中的 QR 码 URL
```

### 步骤 4：启动开发服务器

```bash
npm run dev

# 访问 http://localhost:3000/#download 查看下载页面
```

## 📱 下载页面功能

访问 `http://your-domain.com/#download` 查看：

- **平台选择**：Android / iOS 切换
- **下载按钮**：直接跳转到下载链接
- **二维码**：扫码快速分享
- **系统要求**：显示最低系统版本和文件大小
- **帮助信息**：下载常见问题解答

## 🔧 环境变量配置

### 必需变量

```env
# Android 应用下载 URL
# 支持 APK 直接链接或应用市场链接
VITE_ANDROID_DOWNLOAD_URL="https://your-cdn.com/coin-planet.apk"

# iOS 应用下载 URL
# 支持 TestFlight 或 App Store 链接
VITE_IOS_DOWNLOAD_URL="https://testflight.apple.com/join/xxx"
```

### 可选变量

```env
# Android QR 码图片 URL
VITE_ANDROID_QR_CODE="https://your-cdn.com/qr-codes/android.png"

# iOS QR 码图片 URL
VITE_IOS_QR_CODE="https://your-cdn.com/qr-codes/ios.png"
```

## 📊 获取下载链接的详细步骤

### Android APK

**从 EAS Build 直接获取：**

```bash
cd app-client

# 1. 构建 APK
eas build --platform android --type apk

# 2. 查看构建列表
eas build:list --limit 5

# 3. 从输出中复制 artifacts.buildUrl
# 例如: https://eas-builds.s3.amazonaws.com/builds/xxxxxxxx.apk
```

**自托管 APK：**

```bash
# 1. 下载本地构建
eas build:download --id <BUILD_ID> --path ./coin-planet.apk

# 2. 上传到你的 CDN/服务器
# - 阿里云 OSS
# - 腾讯 COS
# - AWS S3
# - 自建服务器
# - CloudFlare R2

# 3. 获取公开下载链接
# 例如: https://your-domain.com/downloads/coin-planet.apk
```

### iOS 应用

**生成 TestFlight 公测链接：**

```bash
cd app-client

# 1. 构建 iOS（需要 Apple 开发者账户）
eas build --platform ios

# 2. 提交到 TestFlight
eas submit --platform ios --latest

# 3. 复制生成的 TestFlight 公测链接
# 例如: https://testflight.apple.com/join/xxxxxxxx
```

**上线 App Store：**

```bash
# 1. 完成 TestFlight 测试后
eas submit --platform ios --latest

# 2. 在 App Store Connect 中审核和发布

# 3. 获取 App Store 链接
# 例如: https://apps.apple.com/app/coin-planet/id1234567890
```

## 💡 实用命令

### 查看所有已构建的版本

```bash
eas build:list --limit 10 --json | jq '.[].{id,platform,buildType,status,createdAt}'
```

### 快速查询最新 Android 构建

```bash
eas build:list --platform android --limit 1 --json | jq '.[0].artifacts.buildUrl'
```

### 生成二维码并更新配置

```bash
# 一步到位
ANDROID_URL="https://your-android-url"
IOS_URL="https://your-ios-url"
npm run generate-qr-codes "$ANDROID_URL" "$IOS_URL"
```

## 🔐 安全建议

### 链接可靠性

```bash
# 测试链接是否可达
curl -I https://your-download-url.apk

# 验证 APK 签名
jarsigner -verify -verbose -certs coin-planet.apk
```

### 版本管理

在 `app-client/app.json` 中维护版本号：

```json
{
  "expo": {
    "version": "1.0.1",
    "runtimeVersion": "1.0.1"
  }
}
```

### 使用 HTTPS

所有下载链接必须使用 HTTPS：

```env
# ✅ 正确
VITE_ANDROID_DOWNLOAD_URL="https://secure.cdn.com/app.apk"

# ❌ 错误
VITE_ANDROID_DOWNLOAD_URL="http://insecure.com/app.apk"
```

## 📈 监控和分析

### 统计下载次数

在下载链接中添加 UTM 参数：

```env
VITE_ANDROID_DOWNLOAD_URL="https://your-cdn.com/app.apk?utm_source=website&utm_campaign=homepage&utm_medium=button"
```

### 使用分析服务

配置 Google Analytics 或其他分析工具跟踪下载点击。

## 🐛 常见问题

### Q: 如何持续更新应用？

**A:** 使用 Expo Updates 进行 OTA 更新

```bash
npm install expo-updates
```

在应用中集成：

```typescript
import * as Updates from "expo-updates";

// 检查更新
async function checkForUpdates() {
  const update = await Updates.checkAsync();
  if (update.isAvailable) {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  }
}
```

### Q: Android 下载后无法安装

**A:** 确保用户已启用"未知来源"权限

在下载页面已有相关提示。

### Q: iOS 提示"不受信任的开发者"

**A:** 这是 TestFlight 公测的正常现象

用户需要：

1. 打开 TestFlight 应用
2. 点击接受邀请
3. 长按应用图标
4. 选择"打开"

### Q: 二维码无法扫描

**A:** 确认以下几点

```bash
# 1. 检查二维码图片是否存在
ls -la public/qr-codes/

# 2. 测试二维码 URL
curl -I https://your-cdn.com/qr-codes/android.png

# 3. 重新生成二维码
npm run generate-qr-codes "$ANDROID_URL" "$IOS_URL"
```

### Q: 如何替换应用icon和启动画面

**A:** 编辑 `app-client/app.json`

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png"
    }
  }
}
```

## 🔄 CI/CD 集成

### GitHub Actions 自动化

创建 `.github/workflows/eas-build-and-deploy.yml`：

```yaml
name: Auto Build & Deploy

on:
  push:
    branches: [main]
    paths: ["app-client/**"]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: cd app-client && eas build --platform android --type apk --non-interactive

      - name: Sync EAS Links
        run: npm run sync-eas-links

      - name: Generate QR Codes
        run: |
          ANDROID_URL=$(grep VITE_ANDROID_DOWNLOAD_URL .env.local | cut -d'=' -f2 | tr -d '"')
          IOS_URL=$(grep VITE_IOS_DOWNLOAD_URL .env.local | cut -d'=' -f2 | tr -d '"')
          npm run generate-qr-codes "$ANDROID_URL" "$IOS_URL"

      - name: Deploy Website
        run: npm run deploy:cf
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Commit Changes
        run: |
          git config user.name "CI Bot"
          git config user.email "ci@example.com"
          git add .env.local public/qr-codes/
          git commit -m "chore: update app download links" || true
          git push
```

## 📚 相关文档

- [详细 Expo Build 指南](./EXPO_BUILD_GUIDE.md)
- [Expo EAS Build 官方文档](https://docs.expo.dev/build/)
- [TestFlight 发布指南](https://docs.expo.dev/build/internal-distribution/)
- [App Store 发布指南](https://docs.expo.dev/distribution/app-stores/)

## ✨ 下一步

1. ✅ 查看下载页面：`http://localhost:3000/#download`
2. ⭕ 通过 EAS Build 打包应用
3. ⭕ 获取下载链接并配置到 `.env.local`
4. ⭕ 生成二维码
5. ⭕ 测试下载功能
6. ⭕ 部署到生产环境

## 🤝 支持

如果遇到问题，请查看：

- [Expo 文档](https://docs.expo.dev/)
- [EAS CLI 参考](https://docs.expo.dev/build-reference/eas-cli/)
- [项目 Issues](../../issues)
