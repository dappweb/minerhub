# Coin Planet SUPER 浠ｅ竵涓庢寲鐭跨郴缁熻璁?

## 1. SUPER 浠ｅ竵妯″瀷

### 浠ｅ竵鍩烘湰淇℃伅
- **浠ｅ竵鍚嶇О**锛欳oin Planet Miner Token
- **浠ｅ竵绗﹀彿**锛歁M
- **鎬讳緵搴旈噺**锛?,000,000,000 MM锛?0浜挎灇锛?
- **灏忔暟浣嶆暟**锛?8
- **鍚堢害鏍囧噯**锛欵RC20 + ERC20Burnable

### 浠ｅ竵鍒嗛厤鏂规

| 鍒嗛厤绫诲埆 | 鍗犳瘮 | 鏁伴噺 | 鐢ㄩ€?|
|---------|------|------|------|
| 鎸栫熆濂栧姳姹?| 50% | 500,000,000 | 鐢ㄦ埛鎸栫熆鏀剁泭锛?骞寸嚎鎬ч噴鏀撅級 |
| 鐢熸€佸熀閲?| 20% | 200,000,000 | 鐢熸€佸缓璁俱€佽惀閿€銆佹縺鍔?|
| 鍥㈤槦閿佷粨 | 15% | 150,000,000 | 鍥㈤槦婵€鍔憋紙2骞撮攣浠?+ 2骞寸嚎鎬цВ閿侊級 |
| 鏃╂湡鎶曡祫鑰?| 10% | 100,000,000 | 铻嶈祫锛?骞寸嚎鎬цВ閿侊級 |
| 鍌ㄥ閲?| 5% | 50,000,000 | 椋庨櫓鍌ㄥ銆佹祦鍔ㄦ€?|

### 浠ｅ竵閲婃斁鏈哄埗

```
鎸栫熆濂栧姳閲婃斁鏇茬嚎锛?骞达級:
骞翠唤1锛氭湀浜ч噺 10,416,667 MM锛堟€昏 125M锛?
骞翠唤2锛氭湀浜ч噺 10,416,667 MM锛堟€昏 125M锛?
骞翠唤3锛氭湀浜ч噺 10,416,667 MM锛堟€昏 125M锛?
骞翠唤4锛氭湀浜ч噺 10,416,667 MM锛堟€昏 125M锛?

姣忔湀涓€娆¤嚜鍔ㄩ噴鏀撅紝閫氳繃 TimeLock 鍚堢害淇濊瘉杩涘害涓嶅彲閫嗚浆銆?
```

---

## 2. App 绔紙鐭挎満 App锛夌粦瀹氭祦绋?

### 2.1 鐢ㄦ埛娉ㄥ唽涓庨挶鍖呯敓鎴?

1. **棣栨瀹夎**
   - 鐢ㄦ埛鍦?App 鍐呬竴閿敓鎴愭湰鍦伴潪鎵樼閽卞寘锛堝熀浜?TEE 纭欢鍔犲瘑锛?
   - 绉侀挜姘镐笉绂诲紑璁惧锛屽瓨鍌ㄥ湪瀹夊叏鑺墖涓?
   - 鐢熸垚 Derived Address锛堟淳鐢熷湴鍧€锛夛紝鐢ㄤ簬閾句笂韬唤缁戝畾

2. **韬唤缁戝畾**
   ```solidity
   // 鍚堢害璋冪敤
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

3. **璁惧缁戝畾** - 涓€涓挶鍖呬粎鍙粦瀹氫竴涓澶?
   ```solidity
   mapping(string => address) public deviceToMiner;
   ```

### 2.2 鎸栫熆鏉冮檺涓庨槻浣滃紛

- **璁惧绛惧悕楠岃瘉**锛氭瘡娆℃寲鐭挎彁浜ら兘闇€ TEE 绛惧悕
- **璁惧鍞竴鎬?*锛欼MEI + 璁惧鎸囩汗 hash 楠岃瘉
- **绠楀姏涓婃姤鏈哄埗**锛欰pp 姣忓垎閽熶笂鎶ヤ竴娆＄畻鍔涜瘉鏄?

---

## 3. 浠ｅ竵鍒嗛厤涓庢寲鐭块€昏緫

### 3.1 鎸栫熆濂栧姳璁＄畻

```solidity
// 鎸栫熆濂栧姳鐜?
MiningReward = (璁惧绠楀姏 * 闅惧害绯绘暟 * 鏃堕棿娈? / 鎬荤綉缁滅畻鍔?

// 绀轰緥锛?
// - 鍗曞彴璁惧绠楀姏锛? MH/s
// - 鍏ㄧ綉鎬荤畻鍔涳細10,000 MH/s
// - 姣忓ぉ鎬讳骇閲忥細86,400 SUPER
// - 鍗曡澶囨棩浜ч噺锛?6,400 * (1 / 10,000) = 8.64 SUPER
```

### 3.2 鏃ヤ骇閲忓垎閰嶈鍒?

```
鎬绘棩浜ч噺 = 365 * 鏈堥噴鏀鹃噺 / (12 * 30)

绀轰緥锛堢涓€骞达級锛?
鏈堥噴鏀鹃噺锛?0,416,667 SUPER
鏃ラ噴鏀鹃噺锛?47,222 SUPER
鍒嗛厤缁欑敤鎴凤細347,222 * 95% = 329,861 SUPER
骞冲彴/杩愯惀璐癸細347,222 * 5% = 17,361 SUPER
```

### 3.3 鎸栫熆鍙傛暟

```solidity
struct MiningConfig {
    uint256 dailyRelease;           // 姣忔棩閲婃斁閲?
    uint256 minimalHashrate;        // 鏈€灏忕畻鍔涜姹傦紙MH/s锛?
    uint256 maximalHashrate;        // 鏈€澶х畻鍔涗笂闄愶紙闃叉鍗曚釜璁惧鍨勬柇锛?
    uint256 adjustmentPeriod;       // 闅惧害璋冩暣鍛ㄦ湡锛堝ぉ锛?
    uint256 claimCooldown;          // 鎻愬彇鍐峰嵈鏃堕棿锛堝ぉ锛?
}
```

---

## 4. Swap 鍏戞崲璁捐锛圡M 鈫?USDT锛?

### 4.1 Swap 姹犵粨鏋?

```solidity
interface ISwapPool {
    // 鍏戞崲瀵癸細MM/USDT
    // 閲囩敤 Uniswap v3 鎴栬嚜瀹炵幇 AMM
    
    function swapSuperToUsdt(
        uint256 superAmount,
        uint256 minUsdtOut
    ) external returns (uint256 usdtAmount);
    
    function swapUsdtToSuper(
        uint256 usdtAmount,
        uint256 minMmOut
    ) external returns (uint256 superAmount);
    
    function getSwapPrice(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}
```

### 4.2 鍏戞崲璐圭敤缁撴瀯

```
鎵嬬画璐癸細0.3% - 1.0%锛堝彲閰嶏級
缁撴瀯锛?
- 70% 鈫?娴佸姩鎬ф彁渚涜€?
- 20% 鈫?骞冲彴
- 10% 鈫?鐢熸€佸熀閲?

绀轰緥锛氱敤鎴峰厬鎹?1000 SUPER 鈫?USDT
鍋囪褰撳墠浠锋牸锛?000 SUPER = 1 USDT
鍏戞崲璐圭敤锛? USDT * 0.5% = 0.005 USDT
鐢ㄦ埛瀹為檯鑾峰緱锛?.995 USDT
```

### 4.3 鍒濆娴佸姩鎬?

```
娴佸姩鎬ф睜鍒濆鍖栵細
- MM锛?0,000,000 鏋?
- USDT锛?0,000 鏋?
- 鐩爣浠锋牸锛? SUPER = 0.001 USDT

鏃ュ悗鍙€氳繃 LP 鏈哄埗寮曞叆绀惧尯娴佸姩鎬ф彁渚涜€呫€?
```

### 4.4 闃叉粦鐐逛笌闂數璐蜂繚鎶?

```solidity
// 鏈€澶ф粦鐐癸細3%
// 闂數璐烽槻鎶わ細鍚屼竴浜ゆ槗鍧楀唴涓嶅厑璁歌繛缁搷浣?
// 浠锋牸棰勮█鏈猴細浣跨敤 Time-Weighted Average Price (TWAP)
```

---

## 5. 鎸栫熆鏀剁泭鎻愬彇娴佺▼

### 5.1 瀹炴椂鏀剁泭璁＄畻

```solidity
function getPendingReward(address miner) external view returns (uint256) {
    MinerInfo storage info = miners[miner];
    uint256 timePassed = block.timestamp - info.lastClaimTime;
    uint256 pendingReward = (info.hashrate * timePassed * rewardRate) / 1e18;
    return info.totalReward - info.claimed + pendingReward;
}
```

### 5.2 鍒嗘壒鎻愬彇鏈哄埗

- **鏃ユ彁鍙栭搴?*锛氫笉闄愬埗
- **鍛ㄦ彁鍙栭搴?*锛氭棤闄愬埗
- **鏈堥攣浠撴湡**锛氶鏈堥渶閿佷粨7澶╁悗鍙彁鍙?0%

```solidity
function claimReward(uint256 amount) external {
    require(amount <= getPendingReward(msg.sender), "Insufficient reward");
    require(block.timestamp >= lastClaim[msg.sender] + claimCooldown, "Cooldown");
    
    miners[msg.sender].claimed += amount;
    SUPER.transfer(msg.sender, amount);
    
    lastClaim[msg.sender] = block.timestamp;
}
```

---

## 6. 鏅鸿兘鍚堢害鏋舵瀯

### 6.1 鏍稿績鍚堢害鍒楄〃

| 鍚堢害鍚?| 鍔熻兘 | 閮ㄧ讲鍦板潃 |
|-------|------|---------|
| SUPER.sol | ERC20 浠ｅ竵 | 鐙珛閮ㄧ讲 |
| MinerRegistry.sol | 鐭垮伐娉ㄥ唽涓庣鐞?| 鍚庣画閮ㄧ讲 |
| MiningPool.sol | 鎸栫熆濂栧姳鍒嗛厤 | 鍚庣画閮ㄧ讲 |
| SwapRouter.sol | SUPER/USDT 鍏戞崲 | 鍚庣画閮ㄧ讲 |
| RewardVesting.sol | 浠ｅ竵瑙ｉ攣鏃堕棿閿?| 鍚庣画閮ㄧ讲 |

### 6.2 鍚堢害浜や簰娴佺▼

```
App鐢ㄦ埛 鈫?娉ㄥ唽閽卞寘 鈫?MinerRegistry.registerMiner()
              鈫?
         璁剧疆绠楀姏鍙傛暟 鈫?MiningPool.updateHashrate()
              鈫?
         姣忔棩涓婃姤绠楀姏 鈫?MiningPool.submitProof()
              鈫?
         瀹炴椂璁＄畻鏀剁泭 鈫?MiningPool.getPendingReward()
              鈫?
         鎻愬彇鏀剁泭 鈫?MiningPool.claimReward()
              鈫?
         鍏戞崲涓?USDT 鈫?SwapRouter.swapSuperToUsdt()
              鈫?
         鎻愮幇鍒颁氦鏄撴墍 鈫?鐢ㄦ埛閽卞寘
```

---

## 7. 浠ｅ竵鍒濆鍖栦笌閮ㄧ讲

### 閮ㄧ讲缃戠粶
- **涓荤綉**锛欱ase Mainnet (Chainid: 8453)
- **娴嬭瘯缃?*锛歋epolia (Chainid: 97) - 鍒濇湡娴嬭瘯

### 閮ㄧ讲鑴氭湰鍏抽敭姝ラ

```bash
# 1. 閮ㄧ讲 SUPER 浠ｅ竵
npx hardhat run scripts/deploy-SUPER-token.js --network bscTestnet

# 2. 閮ㄧ讲鐭垮伐娉ㄥ唽琛?
npx hardhat run scripts/deploy-miner-registry.js --network bscTestnet

# 3. 閮ㄧ讲鎸栫熆濂栧姳姹?
npx hardhat run scripts/deploy-mining-pool.js --network bscTestnet

# 4. 閮ㄧ讲 Swap 璺敱
npx hardhat run scripts/deploy-swap-router.js --network bscTestnet

# 5. 鍒濆鍖栨祦鍔ㄦ€?
npx hardhat run scripts/init-liquidity.js --network bscTestnet
```

---

## 8. 缁忔祹妯″瀷骞宠　鐐?

### 8.1 渚涢渶骞宠　

| 鎸囨爣 | 鍊?| 璇存槑 |
|------|------|------|
| 鍒濆娴侀€氶噺 | 50M | 绗竴骞村鍔遍噴鏀?|
| 骞村潎鏂板渚涘簲 | 125M | 绾挎€ч噴鏀?|
| 鐩爣骞翠氦鏄撻噺 | 100W | 鐢ㄦ埛鎸栫熆 + 鍏戞崲 |
| 鐩爣閫氳儉鐜?| 12.5% | 绗竴骞?|

### 8.2 浠锋牸绋冲畾鏈哄埗

1. **鍔ㄦ€侀毦搴﹁皟鏁?*锛氬叏缃戠畻鍔?鈫?鈫?鍗曚綅濂栧姳 鈫?
2. **娴佸姩鎬ф繁搴?*锛氬垵濮?50M SUPER + 50k USDT
3. **婵€鍔辨満鍒?*锛歀P 鎻愪緵鑰呰幏寰楅澶栧鍔?

---

## 绯荤粺鎬荤粨

```
MM浠ｅ竵 鈫?ERC20鏍囧噯鍚堢害
   鈫?
MinerRegistry 鈫?鐢ㄦ埛韬唤/璁惧缁戝畾
   鈫?
MiningPool 鈫?绠楀姏璇佹槑 鈫?姣忔棩濂栧姳鍒嗛厤
   鈫?
SwapRouter 鈫?娴佸姩鎬ф睜 鈫?SUPER/USDT 鍏戞崲
   鈫?
鐢ㄦ埛鎻愮幇 鈫?USDT 鍒颁氦鏄撴墍/閽卞寘
```

**瀹夊叏鑰冭檻**锛?
- 鎵€鏈夐噸瑕佸弬鏁扮敱澶氱绠＄悊鍛樻帶鍒?
- 鍚堢害鍙崌绾ф€э細浣跨敤 Proxy Pattern
- 瀹¤鍛ㄦ湡锛氭瘡瀛ｅ害杩涜绗笁鏂瑰璁?

