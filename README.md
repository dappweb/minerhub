# MinerHub

MinerHub 是一个包含三端视图的 Web 项目：

- 项目网站（官网展示）
- 后台管理系统
- 挖矿 App（钱包连接、链上挖矿、链上兑换）

当前官网已增加：

- 钱包登录进入后台管理系统入口
- Android / iOS 挖矿 App 下载入口
- 双端客户端工程（React Native Expo）：`app-client/`

## 📚 完整设计文档

> 查看完整系统设计、实现路线和 API 规范，请见 [**文档导航**](./docs/docs-index.md)

主要文档：

- [**MM 代币模型及经济设计** - Token Model](./docs/token-model.md)：代币分配、4 年释放时间表、挖矿奖励机制、USDT/MM 交换兑换池、智能合约架构
- [**后台管理系统设计** - Admin System](./docs/admin-system-design.md)：6 大管理模块、20+ REST API、MongoDB + Redis 架构、风险控制系统、多签治理机制
- [**系统集成与部署路线** - Integration Roadmap](./docs/system-integration-roadmap.md)：完整用户旅程、合约部署清单、测试计划（Sepolia / Base Mainnet）、发布时间表（4 月-7 月）
- [**开发周期与预期费用** - Costs & Timeline](./docs/development-timeline-and-costs.md)：人力成本 ($375K)、基础设施 ($8K)、融资建议 ($600K-$800K)、ROI 预测与风险评估

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

## 📋 开发阶段与测试

- **第一阶段**（4 月-5 月）：Sepolia 测试网部署与验证
- **第二阶段**（6 月）：Base Mainnet 灰度上线（1000 内部测试用户）
- **第三阶段**（7 月）：正式公开发布

详见 [System Integration Roadmap](./docs/system-integration-roadmap.md#timeline)

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

## 📂 文件结构与快速参考

```
minerhub/
├── src/                      # Web Frontend
│   ├── components/           # React 组件
│   ├── lib/blockchain.ts    # 区块链调用层
│   └── App.tsx              # 主应用（钱包登录门禁）
├── app-client/              # 移动应用（React Native Expo）
├── docs/                    # 完整设计文档
│   ├── docs-index.md        # 文档导航
│   ├── token-model.md       # MM 代币模型
│   ├── admin-system-design.md
│   └── system-integration-roadmap.md
└── wrangler.toml           # Cloudflare Pages 配置
```

## 👥 团队分工与下一步

| 角色 | 文档入口 | 核心任务 |
|------|--------|--------|
| **合约工程师** | [Token Model](./docs/token-model.md#contracts) | 编写 MM.sol、MiningPool.sol、SwapRouter.sol、AdminController.sol |
| **后端工程师** | [Admin System Design](./docs/admin-system-design.md#api) | 实现 20+ REST API、多签系统、风险控制 |
| **移动开发** | [Integration Guide](./docs/system-integration-roadmap.md#mobile) | 集成 WalletConnect SDK、完成真实链上交互 |
| **DevOps** | [Deployment Guide](./docs/system-integration-roadmap.md#deployment) | Sepolia 部署→Base 灰度→正式发布 |
| **QA** | [Test Plan](./docs/system-integration-roadmap.md#testing) | 单元测试、集成测试、安全审计（CertiK） |

---

**项目状态：** ✅ 基础架构完成 | 📝 设计文档完成 | ⏳ 开发阶段启动中
