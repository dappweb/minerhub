# Coin Planet

Coin Planet 鏄竴涓寘鍚笁绔鍥剧殑 Web 椤圭洰锛?

- 椤圭洰缃戠珯锛堝畼缃戝睍绀猴級
- 鍚庡彴绠＄悊绯荤粺
- 鎸栫熆 App锛堥挶鍖呰繛鎺ャ€侀摼涓婃寲鐭裤€侀摼涓婂厬鎹級

褰撳墠瀹樼綉宸插鍔狅細

- 閽卞寘鐧诲綍杩涘叆鍚庡彴绠＄悊绯荤粺鍏ュ彛
- Android / iOS 鎸栫熆 App 涓嬭浇鍏ュ彛
- 鍙岀瀹㈡埛绔伐绋嬶紙React Native Expo锛夛細`app-client/`

## 馃摎 瀹屾暣璁捐鏂囨。

> 鏌ョ湅瀹屾暣绯荤粺璁捐銆佸疄鐜拌矾绾垮拰 API 瑙勮寖锛岃瑙?[**鏂囨。瀵艰埅**](./docs/docs-index.md)

涓昏鏂囨。锛?

- [**SUPER 浠ｅ竵妯″瀷鍙婄粡娴庤璁?* - Token Model](./docs/token-model.md)锛氫唬甯佸垎閰嶃€? 骞撮噴鏀炬椂闂磋〃銆佹寲鐭垮鍔辨満鍒躲€乁SDT/SUPER 浜ゆ崲鍏戞崲姹犮€佹櫤鑳藉悎绾︽灦鏋?
- [**鍚庡彴绠＄悊绯荤粺璁捐** - Admin System](./docs/admin-system-design.md)锛? 澶х鐞嗘ā鍧椼€?0+ REST API銆丮ongoDB + Redis 鏋舵瀯銆侀闄╂帶鍒剁郴缁熴€佸绛炬不鐞嗘満鍒?
- [**绯荤粺闆嗘垚涓庨儴缃茶矾绾?* - Integration Roadmap](./docs/system-integration-roadmap.md)锛氬畬鏁寸敤鎴锋梾绋嬨€佸悎绾﹂儴缃叉竻鍗曘€佹祴璇曡鍒掞紙Sepolia / Base Mainnet锛夈€佸彂甯冩椂闂磋〃锛? 鏈?7 鏈堬級
- [**寮€鍙戝懆鏈熶笌棰勬湡璐圭敤** - Costs & Timeline](./docs/development-timeline-and-costs.md)锛氫汉鍔涙垚鏈?($375K)銆佸熀纭€璁炬柦 ($8K)銆佽瀺璧勫缓璁?($600K-$800K)銆丷OI 棰勬祴涓庨闄╄瘎浼?
- [**鎶曡祫鍐崇瓥閫熸煡琛?* - Quick Reference](./docs/investment-quickref.md)锛氳瀺璧勮妯°€佹垚鏈瀯鎴愩€佹湀搴︽姇鍏ャ€丷OI 棰勬祴銆佸喅绛栨鏌ユ竻鍗?

## 鏈湴杩愯

1. 瀹夎渚濊禆

```bash
npm install
```

2. 澶嶅埗鐜鍙橀噺

```bash
cp .env.example .env.local
```

3. 閰嶇疆鍚堢害鍦板潃涓庨摼鍙傛暟

- `VITE_CHAIN_ID`
- `VITE_RPC_URL`
- `VITE_MINER_CONTRACT_ADDRESS`
- `VITE_SWAP_CONTRACT_ADDRESS`
- `VITE_ANDROID_DOWNLOAD_URL`
- `VITE_IOS_DOWNLOAD_URL`

4. 鍚姩寮€鍙戠幆澧?

```bash
npm run dev
```

## 鍖哄潡閾炬寲鐭垮姛鑳?

鍓嶇宸叉帴鍏ラ挶鍖呬笌鍚堢害璋冪敤锛?

- 鎸栫熆 App 椤甸潰锛?
   - 杩炴帴閽卞寘
   - 璋冪敤 `startMining()` 寮€濮嬮摼涓婃寲鐭?
   - 璋冪敤 `claimRewards()` 棰嗗彇鏀剁泭
- DApp Swap 椤甸潰锛?
   - 璋冪敤 `swapSuperToUsdt(uint256)` 瀹屾垚閾句笂鍏戞崲

瀵瑰簲浠ｇ爜鍦?`src/lib/blockchain.ts`銆?

## 馃搵 寮€鍙戦樁娈典笌娴嬭瘯

- **绗竴闃舵**锛? 鏈?5 鏈堬級锛歋epolia 娴嬭瘯缃戦儴缃蹭笌楠岃瘉
- **绗簩闃舵**锛? 鏈堬級锛欱ase Mainnet 鐏板害涓婄嚎锛?000 鍐呴儴娴嬭瘯鐢ㄦ埛锛?
- **绗笁闃舵**锛? 鏈堬級锛氭寮忓叕寮€鍙戝竷

璇﹁ [System Integration Roadmap](./docs/system-integration-roadmap.md#timeline)

## 閮ㄧ讲鍒?Cloudflare Pages

### 鏂瑰紡涓€锛欳loudflare Dashboard

- Build command: `npm run build`
- Build output directory: `dist`

### 鏂瑰紡浜岋細Wrangler CLI

1. 鐧诲綍 Cloudflare

```bash
npx wrangler login
```

2. 閮ㄧ讲

```bash
npm run deploy:cf
```

`wrangler.toml` 宸插寘鍚熀纭€閰嶇疆锛岄€傜敤浜庡綋鍓嶉潤鎬佺珯鐐归儴缃层€?

## App 瀹㈡埛绔紙鍙岀鍏煎锛?

`app-client/` 宸茶皟鏁翠负 React Native Expo 宸ョ▼锛屾敮鎸?Android 涓?iOS銆?

```bash
cd app-client
npm install
npm run start
```

- Android 璋冭瘯锛歚npm run android`
- iOS 璋冭瘯锛歚npm run ios`

## 馃搨 鏂囦欢缁撴瀯涓庡揩閫熷弬鑰?

```
minerhub/
鈹溾攢鈹€ src/                      # Web Frontend
鈹?  鈹溾攢鈹€ components/           # React 缁勪欢
鈹?  鈹溾攢鈹€ lib/blockchain.ts    # 鍖哄潡閾捐皟鐢ㄥ眰
鈹?  鈹斺攢鈹€ App.tsx              # 涓诲簲鐢紙閽卞寘鐧诲綍闂ㄧ锛?
鈹溾攢鈹€ app-client/              # 绉诲姩搴旂敤锛圧eact Native Expo锛?
鈹溾攢鈹€ docs/                    # 瀹屾暣璁捐鏂囨。
鈹?  鈹溾攢鈹€ docs-index.md        # 鏂囨。瀵艰埅
鈹?  鈹溾攢鈹€ token-model.md       # SUPER 浠ｅ竵妯″瀷
鈹?  鈹溾攢鈹€ admin-system-design.md
鈹?  鈹斺攢鈹€ system-integration-roadmap.md
鈹斺攢鈹€ wrangler.toml           # Cloudflare Pages 閰嶇疆
```

## 馃懃 鍥㈤槦鍒嗗伐涓庝笅涓€姝?

| 瑙掕壊 | 鏂囨。鍏ュ彛 | 鏍稿績浠诲姟 |
|------|--------|--------|
| **鍚堢害宸ョ▼甯?* | [Token Model](./docs/token-model.md#contracts) | 缂栧啓 SUPER.sol銆丮iningPool.sol銆丼wapRouter.sol銆丄dminController.sol |
| **鍚庣宸ョ▼甯?* | [Admin System Design](./docs/admin-system-design.md#api) | 瀹炵幇 20+ REST API銆佸绛剧郴缁熴€侀闄╂帶鍒?|
| **绉诲姩寮€鍙?* | [Integration Guide](./docs/system-integration-roadmap.md#mobile) | 闆嗘垚 WalletConnect SDK銆佸畬鎴愮湡瀹為摼涓婁氦浜?|
| **DevOps** | [Deployment Guide](./docs/system-integration-roadmap.md#deployment) | Sepolia 閮ㄧ讲鈫払ase 鐏板害鈫掓寮忓彂甯?|
| **QA** | [Test Plan](./docs/system-integration-roadmap.md#testing) | 鍗曞厓娴嬭瘯銆侀泦鎴愭祴璇曘€佸畨鍏ㄥ璁★紙CertiK锛?|

---

**椤圭洰鐘舵€侊細** 鉁?鍩虹鏋舵瀯瀹屾垚 | 馃摑 璁捐鏂囨。瀹屾垚 | 鈴?寮€鍙戦樁娈靛惎鍔ㄤ腑

