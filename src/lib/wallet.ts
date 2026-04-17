import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 97);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const coinPlanetChain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'demo';

export const wagmiConfig = getDefaultConfig({
  appName: 'Coin Planet Admin',
  projectId: walletConnectProjectId,
  chains: [coinPlanetChain],
  ssr: false,
});
