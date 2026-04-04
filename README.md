# MinerHub

MinerHub 是一个包含三端视图的 Web 项目：

- 项目网站（官网展示）
- 后台管理系统
- 挖矿 App（钱包连接、链上挖矿、链上兑换）

当前官网已增加：

- 钱包登录进入后台管理系统入口
- Android / iOS 挖矿 App 下载入口
- 双端客户端工程（React Native Expo）：`app-client/`

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env.local
```

3. 配置合约地址与链参数

- `VITE_CHAIN_ID`
- `VITE_RPC_URL`
- `VITE_MINER_CONTRACT_ADDRESS`
- `VITE_SWAP_CONTRACT_ADDRESS`
- `VITE_ANDROID_DOWNLOAD_URL`
- `VITE_IOS_DOWNLOAD_URL`

4. 启动开发环境

```bash
npm run dev
```

## 区块链挖矿功能

前端已接入钱包与合约调用：

- 挖矿 App 页面：
   - 连接钱包
   - 调用 `startMining()` 开始链上挖矿
   - 调用 `claimRewards()` 领取收益
- DApp Swap 页面：
   - 调用 `swapMmToUsdt(uint256)` 完成链上兑换

对应代码在 `src/lib/blockchain.ts`。

## 部署到 Cloudflare Pages

### 方式一：Cloudflare Dashboard

- Build command: `npm run build`
- Build output directory: `dist`

### 方式二：Wrangler CLI

1. 登录 Cloudflare

```bash
npx wrangler login
```

2. 部署

```bash
npm run deploy:cf
```

`wrangler.toml` 已包含基础配置，适用于当前静态站点部署。

## App 客户端（双端兼容）

`app-client/` 已调整为 React Native Expo 工程，支持 Android 与 iOS。

```bash
cd app-client
npm install
npm run start
```

- Android 调试：`npm run android`
- iOS 调试：`npm run ios`
