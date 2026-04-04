# MinerHub 完整实现计划（Sepolia + Cloudflare）

> 基于 Ethereum Sepolia 测试网 + Cloudflare基础设施的端到端实现方案  
> 生成时间：2026-04-04 | 目标完成：2026-05-26（Sepolia测网验证）

---

## 1. 项目架构总体设计

### 1.1 系统拓扑图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MinerHub 完整系统                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    用户端 (官网 + APP)                       │  │
│  │  • 官网 (React 18 + Vite)                                   │  │
│  │  • 移动APP (React Native + Expo)                            │  │
│  │  • 钱包集成 (WalletConnect + Viem)                          │  │
│  └───────────┬──────────────────────────────────────────┬──────┘  │
│              │                                          │          │
│              ▼                                          ▼          │
│  ┌──────────────────────────┐            ┌──────────────────────┐ │
│  │  Cloudflare Workers      │            │  Sepolia RPC         │ │
│  │  (API Gateway)           │            │  (Infura/Alchemy)    │ │
│  └──────────────┬───────────┘            └──────────────────────┘ │
│                 │                                 ▲                 │
│                 │                                 │                 │
│  ┌──────────────▼─────────────────────────────────┴──────────────┐ │
│  │         后台应用 (Node.js + Cloudflare)                       │ │
│  │  ┌────────────────────────────────────────────────────────┐  │ │
│  │  │  REST API 服务                                         │  │ │
│  │  │  • /api/users/* (用户管理)                             │  │ │
│  │  │  • /api/devices/* (矿机管理)                           │  │ │
│  │  │  • /api/claims/* (收益管理)                            │  │ │
│  │  │  • /api/risk/* (风控系统)                              │  │ │
│  │  │  • /api/finance/* (财务报表)                           │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  │  ┌────────────────────────────────────────────────────────┐  │ │
│  │  │  数据存储 & 缓存                                        │  │ │
│  │  │  • Cloudflare KV (会话、缓存)                          │  │ │
│  │  │  • Cloudflare D1 (SQLite 数据库)                       │  │ │
│  │  │  • Supabase PostgreSQL (可选)                         │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  └──────────────┬──────────────────────────────────────┬───────┘ │
│                 │                                      │           │
│  ┌──────────────▼────────────────────────────────────────────┐   │
│  │         区块链层 (Sepolia Test Network)                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐│   │
│  │  │ MM Token     │  │ Mining Pool  │  │ Swap Router   ││   │
│  │  │ (ERC20)      │  │ (挖矿逻辑)    │  │ (AMM)         ││   │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘│   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐│   │
│  │  │Admin Control │  │ USDT Mock    │  │ TimeLock      ││   │
│  │  │(多签治理)     │  │(ERC20测试币)│  │(时间锁)       ││   │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                     │
│  部署：Sepolia 测试网 (chainId: 11155111)                         │
│  RPC: https://sepolia.infura.io/v3/{KEY}                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈与依赖

### 2.1 前端 (已有基础)

```
src/
├── components/
│   ├── Hero.tsx                 ✅ 已有
│   ├── AppPreview.tsx           ✅ 已有
│   ├── DappSwap.tsx             ✅ 已有
│   ├── AdminDashboard.tsx       ✅ 已有
│   └── ...
├── lib/
│   ├── blockchain.ts            ⚠️ 需要完善 (真实合约集成)
│   ├── viem-config.ts           🆕 需要 (Viem 客户端配置)
│   └── api-client.ts            🆕 需要 (后台API调用)
└── ...

依赖：
- react@18.3.1
- vite@6.4.1
- viem@2.37.2                   ← 关键：Web3调用
- @tanstack/react-query@5      ← 数据管理
- typescript@5.6.3

部署：Cloudflare Pages (dist/ 目录)
```

### 2.2 移动应用 (已有基础)

```
app-client/
├── src/
│   ├── App.tsx                 ⚠️ 需要完善 (真实链集成)
│   ├── screens/
│   │   ├── HomeScreen.tsx      🆕 需要 (主页)
│   │   ├── MiningScreen.tsx    🆕 需要 (挖矿)
│   │   ├── RewardScreen.tsx    🆕 需要 (收益)
│   │   └── SwapScreen.tsx      🆕 需要 (兑换)
│   └── ...
├── app.json                    ✅ 已配置 (Expo)
└── ...

依赖：
- react-native@0.76.6
- expo@52.0.25
- viem@2.37.2                   ← Web3 调用
- wagmi@2.5.8                   ← React Hooks for Web3
- zustand@4.4.7                 ← 状态管理
- @react-navigation/native      ← 导航

部署：Expo (iOS + Android 自动化构建)
```

### 2.3 智能合约 (完全新建)

```
contracts/
├── hardhat.config.ts           🆕 Hardhat 配置
├── contracts/
│   ├── MM.sol                  🆕 MM代币 (ERC20 Burnable)
│   ├── MiningPool.sol          🆕 挖矿合约 (奖励逻辑)
│   ├── SwapRouter.sol          🆕 Swap合约 (AMM)
│   ├── AdminController.sol     🆕 管理合约 (多签)
│   ├── USDT_Mock.sol           🆕 USDT 模拟币 (测试用)
│   └── interfaces/
│       ├── IUniswapV2Router.sol
│       └── ...
├── test/
│   ├── MM.test.ts              🆕 单元测试
│   ├── MiningPool.test.ts      🆕 单元测试
│   └── integration.test.ts     🆕 集成测试
├── scripts/
│   ├── deploy.ts               🆕 部署脚本
│   └── verify.ts               🆕 验证脚本
└── .env.example                🆕 环境变量

依赖：
- hardhat@2.22.0                ← 开发框架
- @openzeppelin/contracts@5.0   ← OpenZeppelin 库
- ethers@6.12.0                 ← Ethers.js (部署用)
- typescript@5.6.3              ← TypeScript 支持

部署：Sepolia 测试网
```

### 2.4 后台 (完全新建)

```
backend/
├── src/
│   ├── index.ts                🆕 Cloudflare Worker 入口
│   ├── routes/
│   │   ├── users.ts            🆕 用户管理 API
│   │   ├── devices.ts          🆕 矿机管理 API
│   │   ├── claims.ts           🆕 收益管理 API
│   │   ├── risk.ts             🆕 风控 API
│   │   └── finance.ts          🆕 财务 API
│   ├── middleware/
│   │   ├── auth.ts             🆕 认证中间件
│   │   ├── cors.ts             🆕 CORS
│   │   └── logging.ts          🆕 日志
│   ├── services/
│   │   ├── user-service.ts     🆕 业务逻辑
│   │   ├── mining-service.ts   🆕 挖矿逻辑
│   │   ├── risk-service.ts     🆕 风控逻辑
│   │   └── cache-service.ts    🆕 缓存服务
│   ├── models/
│   │   ├── user.ts             🆕 数据模型
│   │   ├── device.ts           🆕 矿机模型
│   │   ├── claim.ts            🆕 收益模型
│   │   └── ...
│   ├── db/
│   │   ├── schema.sql          🆕 数据库表结构
│   │   └── migrations.ts       🆕 迁移脚本
│   └── utils/
│       ├── crypto.ts           🆕 加密工具
│       ├── validation.ts       🆕 验证工具
│       └── contract.ts         🆕 合约调用工具
├── wrangler.toml               🆕 Cloudflare Workers 配置
├── package.json                🆕 依赖清单
└── tsconfig.json               🆕 TypeScript 配置

依赖：
- wrangler@3.90.0               ← Cloudflare Workers CLI
- @cloudflare/workers-types     ← CF Workers 类型
- ethers@6.12.0                 ← 链交互
- jose@5.0.0                    ← JWT 认证
- zod@3.22.4                    ← 数据验证
- typescript@5.6.3

部署：Cloudflare Workers (自动部署到全球 CDN)
```

---

## 3. 开发顺序与里程碑

### Phase 1: 智能合约开发 (周 1-2 / 4月1-14)

#### Step 1.1: 初始化 Hardhat 工程

```bash
# 创建合约目录
mkdir contracts
cd contracts

# 初始化 Hardhat
npx hardhat init --typescript

# 安装依赖
npm install --save-dev @openzeppelin/contracts ethers
npm install dotenv

# 目录结构
contracts/
├── hardhat.config.ts           ← RPC 配置 (Sepolia)
├── contracts/
│   ├── MM.sol                  ← ERC20 代币
│   ├── MiningPool.sol          ← 挖矿合约
│   ├── SwapRouter.sol          ← Swap AMM
│   └── AdminController.sol     ← 多签管理
├── test/
│   └── *.test.ts               ← 单元测试
├── scripts/
│   └── deploy.ts               ← 部署脚本
└── .env                        ← 私钥、RPC 配置
```

#### Step 1.2: 编写核心合约

**MM.sol (ERC20 代币)**
```solidity
// 核心功能：
// - 初始供应 10 亿 MM
// - burn() 销毁功能
// - mint() 矿池挖矿奖励
// - approve/transferFrom 标准 ERC20
// 目标：~200 行代码
```

**MiningPool.sol (挖矿合约)**
```solidity
// 核心功能：
// - registerMiner: 注册矿工
// - updateHashrate: 更新算力
// - calculateReward: 计算奖励
// - claimReward: 领取奖励 (冷却检查)
// - getMinerStats: 查询矿工统计
// 目标：~400 行代码
```

**SwapRouter.sol (Swap AMM)**
```solidity
// 核心功能：
// - initLiquidity: 初始化流动性池 (50M MM + 50k USDT)
// - swapMmToUsdt: MM 兑换 USDT
// - swapUsdtToMm: USDT 兑换 MM
// - addLiquidity/removeLiquidity: 流动性management
// - getPrice: 查询价格
// 目标：~500 行代码
```

**AdminController.sol (多签管理)**
```solidity
// 核心功能：
// - multisig 配置 (3/3)
// - proposeAction: 提案
// - approveAction: 批准
// - executeAction: 执行
// - emergencyPause: 紧急暂停
// 目标：~300 行代码
```

#### Step 1.3: 编写和运行测试

```bash
# 单元测试
npx hardhat test

# 覆盖率分析
npx hardhat coverage

# 目标：>90% 覆盖率
```

#### Step 1.4: Sepolia 部署

```bash
# 部署脚本
npx hardhat run scripts/deploy.ts --network sepolia

# 输出：
# ✓ MM deployed: 0x1234...
# ✓ MiningPool deployed: 0x5678...
# ✓ SwapRouter deployed: 0x9abc...
# ✓ AdminController deployed: 0xdef0...

# 保存合约地址到 .env:
VITE_MM_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
VITE_SWAP_ROUTER_ADDRESS=0x...
```

**里程碑完成**：✅ 合约部署到 Sepolia，地址确认

---

### Phase 2: 后台 API 实现 (周 3-4 / 4月15-28)

#### Step 2.1: 设置 Cloudflare Workers 基础

```bash
# 初始化 Workers 项目
npm create cloudflare@latest backend -- --type "hello-world"
cd backend

# 安装依赖
npm install ethers jose zod @cloudflare/workers-types

# 配置 wrangler.toml
# - name: minerhub-api
# - routes: api.minerhub.com/*
# - d1_database: minerhub_db
# - kv_namespace: minerhub_cache
```

#### Step 2.2: 实现核心 API 端点

**用户管理 (/api/users/\*)**
```
POST   /api/users/register         注册用户
POST   /api/users/login            钱包登录
GET    /api/users/{userId}         获取用户信息
PUT    /api/users/{userId}         更新用户信息
GET    /api/users/{userId}/stats   获取用户统计

存储：Cloudflare D1 (SQLite)
表结构：
- users (id, wallet, email, created_at)
- user_stats (user_id, total_mining, total_claimed)
```

**矿机管理 (/api/devices/\*)**
```
POST   /api/devices                注册矿机
GET    /api/devices/{deviceId}     获取矿机信息
PUT    /api/devices/{deviceId}     更新矿机状态
GET    /api/devices/{userId}       获取用户所有矿机
DELETE /api/devices/{deviceId}     删除矿机

存储：Cloudflare D1
表结构：
- devices (id, user_id, device_id, hashrate, status)
- device_metrics (device_id, timestamp, hashrate, power)
```

**收益管理 (/api/claims/\*)**
```
POST   /api/claims                 发起提现申请
GET    /api/claims/{claimId}       获取提现状态
PUT    /api/claims/{claimId}       更新提现状态
GET    /api/claims/user/{userId}   获取用户所有提现

存储：Cloudflare D1
表结构：
- claims (id, user_id, amount, status, created_at)
- claim_history (claim_id, action, timestamp)
```

**风控系统 (/api/risk/\*)**
```
POST   /api/risk/check             风险检测
GET    /api/risk/score/{userId}    获取用户风险分
POST   /api/risk/alert             风险告警
GET    /api/risk/rules             获取风控规则

存储：Cloudflare KV (实时缓存)
```

**财务报表 (/api/finance/\*)**
```
GET    /api/finance/summary        财务概览
GET    /api/finance/daily          日报告
GET    /api/finance/monthly        月报告
GET    /api/finance/export         导出数据

存储：Cloudflare D1
```

#### Step 2.3: 实现认证 & 中间件

```
中间件栈：
1. CORS: 处理跨域请求
2. Auth: 验证 JWT 令牌
   - 登录返回 JWT (signed with CF secret)
   - 每个请求验证 Authorization header
3. Logging: 记录所有请求
4. RateLimiting: 防止 DDoS
   - 每个用户限制请求频率
   - 存储在 Cloudflare KV
```

#### Step 2.4: 数据库 & 缓存配置

```
Cloudflare D1 (SQLite) 配置：
- 连接字符串：env.DB
- 迁移脚本：db/schema.sql
- 操作：SQL 查询

Cloudflare KV 配置：
- 命名空间：minerhub_cache
- 用途：会话、缓存、实时数据
- TTL：5分钟到1小时范围

示例代码：
```javascript
// 读取缓存
const cached = await env.CACHE.get(`user:${userId}:stats`);

// 写入缓存
await env.CACHE.put(`user:${userId}:stats`, JSON.stringify(stats), {
  expirationTtl: 300  // 5分钟
});

// 查询数据库
const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?');
const user = await stmt.bind(userId).first();
```

**里程碑完成**：✅ 后台 API 部署到 Cloudflare Workers，所有端点可用

---

### Phase 3: 移动应用集成 (周 5-6 / 4月29-5月12)

#### Step 3.1: 集成钱包 (WalletConnect)

```javascript
// app-client/src/utils/wallet.ts

import WalletConnectProvider from "@walletconnect/web3-provider";
import { ethers } from "ethers";

export async function connectWallet() {
  const provider = new WalletConnectProvider({
    infuraId: process.env.REACT_APP_INFURA_ID,
    chainId: 11155111  // Sepolia
  });

  await provider.enable();
  const ethersProvider = new ethers.providers.Web3Provider(provider);
  const signer = ethersProvider.getSigner();
  const address = await signer.getAddress();
  
  return { provider, ethersProvider, signer, address };
}
```

#### Step 3.2: 集成挖矿合约

```javascript
// app-client/src/services/mining.ts

import { ethers } from "ethers";
import MiningPoolABI from "../abi/MiningPool.json";

export async function startMining(deviceId, hashrate, signer) {
  const contract = new ethers.Contract(
    MINING_POOL_ADDRESS,
    MiningPoolABI,
    signer
  );

  // 调用合约
  const tx = await contract.registerMiner(deviceId, hashrate);
  const receipt = await tx.wait();
  
  return receipt;
}

export async function claimReward(signer) {
  const contract = new ethers.Contract(
    MINING_POOL_ADDRESS,
    MiningPoolABI,
    signer
  );

  const tx = await contract.claimReward();
  const receipt = await tx.wait();
  
  return receipt;
}
```

#### Step 3.3: 实现 UI 屏幕

**MiningScreen.tsx**
```
- 显示用户钱包地址
- "连接钱包" 按钮
- 显示已注册矿机列表
- "添加矿机" 按钮
- 实时算力展示
- "领取奖励" 按钮
```

**RewardScreen.tsx**
```
- 显示待领取奖励
- 显示已领取奖励历史
- 领取成功/失败提示
- 交易哈希链接
```

**SwapScreen.tsx**
```
- MM/USDT 交换界面
- 价格实时显示
- 手续费计算
- 确认交换
```

#### Step 3.4: API 集成层

```javascript
// app-client/src/services/api.ts

const API_BASE = "https://api.minerhub.com";

export async function fetchUserStats(userId) {
  const res = await fetch(`${API_BASE}/api/users/${userId}/stats`);
  return res.json();
}

export async function submitClaim(userId, amount) {
  const res = await fetch(`${API_BASE}/api/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, amount })
  });
  return res.json();
}
```

**里程碑完成**：✅ 移动应用整体集成，UI 完整可用

---

### Phase 4: 集成测试与验证 (周 7-8 / 5月13-26)

#### Step 4.1: 端到端测试

```
测试场景：
1. 新用户注册 → 登录 → 下载APP
2. APP 连接钱包 → 注册矿机
3. 后台计算奖励 → 用户领取 → 链上转账
4. Swap 兑换 → USDT 到账
5. 风控检测 → 异常用户警告

测试工具：
- Hardhat 本地测试
- Postman 集合 API 测试
- Cypress 前端测试
```

#### Step 4.2: 压力测试

```
目标：验证系统支持 1000 并发用户

使用 Apache JMeter 或 k6：
- 1000 用户同时登录
- 每用户不断发起 API 请求
- 记录响应时间、错误率

预期结果：
- 平均响应时间 < 200ms
- 错误率 < 0.1%
- 系统无崩溃
```

#### Step 4.3: CertiK 安全审计准备

```
审计前检查清单：
- [ ] 所有代码已提交到 Git
- [ ] 测试覆盖率 > 90%
- [ ] 无已知安全问题
- [ ] 合约库更新到最新版本
- [ ] 文档完整

提交给 CertiK：
- contracts/ 整个目录
- 部署说明文档
- 现有测试套件

预期周期：2-3周
```

**里程碑完成**：✅ 通过安全审计，无 Critical Bug

---

## 4. 环境配置详解

### 4.1 .env 环境变量

```env
# ========== 区块链 ==========
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/{YOUR_INFURA_KEY}
DEPLOYER_PRIVATE_KEY=0x{your_private_key}  # 4个0后跟40位16进制

# 合约地址 (部署后获得)
VITE_MM_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
VITE_SWAP_ROUTER_ADDRESS=0x...
VITE_ADMIN_CONTROLLER_ADDRESS=0x...

VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://sepolia.infura.io/v3/{YOUR_INFURA_KEY}

# ========== Cloudflare ==========
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_DATABASE_ID=your_d1_database_id

# ========== 应用配置 ==========
VITE_ANDROID_DOWNLOAD_URL=https://...
VITE_IOS_DOWNLOAD_URL=https://...
VITE_API_BASE_URL=https://api.minerhub.com

# ========== 安全 ==========
JWT_SECRET=your_jwt_secret_key
ADMIN_MULTISIG_ADDRESS=0x...
```

### 4.2 Hardhat 配置

```typescript
// contracts/hardhat.config.ts

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY] 
        : []
    },
    hardhat: {
      chainId: 11155111
      // 本地模拟 Sepolia
    }
  }
};

export default config;
```

### 4.3 Wrangler 配置

```toml
# backend/wrangler.toml

name = "minerhub-api"
main = "src/index.ts"
type = "service"
compatibility_date = "2024-04-04"

# Cloudflare D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "minerhub_db"
database_id = "your_database_id"

# Cloudflare KV 命名空间
[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"

# 路由配置
routes = [
  { pattern = "api.minerhub.com/*", zone_name = "minerhub.com" }
]

# 环境变量
[env.production]
routes = [
  { pattern = "api.minerhub.com/*", zone_name = "minerhub.com" }
]

[env.production.vars]
CHAIN_ID = "11155111"
RPC_URL = "https://sepolia.infura.io/v3/{KEY}"
```

---

## 5. 部署流程

### 5.1 智能合约部署

```bash
# 1. 配置私钥
export DEPLOYER_PRIVATE_KEY=0x...
export SEPOLIA_RPC_URL=https://sepolia.infura.io/...

# 2. 编译合约
cd contracts
npm install
npx hardhat compile

# 3. 部署到 Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# 输出：
# Deploying MM Token...
# MM deployed to: 0x1234...
# Deploying MiningPool...
# ✓ All contracts deployed successfully!

# 4. 验证合约 (可选)
npx hardhat verify --network sepolia 0x1234...
```

### 5.2 后台部署到 Cloudflare Workers

```bash
# 1. 登录 Cloudflare
wrangler login

# 2. 创建数据库 (如还未创建)
wrangler d1 create minerhub_db
wrangler d1 execute minerhub_db --file=db/schema.sql

# 3. 部署 Workers
wrangler deploy

# 输出：
# ✅ Successfully deployed to api.minerhub.com
```

### 5.3 前端部署到 Cloudflare Pages

```bash
# 1. 构建
npm run build

# 2. 部署
npm run deploy:cf

# 或手动
wrangler pages deploy dist/
```

### 5.4 移动应用部署到 Expo

```bash
# 1. 构建
cd app-client
expo build --platform ios --type archive
expo build --platform android --type apk

# 2. 上传应用商店
# iOS: 上传到 App Store
# Android: 上传到 Google Play
```

---

## 6. 项目完整文件清单

```
minerhub/
├── src/                           (前端代码)
│   ├── lib/
│   │   ├── blockchain.ts          ⬅ 需要更新：真实合约集成
│   │   ├── viem-config.ts         ⬅ 新建：Viem 客户端
│   │   └── api-client.ts          ⬅ 新建：API 调用库
│   ├── components/                (已有)
│   └── ...
│
├── app-client/                    (移动应用)
│   ├── src/
│   │   ├── App.tsx                ⬅ 需要更新：真实集成
│   │   ├── screens/
│   │   │   ├── MiningScreen.tsx   ⬅ 新建
│   │   │   ├── RewardScreen.tsx   ⬅ 新建
│   │   │   └── SwapScreen.tsx     ⬅ 新建
│   │   ├── services/
│   │   │   ├── mining.ts          ⬅ 新建
│   │   │   ├── wallet.ts          ⬅ 新建
│   │   │   └── api.ts             ⬅ 新建
│   │   └── ...
│   ├── app.json                   (已有)
│   └── ...
│
├── contracts/                     (智能合约) ⬅ 完全新建
│   ├── contracts/
│   │   ├── MM.sol
│   │   ├── MiningPool.sol
│   │   ├── SwapRouter.sol
│   │   ├── AdminController.sol
│   │   ├── USDT_Mock.sol
│   │   └── interfaces/
│   ├── test/
│   │   ├── MM.test.ts
│   │   ├── MiningPool.test.ts
│   │   └── integration.test.ts
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── verify.ts
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env.example
│
├── backend/                       (后台 API) ⬅ 完全新建
│   ├── src/
│   │   ├── index.ts               (Worker 入口)
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── devices.ts
│   │   │   ├── claims.ts
│   │   │   ├── risk.ts
│   │   │   └── finance.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── cors.ts
│   │   │   └── logging.ts
│   │   ├── services/
│   │   │   ├── user-service.ts
│   │   │   ├── mining-service.ts
│   │   │   ├── risk-service.ts
│   │   │   └── cache-service.ts
│   │   ├── models/
│   │   │   ├── user.ts
│   │   │   ├── device.ts
│   │   │   ├── claim.ts
│   │   │   └── ...
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── migrations.ts
│   │   └── utils/
│   │       ├── crypto.ts
│   │       ├── validation.ts
│   │       └── contract.ts
│   ├── wrangler.toml
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── token-model.md           (已有)
│   ├── admin-system-design.md   (已有)
│   ├── system-integration-roadmap.md (已有)
│   ├── development-timeline-and-costs.md (已有)
│   ├── investment-quickref.md   (已有)
│   └── implementation-guide.md  ⬅ 本文件
│
└── .env.example                 (更新：完整变量列表)
```

---

## 7. 关键代码示例

### 7.1 智能合约示例 (MM.sol)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MM is ERC20, ERC20Burnable, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 10亿 MM
    
    constructor() ERC20("MinerHub Token", "MM") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
```

### 7.2 后台 API 示例 (users.ts)

```typescript
// backend/src/routes/users.ts

export async function handleRequest(request: Request, env: Env) {
  if (request.method === "POST") {
    const { walletAddress, email } = await request.json();
    
    // 验证钱包地址
    if (!walletAddress.startsWith("0x")) {
      return new Response(JSON.stringify({ error: "Invalid address" }), { status: 400 });
    }
    
    // 保存到 D1
    const stmt = env.DB.prepare(
      "INSERT INTO users (wallet, email, created_at) VALUES (?, ?, ?)"
    );
    await stmt.bind(walletAddress, email, new Date().toISOString()).run();
    
    // 返回用户信息
    return new Response(JSON.stringify({ 
      walletAddress, 
      createdAt: new Date().toISOString() 
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }
}
```

### 7.3 移动应用示例 (MiningScreen.tsx)

```typescript
// app-client/src/screens/MiningScreen.tsx

import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { connectWallet, startMining } from "../services/wallet";

export default function MiningScreen() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [mining, setMining] = useState(false);
  
  const handleConnect = async () => {
    try {
      const { signer, address } = await connectWallet();
      setAddress(address);
      setConnected(true);
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };
  
  const handleStartMining = async () => {
    try {
      setMining(true);
      await startMining("device-001", 1000, signer);
      alert("Mining started!");
    } catch (error) {
      console.error("Mining failed:", error);
    } finally {
      setMining(false);
    }
  };
  
  return (
    <View>
      {!connected ? (
        <TouchableOpacity onPress={handleConnect}>
          <Text>连接钱包</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text>钱包: {address}</Text>
          <TouchableOpacity onPress={handleStartMining} disabled={mining}>
            <Text>{mining ? "启动中..." : "开始挖矿"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
```

---

## 8. 测试计划

### 单元测试

```bash
# 智能合约单元测试
cd contracts
npx hardhat test

# 覆盖率报告
npx hardhat coverage

# 后台 API 单元测试
cd ../backend
npm test
```

### 集成测试

```bash
# 使用 Postman 集合
# 1. 导入 postman-collection.json
# 2. 运行完整流程测试

# 或使用脚本
npm run test:integration
```

### 压力测试

```bash
# 使用 k6
k6 run stress-test.js --vus 1000 --duration 5m
```

---

## 9. 成功标准

| 里程碑 | 完成条件 | 验收标准 |
|--------|--------|--------|
| **合约部署** | 4 个合约在 Sepolia 部署 | ✅ 所有合约地址确认 |
| **后台 API** | 20+ 端点部署到 CF Workers | ✅ 所有 API 响应 < 200ms |
| **移动应用** | UI 屏幕完成、链接完整 | ✅ 完整用户旅程可走通 |
| **端到端** | 从登录到提现全流程 | ✅ 无 Bug、无错误 |
| **审计通过** | CertiK 审计报告 | ✅ 无 Critical/High 级问题 |
| **上线就绪** | 所有系统组件就绪 | ✅ 可推送到 Base Mainnet |

---

## 10. 风险与应对

| 风险 | 对策 | 应急方案 |
|------|------|--------|
| 合约编写延期 | 提前提高审查频率 | 简化合约功能 |
| API 性能不达标 | 使用 Cloudflare 缓存优化 | 切换到 Vercel Functions |
| 审计问题严重 | 提早联系 CertiK 预审 | 延期发布（不建议） |
| 用户反馈差 | 灰度测试中快速迭代 | 增加社红管理支持 |

---

**下一步**：选择合适的起点开始编码！
