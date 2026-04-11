import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 8453);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://mainnet.base.org';

const coinPlanetChain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
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
