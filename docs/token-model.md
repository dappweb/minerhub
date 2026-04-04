# MinerHub MM 代币与挖矿系统设计

## 1. MM 代币模型

### 代币基本信息
- **代币名称**：MinerHub Miner Token
- **代币符号**：MM
- **总供应量**：1,000,000,000 MM（10亿枚）
- **小数位数**：18
- **合约标准**：ERC20 + ERC20Burnable

### 代币分配方案

| 分配类别 | 占比 | 数量 | 用途 |
|---------|------|------|------|
| 挖矿奖励池 | 50% | 500,000,000 | 用户挖矿收益（4年线性释放） |
| 生态基金 | 20% | 200,000,000 | 生态建设、营销、激励 |
| 团队锁仓 | 15% | 150,000,000 | 团队激励（2年锁仓 + 2年线性解锁） |
| 早期投资者 | 10% | 100,000,000 | 融资（1年线性解锁） |
| 储备金 | 5% | 50,000,000 | 风险储备、流动性 |

### 代币释放机制

```
挖矿奖励释放曲线（4年）:
年份1：月产量 10,416,667 MM（总计 125M）
年份2：月产量 10,416,667 MM（总计 125M）
年份3：月产量 10,416,667 MM（总计 125M）
年份4：月产量 10,416,667 MM（总计 125M）

每月一次自动释放，通过 TimeLock 合约保证进度不可逆转。
```

---

## 2. App 端（矿机 App）绑定流程

### 2.1 用户注册与钱包生成

1. **首次安装**
   - 用户在 App 内一键生成本地非托管钱包（基于 TEE 硬件加密）
   - 私钥永不离开设备，存储在安全芯片中
   - 生成 Derived Address（派生地址），用于链上身份绑定

2. **身份绑定**
   ```solidity
   // 合约调用
   function registerMiner(
       address minerAddress,
       string memory deviceId,
       string memory appVersion
   ) external {
       require(miners[minerAddress].registered == false, "Already registered");
       miners[minerAddress] = Miner({
           registered: true,
           registeredAt: block.timestamp,
           deviceId: deviceId,
           totalMined: 0,
           claimed: 0
       });
   }
   ```

3. **设备绑定** - 一个钱包仅可绑定一个设备
   ```solidity
   mapping(string => address) public deviceToMiner;
   ```

### 2.2 挖矿权限与防作弊

- **设备签名验证**：每次挖矿提交都需 TEE 签名
- **设备唯一性**：IMEI + 设备指纹 hash 验证
- **算力上报机制**：App 每分钟上报一次算力证明

---

## 3. 代币分配与挖矿逻辑

### 3.1 挖矿奖励计算

```solidity
// 挖矿奖励率
MiningReward = (设备算力 * 难度系数 * 时间段) / 总网络算力

// 示例：
// - 单台设备算力：1 MH/s
// - 全网总算力：10,000 MH/s
// - 每天总产量：86,400 MM
// - 单设备日产量：86,400 * (1 / 10,000) = 8.64 MM
```

### 3.2 日产量分配规则

```
总日产量 = 365 * 月释放量 / (12 * 30)

示例（第一年）：
月释放量：10,416,667 MM
日释放量：347,222 MM
分配给用户：347,222 * 95% = 329,861 MM
平台/运营费：347,222 * 5% = 17,361 MM
```

### 3.3 挖矿参数

```solidity
struct MiningConfig {
    uint256 dailyRelease;           // 每日释放量
    uint256 minimalHashrate;        // 最小算力要求（MH/s）
    uint256 maximalHashrate;        // 最大算力上限（防止单个设备垄断）
    uint256 adjustmentPeriod;       // 难度调整周期（天）
    uint256 claimCooldown;          // 提取冷却时间（天）
}
```

---

## 4. Swap 兑换设计（MM ↔ USDT）

### 4.1 Swap 池结构

```solidity
interface ISwapPool {
    // 兑换对：MM/USDT
    // 采用 Uniswap v3 或自实现 AMM
    
    function swapMmToUsdt(
        uint256 mmAmount,
        uint256 minUsdtOut
    ) external returns (uint256 usdtAmount);
    
    function swapUsdtToMm(
        uint256 usdtAmount,
        uint256 minMmOut
    ) external returns (uint256 mmAmount);
    
    function getSwapPrice(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}
```

### 4.2 兑换费用结构

```
手续费：0.3% - 1.0%（可配）
结构：
- 70% → 流动性提供者
- 20% → 平台
- 10% → 生态基金

示例：用户兑换 1000 MM → USDT
假设当前价格：1000 MM = 1 USDT
兑换费用：1 USDT * 0.5% = 0.005 USDT
用户实际获得：0.995 USDT
```

### 4.3 初始流动性

```
流动性池初始化：
- MM：50,000,000 枚
- USDT：50,000 枚
- 目标价格：1 MM = 0.001 USDT

日后可通过 LP 机制引入社区流动性提供者。
```

### 4.4 防滑点与闪电贷保护

```solidity
// 最大滑点：3%
// 闪电贷防护：同一交易块内不允许连续操作
// 价格预言机：使用 Time-Weighted Average Price (TWAP)
```

---

## 5. 挖矿收益提取流程

### 5.1 实时收益计算

```solidity
function getPendingReward(address miner) external view returns (uint256) {
    MinerInfo storage info = miners[miner];
    uint256 timePassed = block.timestamp - info.lastClaimTime;
    uint256 pendingReward = (info.hashrate * timePassed * rewardRate) / 1e18;
    return info.totalReward - info.claimed + pendingReward;
}
```

### 5.2 分批提取机制

- **日提取额度**：不限制
- **周提取额度**：无限制
- **月锁仓期**：首月需锁仓7天后可提取30%

```solidity
function claimReward(uint256 amount) external {
    require(amount <= getPendingReward(msg.sender), "Insufficient reward");
    require(block.timestamp >= lastClaim[msg.sender] + claimCooldown, "Cooldown");
    
    miners[msg.sender].claimed += amount;
    MM.transfer(msg.sender, amount);
    
    lastClaim[msg.sender] = block.timestamp;
}
```

---

## 6. 智能合约架构

### 6.1 核心合约列表

| 合约名 | 功能 | 部署地址 |
|-------|------|---------|
| MM.sol | ERC20 代币 | 独立部署 |
| MinerRegistry.sol | 矿工注册与管理 | 后续部署 |
| MiningPool.sol | 挖矿奖励分配 | 后续部署 |
| SwapRouter.sol | MM/USDT 兑换 | 后续部署 |
| RewardVesting.sol | 代币解锁时间锁 | 后续部署 |

### 6.2 合约交互流程

```
App用户 → 注册钱包 → MinerRegistry.registerMiner()
              ↓
         设置算力参数 → MiningPool.updateHashrate()
              ↓
         每日上报算力 → MiningPool.submitProof()
              ↓
         实时计算收益 → MiningPool.getPendingReward()
              ↓
         提取收益 → MiningPool.claimReward()
              ↓
         兑换为 USDT → SwapRouter.swapMmToUsdt()
              ↓
         提现到交易所 → 用户钱包
```

---

## 7. 代币初始化与部署

### 部署网络
- **主网**：Base Mainnet (Chainid: 8453)
- **测试网**：Sepolia (Chainid: 11155111) - 初期测试

### 部署脚本关键步骤

```bash
# 1. 部署 MM 代币
npx hardhat run scripts/deploy-mm-token.js --network sepolia

# 2. 部署矿工注册表
npx hardhat run scripts/deploy-miner-registry.js --network sepolia

# 3. 部署挖矿奖励池
npx hardhat run scripts/deploy-mining-pool.js --network sepolia

# 4. 部署 Swap 路由
npx hardhat run scripts/deploy-swap-router.js --network sepolia

# 5. 初始化流动性
npx hardhat run scripts/init-liquidity.js --network sepolia
```

---

## 8. 经济模型平衡点

### 8.1 供需平衡

| 指标 | 值 | 说明 |
|------|------|------|
| 初始流通量 | 50M | 第一年奖励释放 |
| 年均新增供应 | 125M | 线性释放 |
| 目标年交易量 | 100W | 用户挖矿 + 兑换 |
| 目标通胀率 | 12.5% | 第一年 |

### 8.2 价格稳定机制

1. **动态难度调整**：全网算力 ↑ → 单位奖励 ↓
2. **流动性深度**：初始 50M MM + 50k USDT
3. **激励机制**：LP 提供者获得额外奖励

---

## 系统总结

```
MM代币 ← ERC20标准合约
   ↓
MinerRegistry ← 用户身份/设备绑定
   ↓
MiningPool ← 算力证明 → 每日奖励分配
   ↓
SwapRouter ← 流动性池 → MM/USDT 兑换
   ↓
用户提现 → USDT 到交易所/钱包
```

**安全考虑**：
- 所有重要参数由多签管理员控制
- 合约可升级性：使用 Proxy Pattern
- 审计周期：每季度进行第三方审计
