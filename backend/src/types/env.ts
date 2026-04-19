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

  /** Phase-1 gas service pricing */
  GAS_FEE_RATE?: string;
  BNB_USD_PRICE?: string;
  SUPER_USD_PRICE?: string;
  USDT_USD_PRICE?: string;

  /** Optional treasury signer for automatic BNB distribution */
  GAS_TREASURY_PRIVATE_KEY?: string;

  /** Owner relayer (on-chain SUPER/USDT operations) */
  OWNER_PRIVATE_KEY?: string;
  /** USDT token address used for batch payouts */
  USDT_TOKEN_ADDRESS?: string;
  /** Per-batch safety cap for SUPER mint/airdrop (in SUPER units, plain string) */
  OWNER_MINT_DAILY_CAP?: string;

  /** Optional webhook invoked by scheduled task when a customer goes offline */
  ALERT_WEBHOOK_URL?: string;
}

