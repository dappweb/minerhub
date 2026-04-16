# Coin Planet Mobile Client

杩欐槸 Coin Planet 鐨勫弻绔Щ鍔ㄥ鎴风宸ョ▼锛屾妧鏈爤涓?React Native + Expo锛屽吋瀹?Android 涓?iOS銆?

## 鍚姩鏂瑰紡

```bash
npm install
npm run start
```

## 杩愯鍒拌澶?

- Android锛歚npm run android`
- iOS锛歚npm run ios`
- Web 棰勮锛歚npm run web`

## 鐜鍙橀噺锛堥摼涓婅仈璋冿級

鍦ㄥ惎鍔ㄥ墠閰嶇疆 Expo 鍏叡鍙橀噺锛堝彲鍐欏叆绯荤粺鐜鎴?`.env`锛夛細

- `EXPO_PUBLIC_API_BASE_URL`锛氬悗绔?API 鍦板潃锛堟湰鍦伴粯璁?`http://127.0.0.1:8788`锛?
- `EXPO_PUBLIC_CHAIN_ID`锛氶摼 ID锛圫epolia 涓?`97`锛?
- `EXPO_PUBLIC_RPC_URL`锛歊PC 鍦板潃
- `EXPO_PUBLIC_MINING_POOL_ADDRESS`锛歁iningPool 鍚堢害鍦板潃
- `EXPO_PUBLIC_SWAP_ROUTER_ADDRESS`锛歋wapRouter 鍚堢害鍦板潃
- `EXPO_PUBLIC_WALLET_PRIVATE_KEY`锛氭祴璇曢挶鍖呯閽ワ紙浠呮祴璇曠綉锛?

褰撳墠 App 宸叉敮鎸侊細

- 璇诲彇绉侀挜閽卞寘鍦板潃骞跺垱寤哄悗绔敤鎴?
- 閾句笂 `registerMiner`
- 閾句笂 `claimReward`
- 閾句笂 `swapSuperToUsdt`

## 宸ョ▼缁撴瀯

- `src/App.tsx`锛氱Щ鍔ㄧ棣栭〉锛堥挶鍖呰繛鎺ャ€佹寲鐭垮叆鍙ｏ級
- `app.json`锛欵xpo 骞冲彴涓庡寘鍚嶉厤缃?
- `package.json`锛氬弻绔剼鏈笌渚濊禆

## 涓嬩竴姝ュ缓璁?

- 鎺ュ叆 WalletConnect 鎴?App 鍐呴挶鍖呯鍚?
- 瀵规帴閾句笂 `startMining` / `claimRewards` / `swap`
- 澧炲姞璁惧鎬ц兘涓庣數閲忕瓥鐣ユ帶鍒?

