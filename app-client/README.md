# MinerHub Mobile Client

这是 MinerHub 的双端移动客户端工程，技术栈为 React Native + Expo，兼容 Android 与 iOS。

## 启动方式

```bash
npm install
npm run start
```

## 运行到设备

- Android：`npm run android`
- iOS：`npm run ios`
- Web 预览：`npm run web`

## 工程结构

- `src/App.tsx`：移动端首页（钱包连接、挖矿入口）
- `app.json`：Expo 平台与包名配置
- `package.json`：双端脚本与依赖

## 下一步建议

- 接入 WalletConnect 或 App 内钱包签名
- 对接链上 `startMining` / `claimRewards` / `swap`
- 增加设备性能与电量策略控制
