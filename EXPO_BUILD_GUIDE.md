# Expo 应用下载集成指南

本指南说明如何将 Expo 打包的应用下载链接集成到网页下载页面。

## 📱 功能概述

- ✅ 双平台下载支持（Android / iOS）
- ✅ 动态下载链接配置（环境变量）
- ✅ 二维码快速扫码下载
- ✅ 平台系统要求显示
- ✅ 下载状态监控

## 🔧 配置步骤

### 1. 通过 Expo EAS Build 打包应用

#### 安装 EAS CLI

```bash
npm install -g eas-cli
```

#### 初始化 EAS 项目（在 app-client 目录）

```bash
cd app-client
eas init
```

#### 构建 Android APK

```bash
# 生成测试 APK（无需发布到 Play Store）
eas build --platform android --type apk

# 查看构建状态和下载链接
eas build:list

# 直接下载 APK
eas build:download --id <BUILD_ID> --path ./coin-planet.apk
```

#### 构建 iOS

```bash
# 生成 iOS 测试版（需要 Apple 开发者账户）
eas build --platform ios

# 生成 TestFlight 公测链接
eas submit --platform ios --latest
```

### 2. 配置环境变量

编辑 `.env.local` 文件，添加下载链接：

```env
# 从 EAS Build 获得的直接下载链接
VITE_ANDROID_DOWNLOAD_URL="https://eas-builds.s3.amazonaws.com/your-build-id/coin-planet.apk"

# TestFlight 公测链接或 App Store 链接
VITE_IOS_DOWNLOAD_URL="https://testflight.apple.com/join/your-testflight-id"

# 可选：生成的二维码链接
VITE_ANDROID_QR_CODE="https://eas-builds.s3.amazonaws.com/qr-codes/android.png"
VITE_IOS_QR_CODE="https://eas-builds.s3.amazonaws.com/qr-codes/ios.png"
```

## 📲 获取下载链接

### Android APK 链接（推荐直接下载）

**方式1：EAS Build 直接下载**

- 运行: `eas build --platform android --type apk`
- 完成后访问 EAS 构建页面获取直接下载链接
- 链接格式: `https://eas-builds.s3.amazonaws.com/builds/...`

**方式2：自托管 APK**

- 如果有自己的服务器，可将 APK 上传到：
  - CDN（阿里云 OSS、腾讯 COS 等）
  - 专用下载服务器
- 例如: `https://your-domain.com/downloads/coin-planet.apk`

### iOS下载链接

**方式1：TestFlight 公测链接（推荐）**

```bash
eas submit --platform ios --latest
```

- 生成链接: `https://testflight.apple.com/join/xxx`
- 优点：可邀请公测用户，收集反馈

**方式2：App Store 链接**

- App Store 上架后可使用官方链接
- 例如: `https://apps.apple.com/app/coin-planet/id123456789`

## 🎯 生成二维码

### 自动生成（推荐）

使用 QR Code API：

```
https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=YOUR_DOWNLOAD_URL
```

### 手动生成

1. 访问 [qr-code-generator.com](https://www.qr-code-generator.com)
2. 粘贴下载链接
3. 下载二维码图片
4. 上传到 CDN，获得URL
5. 配置到环境变量

### 动态生成脚本

```bash
# 使用以下脚本自动生成
node scripts/generate-qr-codes.js
```

## 🚀 部署到生产环境

### GitHub Actions 自动化（可选）

在 `.github/workflows/eas-build.yml` 中配置：

```yaml
name: EAS Build

on:
  push:
    branches: [main]
    paths: ["app-client/**"]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: |
          cd app-client
          eas build --platform android --type apk --non-interactive

      - name: Get Build Info
        run: |
          BUILD_ID=$(eas build:list --limit 1 --json | jq -r '.[0].id')
          DOWNLOAD_URL=$(eas build:list --limit 1 --json | jq -r '.[0].artifacts.buildUrl')
          echo "EXPO_DOWNLOAD_URL=$DOWNLOAD_URL" >> $GITHUB_ENV

      - name: Update env.local
        run: |
          echo "VITE_ANDROID_DOWNLOAD_URL=${{ env.EXPO_DOWNLOAD_URL }}" >> .env.local
          git add .env.local
          git commit -m "chore: update app download links"
          git push
```

### 手动发布流程

1. **构建应用**

   ```bash
   cd app-client
   eas build --platform android --type apk
   eas build --platform ios
   ```

2. **获取下载链接**

   ```bash
   eas build:list --limit 1 --json
   ```

3. **更新环境变量**

   ```bash
   # 编辑 .env.local
   VITE_ANDROID_DOWNLOAD_URL="https://..."
   VITE_IOS_DOWNLOAD_URL="https://..."
   ```

4. **重新部署网站**
   ```bash
   npm run build
   npm run deploy  # 或你的部署命令
   ```

## 📊 测试下载页面

启动本地开发服务器：

```bash
npm run dev
```

访问 `http://localhost:5173/#download`

## 🔐 安全建议

1. **使用 HTTPS**：所有下载链接必须使用 HTTPS
2. **签名验证**：Android APK 应使用配置签名

   ```bash
   jarsigner -verify -verbose -certs coin-planet.apk
   ```

3. **版本管理**：在 `app.json` 中更新版本号

   ```json
   {
     "expo": {
       "version": "1.0.1"
     }
   }
   ```

4. **更新说明**：为每个版本添加更新日志

## 🐛 故障排除

### 下载链接返回 404

- 确认 EAS Build 已完成
- 检查链接是否过期
- 重新构建应用获取新链接

### iOS 无法打开 TestFlight 链接

- 确认使用 Safari 浏览器打开（Chrome 可能不支持）
- 检查邀请链接是否过期
- 使用 Apple ID 登录

### QR 码失效

- 确认目标 URL 仍然可用
- 重新生成 QR 码
- 测试扫码后的跳转

## 📞 相关资源

- [Expo EAS Build 文档](https://docs.expo.dev/build/introduction/)
- [EAS CLI 命令参考](https://docs.expo.dev/build-reference/eas-json/)
- [TestFlight 指南](https://docs.expo.dev/build/internal-distribution/)
- [App Store 发布指南](https://docs.expo.dev/distribution/app-stores/)

## ✨ 下一步

1. ✅ 集成下载页面组件
2. ✅ 配置环境变量
3. ⭕ 通过 EAS Build 打包应用
4. ⭕ 获取下载链接
5. ⭕ 生成二维码
6. ⭕ 测试下载功能
7. ⭕ 部署到生产环境

## 📝 常见问题

**Q: 如何持续更新应用版本？**
A: 使用 GitHub Actions 实现自动化构建和发布，每次代码提交后自动打包。

**Q: 用户下载后如何更新应用？**
A: Expo 提供内置更新机制，使用 `expo-updates` 库实现 OTA（Over-The-Air）更新。

**Q: 如何统计下载次数？**
A: 配置下载链接时添加 UTM 参数或使用分析工具跟踪下载来源。

```env
VITE_ANDROID_DOWNLOAD_URL="https://your-cdn.com/coin-planet.apk?utm_source=website&utm_campaign=homepage"
```
