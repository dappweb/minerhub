ALTER TABLE customer_profiles ADD COLUMN contract_type TEXT;
ALTER TABLE owner_sub_admins ADD COLUMN allowed_contract_types_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE owner_sub_admins ADD COLUMN contract_types_locked_at TEXT;
