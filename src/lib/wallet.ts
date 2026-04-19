import { createConfig } from '@privy-io/wagmi';
import { defineChain } from 'viem';
import { http } from 'wagmi';

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 97);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/';

export const coinPlanetChain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
});

export const wagmiConfig = createConfig({
  chains: [coinPlanetChain],
  transports: { [coinPlanetChain.id]: http(rpcUrl) },
});

// Privy App ID is a public client-side identifier (not a secret). We fall back
// to the known app ID so that deployments without the env var configured still
// work. Override via VITE_PRIVY_APP_ID when needed.
const DEFAULT_PRIVY_APP_ID = 'cmnmwq14i01dc0cjl06ehqrem';
export const privyAppId =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() || DEFAULT_PRIVY_APP_ID;
