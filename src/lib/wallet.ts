import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
    coinbaseWallet,
    injectedWallet,
    metaMaskWallet,
    okxWallet,
    walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';
import { createConfig } from 'wagmi';

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 97);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const rpcHttpUrls = Array.from(
  new Set(
    [
      rpcUrl,
      'https://data-seed-prebsc-2-s1.binance.org:8545/',
      'https://bsc-testnet.publicnode.com',
      'https://bsc-testnet-rpc.publicnode.com',
    ].filter((u): u is string => Boolean(u && u.trim()))
  )
);

export const coinPlanetChain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: rpcHttpUrls }, public: { http: rpcHttpUrls } },
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
  transports: {
    [coinPlanetChain.id]: fallback(
      rpcHttpUrls.map((url) =>
        http(url, {
          timeout: 10_000,
          retryCount: 1,
        })
      )
    ),
  },
  ssr: false,
});
