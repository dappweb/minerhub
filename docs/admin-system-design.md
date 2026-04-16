# Coin Planet 鍚庡彴绠＄悊绯荤粺璁捐

## 1. 绯荤粺鏋舵瀯姒傝

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹?     Web 鍚庡彴绠＄悊绯荤粺锛圧eact + Web3锛?    鈹?
鈹? - 杩愯惀鍥㈤槦銆佽储鍔°€佹妧鏈敮鎸?             鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
               鈹?
    鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
    鈻?                    鈻?
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?     鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹?鍚庡彴 API    鈹?     鈹?鍖哄潡閾剧綉缁?   鈹?
鈹?(Node.js)   鈹?     鈹?(Base+BSC Testnet)鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?     鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
    鈹?
    鈹溾攢 MongoDB锛堢敤鎴锋暟鎹級
    鈹溾攢 Redis锛堢紦瀛橈級
    鈹斺攢 AWS S3锛堟棩蹇楋級
```

---

## 2. 鍚庡彴绠＄悊绯荤粺妯″潡璁捐

### 2.1 鐢ㄦ埛绠＄悊妯″潡

#### 2.1.1 鐢ㄦ埛鏁版嵁缁撴瀯

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
  referrer: "0x..." // 鎺ㄨ崘浜哄湴鍧€锛堢敤浜庤繑浣ｏ級
}
```

#### 2.1.2 鐢ㄦ埛绠＄悊鍔熻兘

```
- 鐢ㄦ埛鎼滅储锛堟寜閽卞寘銆侀偖绠便€丏eviceID锛?
- 鐢ㄦ埛鐘舵€佺鐞嗭紙鍚敤/绂佺敤/灏佺锛?
- 鐢ㄦ埛璇︽儏鏌ョ湅锛堟寲鐭挎暟鎹€佹敹鐩婄粺璁★級
- 鎵归噺鎿嶄綔锛堝鍑恒€佸皝绂併€佹縺鍔憋級
- 椋庨櫓璇嗗埆锛堝紓甯歌涓恒€佸璐︽埛銆佸埛鍗曪級
```

#### 2.1.3 鍚庡彴 API - 鐢ㄦ埛妯″潡

```typescript
// GET /api/admin/users - 鍒嗛〉鑾峰彇鐢ㄦ埛鍒楄〃
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

### 2.2 鐭挎満绠＄悊妯″潡

#### 2.2.1 璁惧鏁版嵁缁撴瀯

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
    averageHashrate: 1.45,     // 24h 骞冲潎
    temperature: 42,            // 鈩?
    cpuUsage: 65,               // %
    batteryLevel: 78,           // %
    networkQuality: 95          // %
  },
  uptime: 864000,              // 绉?
  lastSeen: Timestamp,
  totalMined: 500,             // SUPER
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

#### 2.2.2 鐭挎満绠＄悊鍔熻兘

```
- 瀹炴椂璁惧鐩戞帶锛堝湪绾?绂荤嚎鐘舵€侊級
- 绠楀姏鍒嗗竷缁熻锛堟€荤畻鍔涖€佸崟鏈虹畻鍔涙帓琛岋級
- 璁惧鍋ュ悍鐩戞帶锛堟俯搴︺€佺數閲忋€佺綉缁滐級
- 寮傚父璁惧棰勮锛堟帀绾裤€佺畻鍔涘紓甯搞€佸璁惧浣滃紛锛?
- 鎵归噺绠＄悊锛堥粦鍚嶅崟銆侀檺娴併€佸仠姝級
```

#### 2.2.3 鍚庡彴 API - 鐭挎満妯″潡

```typescript
// GET /api/admin/devices - 璁惧缁熻
{
  response: {
    totalDevices: 50000,
    activeDevices: 38000,
    totalHashrate: 75000,     // MH/s
    avgHashrate: 1.97,        // 骞冲潎鍗曟満
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

### 2.3 鏀剁泭绠＄悊妯″潡

#### 2.3.1 鏀剁泭缁熻

```
- 瀹炴椂鎬讳骇閲忥紙浠婃棩銆佹湰鍛ㄣ€佹湰鏈堛€佺疮璁★級
- 鐢ㄦ埛鏀剁泭鍒嗗竷锛堥噾瀛楀銆佹帓琛屾锛?
- 鎻愮幇鐢宠瀹℃牳锛堝緟瀹°€佸凡鎵瑰噯銆佸凡椹冲洖锛?
- 閾句笂浜ゆ槗鏌ヨ锛堟寲鐭垮鍔便€丼wap銆佹彁鐜帮級
```

#### 2.3.2 鏁版嵁缁熻 API

```typescript
// GET /api/admin/revenue/stats
{
  response: {
    dailyStats: {
      date: "2026-04-04",
      totalMined: 347222,        // SUPER
      totalUsers: 48000,
      avgUserReward: 7.23,       // SUPER
      totalClaimed: 150000,      // SUPER
      totalSwapped: 120000,      // SUPER -> USDT
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
        amount: 1000,             // SUPER
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

### 2.4 椋庢帶涓庡弽浣滃紛妯″潡

#### 2.4.1 椋庨櫓妫€娴嬭鍒?

```javascript
// 浣滃紛妫€娴嬫ā鍨?
const suspiciousPatterns = [
  {
    name: "Multi-Device-Cheat",
    rule: "鍚屼竴鐢ㄦ埛澶氫釜璁惧绠楀姏鍚屾椂婵€澧?,
    threshold: 3,  // 3涓澶?
    action: "flag_review"
  },
  {
    name: "Impossible-Hashrate",
    rule: "璁惧绠楀姏瓒呰繃鐗╃悊涓婇檺",
    threshold: 10,  // 10 MH/s 浠ヤ笂涓哄紓甯?
    action: "suspend"
  },
  {
    name: "Claim-Spam",
    rule: "棰戠箒鎻愪氦寰皬閲戦鎻愮幇璇锋眰",
    threshold: 10,  // 10鍒嗛挓鍐?娆?
    action: "rate_limit"
  },
  {
    name: "Geolocation-Anomaly",
    rule: "鐭椂闂村唴鍦扮悊浣嶇疆璺ㄥ害寮傚父",
    threshold: 1000,  // 1000km in 10 min
    action: "flag_review"
  }
];
```

#### 2.4.2 椋庢帶 API

```typescript
// GET /api/admin/risk/alerts
{
  response: {
    critical: 5,          // 鍏抽敭椋庨櫓
    warning: 23,          // 璀﹀憡
    info: 150,            // 淇℃伅
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

### 2.5 璐㈠姟涓庢彁鐜扮鐞嗘ā鍧?

#### 2.5.1 鎻愮幇娴佺▼

```
鐢ㄦ埛鍙戣捣鎻愮幇 (SUPER 鎴?USDT)
    鈫?
鏅鸿兘鍚堢害楠岃瘉 (gas 璐圭敤銆侀鐜囬檺鍒?
    鈫?
鍚庡彴瀹℃牳 (濡傝秴杩囨棩棰濆害 5k)
    鈫?
鑷姩杞处 (Swap MM鈫扷SDT + 閾句笂杞处)
    鈫?
鐢ㄦ埛鍒拌处
```

#### 2.5.2 璐㈠姟鎶ヨ〃 API

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
      miningReward: 1388888,    // SUPER
      platformFee: 69444,       // SUPER (5%)
      lpFee: 97222              // SUPER (涓烘祦鍔ㄦ€ф彁渚涜€咃級
    },
    expense: {
      userClaimed: 500000,      // SUPER
      userSwapped: 400000,      // SUPER -> 400 USDT
      liquidityProvision: 50000 // SUPER
    },
    balance: {
      in_contract: 5000000,     // SUPER 鍦ㄩ摼涓婇攣瀹?
      in_liquidity: 100000,     // SUPER in LP姹?
      reserve_usdt: 50000       // USDT 鍌ㄥ閲?
    },
    metrics: {
      platformEarnings: 69444,  // SUPER 锛堜竴鍛ㄦ敹鐩婏級
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
        type: "SUPER_TO_USDT",
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

### 2.6 绯荤粺閰嶇疆涓庡弬鏁扮鐞?

#### 2.6.1 鍙皟鍙傛暟

```javascript
const systemConfig = {
  mining: {
    dailyRelease: 347222,          // SUPER
    minHashrate: 0.1,               // MH/s
    maxHashrate: 10,                // MH/s锛堥槻姝㈠崟鏈哄瀯鏂級
    difficultyAdjustmentPeriod: 7   // 澶?
  },
  swap: {
    feeRate: 0.005,                 // 0.5%
    slippage: 0.03,                 // 鏈€澶?%婊戠偣
    minAmount: 100                  // 100 SUPER 鏈€灏忓厬鎹㈤
  },
  claim: {
    cooldown: 3600,                 // 绉?
    dailyLimit: 100000,             // SUPER
    firstMonthLock: 7 * 24 * 3600   // 棣栨湀閿佷粨7澶?
  },
  riskControl: {
    multiDeviceThreshold: 3,
    maxHashratePhysical: 10,        // MH/s
    geolocationAnomalyKm: 1000,
    claimSpamThreshold: 5
  }
};
```

#### 2.6.2 閰嶇疆绠＄悊 API

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

### 2.7 鏃ュ織涓庡璁?

#### 2.7.1 瀹¤鏃ュ織

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
  txHash?: "0x..." // 閾句笂浜ゆ槗鍝堝笇锛堝閫傜敤锛?
}
```

#### 2.7.2 瀹¤ API

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

## 3. 鍚庡彴绠＄悊绯荤粺鏋舵瀯

### 3.1 鎶€鏈爤

| 妯″潡 | 鎶€鏈?| 璇存槑 |
|------|------|------|
| 鍓嶇 | React 18 + TypeScript | 鍚庡彴 UI |
| 鐘舵€佺鐞?| Redux Toolkit | 鍏ㄥ眬鐘舵€?|
| UI 缁勪欢 | Ant Design / Material-UI | 缁勪欢搴?|
| 鍥捐〃 | ECharts / Chart.js | 鏁版嵁鍙鍖?|
| HTTP | Axios | API 璇锋眰 |
| 鍚庣 | Node.js + Express | REST API |
| 鏁版嵁搴?| MongoDB | 鐢ㄦ埛/璁惧鏁版嵁 |
| 缂撳瓨 | Redis | 缂撳瓨鐑暟鎹?|
| 鍖哄潡閾?| Ethers.js + Viem | 閾句氦浜?|
| 閮ㄧ讲 | Docker + K8s | 瀹瑰櫒鍖栭儴缃?|

### 3.2 閮ㄧ讲鏋舵瀯

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹?       Cloudflare CDN / WAF                  鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
                   鈹?
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹? K8s Cluster (璐熻浇鍧囪　)                      鈹?
鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹? Pod 1: Admin API (Node.js)                 鈹?
鈹? Pod 2: Admin API (Node.js)                 鈹?
鈹? Pod 3: Worker (鏁版嵁娓呯悊)                   鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
                   鈹?
    鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
    鈻?             鈻?             鈻?
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹侻ongoDB  鈹? 鈹?Redis  鈹? 鈹?AWS S3   鈹?
鈹?Replica 鈹? 鈹侰luster 鈹? 鈹?鏃ュ織澶囦唤)鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
    鈹?
    鈹斺攢鈹€ 姣忓懆澶囦唤 鈫?AWS S3
```

---

## 4. 瀹夊叏鑰冭檻

### 4.1 鏉冮檺绠＄悊

```javascript
const roles = {
  super_admin: ["*"],                    // 瀹屽叏鏉冮檺
  operations: ["user.*", "device.*"],    // 鐢ㄦ埛杩愮淮
  finance: ["claim.*", "withdrawal.*"],  // 璐㈠姟瀹℃牳
  risk: ["risk.*"],                      // 椋庢帶瀹℃煡
  viewer: ["*.read"]                     // 浠呮煡鐪?
};
```

### 4.2 澶氱绠＄悊

```solidity
// 閲嶈鎿嶄綔闇€瑕佸绛撅紙2/3锛?
- 鎻愰珮鍙傛暟闄愰
- 绂佺敤鍚堢害
- 鎻愮幇澶ч璧勯噾
- 鍗囩骇浠ｇ爜

澶氱绠＄悊鍛橀挶鍖咃細
  1. Operator: 0x... (鏃ュ父鎿嶄綔)
  2. Finance: 0x... (璐㈠姟瀹℃壒)
  3. Security: 0x... (瀹夊叏瀹℃壒)
```

### 4.3 鏁版嵁鍔犲瘑

- 鎵€鏈?API 閫氫俊浣跨敤 HTTPS
- 鏁忔劅鍙傛暟锛堢閽ワ級瀛樺偍鍦?AWS KMS
- 鏁版嵁搴撳浠戒娇鐢?AES-256 鍔犲瘑

---

## 5. 鐩戞帶涓庡憡璀?

```
鎸囨爣鐩戞帶锛?
- API 鍝嶅簲鏃堕棿 (SLA: < 200ms)
- 鏁版嵁搴撴煡璇㈡€ц兘
- 鍖哄潡閾?RPC 璋冪敤鎴愬姛鐜?
- 绯荤粺閿欒鐜?(SLA: < 0.1%)

鍛婅瑙勫垯锛?
- 寮傚父浜ゆ槗閲?(鏃ュ潎 卤30% 绠椾綔寮傚父)
- API 鍝嶅簲鏃堕棿 > 1s
- 鏁版嵁搴撹繛鎺ユ睜鑰楀敖
- 鍖哄潡閾剧綉缁滃垎鍙夋娴?
```

---

## 鎬荤粨

Coin Planet 鍚庡彴绠＄悊绯荤粺鏍稿績鍖呮嫭锛?
1. **鐢ㄦ埛杩愮淮** - 璐︽埛绠＄悊銆佺姸鎬佹帶鍒?
2. **鐭挎満鐩戞帶** - 瀹炴椂绠楀姏銆佽澶囧仴搴?
3. **鏀剁泭瀹″崟** - 鎻愮幇鐢宠銆佽储鍔℃姤琛?
4. **椋庢帶鍙嶄綔寮?* - 澶氱淮搴﹂闄╂娴?
5. **鍙傛暟绠＄悊** - 绯荤粺閰嶇疆銆佸绛炬墽琛?
6. **瀹¤鏃ュ織** - 鎿嶄綔杩芥函銆佸悎瑙勬€?

鎵€鏈夐噸瑕佹搷浣滈兘闇€澶氱鎵瑰噯锛岀‘淇濆幓涓績鍖栨不鐞嗙殑鍚屾椂淇濈暀蹇呰鐨勮繍钀ョ伒娲绘€с€?

