CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  hashrate INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);

CREATE TABLE IF NOT EXISTS gas_quotes (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  pay_token TEXT NOT NULL,
  pay_amount TEXT NOT NULL,
  bnb_amount TEXT NOT NULL,
  fee_rate TEXT NOT NULL,
  price_snapshot TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gas_orders (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  user_id TEXT,
  pay_token TEXT NOT NULL,
  pay_amount TEXT NOT NULL,
  bnb_amount TEXT NOT NULL,
  status TEXT NOT NULL,
  relay_mode TEXT NOT NULL,
  relay_tx_hash TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES gas_quotes(id)
);

CREATE TABLE IF NOT EXISTS gas_wallet_credits (
  wallet TEXT PRIMARY KEY,
  total_bnb_funded TEXT NOT NULL DEFAULT '0',
  total_orders INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gas_intents (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  user_id TEXT,
  pay_token TEXT NOT NULL,
  max_token_spend TEXT NOT NULL,
  action TEXT NOT NULL,
  action_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  relay_order_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gas_quotes_wallet ON gas_quotes(wallet);
CREATE INDEX IF NOT EXISTS idx_gas_quotes_expires_at ON gas_quotes(expires_at);
CREATE INDEX IF NOT EXISTS idx_gas_orders_wallet ON gas_orders(wallet);
CREATE INDEX IF NOT EXISTS idx_gas_orders_status ON gas_orders(status);
CREATE INDEX IF NOT EXISTS idx_gas_intents_wallet ON gas_intents(wallet);
CREATE INDEX IF NOT EXISTS idx_gas_intents_status ON gas_intents(status);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES
  ('maintenance_enabled', '0', datetime('now')),
  ('maintenance_message_zh', '系统维护中，请稍后再试。', datetime('now')),
  ('maintenance_message_en', 'System maintenance in progress. Please try again later.', datetime('now')),
  ('exchange_auto_enabled', '1', datetime('now')),
  ('monthly_card_days', '30', datetime('now')),
  ('contract_term_years_default', '3', datetime('now')),
  ('contract_term_days_default', '1095', datetime('now')),
  ('reward_rate_usdt_per_hour', '0.084', datetime('now')),
  ('swap_price_super_per_usdt', '0', datetime('now')),
  ('payout_wallets_json', '[]', datetime('now')),
  ('user_agreement_required', '0', datetime('now')),
  ('user_agreement_version', '1.0.0', datetime('now')),
  ('user_agreement_title_zh', '用户协议', datetime('now')),
  ('user_agreement_title_en', 'User Agreement', datetime('now')),
  ('user_agreement_content_zh', '欢迎使用本应用。使用本服务即表示您已阅读并同意平台的服务条款、隐私政策以及相关的风险提示。管理员可随时更新本协议内容。', datetime('now')),
  ('user_agreement_content_en', 'Welcome. By using this service you acknowledge that you have read and agreed to the platform terms of service, privacy policy and related risk disclosures. The administrator may update this agreement at any time.', datetime('now')),
  ('support_contacts_json', '[]', datetime('now'));

CREATE TABLE IF NOT EXISTS user_agreement_acceptances (
  user_id TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  wallet TEXT,
  PRIMARY KEY (user_id, version),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id TEXT PRIMARY KEY,
  parent_user_id TEXT,
  nickname TEXT,
  machine_code TEXT,
  contract_start_at TEXT,
  contract_end_at TEXT,
  contract_term_days INTEGER NOT NULL DEFAULT 1095,
  monthly_card_days INTEGER NOT NULL DEFAULT 30,
  contract_active INTEGER NOT NULL DEFAULT 0,
  agreement_accepted_at TEXT,
  activation_status TEXT NOT NULL DEFAULT 'pending',
  exchange_auto_enabled INTEGER NOT NULL DEFAULT 1,
  payout_wallets_json TEXT NOT NULL DEFAULT '[]',
  reward_rate_usdt_per_hour TEXT NOT NULL DEFAULT '0.084',
  total_reward_usdt TEXT NOT NULL DEFAULT '0',
  total_reward_super TEXT NOT NULL DEFAULT '0',
  last_seen_at TEXT,
  online_status TEXT NOT NULL DEFAULT 'offline',
  offline_alerted_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sub_accounts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  child_user_id TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (child_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payout_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_status_history (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  hashrate INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  reward_usdt TEXT NOT NULL DEFAULT '0',
  reward_super TEXT NOT NULL DEFAULT '0',
  rate_usdt_per_hour TEXT NOT NULL DEFAULT '0',
  accrued_from TEXT,
  accrued_to TEXT,
  source TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_parent_user_id ON customer_profiles(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_contract_active ON customer_profiles(contract_active);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_owner_user_id ON sub_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_wallets_user_id ON payout_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_device_status_history_device_id ON device_status_history(device_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user_id ON reward_ledger(user_id);

CREATE TABLE IF NOT EXISTS exchange_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  amount_super TEXT NOT NULL DEFAULT '0',
  amount_usdt TEXT NOT NULL DEFAULT '0',
  mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'manual_pending',
  request_note TEXT,
  approved_by TEXT,
  approved_at TEXT,
  completed_at TEXT,
  payout_wallet TEXT,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  total_usdt TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  exchange_order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount_usdt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES payout_batches(id),
  FOREIGN KEY (exchange_order_id) REFERENCES exchange_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS swap_price_history (
  id TEXT PRIMARY KEY,
  price_super_per_usdt TEXT NOT NULL,
  source TEXT NOT NULL,
  operator_wallet TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS swap_trade_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  wallet TEXT,
  direction TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  price_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  tx_hash TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_orders_user_id ON exchange_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_orders_status ON exchange_orders(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch_id ON payout_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_swap_trade_logs_user_id ON swap_trade_logs(user_id);

-- === Owner admin system (P0) ===
CREATE TABLE IF NOT EXISTS owner_sessions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_wallet ON owner_sessions(wallet);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id TEXT PRIMARY KEY,
  actor_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  target_wallet TEXT,
  payload_json TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_owner_audit_actor ON owner_audit_logs(actor_wallet);
CREATE INDEX IF NOT EXISTS idx_owner_audit_action ON owner_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_owner_audit_created ON owner_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_owner_audit_target_wallet ON owner_audit_logs(target_wallet);

CREATE TABLE IF NOT EXISTS owner_mint_counters (
  day TEXT PRIMARY KEY,
  total_super TEXT NOT NULL DEFAULT '0',
  updated_at TEXT NOT NULL
);