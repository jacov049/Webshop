-- CryptoShop Datenbankschema
-- Datensparsamkeit: Es werden bewusst KEINE personenbezogenen Klartextdaten
-- gespeichert. Bestell- und Kontaktinhalte liegen ausschließlich als
-- clientseitig PGP-verschlüsselte Blobs vor (siehe docs/verschluesselung.md).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fortlaufender Index für die BTC-HD-Wallet-Adressableitung (atomar, kollisionsfrei)
CREATE SEQUENCE IF NOT EXISTS btc_derivation_index_seq START 1;

-- Artikel
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_eur NUMERIC(10,2) NOT NULL CHECK (price_eur >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_path TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bestellungen (personenbezogene Daten NUR als PGP-Blob, zusätzlich
-- AES-256-GCM "at rest" verschlüsselt in encrypted_payload_at_rest;
-- das Backend besitzt keinen PGP-Private-Key und kann den PGP-Inhalt
-- selbst nie einsehen)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    encrypted_payload TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('BTC','XMR')),
    payment_address TEXT NOT NULL,
    derivation_index INTEGER,
    amount_crypto NUMERIC(20,12),
    amount_eur NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirming','paid','expired','shipped','cancelled')),
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    deletion_due TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_deletion_due ON orders(deletion_due);

-- Kontaktanfragen (verschlüsselt, kein Klartext-Kontaktkanal in der DB)
CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encrypted_payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deletion_due TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_deletion_due ON contact_requests(deletion_due);

-- Admin-Zugänge
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-Sessions (minimal, keine IP-Speicherung; nur Session-Token-Hash)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
