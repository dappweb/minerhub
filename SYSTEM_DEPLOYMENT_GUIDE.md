# Coin Planet 完整系统部署指南（3周版本）

> 完整的挖矿系统：APP客户端 + 后台API + 智能合约 + 管理平台  
> 生成于 2026-04-11 | 版本：0.1.0（MVP）

---

## 🎯 系统架构概览

```
┌──────────────────────────────────────────────────────────┐
│                    Coin Planet 完整系统                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📱 App客户端 (React Native + Expo)                      │
│  ├─ 设备ID持久化 ✅                                      │
│  ├─ 可配置算力 ✅                                        │
│  ├─ 签名认证 ✅                                          │
│  ├─ 交易状态追踪 ✅                                      │
│  └─ 断网恢复 ✅                                          │
│                                                           │
│  🔗 后台API (Cloudflare Workers)                       │
│  ├─ REST 服务 ✅                                        │
│  ├─ 签名验证中间件 ✅                                    │
│  ├─ 数据库 (D1 SQLite) ✅                               │
│  └─ CORS 配置 ✅                                        │
│                                                           │
│  ⛓️  智能合约 (Sepolia 测试网)                           │
│  ├─ SUPER Token (ERC20) ✅                              │
│  ├─ MiningPool (挖矿逻辑) ✅                            │
│  ├─ SwapRouter (AMM 兑换) ✅                            │
│  └─ USDT_Mock (测试) ✅                                 │
│                                                           │
│  🌐 管理平台 (React 18 + Vite)                          │
│  ├─ 用户钱包连接 ✅                                      │
│  ├─ 管理员后台 ✅                                        │
│  ├─ 数据展示 ✅                                          │
│  └─ 链上验证 ✅                                          │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 📋 部分一：Mobile App 配置与运行

### 要求
- Node.js 18+
- Expo CLI
- Android Studio (Android) 或 Xcode (iOS)

### 安装与运行

```bash
cd app-client

# 安装依赖
npm install

# 设置环境变量 (.env 或 .env.local)
EXPO_PUBLIC_WALLET_PRIVATE_KEY=0x...      # 测试钱包私钥
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8788
EXPO_PUBLIC_CHAIN_ID=11155111              # Sepolia
EXPO_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# 运行开发服务器
npm start

# 选择平台
# a 用 Android
# i 用 iOS
# w 用 Web 预览
```

### 核心功能

| 功能 | 状态 | 说明 |
|-----|------|------|
| 钱包连接 | ✅ | 读取本地硬编码私钥 |
| 矿工注册 | ✅ | 配置算力并提交链上交易 |
| 收益领取 | ✅ | 从 MiningPool 领取 SUPER Token |
| 兑换 | ✅ | SUPER ↔ USDT 通过 SwapRouter |
| 签名认证 | ✅ | 所有 API 请求使用钱包签名 |
| 交易追踪 | ✅ | AsyncStorage 本地历史存储 |
| 断网恢复 | ✅ | APP 重启时恢复未完成交易 |

### 主要代码位置
- UI: `app-client/src/App.tsx`
- 链交互: `app-client/src/services/blockchain.ts`
- 后台通信: `app-client/src/services/api.ts`
- 签名认证: `app-client/src/services/signature.ts`
- 交易管理: `app-client/src/hooks/useTransactionManager.ts`
- 错误处理: `app-client/src/utils/errorHandler.ts`

---

## 📋 部分二：后台 API 配置与运行

### 技术栈
- Cloudflare Workers (Serverless)
- Cloudflare D1 (SQLite Database)
- TypeScript + Viem

### 环保变量配置

创建 `backend/.env.local`：

```env
# 数据库（自动通过 wrangler.toml 配置）
# 数据库仅在 Cloudflare 部署后可用

# 链 RPC
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...

# Viem 配置
EXPO_PUBLIC_CHAIN_ID=11155111
```

### 本地开发运行

```bash
cd backend

# 安装依赖
npm install

# 运行开发服务器
npm run dev
# 访问 http://localhost:8787

# 编译 TypeScript
npm run build

# 部署到 Cloudflare
npm run deploy
```

### API 端点

**用户管理**
```
POST /api/users
  headers: { x-signature, x-nonce, x-wallet }
  body: { wallet: string }
  response: { id, wallet, email, createdAt }
```

**设备注册**
```
POST /api/devices
  headers: { x-signature, x-nonce, x-wallet }
  body: { userId, deviceId, hashrate, wallet }
  response: { id, userId, deviceId, hashrate, status }
```

**收益申报**
```
POST /api/claims
  headers: { x-signature, x-nonce, x-wallet }
  body: { userId, amount, wallet }
  response: { id, userId, amount, status, createdAt }
```

### 核心代码位置
- 入口: `backend/src/index.ts`
- 签名验证: `backend/src/lib/auth.ts`
- 用户路由: `backend/src/routes/users.ts`
- 设备路由: `backend/src/routes/devices.ts`
- 收益路由: `backend/src/routes/claims.ts`

---

## 📋 部分三：链上合约部署

### 支持的网络
- **Sepolia** (测试网，推荐)
- **Hardhat Local** (本地开发)

### 环境配置

创建 `contracts/.env`：

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
DEPLOYER_PRIVATE_KEY=0x...yourawesomedeployerkey...
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY  # 可选，用于验证
```

### 编译合约

```bash
cd contracts

# 安装依赖
npm install

# 编译
npm run compile

# 测试
npx hardhat test

# 本地部署（Hardhat）
npm run deploy:local

# 查看部署输出
cat deployment.json
```

### 部署到 Sepolia

```bash
# 部署所有合约
npm run deploy:sepolia

# 或分步部署和验证
npm run deploy:sepolia
npm run deploy:finalize
npm run verify
```

### 部署后的配置

部署完成后，`contracts/deployment.json` 会包含：

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "addresses": {
    "SUPER": "0x...",
    "USDT_Mock": "0x...",
    "MiningPool": "0x...",
    "SwapRouter": "0x..."
  },
  "deployer": "0x...",
  "blockNumber": 12345678
}
```

**将这些地址配置到 APP 环境变量中：**

```env
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SWAP_ROUTER_ADDRESS=0x...
EXPO_PUBLIC_SUPER_TOKEN_ADDRESS=0x...
```

### 核心合约位置
- SUPER Token: `contracts/contracts/SUPER.sol`
- MiningPool: `contracts/contracts/MiningPool.sol`
- SwapRouter: `contracts/contracts/SwapRouter.sol`
- USDT Mock: `contracts/contracts/USDT_Mock.sol`

---

## 📋 部分四：管理平台部署

### 技术栈
- React 18 + Vite
- Rainbow Kit (钱包连接)
- Wagmi (Web3 交互)

### 环境配置

创建 `.env.local`：

```env
VITE_OWNER_ADDRESS=0x...             # 管理员钱包
VITE_OWNER_WALLET=0x...              # 同上（备用）
VITE_ANDROID_DOWNLOAD_URL=https://...
VITE_IOS_DOWNLOAD_URL=https://...
VITE_API_BASE_URL=http://localhost:8787  # 后台API
```

### 本地运行

```bash
cd . (根目录)

# 安装依赖
npm install

# 运行开发服务器
npm run dev
# 访问 http://localhost:5173

# 编译生产版
npm run build
# 输出到 dist/

# 部署到 Cloudflare Pages
npm run deploy:pages
```

### 管理平台功能

| 页面 | 功能 |
|-----|------|
| **Hero** | 产品介绍 + APP 下载链接 |
| **Features** | 平台特性展示 |
| **Economics** | 代币经济学模型 |
| **Flow** | 用户流程演示 |
| **Architecture** | 系统架构 |
| **Admin Dashboard** | 管理员后台 |
| **Roadmap** | 开发路线图 |

### 管理员后台功能

1. **钱包登录**：连接钱包并签名验证
2. **设备管理**：查看所有注册设备
3. **用户统计**：总用户数、活跃度
4. **合约交互**：直接在后台调用智能合约
5. **数据分析**：挖矿收益、兑换量统计

### 核心代码位置
- App: `src/App.tsx`
- 管理后台: `src/components/AdminDashboard.tsx`
- 区块链交互: `src/lib/blockchain.ts`
- 钱包配置: `src/lib/wallet.ts` 或主文件

---

## 🚀 快速启动（完整系统）

### 方式一：本地开发（推荐新手）

**第1步：启动后台 API**
```bash
cd backend
npm install
npm run dev
# 监听 http://localhost:8787
```

**第2步：部署合约到本地 Hardhat**
```bash
cd contracts
npm install
npm run deploy:local
# 记录 deployment.json 中的地址
```

**第3步：配置 APP 环境**
```bash
cd app-client
cp .env.example .env.local
# 编辑 .env.local，填入合约地址和后台 URL
```

**第4步：运行 APP**
```bash
cd app-client
npm install
npm start
# 选择 a（Android）或 i（iOS）或 w（Web）
```

**第5步：运行管理平台**
```bash
# 回到根目录
npm install
npm run dev
# 访问 http://localhost:5173
```

### 方式二：部署到 Sepolia 测试网

```bash
# 1. 部署合约
cd contracts
npm run deploy:sepolia

# 2. 更新 APP 环境变量
# 填入 Sepolia 合约地址

# 3. 部署后端
cd backend
npm run deploy

# 4. 部署官网
npm run build
npm run deploy:pages
```

---

## 📊 功能完成度

### Week 1 - P0 基础功能 ✅
- [x] 设备标识持久化
- [x] 可配置算力
- [x] 交易防重复
- [x] 价格读取
- [x] TypeScript 类型系统

### Week 2 - P1 可靠性 ✅
- [x] 签名认证系统
- [x] 交易状态管理
- [x] 断网恢复机制
- [x] 错误分类处理
- [x] Nonce 防重放

### Week 3 - P2 完整性 ✅
- [x] 官网/管理平台
- [x] 链上合约完整
- [x] 后台数据库设计
- [x] 完整部署指南
- [x] 系统集成文档

---

## 🔐 安全性注意事项

### ⚠️ 当前限制（MVP 版本）
1. **私钥在客户端**：当前 APP 使用硬编码私钥（有风险）
   - ✅ 待改进：迁移至 WalletConnect 或钱包授权服务
2. **Nonce 存储在内存**：重启 Workers 会重置
   - ✅ 待改进：使用 Cloudflare KV 持久化

### ✅ 已实现的安全措施
- 钱包签名验证所有 API 请求
- Nonce 防重放攻击
- 链上合约原子性保证
- 设备 ID 唯一性追踪

---

## 📝 常见问题

**Q: APP 如何获取 Sepolia ETH？**  
A: 访问 https://sepolia-faucet.pk910.de/ 或其他 Sepolia 水龙头申请测试币

**Q: 如何修改 MiningPool 的收益率？**  
A: 在 `contracts/contracts/MiningPool.sol` 中修改 `rewardRate` 参数后重新部署

**Q: 管理平台无法连接后端？**  
A: 检查 `VITE_API_BASE_URL` 环境变量和后端是否运行

**Q: 签名验证总是失败？**  
A: 确保前端签名消息格式与后端验证一致：`coinplanet|{nonce}|{path}|{payload}`

---

## 📞 技术支持

遇到问题？检查以下内容：

1. **环境变量**：确保所有 `.env` 文件配置正确
2. **依赖安装**：`npm install` 后推荐 `npm ci` 保证版本一致
3. **TypeScript 编译**：`npx tsc --noEmit` 无错误
4. **日志输出**：查看控制台错误信息
5. **合约地址**：确认地址已配置到环境变量

---

## 📦 项目结构

```
minerhub/
├── app-client/                 # React Native + Expo 移动应用
│   ├── src/
│   │   ├── App.tsx            # 主 UI 组件
│   │   ├── services/          # API 和链交互服务
│   │   ├── hooks/             # React hooks (交易管理)
│   │   └── utils/             # 工具 (错误处理)
│   └── package.json
├── backend/                    # Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts           # 路由入口
│   │   ├── lib/               # 签名验证等
│   │   ├── routes/            # API 路由处理
│   │   └── types/             # TypeScript 类型
│   ├── db/schema.sql          # 数据库 schema
│   └── wrangler.toml          # Cloudflare 配置
├── contracts/                 # Hardhat Solidity 合约
│   ├── contracts/             # 合约源码
│   ├── scripts/               # 部署脚本
│   ├── test/                  # 合约测试
│   └── hardhat.config.ts      # Hardhat 配置
├── src/                       # React 官网 + 管理平台
│   ├── App.tsx               # 主应用
│   ├── components/           # React 组件
│   ├── lib/                  # 工具库
│   └── styles/               # CSS
├── docs/                      # 文档
└── README.md                  # 项目说明
```

---

**版本信息**  
- **Date**: 2026-04-11
- **Status**: MVP (Minimum Viable Product)
- **Testnet**: Ethereum Sepolia (11155111)
- **Compatibility**: Node.js 18+, Expo SDK 52+
