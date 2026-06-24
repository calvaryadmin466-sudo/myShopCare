-- ╔══════════════════════════════════════════════════════════╗
-- ║          myShopCare — Supabase SQL Schema               ║
-- ║  Run this in Supabase SQL Editor to set up the DB      ║
-- ╚══════════════════════════════════════════════════════════╝

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drop legacy FK constraints from old shops-based schema ────
-- The new schema stores shop_id directly in profiles (no shops table).
-- These constraints were created by the old SETUP.md schema and block inserts.
ALTER TABLE products      DROP CONSTRAINT IF EXISTS products_shop_id_fkey;
ALTER TABLE sales         DROP CONSTRAINT IF EXISTS sales_shop_id_fkey;
ALTER TABLE sale_items    DROP CONSTRAINT IF EXISTS sale_items_shop_id_fkey;
ALTER TABLE debts         DROP CONSTRAINT IF EXISTS debts_shop_id_fkey;
ALTER TABLE debt_payments DROP CONSTRAINT IF EXISTS debt_payments_shop_id_fkey;
ALTER TABLE deals         DROP CONSTRAINT IF EXISTS deals_shop_id_fkey;

-- ── Fix legacy NOT NULL columns (only if they exist from old schema) ─────────────
-- Wrapped in DO $$ so this is safe on both old AND new schema databases.
DO $$
BEGIN
  -- ── sales table legacy columns ──
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='final_amount') THEN
    ALTER TABLE sales ALTER COLUMN final_amount SET DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='total_amount') THEN
    ALTER TABLE sales ALTER COLUMN total_amount SET DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='discount_amount') THEN
    ALTER TABLE sales ALTER COLUMN discount_amount SET DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='receipt_number') THEN
    ALTER TABLE sales ALTER COLUMN receipt_number DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='is_debt') THEN
    ALTER TABLE sales ALTER COLUMN is_debt SET DEFAULT false;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='staff_id') THEN
    ALTER TABLE sales ALTER COLUMN staff_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='final_amount') THEN
    ALTER TABLE sales ALTER COLUMN final_amount DROP NOT NULL;
  END IF;

  -- ── sale_items table: old schema had shop_id NOT NULL, React app never sends it ──
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sale_items' AND column_name='shop_id') THEN
    ALTER TABLE sale_items ALTER COLUMN shop_id DROP NOT NULL;
  END IF;
  -- old schema had product_id NOT NULL; new schema allows NULL (product deleted scenario)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sale_items' AND column_name='product_id') THEN
    ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;
  END IF;

  -- ── debt_payments: old schema had shop_id NOT NULL ──
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='debt_payments' AND column_name='shop_id') THEN
    ALTER TABLE debt_payments ALTER COLUMN shop_id DROP NOT NULL;
  END IF;

  -- ── debts: old schema had is_cleared BOOLEAN NOT NULL ──
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='debts' AND column_name='is_cleared') THEN
    ALTER TABLE debts ALTER COLUMN is_cleared SET DEFAULT false;
  END IF;
END $$;



-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  shop_name   TEXT NOT NULL,
  shop_id     UUID NOT NULL DEFAULT uuid_generate_v4(),
  role        TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','cashier','manager')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO anon,service_role WITH CHECK (true);

-- Helper function to get shop_id securely
CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT shop_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'seller',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop workers" ON workers;
CREATE POLICY "Shop workers" ON workers FOR ALL USING (shop_id = public.get_my_shop_id());


-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id              UUID NOT NULL,
  name                 TEXT NOT NULL,
  sku                  TEXT,
  description          TEXT,
  category             TEXT NOT NULL DEFAULT 'General',
  buying_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity       NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit                 TEXT NOT NULL DEFAULT 'pcs',
  low_stock_threshold  INTEGER NOT NULL DEFAULT 5,
  image_url            TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;


ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop products" ON products;
CREATE POLICY "Shop products" ON products FOR ALL USING (shop_id = public.get_my_shop_id());

-- auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Sales ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL,
  cashier_id       UUID NOT NULL REFERENCES auth.users(id),
  cashier_worker_id UUID REFERENCES workers(id),
  cashier_name     TEXT,
  customer_name    TEXT,
  customer_phone   TEXT,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','mobile_money','card','credit')),
  payment_status   TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid','partial','pending')),
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_given     NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_worker_id UUID REFERENCES workers(id);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop sales" ON sales;
CREATE POLICY "Shop sales" ON sales FOR ALL USING (shop_id = public.get_my_shop_id());

-- ── Sale Items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_name  TEXT NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL,
  total_price   NUMERIC(12,2) NOT NULL
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop sale items" ON sale_items;
CREATE POLICY "Shop sale items" ON sale_items FOR ALL USING (sale_id IN (SELECT id FROM sales WHERE shop_id = public.get_my_shop_id()));

-- ── Debts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  original_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance          NUMERIC(12,2) GENERATED ALWAYS AS (original_amount - amount_paid) STORED,
  due_date         DATE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','overdue')),
  notes            TEXT,
  sale_id          UUID REFERENCES sales(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE debts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','overdue'));


ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop debts" ON debts;
CREATE POLICY "Shop debts" ON debts FOR ALL USING (shop_id = public.get_my_shop_id());

DROP TRIGGER IF EXISTS debts_updated_at ON debts;
CREATE TRIGGER debts_updated_at
  BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Debt Payments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id         UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop debt payments" ON debt_payments;
CREATE POLICY "Shop debt payments" ON debt_payments FOR ALL USING (debt_id IN (SELECT id FROM debts WHERE shop_id = public.get_my_shop_id()));

-- ── Deals ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id              UUID NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  deal_type            TEXT NOT NULL DEFAULT 'percentage' CHECK (deal_type IN ('percentage','fixed','bogo','bundle')),
  discount_value       NUMERIC(8,2) NOT NULL DEFAULT 0,
  min_purchase         NUMERIC(12,2),
  applicable_products  UUID[],
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count          INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop deals" ON deals;
CREATE POLICY "Shop deals" ON deals FOR ALL USING (shop_id = public.get_my_shop_id());

-- ── Profile trigger on signup ─────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, shop_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'),
    'owner'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_workers_shop ON workers(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debts_shop ON debts(shop_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_deals_shop ON deals(shop_id);
