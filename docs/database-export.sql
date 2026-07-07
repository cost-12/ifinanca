-- iFinanca - exportacao relacional de referencia
-- Observacao: a aplicacao usa Firebase Firestore, um banco NoSQL.
-- Este arquivo atende ao requisito academico de exportacao .sql e representa
-- uma estrutura relacional equivalente aos principais dados do sistema.

CREATE TABLE users (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  financial_goal VARCHAR(180),
  monthly_income DECIMAL(12, 2) DEFAULT 0.00,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE financial_accounts (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  institution_name VARCHAR(120) NOT NULL,
  account_name VARCHAR(120),
  account_type VARCHAR(60),
  balance DECIMAL(12, 2) DEFAULT 0.00,
  currency CHAR(3) DEFAULT 'BRL',
  status VARCHAR(40) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_financial_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE transactions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  account_id VARCHAR(128),
  description VARCHAR(240) NOT NULL,
  category VARCHAR(120),
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  status VARCHAR(40) DEFAULT 'confirmed',
  source VARCHAR(60) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_transactions_account
    FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
);

CREATE TABLE assets (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  name VARCHAR(120) NOT NULL,
  asset_type VARCHAR(80),
  current_value DECIMAL(12, 2) DEFAULT 0.00,
  profitability DECIMAL(8, 4),
  currency CHAR(3) DEFAULT 'BRL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assets_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE pluggy_connections (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  pluggy_item_id VARCHAR(128) NOT NULL UNIQUE,
  institution_name VARCHAR(120),
  status VARCHAR(40) DEFAULT 'created',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pluggy_connections_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_financial_accounts_user_id ON financial_accounts(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_pluggy_connections_user_id ON pluggy_connections(user_id);
