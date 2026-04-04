# MinerHub 后台管理系统设计

## 1. 系统架构概览

```
┌─────────────────────────────────────────┐
│      Web 后台管理系统（React + Web3）     │
│  - 运营团队、财务、技术支持              │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────┐      ┌──────────────┐
│ 后台 API    │      │ 区块链网络    │
│ (Node.js)   │      │ (Base+Sepolia)│
└─────────────┘      └──────────────┘
    │
    ├─ MongoDB（用户数据）
    ├─ Redis（缓存）
    └─ AWS S3（日志）
```

---

## 2. 后台管理系统模块设计

### 2.1 用户管理模块

#### 2.1.1 用户数据结构

```javascript
// User Collection (MongoDB)
{
  _id: ObjectId,
  walletAddress: "0x...",
  nickname: "User123",
  email: "user@example.com",
  registeredAt: Timestamp,
  lastActiveAt: Timestamp,
  status: "active" | "banned" | "suspended",
  deviceId: "device_hash_123",
  appVersion: "1.0.0",
  referrer: "0x..." // 推荐人地址（用于返佣）
}
```

#### 2.1.2 用户管理功能

```
- 用户搜索（按钱包、邮箱、DeviceID）
- 用户状态管理（启用/禁用/封禁）
- 用户详情查看（挖矿数据、收益统计）
- 批量操作（导出、封禁、激励）
- 风险识别（异常行为、多账户、刷单）
```

#### 2.1.3 后台 API - 用户模块

```typescript
// GET /api/admin/users - 分页获取用户列表
{
  query: {
    page: 1,
    limit: 50,
    status: "active|banned|all",
    sortBy: "registeredAt|lastActiveAt",
    search?: "wallet|email|deviceId"
  },
  response: {
    total: 10000,
    users: [
      {
        walletAddress: "0x...",
        nickname: "User1",
        registeredAt: "2026-04-01",
        totalMined: 1000,
        totalClaimed: 500,
        status: "active",
        referralCount: 5
      }
    ]
  }
}

// PUT /api/admin/users/:walletAddress/status
{
  body: { status: "active|banned|suspended" },
  response: { success: true }
}

// GET /api/admin/users/:walletAddress
{
  response: {
    walletAddress: "0x...",
    totalMined: 50000,
    totalClaimed: 10000,
    pendingReward: 40000,
    devices: [
      { deviceId: "xxx", hashrate: 1.5, status: "mining", lastSeen: "2026-04-04T10:30:00Z" }
    ],
    referralNetwork: {
      referrer: "0x...",
      referralCount: 5,
      referralReward: 500
    },
    suspiciousActivity: [
      { type: "multi_device_cheat", confidence: 0.85, timestamp: "2026-04-04T09:00:00Z" }
    ]
  }
}
```

---

### 2.2 矿机管理模块

#### 2.2.1 设备数据结构

```javascript
// DeviceMetrics Collection (MongoDB)
{
  _id: ObjectId,
  deviceId: "device_hash_123",
  walletAddress: "0x...",
  deviceInfo: {
    osType: "Android",
    osVersion: "13.0",
    deviceModel: "Xiaomi 12",
    appVersion: "1.0.0"
  },
  status: "mining" | "idle" | "offline" | "suspended",
  metrics: {
    currentHashrate: 1.5,      // MH/s
    averageHashrate: 1.45,     // 24h 平均
    temperature: 42,            // ℃
    cpuUsage: 65,               // %
    batteryLevel: 78,           // %
    networkQuality: 95          // %
  },
  uptime: 864000,              // 秒
  lastSeen: Timestamp,
  totalMined: 500,             // MM
  createdAt: Timestamp,
  dailyStats: [
    {
      date: "2026-04-04",
      mined: 8.64,
      uptime: 86400,
      avgHashrate: 1.5
    }
  ]
}
```

#### 2.2.2 矿机管理功能

```
- 实时设备监控（在线/离线状态）
- 算力分布统计（总算力、单机算力排行）
- 设备健康监控（温度、电量、网络）
- 异常设备预警（掉线、算力异常、多设备作弊）
- 批量管理（黑名单、限流、停止）
```

#### 2.2.3 后台 API - 矿机模块

```typescript
// GET /api/admin/devices - 设备统计
{
  response: {
    totalDevices: 50000,
    activeDevices: 38000,
    totalHashrate: 75000,     // MH/s
    avgHashrate: 1.97,        // 平均单机
    distribution: {
      online: 38000,
      idle: 10000,
      offline: 2000
    },
    topHashrateDevices: [
      { deviceId: "xxx", hashrate: 5.2, walletAddress: "0x..." }
    ]
  }
}

// GET /api/admin/devices/:deviceId
{
  response: {
    deviceId: "device_hash_123",
    walletAddress: "0x...",
    status: "mining",
    currentHashrate: 1.5,
    temperature: 42,
    batteryLevel: 78,
    uptime: 864000,
    dailyReward: [
      { date: "2026-04-04", mined: 8.64, uptime: 86400 }
    ],
    suspiciousFlags: []
  }
}

// PUT /api/admin/devices/:deviceId/action
{
  body: { action: "throttle|suspend|blacklist" },
  response: { success: true }
}
```

---

### 2.3 收益管理模块

#### 2.3.1 收益统计

```
- 实时总产量（今日、本周、本月、累计）
- 用户收益分布（金字塔、排行榜）
- 提现申请审核（待审、已批准、已驳回）
- 链上交易查询（挖矿奖励、Swap、提现）
```

#### 2.3.2 数据统计 API

```typescript
// GET /api/admin/revenue/stats
{
  response: {
    dailyStats: {
      date: "2026-04-04",
      totalMined: 347222,        // MM
      totalUsers: 48000,
      avgUserReward: 7.23,       // MM
      totalClaimed: 150000,      // MM
      totalSwapped: 120000,      // MM -> USDT
      totalUsdtOut: 120          // USDT
    },
    monthlyStats: {
      totalMined: 10416667,
      totalUsers: 50000,
      cumulative: {
        totalMined: 20833334,
        claimed: 5000000,
        swapped: 4000000
      }
    },
    topMipers: [
      { walletAddress: "0x...", totalMined: 5000, rank: 1 }
    ]
  }
}

// GET /api/admin/claims/pending
{
  response: {
    total: 250,
    claims: [
      {
        _id: ObjectId,
        userWallet: "0x...",
        amount: 1000,             // MM
        type: "reward_claim",
        status: "pending",
        createdAt: "2026-04-04T10:00:00Z"
      }
    ]
  }
}

// PUT /api/admin/claims/:claimId/approve
{
  body: { approvedAmount: 1000 },
  response: { txHash: "0x..." }
}
```

---

### 2.4 风控与反作弊模块

#### 2.4.1 风险检测规则

```javascript
// 作弊检测模型
const suspiciousPatterns = [
  {
    name: "Multi-Device-Cheat",
    rule: "同一用户多个设备算力同时激增",
    threshold: 3,  // 3个设备
    action: "flag_review"
  },
  {
    name: "Impossible-Hashrate",
    rule: "设备算力超过物理上限",
    threshold: 10,  // 10 MH/s 以上为异常
    action: "suspend"
  },
  {
    name: "Claim-Spam",
    rule: "频繁提交微小金额提现请求",
    threshold: 10,  // 10分钟内5次
    action: "rate_limit"
  },
  {
    name: "Geolocation-Anomaly",
    rule: "短时间内地理位置跨度异常",
    threshold: 1000,  // 1000km in 10 min
    action: "flag_review"
  }
];
```

#### 2.4.2 风控 API

```typescript
// GET /api/admin/risk/alerts
{
  response: {
    critical: 5,          // 关键风险
    warning: 23,          // 警告
    info: 150,            // 信息
    recentAlerts: [
      {
        id: "alert_123",
        type: "Multi-Device-Cheat",
        severity: "critical",
        users: ["0x...", "0x..."],
        confidence: 0.95,
        createdAt: "2026-04-04T10:00:00Z",
        status: "pending_review"
      }
    ]
  }
}

// PUT /api/admin/risk/alerts/:alertId/resolve
{
  body: { action: "approve|suspend|ignore" },
  response: { success: true }
}
```

---

### 2.5 财务与提现管理模块

#### 2.5.1 提现流程

```
用户发起提现 (MM 或 USDT)
    ↓
智能合约验证 (gas 费用、频率限制)
    ↓
后台审核 (如超过日额度 5k)
    ↓
自动转账 (Swap MM→USDT + 链上转账)
    ↓
用户到账
```

#### 2.5.2 财务报表 API

```typescript
// GET /api/admin/finance/report
{
  query: {
    startDate: "2026-04-01",
    endDate: "2026-04-04"
  },
  response: {
    period: {
      startDate: "2026-04-01",
      endDate: "2026-04-04"
    },
    income: {
      miningReward: 1388888,    // MM
      platformFee: 69444,       // MM (5%)
      lpFee: 97222              // MM (为流动性提供者）
    },
    expense: {
      userClaimed: 500000,      // MM
      userSwapped: 400000,      // MM -> 400 USDT
      liquidityProvision: 50000 // MM
    },
    balance: {
      in_contract: 5000000,     // MM 在链上锁定
      in_liquidity: 100000,     // MM in LP池
      reserve_usdt: 50000       // USDT 储备金
    },
    metrics: {
      platformEarnings: 69444,  // MM （一周收益）
      networkHashrate: 75000,   // MH/s
      activeUsers: 48000,
      churnRate: 0.03           // 3%
    }
  }
}

// GET /api/admin/withdrawals/history
{
  response: {
    total: 1000,
    withdrawals: [
      {
        id: "wd_123",
        user: "0x...",
        amount: 100,
        type: "MM_TO_USDT",
        usdtAmount: 0.1,
        status: "completed",
        txHash: "0x...",
        fee: 0.0003,  // USDT
        createdAt: "2026-04-04T10:00:00Z",
        completedAt: "2026-04-04T10:05:00Z"
      }
    ]
  }
}
```

---

### 2.6 系统配置与参数管理

#### 2.6.1 可调参数

```javascript
const systemConfig = {
  mining: {
    dailyRelease: 347222,          // MM
    minHashrate: 0.1,               // MH/s
    maxHashrate: 10,                // MH/s（防止单机垄断）
    difficultyAdjustmentPeriod: 7   // 天
  },
  swap: {
    feeRate: 0.005,                 // 0.5%
    slippage: 0.03,                 // 最大3%滑点
    minAmount: 100                  // 100 MM 最小兑换额
  },
  claim: {
    cooldown: 3600,                 // 秒
    dailyLimit: 100000,             // MM
    firstMonthLock: 7 * 24 * 3600   // 首月锁仓7天
  },
  riskControl: {
    multiDeviceThreshold: 3,
    maxHashratePhysical: 10,        // MH/s
    geolocationAnomalyKm: 1000,
    claimSpamThreshold: 5
  }
};
```

#### 2.6.2 配置管理 API

```typescript
// GET /api/admin/config
{ response: { config: systemConfig } }

// PUT /api/admin/config
{
  body: { 
    key: "mining.dailyRelease",
    value: 347222
  },
  response: { 
    success: true, 
    updateAt: "2026-04-04T10:00:00Z",
    approvedBy: "admin_wallet_0x..."
  }
}
```

---

### 2.7 日志与审计

#### 2.7.1 审计日志

```typescript
// AuditLog Collection
{
  _id: ObjectId,
  adminWallet: "0x...",
  action: "user_ban|device_suspend|reward_adjust|config_change",
  target: "user_0x..." | "device_xxx",
  changes: { before: {}, after: {} },
  reason: "Cheat detection",
  timestamp: Timestamp,
  txHash?: "0x..." // 链上交易哈希（如适用）
}
```

#### 2.7.2 审计 API

```typescript
// GET /api/admin/audit/logs
{
  query: {
    page: 1,
    limit: 50,
    adminWallet?: "0x...",
    action?: "user_ban|device_suspend",
    startDate?: "2026-04-01"
  },
  response: {
    total: 5000,
    logs: [
      {
        _id: ObjectId,
        adminWallet: "0x...",
        action: "user_ban",
        target: "0x...",
        reason: "Multi-device cheat detected",
        timestamp: "2026-04-04T10:00:00Z"
      }
    ]
  }
}
```

---

## 3. 后台管理系统架构

### 3.1 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript | 后台 UI |
| 状态管理 | Redux Toolkit | 全局状态 |
| UI 组件 | Ant Design / Material-UI | 组件库 |
| 图表 | ECharts / Chart.js | 数据可视化 |
| HTTP | Axios | API 请求 |
| 后端 | Node.js + Express | REST API |
| 数据库 | MongoDB | 用户/设备数据 |
| 缓存 | Redis | 缓存热数据 |
| 区块链 | Ethers.js + Viem | 链交互 |
| 部署 | Docker + K8s | 容器化部署 |

### 3.2 部署架构

```
┌─────────────────────────────────────────────┐
│        Cloudflare CDN / WAF                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│  K8s Cluster (负载均衡)                      │
├─────────────────────────────────────────────┤
│  Pod 1: Admin API (Node.js)                 │
│  Pod 2: Admin API (Node.js)                 │
│  Pod 3: Worker (数据清理)                   │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌────────┐  ┌──────────┐
│MongoDB  │  │ Redis  │  │ AWS S3   │
│ Replica │  │Cluster │  │(日志备份)│
└─────────┘  └────────┘  └──────────┘
    │
    └── 每周备份 → AWS S3
```

---

## 4. 安全考虑

### 4.1 权限管理

```javascript
const roles = {
  super_admin: ["*"],                    // 完全权限
  operations: ["user.*", "device.*"],    // 用户运维
  finance: ["claim.*", "withdrawal.*"],  // 财务审核
  risk: ["risk.*"],                      // 风控审查
  viewer: ["*.read"]                     // 仅查看
};
```

### 4.2 多签管理

```solidity
// 重要操作需要多签（2/3）
- 提高参数限额
- 禁用合约
- 提现大额资金
- 升级代码

多签管理员钱包：
  1. Operator: 0x... (日常操作)
  2. Finance: 0x... (财务审批)
  3. Security: 0x... (安全审批)
```

### 4.3 数据加密

- 所有 API 通信使用 HTTPS
- 敏感参数（私钥）存储在 AWS KMS
- 数据库备份使用 AES-256 加密

---

## 5. 监控与告警

```
指标监控：
- API 响应时间 (SLA: < 200ms)
- 数据库查询性能
- 区块链 RPC 调用成功率
- 系统错误率 (SLA: < 0.1%)

告警规则：
- 异常交易量 (日均 ±30% 算作异常)
- API 响应时间 > 1s
- 数据库连接池耗尽
- 区块链网络分叉检测
```

---

## 总结

MinerHub 后台管理系统核心包括：
1. **用户运维** - 账户管理、状态控制
2. **矿机监控** - 实时算力、设备健康
3. **收益审单** - 提现申请、财务报表
4. **风控反作弊** - 多维度风险检测
5. **参数管理** - 系统配置、多签执行
6. **审计日志** - 操作追溯、合规性

所有重要操作都需多签批准，确保去中心化治理的同时保留必要的运营灵活性。
