# MinerHub 智能合约

完整的 MinerHub 挖矿生态智能合约套件。

## 📋 合约清单

| 合约 | 功能 | 行数 |
|------|------|------|
| **MM.sol** | ERC20 代币，支持铸造和销毁 | ~150 |
| **USDT_Mock.sol** | Sepolia 测试网模拟 USDT | ~30 |
| **MiningPool.sol** | 核心挖矿逻辑，奖励计算分配 | ~400 |
| **SwapRouter.sol** | AMM 流动性交换 (MM ↔ USDT) | ~500 |

**总计**：~1080 行 Solidity 代码

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd contracts
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY (可选)
```

**获取这些值：**
- **SEPOLIA_RPC_URL**：访问 [Infura](https://www.infura.io/) 或 [Alchemy](https://www.alchemy.com/) 获取免费 API Key
- **DEPLOYER_PRIVATE_KEY**：从 MetaMask 导出私钥（需要有 Sepolia ETH 余额）
- **ETHERSCAN_API_KEY**：访问 [Etherscan](https://etherscan.io/apis) 获取 (用于合约验证)

### 3. 编译合约

```bash
npm run compile
```

输出：
```
Compiled 4 Solidity contracts successfully
```

### 4. 运行测试

```bash
npm test
```

输出：
```
MinerHub Contracts
  MM Token
    ✓ Should have correct initial state
    ✓ Should allow minting only by minter
  MiningPool
    ✓ Should allow miner registration
    ...
```

### 5. 部署到 Sepolia

```bash
npm run deploy:sepolia
```

输出：
```
🚀 MinerHub Smart Contracts Deployment Started
✓ Deployer Address: 0x...
✓ Deployer Balance: 0.5 ETH

📦 Deploying MM Token...
✓ MM Token deployed: 0x...

📦 Deploying USDT Mock...
✓ USDT Mock deployed: 0x...

📦 Deploying MiningPool...
✓ MiningPool deployed: 0x...

📦 Deploying SwapRouter...
✓ SwapRouter deployed: 0x...

✅ Add these to your .env.local:
VITE_MM_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
VITE_SWAP_ROUTER_ADDRESS=0x...
```

---

## 📚 合约详解

### MM Token

```solidity
IERC20 标准 + 额外功能：
- name: "MinerHub Token"
- symbol: "MM"
- total supply: 10 亿
- mint(): 只有授权的 Minter 可以铸造
- burn(): 任何持有者可以销毁代币
```

**主要方法：**
```solidity
addMinter(address _minter)           // 添加铸造者权限
removeMinter(address _minter)        // 移除铸造者权限
mint(address _to, uint256 _amount)   // 铸造新代币
burn(uint256 _amount)                // 销毁代币
```

---

### MiningPool

核心挖矿逻辑合约。

**关键概念：**
- **算力 (Hashrate)**：矿工计算能力的度量
- **奖励 (Reward)**：根据算力和时间计算的 MM 代币奖励
- **冷却期 (Cooldown)**：两次领取奖励之间的最小时间间隔
- **锁仓期 (Lockup)**：首次注册后无法领取奖励的时间

**主要方法：**
```solidity
registerMiner(uint256 _hashrate, string _deviceId)
  -> 注册矿工，初始化算力

updateHashrate(uint256 _newHashrate)
  -> 更新矿工算力（检测异常增长）

calculatePendingReward(address _miner)
  -> 计算待领取奖励

claimReward()
  -> 领取奖励（需满足冷却期）

getMinerInfo(address _miner)
  -> 获取矿工完整信息
```

**奖励公式：**
```
日产总量 = 284.7222 万 MM

矿工日奖励 = 日产总量 × (矿工算力 / 全球总算力)

实时奖励 = 矿工日奖励 × (经过时间 / 一天)
```

**参数配置：**
- `MIN_HASHRATE`：100 (0.1 MH/s)
- `MAX_HASHRATE`：10,000,000 (10 MH/s)
- `claimCooldown`：1 天
- `lockupPeriod`：7 天

---

### SwapRouter

AMM (自动做市商) 流动性交换合约。

**流动性池组成：**
- **初始 MM**：5000 万
- **初始 USDT**：5 万
- **初始价格**：1 MM ≈ 0.001 USDT

**费用结构：**
- **总手续费**：0.5%
  - 70% → LP (流动性提供者)
  - 20% → 平台
  - 10% → 生态

**主要方法：**
```solidity
initializeLiquidity(uint256 _mmAmount, uint256 _usdtAmount)
  -> 初始化流动性池 (仅 Owner，只能调用一次)

addLiquidity(uint256 _mmAmount, uint256 _usdtAmount)
  -> 添加流动性，获得 LP 份额

removeLiquidity(uint256 _sharesToBurn)
  -> 移除流动性，提取代币

swapMmToUsdt(uint256 _mmAmount)
  -> MM 兑换 USDT

swapUsdtToMm(uint256 _usdtAmount)
  -> USDT 兑换 MM

getPrice()
  -> 获取当前 MM/USDT 价格
```

**AMM 公式 (x × y = k)**：
```
假设当前池状态：
- reserveMM = X
- reserveUSDT = Y
- k = X × Y (常数)

用户交换 A 个 MM 获得多少 USDT？
1. 减去手续费：A' = A × 0.995
2. 计算新池状态：newX = X + A'
3. 计算输出：newY = k / newX
4. 用户获得：Y - newY
```

---

## 🧪 测试

### 运行所有测试

```bash
npm test
```

### 生成覆盖率报告

```bash
npm run coverage
```

### 运行特定测试

```bash
npx hardhat test test/MiningPool.test.ts
```

### 本地节点调试

```bash
npx hardhat node
```

在另一个终端：
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

---

## 🔗 区块浏览器验证

### 验证合约

```bash
npm run verify -- CONTRACT_ADDRESS constructor_args
```

示例：
```bash
npm run verify -- 0x1234567890123456789012345678901234567890 "0x0000000000000000000000000000000000000000"
```

### 查看合约

部署后，访问以下链接在 Sepolia 浏览器查看：

```
https://sepolia.etherscan.io/address/0x{CONTRACT_ADDRESS}
```

---

## 🚨 安全考虑

### 已实现的防护

- ✅ ReentrancyGuard：防止重入攻击
- ✅ 访问控制：Owner/Minter 权限检查
- ✅ 输入验证：合约参数范围检查
- ✅ SafeMath：Solidity 0.8+ 内置上溢/下溢保护
- ✅ 异常检测：矿工可疑分数追踪

### 审计建议

1. **内部审计**：
   - [ ] 代码走查
   - [ ] 单元测试覆盖 >90%
   - [ ] 集成测试所有流程

2. **外部审计**（推荐）：
   - [ ] 提交给 CertiK 或 Trail of Bits
   - [ ] 修复所有发现的问题
   - [ ] 获得审计报告

3. **部署前检查清单**：
   - [ ] 所有测试通过
   - [ ] gas 优化完成
   - [ ] 权限配置检查
   - [ ] 应急暂停机制配置

---

## 📊 Gas 估计

| 操作 | Gas 消耗 | USDT 成本<br/>(20 Gwei) |
|------|--------|--------|
| MM 转账 | ~50K | $0.01 |
| 矿工注册 | ~80K | $0.02 |
| 更新算力 | ~60K | $0.01 |
| 领取奖励 | ~120K | $0.03 |
| Swap (MM→USDT) | ~150K | $0.04 |
| 添加流动性 | ~180K | $0.05 |

---

## 🎯 部署清单

- [ ] 编译所有合约成功
- [ ] 所有测试通过
- [ ] Sepolia 部署成功
- [ ] 流动性池初始化
- [ ] 梅权限配置完成
- [ ] Etherscan 验证成功
- [ ] 前端 .env 更新
- [ ] 后台合约地址配置更新
- [ ] 移动应用 ABI 更新
- [ ] CertiK 审计通过

---

## 📱 与前端集成

### 获取合约 ABI

部署后，ABI 自动生成在：
```
artifacts/contracts/
├── MM.sol/MM.json
├── MiningPool.sol/MiningPool.json
├── SwapRouter.sol/SwapRouter.json
└── USDT_Mock.sol/USDT_Mock.json
```

### 前端调用示例

```typescript
import { ethers } from "ethers";
import MiningPoolABI from "./abi/MiningPool.json";

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const miningPool = new ethers.Contract(
  MINING_POOL_ADDRESS,
  MiningPoolABI,
  signer
);

// 注册矿工
const tx = await miningPool.registerMiner(1000, "device-1");
await tx.wait();

// 查询奖励
const pending = await miningPool.calculatePendingReward(userAddress);
console.log("Pending reward:", ethers.formatEther(pending));

// 领取奖励
const claimTx = await miningPool.claimReward();
await claimTx.wait();
```

---

## 🔧 故障排除

### "Miner not registered"

确保已调用 `registerMiner()` 初始化矿工账户。

### "Claim cooldown not met"

需要等待 1 天才能再次领取奖励。

### "Insufficient liquidity"

Swap 池中流动性不足，稍后重试或增加流动性。

### 部署失败 "Insufficient funds"

Deployer 账户 Sepolia ETH 余额不足。从水龙头获取 Sepolia ETH：
- https://www.alchemy.com/faucets/sepolia
- https://sepolia-faucet.pk910.de/

---

## 📞 支持

遇到问题？

1. 检查本文档的故障排除部分
2. 查看合约注释和文档字符串
3. 运行测试确保本地环境正确
4. 提交 Issue 附上完整错误日志

---

**智能合约版本**：1.0.0  
**Solidity 版本**：0.8.24  
**最后更新**：2026-04-04
