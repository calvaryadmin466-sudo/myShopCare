-- ╔══════════════════════════════════════════════════════════╗
-- ║     Multi-Business Support Migration for myShopCare      ║
-- ╚══════════════════════════════════════════════════════════╝

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Businesses Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  logo_url        TEXT,
  theme_color     TEXT NOT NULL DEFAULT '#3B82F6',
  currency        TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','TZS','KSH')),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Business Users Table (Role-based access) ───────────────────
CREATE TABLE IF NOT EXISTS business_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner','manager','cashier')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
CREATE POLICY "Users can view own businesses" ON businesses 
  FOR SELECT USING (owner_id = auth.uid() OR id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Owners can insert businesses" ON businesses;
CREATE POLICY "Owners can insert businesses" ON businesses 
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update own businesses" ON businesses;
CREATE POLICY "Owners can update own businesses" ON businesses 
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete own businesses" ON businesses;
CREATE POLICY "Owners can delete own businesses" ON businesses 
  FOR DELETE USING (owner_id = auth.uid());

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_users
DROP POLICY IF EXISTS "Users can view business memberships" ON business_users;
CREATE POLICY "Users can view business memberships" ON business_users 
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert business memberships" ON business_users;
CREATE POLICY "Users can insert business memberships" ON business_users 
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own business memberships" ON business_users;
CREATE POLICY "Users can update own business memberships" ON business_users 
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own business memberships" ON business_users;
CREATE POLICY "Users can delete own business memberships" ON business_users 
  FOR DELETE USING (user_id = auth.uid());

-- ── Migrate existing shop_id to business_id ─────────────────────
-- First, create businesses from existing profiles
DO $$
DECLARE
  profile_record RECORD;
  new_business_id UUID;
BEGIN
  FOR profile_record IN SELECT DISTINCT shop_id, shop_name, id FROM profiles WHERE shop_id IS NOT NULL LOOP
    -- Check if business already exists for this shop_id
    IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = profile_record.shop_id) THEN
      -- Create new business
      INSERT INTO businesses (id, name, owner_id)
      VALUES (profile_record.shop_id, profile_record.shop_name, profile_record.id)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ── Update helper function to get current business_id ───────────
DROP FUNCTION IF EXISTS public.get_my_business_id();
CREATE OR REPLACE FUNCTION public.get_my_business_id()
RETURNS UUID AS $$
BEGIN
  -- Try to get from localStorage/session context first (set by app)
  -- If not available, get the first business the user has access to
  RETURN (
    SELECT business_id 
    FROM business_users 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ── Update existing tables to use business_id consistently ───────
-- Rename shop_id to business_id in all tables for consistency
-- PostgreSQL doesn't support IF EXISTS with RENAME COLUMN, so we use DO blocks

DO $$
BEGIN
  -- Products
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='shop_id') THEN
    ALTER TABLE products RENAME COLUMN shop_id TO business_id;
  END IF;
  
  -- Workers  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workers' AND column_name='shop_id') THEN
    ALTER TABLE workers RENAME COLUMN shop_id TO business_id;
  END IF;
  
  -- Sales
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='shop_id') THEN
    ALTER TABLE sales RENAME COLUMN shop_id TO business_id;
  END IF;
  
  -- Debts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='shop_id') THEN
    ALTER TABLE debts RENAME COLUMN shop_id TO business_id;
  END IF;
  
  -- Expenses
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='shop_id') THEN
    ALTER TABLE expenses RENAME COLUMN shop_id TO business_id;
  END IF;
  
  -- Deals
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='shop_id') THEN
    ALTER TABLE deals RENAME COLUMN shop_id TO business_id;
  END IF;
END $$;

-- ── Update RLS policies to use new business_id function ─────────
-- Products
DROP POLICY IF EXISTS "Shop products" ON products;
CREATE POLICY "Business products" ON products 
  FOR ALL USING (business_id = public.get_my_business_id());

-- Workers
DROP POLICY IF EXISTS "Shop workers" ON workers;
CREATE POLICY "Business workers" ON workers 
  FOR ALL USING (business_id = public.get_my_business_id());

-- Sales
DROP POLICY IF EXISTS "Shop sales" ON sales;
CREATE POLICY "Business sales" ON sales 
  FOR ALL USING (business_id = public.get_my_business_id());

-- Sale Items
DROP POLICY IF EXISTS "Shop sale items" ON sale_items;
CREATE POLICY "Business sale items" ON sale_items 
  FOR ALL USING (sale_id IN (SELECT id FROM sales WHERE business_id = public.get_my_business_id()));

-- Debts
DROP POLICY IF EXISTS "Shop debts" ON debts;
CREATE POLICY "Business debts" ON debts 
  FOR ALL USING (business_id = public.get_my_business_id());

-- Debt Payments
DROP POLICY IF EXISTS "Shop debt payments" ON debt_payments;
CREATE POLICY "Business debt payments" ON debt_payments 
  FOR ALL USING (debt_id IN (SELECT id FROM debts WHERE business_id = public.get_my_business_id()));

-- Expenses
DROP POLICY IF EXISTS "Shop expenses" ON expenses;
CREATE POLICY "Business expenses" ON expenses 
  FOR ALL USING (business_id = public.get_my_business_id());

-- Deals
DROP POLICY IF EXISTS "Shop deals" ON deals;
CREATE POLICY "Business deals" ON deals 
  FOR ALL USING (business_id = public.get_my_business_id());

-- ── Update profiles table to reference business_id ───────────────
-- Add business_id column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

-- Migrate existing shop_id to business_id in profiles
UPDATE profiles 
SET business_id = shop_id 
WHERE business_id IS NULL AND shop_id IS NOT NULL;

-- Make business_id nullable (users might not have a business initially)
-- PostgreSQL doesn't support IF EXISTS with ALTER COLUMN DROP NOT NULL
DO $$
BEGIN
  -- Check if column is NOT NULL and drop the constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'business_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN business_id DROP NOT NULL;
  END IF;
END $$;

-- ── Update indexes for new business_id columns ───────────────────
DROP INDEX IF EXISTS idx_products_shop;
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);

DROP INDEX IF EXISTS idx_workers_shop;
CREATE INDEX IF NOT EXISTS idx_workers_business ON workers(business_id);

DROP INDEX IF EXISTS idx_sales_shop;
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);

DROP INDEX IF EXISTS idx_debts_shop;
CREATE INDEX IF NOT EXISTS idx_debts_business ON debts(business_id);

DROP INDEX IF EXISTS idx_deals_shop;
CREATE INDEX IF NOT EXISTS idx_deals_business ON deals(business_id);

DROP INDEX IF EXISTS idx_expenses_shop;
CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);

-- New indexes for business_users
CREATE INDEX IF NOT EXISTS idx_business_users_user ON business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_business_users_business ON business_users(business_id);

-- ── Update trigger function to handle business creation on signup ──
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_business_id UUID;
BEGIN
  -- Create a default business for new users
  INSERT INTO businesses (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Business'),
    NEW.id
  )
  RETURNING id INTO new_business_id;
  
  -- Create profile with business_id
  INSERT INTO public.profiles (id, email, full_name, shop_name, business_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Business'),
    new_business_id,
    'owner'
  );
  
  -- Add user as owner of the business
  INSERT INTO business_users (business_id, user_id, role)
  VALUES (new_business_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Add updated_at trigger to businesses table ───────────────────
DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Create offline sync tracking table ───────────────────────────
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  record_id       UUID,
  record_data     JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at       TIMESTAMPTZ,
  sync_status     TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed'))
);

ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sync queue" ON offline_sync_queue;
CREATE POLICY "Users can manage own sync queue" ON offline_sync_queue 
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_business ON offline_sync_queue(business_id);

-- ── Create function to get current business from session ───────────
-- This function can be called with a specific business_id to set context
CREATE OR REPLACE FUNCTION public.set_business_context(business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verify user has access to this business
  IF EXISTS (
    SELECT 1 FROM business_users 
    WHERE business_id = set_business_context.business_id 
    AND user_id = auth.uid()
  ) THEN
    -- In a real implementation, this would set a session variable
    -- For now, we'll rely on the client-side context
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
