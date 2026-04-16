export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  APP_BUCKET?: R2Bucket;
  JWT_SECRET: string;
  CHAIN_ID: string;
  RPC_URL: string;
  SUPER_TOKEN_ADDRESS: string;
  MINING_POOL_ADDRESS: string;
  SWAP_ROUTER_ADDRESS: string;
  /** Admin wallet address, used to guard upload endpoints */
  OWNER_ADDRESS?: string;
}

