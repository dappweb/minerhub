/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANDROID_DOWNLOAD_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_IOS_DOWNLOAD_URL?: string;
  readonly VITE_MINER_CONTRACT_ADDRESS?: string;
  readonly VITE_MINING_POOL_ADDRESS?: string;
  readonly VITE_OWNER_ADDRESS?: string;
  readonly VITE_OWNER_WALLET?: string;
  readonly VITE_ADMIN_ADDRESSES?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_SUPER_ADDRESS?: string;
  readonly VITE_SWAP_CONTRACT_ADDRESS?: string;
  readonly VITE_SWAP_ROUTER_ADDRESS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_PRIVY_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}