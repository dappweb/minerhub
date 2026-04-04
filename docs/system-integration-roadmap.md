# MinerHub 系统集成与实现路线图

## 1. 全系统架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                   MinerHub 完整生态系统                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              官网 + 后台管理系统（Web）                      │ │
│  │  - Cloudflare Pages 部署                                   │ │
│  │  - 钱包登录、后台运维、数据展示                             │ │
│  └───────────┬──────────────────────────┬────────────────────┘ │
│              │                          │                     │
│    ┌─────────▼──────────┐     ┌────────▼──────────┐          │
│    │   移动端 App      │     │  后台 API        │          │
│    │ (Android + iOS)   │     │  (Node.js)       │          │
│    │  React Native    │     │  MongoDB + Redis │          │
│    │  Expo 框架       │     │  风控 + 审计      │          │
│    └────────┬──────────┘     └────────┬─────────┘          │
│             │                         │                    │
│    ┌────────▼──────────────────────────▼──────────┐         │
│    │       区块链智能合约网络                      │         │
│    │                                             │         │
│    │  ┌─────────────────────────────────────┐   │         │
│    │  │    MM Token（ERC20）                │   │         │
│    │  │    - 铸造/销毁 | 审批              │   │         │
│    │  │    - 代币流通控制                  │   │         │
│    │  └─────────────────────────────────────┘   │         │
│    │                                             │         │
│    │  ┌─────────────────────────────────────┐   │         │
│    │  │    MiningPool（挖矿合约）           │   │         │
│    │  │    - 矿工注册 | 验证               │   │         │
│    │  │    - 奖励计算 | 分配               │   │         │
│    │  │    - 提取冷却 | 安全性             │   │         │
│    │  └─────────────────────────────────────┘   │         │
│    │                                             │         │
│    │  ┌─────────────────────────────────────┐   │         │
│    │  │    SwapRouter（流动性切换）         │   │         │
│    │  │    - MM ↔ USDT 兑换                │   │         │
│    │  │    - 流动性管理                    │   │         │
│    │  │    - 价格预言机                    │   │         │
│    │  └─────────────────────────────────────┘   │         │
│    │                                             │         │
│    └─────────────────────────────────────────────┘         │
│                                                              │
│  链：Base Mainnet (生产) + Sepolia (开发)                   │
│  跨链桥接（未来）：Base ↔ Ethereum ↔ Polygon              │
│                                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 用户旅程工作流

### 2.1 新用户上车路径

```
1️⃣ 访问官网 (Website)
   ↓ 点击"下载双端客户端"
   
2️⃣ 下载 App (Android / iOS)
   ↓ 首次打开
   
3️⃣ App 生成本地钱包
   ↓ TEE 硬件加密，私钥不离设备
   
4️⃣ 连接钱包到链
   ↓ 调用 MinerRegistry.registerMiner()
   
5️⃣ 选择挖矿策略
   ↓ 设置算力、耗电预期、时间段
   
6️⃣ 后台开始分配奖励
   ↓ MiningPool 实时计算
   
7️⃣ 用户实时查看收益
   ↓ UI 显示 pending_reward
   
8️⃣ 发起提取
   ↓ MiningPool.claimReward()
   
9️⃣ 选择兑换方案
   ┌─────────────────────────┐
   ├─ 保持 MM 代币           ├─ 后续交易所价涨
   ├─ 兑换为 USDT (0.5% 费)  ├─ 马上变现
   └─ 提现到钱包             ├─ 用于支付消费
     └─ 到账用户钱包
     
🔟 后台审批与风控检查
   ↓ 自动检测作弊 | 高额提现需人工审核
   
1️⃣1️⃣ 链上转账完成
   ↓ Swap Router 执行 MM→USDT + 提现
   
1️⃣2️⃣ 钱包收到资金
   ✅ 完成
```

---

## 3. 各模块间数据流

### 3.1 挖矿奖励流动

```
App 上报算力
   ↓ deviceId + hashrate + timestamp (TEE 签名)
   ↓
后台监听 (MiningPool.submitProof())
   ↓ 验证签名 + 防作弊检查
   ↓
MiningPool 合约
   ├─ 累加 totalMined
   ├─ 记录 lastClaimTime
   └─ emit MiningRewardAccrued
   ↓
App 前端订阅事件
   ├─ 实时显示 getPendingReward()
   └─ 图表展示日累计趋势
   
用户发起 claimReward()
   ↓ MiningPool.claimReward(amount)
   ↓ 验证冷却 + 金额有效性
   ↓
MM Token 转账
   ├─ 95% → 用户钱包
   ├─ 5% → 平台储备
   └─ emit Reward Claimed
   
后台记录
   ├─ MongoDB: claims collection
   ├─ 审计日志更新
   └─ 财务报表修正
```

### 3.2 Swap 流动性切换

```
用户发起 Swap (100 MM → ? USDT)
   ↓ SwapRouter.swapMmToUsdt(100)
   ↓
检查流动性
   ├─ MM Reserve: 50M
   ├─ USDT Reserve: 50k
   ├─ 计算滑点与兑换率
   └─ 1 MM ≈ 0.001 USDT → 100 MM ≈ 0.1 USDT
   
手续费计算
   ├─ 0.5% 手续费 = 0.0005 USDT
   ├─ 用户实际获得 0.0995 USDT
   └─ 收费分配：
      ├─ 70% → LP (0.0003525)
      ├─ 20% → 平台 (0.0001)
      └─ 10% → 生态 (0.00005)

链上执行
   ├─ MM: 用户 → SwapRouter → Reserve
   ├─ USDT: Reserve → SwapRouter → 用户
   ├─ 更新 Reserves
   └─ emit Swap Event
   
后台记录
   ├─ MongoDB: swaps collection
   ├─ 更新用户余额
   ├─ 财务报表统计
   └─ Redis 缓存实时价格
```

---

## 4. 后台管理员操作流程

### 4.1 风控告警处理

```
系统自动检测作弊
   ├─ 多设备刷单
   ├─ 异常算力激增
   ├─ 地理位置异常
   └─ 提现频率异常
   
告警生成
   ├─ severity: critical / warning / info
   ├─ confidence score: 0.0 ~ 1.0
   └─ 建议处置: suspend / throttle / review
   
后台管理员收到通知
   ├─ Dashboard 红点闪烁
   ├─ 钉钉/Slack 通知
   └─ Email 发送
   
打开告警详情
   ├─ 查看关联账户
   ├─ 历史投诉记录
   ├─ 链上交易追溯
   └─ 设备重合度分析
   
做出处置决定
   ├─ 自动批准 (score > 0.95) → 直接执行
   ├─ 人工审核 (0.7 < score < 0.95) → 审批流
   └─ 手动忽略 (score < 0.7) → 白名单
   
执行处置
   ├─ 方案 A: suspend -> 账户冻结 -> MiningPool.suspend(user)
   ├─ 方案 B: throttle -> 降速 -> 算力限额 0.1 MH/s
   └─ 方案 C: review -> 标记人工审查 -> 继续监控
   
记录审计日志
   ├─ adminWallet, action, target
   ├─ reason, confidence, txHash
   └─ timestamp, approval_count
```

### 4.2 提现申请审核

```
用户发起提现 (1000 MM)
   ├─ 小于日额度 5000 MM
   ├─ 不在黑名单中
   ├─ 冷却时间已过
   → 自动批准 ✅
   
用户发起提现 (20000 MM)
   ├─ 超过日额度限制
   ├─ 需要人工审核
   → 进入待审池
   
后台财务人员收到通知
   ├─ 查看申请单详情
   ├─ 用户历史提现记录
   ├─ 当日总提现额度监控
   └─ 链上流动性检查
   
审核决策
   ├─ 确认 → 自动执行 Swap 与转账
   ├─ 拒绝 → 返还 MM 到用户钱包
   └─ 分批 → 分 2 次提现 (10k/day)
   
执行处置
   ├─ Swap Router: 20k MM → 20 USDT
   ├─ 链上转账 20 USDT 到用户
   ├─ MongoDB 记录 status=completed
   └─ 用户 App 收到确认通知
```

---

## 5. 智能合约部署清单

### 5.1 合约清单与顺序

```
部署顺序（Sepolia 测试网）:
  1. MM Token (ERC20)
  2. MiningPool (挖矿正主)
  3. SwapRouter (流动性)
  4. AdminController (多签管理)

部署顺序（Base 主网，月底）:
  1. MM Token (前提：审计通过)
  2. MiningPool
  3. SwapRouter
  4. AdminController

初始化步骤:
  a) MM: 铸造总供应量 1B
  b) MiningPool: 转入 500M MM (挖矿池)
  c) SwapRouter: 转入 50M MM + 初始化 50k USDT (LP)
  d) AdminController: 配置 3/3 多签admin
```

### 5.2 合约基础框架

```solidity
// 文件结构建议
contracts/
├── token/
│   ├── MM.sol (ERC20 代币)
│   └── extensions/
│       ├── MMBurnable.sol
│       └── MMVoting.sol (未来治理)
│
├── mining/
│   ├── MinerRegistry.sol (矿工注册表)
│   ├── MiningPool.sol (主合约)
│   └── ProofOfWork.sol (工作量证明)
│
├── swap/
│   ├── SwapRouter.sol (AMM 路由)
│   ├── LiquidityPool.sol (流动性池)
│   └── PriceOracle.sol (价格预言机)
│
├── governance/
│   ├── MultiSigController.sol (多签管理)
│   └── TimeLock.sol (时间锁)
│
└── test/
    └── *.test.ts
```

---

## 6. 前端应用集成清单

### 6.1 官网（Website）需要的改动

```
✅ 已完成:
  - 三视图导航 (website / admin / mining)
  - 钱包连接入口
  - Android/iOS 双下载链接

⏳ 待实现:
  - 官网部分: 实时数据展示 (总挖矿、用户数、流动性)
  - 后台管理: 完整 CRUD 界面
    ├─ 用户管理表格
    ├─ 矿机实时监控
    ├─ 收益统计图表
    ├─ 风控告警列表
    └─ 财务报表
  - 数据更新：WebSocket 订阅链事件
```

### 6.2 App 客户端（Mobile）需要的改动

```
✅ 已完成:
  - React Native + Expo 框架
  - 移动端 UI 骨架
  - 钱包连接 Mock

⏳ 待实现:
  - 集成真实钱包 SDK
    ├─ WalletConnect SDK
    ├─ Ethers.js / Viem
    └─ TEE 签名库
  
  - App 核心功能
    ├─ 注册与设备绑定
    ├─ 后台挖矿管理
    ├─ 实时收益展示
    ├─ Swap 与提现流程
    └─ 设备健康监控
  
  - 链上交互
    ├─ MinerRegistry.registerMiner()
    ├─ MiningPool.claimReward()
    ├─ SwapRouter.swapMmToUsdt()
    └─ 交易签名 + 广播
  
  - 后台服务对接
    ├─ API 集成 (axios / fetch)
    ├─ 身份验证 (JWT)
    └─ 错误处理与重试
```

---

## 7. 后台系统（Admin）实现清单

### 7.1 需要开发的后端 API 模块

```
✅ 框架搭建:
  - Express 服务器配置
  - MongoDB 连接
  - Redis 缓存初始化

⏳ 需要实现:

用户管理模块 (/api/admin/users)
  ├─ GET /users (分页查询)
  ├─ GET /users/:wallet (详情)
  ├─ PUT /users/:wallet/status (封禁)
  ├─ DELETE /users/:wallet (注销)
  └─ POST /users/bulk-export (导出)

矿机监控模块 (/api/admin/devices)
  ├─ GET /devices (列表)
  ├─ GET /devices/:deviceId (详情)
  ├─ PUT /devices/:deviceId/action (限流/封禁)
  └─ GET /devices/stats (聚合统计)

收益管理模块 (/api/admin/revenue)
  ├─ GET /stats (日/月统计)
  ├─ GET /claims/pending (待审列表)
  ├─ PUT /claims/:claimId/approve (批准)
  └─ GET /withdrawals/history (提现记录)

风控管理模块 (/api/admin/risk)
  ├─ GET /alerts (告警列表)
  ├─ PUT /alerts/:alertId/resolve (处置)
  └─ GET /detections (检测规则)

财务报表模块 (/api/admin/finance)
  ├─ GET /report (财务报表)
  ├─ GET /balance (账户余额)
  └─ POST /payout (手动打款)

系统配置模块 (/api/admin/config)
  ├─ GET /config (获取参数)
  ├─ PUT /config/:key (修改参数，需多签)
  └─ GET /audit-log (审计日志)
```

### 7.2 前端 UI 页面清单

```
✅ 已有:
  - 登录/钱包验证页面

⏳ 需要开发:

Dashboard (首页)
  ├─ KPI 卡片 (总算力、用户数、日产量)
  ├─ 图表 (挖矿趋势、提现趋势)
  └─ 快速告警面板

用户管理页面
  ├─ 用户列表表格
  ├─ 搜索与筛选
  ├─ 批量操作工具栏
  └─ 用户详情模态框

矿机监控页面
  ├─ 设备热力图
  ├─ 算力排行榜
  ├─ 设备状态饼图
  └─ 单设备详情

收益与提现页面
  ├─ 日收益趋势图
  ├─ 待审提现列表
  ├─ 流动性监控
  └─ 提现操作工具

风控面板
  ├─ 告警黄金列表
  ├─ 告警详情展开
  ├─ 处置历史记录
  └─ 检测规则调试

财务报表
  ├─ 周期财务汇总
  ├─ 收入/支出分类
  ├─ K线与蜡烛图
  └─ 导出 Excel
```

---

## 8. 测试与验证清单

### 8.1 单元测试

```
合约测试 (Hardhat):
  ├─ MM Token
  │  ├─ 铸造/销毁测试
  │  ├─ 转账测试
  │  └─ 权限测试
  ├─ MiningPool
  │  ├─ 注册测试
  │  ├─ 奖励计算测试
  │  ├─ 提取测试
  │  └─ 冷却测试
  └─ SwapRouter
     ├─ 兑换测试
     ├─ 滑点测试
     ├─ 价格测试
     └─ 闪电贷测试

前端单元测试 (Jest + React Testing Library):
  ├─ 组件渲染测试
  ├─ 事件处理测试
  ├─ 状态管理测试
  └─ API Mock 测试

后端单元测试 (Jest):
  ├─ API 端点测试
  ├─ 数据库操作
  ├─ 风控规则
  └─ 业务逻辑
```

### 8.2 集成测试

```
Sepolia 测试网集成:
  1. 部署所有合约
  2. 初始化流动性与参数
  3. Mock 用户场景:
     ├─ 用户注册
     ├─ 挖矿上报
     ├─ 提取收益
     ├─ Swap 兑换
     └─ 提现流程
  4. 后台验收:
     ├─ 用户管理操作
     ├─ 风控告警触发
     ├─ 审核流程
     └─ 报表生成
```

### 8.3 安全审计

```
代码审计 (代码质量):
  ├─ Solidity 合约: SlitherAI / Mythril
  ├─ 前端代码: ESLint + SonarQube
  └─ 后端代码: SonarQube + OWASP

第三方审计 (安全评估):
  ├─ CertiK / OpenZeppelin (Sepolia)
  ├─ Formal Verification (如适用)
  └─ Penetration Testing (后台)
```

---

## 9. 上线前检查清单

```
智能合约:
  ☐ 代码审计通过
  ☐ Sepolia 测试完成
  ☐ 合约部署脚本验证
  ☐ 多签配置确认
  ☐ 紧急停止机制测试

Mobile App:
  ☐ 内测用户 100+ 反馈
  ☐ 真机测试 (Android + iOS)
  ☐ 性能基准测试 (内存/电量)
  ☐ 网络异常模拟测试
  ☐ App Store/Play Store 审核准备

后台系统:
  ☐ 权限模型测试
  ☐ 并发压力测试 (QPS)
  ☐ 数据库备份与恢复测试
  ☐ 监控告警系统配置
  ☐ 灾难恢复演练

运营文档:
  ☐ 后台管理员手册
  ☐ 用户常见问题 FAQ
  ☐ 应急预案文档
  ☐ 联系方式与支持流程
```

---

## 10. 发布时间线（推荐）

```
第 1 阶段 - Sepolia 测试 (4 月 - 5 月)
  Week 1-2: 合约编写 + 后台 API 开发
  Week 3-4: Mobile App 集成开发
  Week 5-6: 集成测试 + 压力测试
  Week 7-8: 修复 Bug + CertiK 审计

第 2 阶段 - Base 主网灰度 (6 月)
  Week 1: 合约部署 + 初始化流动性
  Week 2: 邀请 1000 内测用户
  Week 3-4: 监控 & 优化

第 3 阶段 - 全量发行 (7 月)
  Week 1: 官方宣布正式上线
  Week 2: 市场营销活动启动
  持续: 社区建设 & 生态扩展
```

---

## 总结

MinerHub 从设计到上线的完整路径：

```
需求定义
    ↓
代币模型设计 (Token Model) ✅
    ↓
后台系统设计 (Admin System) ✅
    ↓
智能合约开发
    ├─ MM Token
    ├─ MiningPool
    ├─ SwapRouter
    └─ AdminController
    ↓
Mobile App 开发 (React Native)
    ├─ 钱包集成
    ├─ 挖矿功能
    └─ 提现兑换
    ↓
后台系统开发 (Node.js)
    ├─ 用户/矿机管理
    ├─ 风控系统
    └─ 财务报表
    ↓
集成测试 (Sepolia)
    ├─ 端到端流程
    ├─ 压力测试
    └─ 安全审计
    ↓
主网部署 (Base Mainnet)
    ├─ 合约上线
    ├─ 灰度用户邀请
    └─ 全量发行
```

所有关键文档已位于 `docs/` 目录，可随时查阅与更新。
