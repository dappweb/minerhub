# Coin Planet 鏅鸿兘鍚堢害

瀹屾暣鐨?Coin Planet 鎸栫熆鐢熸€佹櫤鑳藉悎绾﹀浠躲€?

## 馃搵 鍚堢害娓呭崟

| 鍚堢害 | 鍔熻兘 | 琛屾暟 |
|------|------|------|
| **SUPER.sol** | ERC20 浠ｅ竵锛屾敮鎸侀摳閫犲拰閿€姣?| ~150 |
| **USDT_Mock.sol** | Sepolia 娴嬭瘯缃戞ā鎷?USDT | ~30 |
| **MiningPool.sol** | 鏍稿績鎸栫熆閫昏緫锛屽鍔辫绠楀垎閰?| ~400 |
| **SwapRouter.sol** | AMM 娴佸姩鎬т氦鎹?(SUPER 鈫?USDT) | ~500 |

**鎬昏**锛殈1080 琛?Solidity 浠ｇ爜

---

## 馃殌 蹇€熷紑濮?

### 1. 瀹夎渚濊禆

```bash
cd contracts
npm install
```

### 2. 閰嶇疆鐜鍙橀噺

鍒涘缓 `.env` 鏂囦欢锛?

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY (鍙€?
```

**鑾峰彇杩欎簺鍊硷細**
- **SEPOLIA_RPC_URL**锛氳闂?[Infura](https://www.infura.io/) 鎴?[Alchemy](https://www.alchemy.com/) 鑾峰彇鍏嶈垂 API Key
- **DEPLOYER_PRIVATE_KEY**锛氫粠 MetaMask 瀵煎嚭绉侀挜锛堥渶瑕佹湁 Sepolia ETH 浣欓锛?
- **ETHERSCAN_API_KEY**锛氳闂?[Etherscan](https://etherscan.io/apis) 鑾峰彇 (鐢ㄤ簬鍚堢害楠岃瘉)

### 3. 缂栬瘧鍚堢害

```bash
npm run compile
```

杈撳嚭锛?
```
Compiled 4 Solidity contracts successfully
```

### 4. 杩愯娴嬭瘯

```bash
npm test
```

杈撳嚭锛?
```
Coin Planet Contracts
  SUPER Token
    鉁?Should have correct initial state
    鉁?Should allow minting only by minter
  MiningPool
    鉁?Should allow miner registration
    ...
```

### 5. 閮ㄧ讲鍒?Sepolia

```bash
npm run deploy:sepolia
```

杈撳嚭锛?
```
馃殌 Coin Planet Smart Contracts Deployment Started
鉁?Deployer Address: 0x...
鉁?Deployer Balance: 0.5 ETH

馃摝 Deploying SUPER Token...
鉁?SUPER Token deployed: 0x...

馃摝 Deploying USDT Mock...
鉁?USDT Mock deployed: 0x...

馃摝 Deploying MiningPool...
鉁?MiningPool deployed: 0x...

馃摝 Deploying SwapRouter...
鉁?SwapRouter deployed: 0x...

鉁?Add these to your .env.local:
VITE_SUPER_ADDRESS=0x...
VITE_MINING_POOL_ADDRESS=0x...
VITE_SWAP_ROUTER_ADDRESS=0x...
```

---

## 馃摎 鍚堢害璇﹁В

### SUPER Token

```solidity
IERC20 鏍囧噯 + 棰濆鍔熻兘锛?
- name: "Coin Planet Token"
- symbol: "SUPER"
- total supply: 10 浜?
- mint(): 鍙湁鎺堟潈鐨?Minter 鍙互閾搁€?
- burn(): 浠讳綍鎸佹湁鑰呭彲浠ラ攢姣佷唬甯?
```

**涓昏鏂规硶锛?*
```solidity
addMinter(address _minter)           // 娣诲姞閾搁€犺€呮潈闄?
removeMinter(address _minter)        // 绉婚櫎閾搁€犺€呮潈闄?
mint(address _to, uint256 _amount)   // 閾搁€犳柊浠ｅ竵
burn(uint256 _amount)                // 閿€姣佷唬甯?
```

---

### MiningPool

鏍稿績鎸栫熆閫昏緫鍚堢害銆?

**鍏抽敭姒傚康锛?*
- **绠楀姏 (Hashrate)**锛氱熆宸ヨ绠楄兘鍔涚殑搴﹂噺
- **濂栧姳 (Reward)**锛氭牴鎹畻鍔涘拰鏃堕棿璁＄畻鐨?SUPER 浠ｅ竵濂栧姳
- **鍐峰嵈鏈?(Cooldown)**锛氫袱娆￠鍙栧鍔变箣闂寸殑鏈€灏忔椂闂撮棿闅?
- **閿佷粨鏈?(Lockup)**锛氶娆℃敞鍐屽悗鏃犳硶棰嗗彇濂栧姳鐨勬椂闂?

**涓昏鏂规硶锛?*
```solidity
registerMiner(uint256 _hashrate, string _deviceId)
  -> 娉ㄥ唽鐭垮伐锛屽垵濮嬪寲绠楀姏

updateHashrate(uint256 _newHashrate)
  -> 鏇存柊鐭垮伐绠楀姏锛堟娴嬪紓甯稿闀匡級

calculatePendingReward(address _miner)
  -> 璁＄畻寰呴鍙栧鍔?

claimReward()
  -> 棰嗗彇濂栧姳锛堥渶婊¤冻鍐峰嵈鏈燂級

getMinerInfo(address _miner)
  -> 鑾峰彇鐭垮伐瀹屾暣淇℃伅
```

**濂栧姳鍏紡锛?*
```
鏃ヤ骇鎬婚噺 = 284.7222 涓?SUPER

鐭垮伐鏃ュ鍔?= 鏃ヤ骇鎬婚噺 脳 (鐭垮伐绠楀姏 / 鍏ㄧ悆鎬荤畻鍔?

瀹炴椂濂栧姳 = 鐭垮伐鏃ュ鍔?脳 (缁忚繃鏃堕棿 / 涓€澶?
```

**鍙傛暟閰嶇疆锛?*
- `MIN_HASHRATE`锛?00 (0.1 MH/s)
- `MAX_HASHRATE`锛?0,000,000 (10 MH/s)
- `claimCooldown`锛? 澶?
- `lockupPeriod`锛? 澶?

---

### SwapRouter

AMM (鑷姩鍋氬競鍟? 娴佸姩鎬т氦鎹㈠悎绾︺€?

**娴佸姩鎬ф睜缁勬垚锛?*
- **鍒濆 SUPER**锛?000 涓?
- **鍒濆 USDT**锛? 涓?
- **鍒濆浠锋牸**锛? SUPER 鈮?0.001 USDT

**璐圭敤缁撴瀯锛?*
- **鎬绘墜缁垂**锛?.5%
  - 70% 鈫?LP (娴佸姩鎬ф彁渚涜€?
  - 20% 鈫?骞冲彴
  - 10% 鈫?鐢熸€?

**涓昏鏂规硶锛?*
```solidity
initializeLiquidity(uint256 _superAmount, uint256 _usdtAmount)
  -> 鍒濆鍖栨祦鍔ㄦ€ф睜 (浠?Owner锛屽彧鑳借皟鐢ㄤ竴娆?

addLiquidity(uint256 _superAmount, uint256 _usdtAmount)
  -> 娣诲姞娴佸姩鎬э紝鑾峰緱 LP 浠介

removeLiquidity(uint256 _sharesToBurn)
  -> 绉婚櫎娴佸姩鎬э紝鎻愬彇浠ｅ竵

swapSuperToUsdt(uint256 _superAmount)
  -> SUPER 鍏戞崲 USDT

swapUsdtToSuper(uint256 _usdtAmount)
  -> USDT 鍏戞崲 SUPER

getPrice()
  -> 鑾峰彇褰撳墠 SUPER/USDT 浠锋牸
```

**AMM 鍏紡 (x 脳 y = k)**锛?
```
鍋囪褰撳墠姹犵姸鎬侊細
- reserveSuper = X
- reserveUSDT = Y
- k = X 脳 Y (甯告暟)

鐢ㄦ埛浜ゆ崲 A 涓?SUPER 鑾峰緱澶氬皯 USDT锛?
1. 鍑忓幓鎵嬬画璐癸細A' = A 脳 0.995
2. 璁＄畻鏂版睜鐘舵€侊細newX = X + A'
3. 璁＄畻杈撳嚭锛歯ewY = k / newX
4. 鐢ㄦ埛鑾峰緱锛歒 - newY
```

---

## 馃И 娴嬭瘯

### 杩愯鎵€鏈夋祴璇?

```bash
npm test
```

### 鐢熸垚瑕嗙洊鐜囨姤鍛?

```bash
npm run coverage
```

### 杩愯鐗瑰畾娴嬭瘯

```bash
npx hardhat test test/MiningPool.test.ts
```

### 鏈湴鑺傜偣璋冭瘯

```bash
npx hardhat node
```

鍦ㄥ彟涓€涓粓绔細
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

---

## 馃敆 鍖哄潡娴忚鍣ㄩ獙璇?

### 楠岃瘉鍚堢害

```bash
npm run verify -- CONTRACT_ADDRESS constructor_args
```

绀轰緥锛?
```bash
npm run verify -- 0x1234567890123456789012345678901234567890 "0x0000000000000000000000000000000000000000"
```

### 鏌ョ湅鍚堢害

閮ㄧ讲鍚庯紝璁块棶浠ヤ笅閾炬帴鍦?Sepolia 娴忚鍣ㄦ煡鐪嬶細

```
https://sepolia.etherscan.io/address/0x{CONTRACT_ADDRESS}
```

---

## 馃毃 瀹夊叏鑰冭檻

### 宸插疄鐜扮殑闃叉姢

- 鉁?ReentrancyGuard锛氶槻姝㈤噸鍏ユ敾鍑?
- 鉁?璁块棶鎺у埗锛歄wner/Minter 鏉冮檺妫€鏌?
- 鉁?杈撳叆楠岃瘉锛氬悎绾﹀弬鏁拌寖鍥存鏌?
- 鉁?SafeMath锛歋olidity 0.8+ 鍐呯疆涓婃孩/涓嬫孩淇濇姢
- 鉁?寮傚父妫€娴嬶細鐭垮伐鍙枒鍒嗘暟杩借釜

### 瀹¤寤鸿

1. **鍐呴儴瀹¤**锛?
   - [ ] 浠ｇ爜璧版煡
   - [ ] 鍗曞厓娴嬭瘯瑕嗙洊 >90%
   - [ ] 闆嗘垚娴嬭瘯鎵€鏈夋祦绋?

2. **澶栭儴瀹¤**锛堟帹鑽愶級锛?
   - [ ] 鎻愪氦缁?CertiK 鎴?Trail of Bits
   - [ ] 淇鎵€鏈夊彂鐜扮殑闂
   - [ ] 鑾峰緱瀹¤鎶ュ憡

3. **閮ㄧ讲鍓嶆鏌ユ竻鍗?*锛?
   - [ ] 鎵€鏈夋祴璇曢€氳繃
   - [ ] gas 浼樺寲瀹屾垚
   - [ ] 鏉冮檺閰嶇疆妫€鏌?
   - [ ] 搴旀€ユ殏鍋滄満鍒堕厤缃?

---

## 馃搳 Gas 浼拌

| 鎿嶄綔 | Gas 娑堣€?| USDT 鎴愭湰<br/>(20 Gwei) |
|------|--------|--------|
| SUPER 杞处 | ~50K | $0.01 |
| 鐭垮伐娉ㄥ唽 | ~80K | $0.02 |
| 鏇存柊绠楀姏 | ~60K | $0.01 |
| 棰嗗彇濂栧姳 | ~120K | $0.03 |
| Swap (MM鈫扷SDT) | ~150K | $0.04 |
| 娣诲姞娴佸姩鎬?| ~180K | $0.05 |

---

## 馃幆 閮ㄧ讲娓呭崟

- [ ] 缂栬瘧鎵€鏈夊悎绾︽垚鍔?
- [ ] 鎵€鏈夋祴璇曢€氳繃
- [ ] Sepolia 閮ㄧ讲鎴愬姛
- [ ] 娴佸姩鎬ф睜鍒濆鍖?
- [ ] 姊呮潈闄愰厤缃畬鎴?
- [ ] Etherscan 楠岃瘉鎴愬姛
- [ ] 鍓嶇 .env 鏇存柊
- [ ] 鍚庡彴鍚堢害鍦板潃閰嶇疆鏇存柊
- [ ] 绉诲姩搴旂敤 ABI 鏇存柊
- [ ] CertiK 瀹¤閫氳繃

---

## 馃摫 涓庡墠绔泦鎴?

### 鑾峰彇鍚堢害 ABI

閮ㄧ讲鍚庯紝ABI 鑷姩鐢熸垚鍦細
```
artifacts/contracts/
鈹溾攢鈹€ SUPER.sol/SUPER.json
鈹溾攢鈹€ MiningPool.sol/MiningPool.json
鈹溾攢鈹€ SwapRouter.sol/SwapRouter.json
鈹斺攢鈹€ USDT_Mock.sol/USDT_Mock.json
```

### 鍓嶇璋冪敤绀轰緥

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

// 娉ㄥ唽鐭垮伐
const tx = await miningPool.registerMiner(1000, "device-1");
await tx.wait();

// 鏌ヨ濂栧姳
const pending = await miningPool.calculatePendingReward(userAddress);
console.log("Pending reward:", ethers.formatEther(pending));

// 棰嗗彇濂栧姳
const claimTx = await miningPool.claimReward();
await claimTx.wait();
```

---

## 馃敡 鏁呴殰鎺掗櫎

### "Miner not registered"

纭繚宸茶皟鐢?`registerMiner()` 鍒濆鍖栫熆宸ヨ处鎴枫€?

### "Claim cooldown not met"

闇€瑕佺瓑寰?1 澶╂墠鑳藉啀娆￠鍙栧鍔便€?

### "Insufficient liquidity"

Swap 姹犱腑娴佸姩鎬т笉瓒筹紝绋嶅悗閲嶈瘯鎴栧鍔犳祦鍔ㄦ€с€?

### 閮ㄧ讲澶辫触 "Insufficient funds"

Deployer 璐︽埛 Sepolia ETH 浣欓涓嶈冻銆備粠姘撮緳澶磋幏鍙?Sepolia ETH锛?
- https://www.alchemy.com/faucets/sepolia
- https://sepolia-faucet.pk910.de/

---

## 馃摓 鏀寔

閬囧埌闂锛?

1. 妫€鏌ユ湰鏂囨。鐨勬晠闅滄帓闄ら儴鍒?
2. 鏌ョ湅鍚堢害娉ㄩ噴鍜屾枃妗ｅ瓧绗︿覆
3. 杩愯娴嬭瘯纭繚鏈湴鐜姝ｇ‘
4. 鎻愪氦 Issue 闄勪笂瀹屾暣閿欒鏃ュ織

---

**鏅鸿兘鍚堢害鐗堟湰**锛?.0.0  
**Solidity 鐗堟湰**锛?.8.24  
**鏈€鍚庢洿鏂?*锛?026-04-04


