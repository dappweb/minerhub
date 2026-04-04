# MinerHub

MinerHub 是一个包含三端视图的 Web 项目：

- 项目网站（官网展示）
- 后台管理系统
- 挖矿 App（钱包连接、链上挖矿、链上兑换）

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
