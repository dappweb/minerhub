import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 97);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/';

export const coinPlanetChain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
});

export const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim();

const hasWalletConnectProjectId = /^[a-z0-9]{16,}$/i.test(walletConnectProjectId);

const recommendedWallets = [
  metaMaskWallet,
  injectedWallet,
  coinbaseWallet,
  okxWallet,
  ...(hasWalletConnectProjectId ? [walletConnectWallet] : []),
];

export const wagmiConfig = createConfig({
  chains: [coinPlanetChain],
  connectors: connectorsForWallets(
    [
      {
        groupName: hasWalletConnectProjectId ? 'Recommended' : 'Browser Wallets',
        wallets: recommendedWallets,
      },
    ],
    {
      appName: 'Coin Planet Admin',
      projectId: hasWalletConnectProjectId ? walletConnectProjectId : 'disabled-walletconnect',
    },
  ),
  transports: { [coinPlanetChain.id]: http(rpcUrl) },
  ssr: false,
});
