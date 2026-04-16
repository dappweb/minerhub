# USDT 部署指南

## 当前状态

系统已配置为支持两种 USDT 模式：

### 模式 1: USDT Mock（默认）✅
- **状态**: 当前正在使用
- **优点**: 
  - ✅ 完全自主可控
  - ✅ 用于测试和开发
  - ✅ 部署者无需预先拥有 USDT
  - ✅ 可以快速初始化流动性
- **部署者余额**: ~10M USDT（模拟）
- **配置**: `USDT_MODE=mock` in `.env`
- **合约地址（当前）**: 0xFab305eF0B39dB510386c6CD7f32a3841118A71D

### 模式 2: 真实 USDT
- **状态**: 可选，需要手动启用
- **用途**: 生产环境或真实测试
- **BSC Testnet 地址**: 0x337610d27c682E347C9cD60BD4b3b107C9d34585
- **前提条件**: 部署者必须预先拥有至少 50,000 USDT
- **配置**: `USDT_MODE=real` in `.env`

## 如何切换为真实 USDT

### 步骤 1: 获取真实 USDT
首先确保部署者地址 `0x744447d8580EB900b199e852C132F626247a36F7` 拥有至少 50,000 USDT：

```bash
# 选项 A: 从链上的 USDT faucet 领取
# https://testfaucet.binance.org （某些时段可用）

# 选项 B: 从其他账户转入

# 选项 C: 通过 DeFi 交易获取
```

### 步骤 2: 更新配置文件
编辑 `contracts/.env`：
```bash
USDT_MODE=real
USDT_ADDRESS=0x337610d27c682E347C9cD60BD4b3b107C9d34585
```

### 步骤 3: 重新部署
```bash
cd contracts
npm run deploy:bsc
```

部署脚本会自动：
1. 检测 `USDT_MODE=real`
2. 连接到真实 USDT 合约
3. 验证部署者拥有足够的 USDT 余额 (≥ 50,000)
4. 自动批准并初始化流动性
5. 更新 `deployment.json`

### 步骤 4: 同步配置
```bash
npm run sync-env
```

这会将真实 USDT 地址更新到所有环境文件：
- `.env.local`（前端）
- `app-client/.env.local`（App）
- `backend/.dev.vars`（后端）

## 快速参考

| 操作 | 命令 |
|------|------|
| **当前状态查询** | `grep USDT deployment.json` |
| **预览变更（不执行）** | `USDT_MODE=real npm run deploy:bsc --dry-run` |
| **部署 Mock USDT** | `USDT_MODE=mock npm run deploy:bsc` |
| **部署真实 USDT** | `USDT_MODE=real npm run deploy:bsc` |
| **检查部署者 USDT 余额** | 查看 BSCScan 或执行链上查询 |

## 故障排除

### ❌ "Insufficient USDT balance for liquidity!"
- **原因**: 部署者没有 50,000 USDT
- **解决**: 先获取真实 USDT，或切换回 `USDT_MODE=mock`

### ❌ "replacement transaction underpriced"
- **原因**: Gas 价格设置过低
- **解决**: 已在 `hardhat.config.ts` 中优化，如仍有问题请检查网络状态

### ❌ 部署后合约不可交互
- **原因**: 环境变量未同步
- **解决**: 运行 `npm run sync-env`，然后重启前端/App

## 架构说明

```
部署流程:
  USDT_MODE=mock → 部署 USDT_Mock.sol
              → SwapRouter 与 Mock USDT 交互
              
  USDT_MODE=real → 连接真实 USDT (0x337610d27c682E347C9cD60BD4b3b107C9d34585)
              → SwapRouter 与真实 USDT 交互
              → 需要部署者预先拥有 50K USDT
```

## 生产环境建议

- 👥 **多签钱包**: 使用多签钱包作为部署者
- 🔒 **私钥安全**: 使用 HSM 或类似的密钥管理方案
- 🧪 **测试**: 先在测试网使用 Mock USDT 验证流程
- 📝 **部署记录**: 保存 `deployment.json` 和部署日志作为审计记录
