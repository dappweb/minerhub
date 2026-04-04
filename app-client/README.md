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

## 环境变量（链上联调）

在启动前配置 Expo 公共变量（可写入系统环境或 `.env`）：

- `EXPO_PUBLIC_API_BASE_URL`：后端 API 地址（本地默认 `http://127.0.0.1:8788`）
- `EXPO_PUBLIC_CHAIN_ID`：链 ID（Sepolia 为 `11155111`）
- `EXPO_PUBLIC_RPC_URL`：RPC 地址
- `EXPO_PUBLIC_MINING_POOL_ADDRESS`：MiningPool 合约地址
- `EXPO_PUBLIC_SWAP_ROUTER_ADDRESS`：SwapRouter 合约地址
- `EXPO_PUBLIC_WALLET_PRIVATE_KEY`：测试钱包私钥（仅测试网）

当前 App 已支持：

- 读取私钥钱包地址并创建后端用户
- 链上 `registerMiner`
- 链上 `claimReward`
- 链上 `swapMmToUsdt`

## 工程结构

- `src/App.tsx`：移动端首页（钱包连接、挖矿入口）
- `app.json`：Expo 平台与包名配置
- `package.json`：双端脚本与依赖

## 下一步建议

- 接入 WalletConnect 或 App 内钱包签名
- 对接链上 `startMining` / `claimRewards` / `swap`
- 增加设备性能与电量策略控制
