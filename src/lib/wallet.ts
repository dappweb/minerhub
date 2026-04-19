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

export const privyAppId = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() ?? '';
