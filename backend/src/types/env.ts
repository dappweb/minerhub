export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  CHAIN_ID: string;
  RPC_URL: string;
  SUPER_TOKEN_ADDRESS: string;
  MINING_POOL_ADDRESS: string;
  SWAP_ROUTER_ADDRESS: string;
}

