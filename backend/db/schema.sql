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

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

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
  ('support_contacts_json', '[]', datetime('now')),
  ('contract_required', '1', datetime('now')),
  ('contract_version', '1.0.0', datetime('now')),
  ('contract_title_zh', '用户挖矿合同', datetime('now')),
  ('contract_title_en', 'Mining Contract', datetime('now')),
  ('contract_content_zh', '感谢您购买我们的服务。本合同约定：\n\n1. 您已购买月卡并支付相关费用\n2. 激活后，您的账户开始累计挖矿收益\n3. 合同期限为所购周期（默认1095天）\n4. 期间保持设备在线以持续累计收益\n5. 合同到期后收益停止累计\n6. 本条款由平台管理方解释', datetime('now')),
  ('contract_content_en', 'Thank you for purchasing our service. This contract stipulates:\n\n1. You have purchased a monthly card and paid the relevant fees\n2. After activation, your account begins to accrue mining rewards\n3. The contract term is the purchased period (default 1095 days)\n4. During this period, keep the device online to continue accruing rewards\n5. After the contract expires, reward accrual stops\n6. This clause is interpreted by the platform administrator', datetime('now'));

CREATE TABLE IF NOT EXISTS user_agreement_acceptances (
  user_id TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  wallet TEXT,
  PRIMARY KEY (user_id, version),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_zh TEXT NOT NULL,
  content_en TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  target TEXT NOT NULL DEFAULT 'all',
  is_published INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  publish_at TEXT,
  expire_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  wallet TEXT,
  read_at TEXT NOT NULL,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id TEXT PRIMARY KEY,
  parent_user_id TEXT,
  nickname TEXT,
  machine_code TEXT,
  contract_start_at TEXT,
  contract_end_at TEXT,
  contract_type TEXT,
  contract_term_days INTEGER NOT NULL DEFAULT 1095,
  monthly_card_days INTEGER NOT NULL DEFAULT 30,
  monthly_card_end_at TEXT,
  contract_active INTEGER NOT NULL DEFAULT 0,
  agreement_accepted_at TEXT,
  contract_agreement_accepted_version TEXT,
  activation_status TEXT NOT NULL DEFAULT 'pending',
  exchange_auto_enabled INTEGER NOT NULL DEFAULT 1,
  payout_wallets_json TEXT NOT NULL DEFAULT '[]',
  reward_rate_usdt_per_hour TEXT NOT NULL DEFAULT '0.084',
  total_reward_usdt TEXT NOT NULL DEFAULT '0',
  total_reward_super TEXT NOT NULL DEFAULT '0',
  last_seen_at TEXT,
  last_heartbeat_at TEXT,
  last_reward_accrued_at TEXT,
  total_online_seconds INTEGER NOT NULL DEFAULT 0,
  online_status TEXT NOT NULL DEFAULT 'offline',
  offline_alerted_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_profiles_machine_code_normalized
  ON customer_profiles(LOWER(TRIM(machine_code)))
  WHERE TRIM(COALESCE(machine_code, '')) <> '';
CREATE INDEX IF NOT EXISTS idx_announcements_publish_at ON announcements(publish_at);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published, is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON announcement_reads(user_id);
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

CREATE TABLE IF NOT EXISTS super_distributions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  wallet TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('mint','transfer')),
  usdt_amount REAL NOT NULL,
  super_amount REAL NOT NULL,
  swap_price_super_per_usdt REAL NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending','success','failed')),
  lock_term_days INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS token_locks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  source_distribution_id TEXT,
  locked_super REAL NOT NULL,
  released_super REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_agreement' CHECK (status IN ('pending_agreement','active','released','admin_released','cancelled')),
  lock_term_days INTEGER NOT NULL,
  agreement_version TEXT,
  start_at TEXT,
  end_at TEXT,
  released_at TEXT,
  release_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (source_distribution_id) REFERENCES super_distributions(id)
);

CREATE TABLE IF NOT EXISTS reward_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  amount_super REAL NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','confirmed','failed')),
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
CREATE INDEX IF NOT EXISTS idx_super_distributions_user_time ON super_distributions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_locks_user_status ON token_locks(user_id, status, end_at);
CREATE INDEX IF NOT EXISTS idx_reward_withdrawals_user_time ON reward_withdrawals(user_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS owner_sub_admins (
  wallet TEXT PRIMARY KEY,
  note TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  allowed_contract_types_json TEXT NOT NULL DEFAULT '[]',
  contract_types_locked_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_owner_sub_admins_enabled ON owner_sub_admins(enabled);

-- === Referral system ===
CREATE TABLE IF NOT EXISTS referral_edges (
  id TEXT PRIMARY KEY,
  inviter_user_id TEXT NOT NULL,
  invitee_user_id TEXT NOT NULL UNIQUE,
  inviter_wallet TEXT NOT NULL,
  invitee_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  bound_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (inviter_user_id) REFERENCES users(id),
  FOREIGN KEY (invitee_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referral_closure (
  ancestor_user_id TEXT NOT NULL,
  descendant_user_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (ancestor_user_id, descendant_user_id),
  FOREIGN KEY (ancestor_user_id) REFERENCES users(id),
  FOREIGN KEY (descendant_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_edges_inviter ON referral_edges(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_edges_invitee ON referral_edges(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_closure_ancestor ON referral_closure(ancestor_user_id, depth);
CREATE INDEX IF NOT EXISTS idx_referral_closure_descendant ON referral_closure(descendant_user_id);
