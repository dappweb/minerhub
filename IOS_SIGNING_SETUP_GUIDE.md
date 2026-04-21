# iOS App Store Connect 签名配置指南

本指南说明如何配置 EAS Build 使用 Apple App Store Connect API 密钥进行 iOS 应用签名和发布。

## 前置条件

- ✅ Apple Developer Account（已创建）
- ✅ App Store Connect 账户
- ✅ 已上传的私钥文件：`AuthKey_76553GW25U.p8`
- 📋 需要获取的信息（见第2步）

## 第1步：准备 Apple App Store Connect API 凭证

### 1.1 登录 App Store Connect

访问 [App Store Connect - Users and Access](https://appstoreconnect.apple.com/access/users)

### 1.2 获取 Team ID

1. 点击 "Users and Access" → 选择你的账户
2. 复制右上角的 **Team ID**（格式如：`ABC123DEFG`）
3. 记录此 ID 供后续使用

### 1.3 获取 Issuer ID 和 Key ID

1. 在 App Store Connect 中导航到 "Users and Access" → "Keys"
2. 找到或创建新的 API Key（需要 "Admin" 权限）
3. 复制 **Issuer ID**（格式如：`12345678-1234-1234-1234-123456789012`）
4. 记录 **Key ID**（即文件名中的部分：`76553GW25U`）

### 1.4 验证私钥文件

私钥文件 `AuthKey_76553GW25U.p8` 应该包含 Apple 生成的 EC 私钥：

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
-----END PRIVATE KEY-----
```

## 第2步：配置环境变量

### 2.1 创建或编辑 `.env.local` 文件

在项目根目录创建 `.env.local`，添加以下变量：

```env
# Apple App Store Connect API 配置
APPLE_TEAM_ID=ABC123DEFG                    # 从 App Store Connect 获取
APPLE_KEY_ID=76553GW25U                     # 私钥文件名中的 ID
APPLE_ISSUER_ID=12345678-1234-1234-1234-123456789012  # 从 API Keys 页面获取

# EAS Build 配置
EAS_BUILD_EXECUTION_CONTEXT=eas-cli         # 用于 EAS CLI 识别
```

### 2.2 将私钥上传到 EAS 凭证存储

运行以下命令将私钥注册到 EAS：

```bash
cd app-client
eas credentials
```

按照提示：

1. 选择 "iOS" 平台
2. 选择 "App Store Connect API Key"
3. 选择 "Create new" 或选择现有密钥
4. 当提示上传私钥时，选择 `AuthKey_76553GW25U.p8` 文件
5. 确认 Key ID: `76553GW25U`
6. 确认 Issuer ID: 粘贴从 App Store Connect 获取的 Issuer ID
7. 确认 Team ID: 粘贴从 App Store Connect 获取的 Team ID

EAS 将加密并存储此凭证。

## 第3步：更新 EAS 配置文件

编辑 `app-client/eas.json`，在生产构建中添加 iOS App Store 签名配置：

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "channel": "production",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "distribution": "store",
        "credentialsSource": "local"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$APPLE_ID",
        "appleIdPassword": "@keychain:APPLE_ID_PASSWORD",
        "teamId": "$APPLE_TEAM_ID",
        "bundleIdentifier": "com.coinplanet.mobile"
      }
    }
  }
}
```

## 第4步：构建生产 iOS 应用

### 4.1 构建 iOS App Bundle（IPA）

```bash
cd app-client

# 构建生产版本 - EAS 将自动使用存储的 App Store Connect API 密钥
eas build --platform ios --profile production

# 或针对特定设备构建（例如模拟器测试）
eas build --platform ios --profile preview
```

### 4.2 上传到 App Store Connect

EAS 可以自动提交到 App Store：

```bash
# 先构建并获取 IPA 文件 URL
eas build --platform ios --profile production

# 然后使用 submit 命令（需要 Apple ID 凭证）
eas submit --platform ios --latest
```

## 第5步：TestFlight 分发（可选）

### 5.1 自动提交到 TestFlight

更新 `eas.json` 添加 TestFlight 配置：

```json
"submit": {
  "production": {
    "ios": {
      ...
      "testflightTrackId": 1  // 提交到主 TestFlight 轨道
    }
  }
}
```

### 5.2 手动管理 TestFlight

如果不使用 EAS 提交，可以：

1. 从 EAS 下载构建的 IPA
2. 在 Xcode 中打开 Organizer
3. 选择应用 → 上传到 App Store
4. 在 App Store Connect 中管理 TestFlight 版本

## 第6步：持续集成（CI/CD）集成

### 6.1 GitHub Actions 示例

创建 `.github/workflows/ios-build.yml`：

```yaml
name: Build and Submit iOS App

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  APPLE_KEY_ID: ${{ secrets.APPLE_KEY_ID }}
  APPLE_ISSUER_ID: ${{ secrets.APPLE_ISSUER_ID }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd app-client && npm install
      
      - name: Build iOS with EAS
        run: |
          npm install -g eas-cli
          eas build --platform ios --profile production
        env:
          EAS_TOKEN: ${{ secrets.EAS_TOKEN }}
```

**重要**：在 GitHub Secrets 中添加：
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_ISSUER_ID`
- `EAS_TOKEN`（从 EAS CLI 生成）

## 故障排除

### 问题 1：EAS 找不到凭证

**解决方案**：
```bash
cd app-client
eas credentials --platform ios
# 重新上传或验证凭证
```

### 问题 2：签名失败

确保：
1. 私钥文件格式正确（EC 密钥，PKCS#8）
2. Bundle ID 与 App Store Connect 中注册的一致：`com.coinplanet.mobile`
3. Team ID 正确
4. Key ID 匹配私钥文件名

### 问题 3：App Store 提交被拒

最常见原因：
- 隐私政策链接缺失或无效
- 应用描述与功能不符
- 需要医疗/财务披露（如适用）

## 后续步骤

1. ✅ 运行 `eas build --platform ios --profile production` 测试构建
2. ✅ 配置首页 iOS 下载链接（使用 EAS 返回的公共 IPA URL）
3. ✅ 设置 TestFlight 邀请规则
4. ✅ 在 App Store Connect 中配置应用审核信息
5. ✅ 提交 App Store 审核

## 相关文件

- `app-client/eas.json` - EAS Build 配置
- `app-client/app.json` - Expo 应用配置
- `.env.local` - 本地环境变量（不提交到 git）
- `AuthKey_76553GW25U.p8` - Apple App Store Connect API 私钥

## 参考链接

- [Expo EAS Build 文档](https://docs.expo.dev/eas-update/introduction/)
- [App Store Connect API 文档](https://developer.apple.com/app-store-connect/api/)
- [EAS 凭证管理](https://docs.expo.dev/app-signing/managed-credentials/)
