-- Align backend storage names with the current exchange workflow.
-- This patch keeps existing swap_* data available by copying it into exchange_* tables.

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
SELECT 'exchange_price_super_per_usdt', value, updated_at
FROM system_settings
WHERE key = 'swap_price_super_per_usdt';

CREATE TABLE IF NOT EXISTS exchange_price_history (
  id TEXT PRIMARY KEY,
  price_super_per_usdt TEXT NOT NULL,
  source TEXT NOT NULL,
  operator_wallet TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO exchange_price_history (id, price_super_per_usdt, source, operator_wallet, note, created_at)
SELECT id, price_super_per_usdt, source, operator_wallet, note, created_at
FROM swap_price_history;

CREATE TABLE IF NOT EXISTS exchange_trade_logs (
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

INSERT OR IGNORE INTO exchange_trade_logs (
  id, user_id, wallet, direction, amount_in, amount_out,
  price_snapshot, status, tx_hash, note, created_at, updated_at
)
SELECT
  id, user_id, wallet, direction, amount_in, amount_out,
  price_snapshot, status, tx_hash, note, created_at, updated_at
FROM swap_trade_logs;

CREATE INDEX IF NOT EXISTS idx_exchange_trade_logs_user_id ON exchange_trade_logs(user_id);

ALTER TABLE super_distributions ADD COLUMN exchange_price_super_per_usdt REAL;

UPDATE super_distributions
SET exchange_price_super_per_usdt = swap_price_super_per_usdt
WHERE exchange_price_super_per_usdt IS NULL;
