-- ╔══════════════════════════════════════════════════════════╗
-- ║     Add Audit Fields to All Tables Migration           ║
-- ╚══════════════════════════════════════════════════════════╝

-- Add audit fields to all business tables
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'businesses', 'business_users', 'profiles', 'products', 
    'workers', 'sales', 'sale_items', 'debts', 'debt_payments',
    'expenses', 'deals'
  ] LOOP
    -- Add created_by if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)', table_name);
    
    -- Add updated_by if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id)', table_name);
    
    -- Add deleted_at if not exists (soft delete)
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', table_name);
    
    -- Create index on deleted_at for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON %I(deleted_at) WHERE deleted_at IS NOT NULL', table_name, table_name);
  END LOOP;
END $$;

-- Update RLS policies to exclude soft-deleted records
-- Products
DROP POLICY IF EXISTS "Business products" ON products;
CREATE POLICY "Business products" ON products 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Workers
DROP POLICY IF EXISTS "Business workers" ON workers;
CREATE POLICY "Business workers" ON workers 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Sales
DROP POLICY IF EXISTS "Business sales" ON sales;
CREATE POLICY "Business sales" ON sales 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Sale Items
DROP POLICY IF EXISTS "Business sale items" ON sale_items;
CREATE POLICY "Business sale items" ON sale_items 
  FOR ALL USING (
    sale_id IN (SELECT id FROM sales WHERE business_id = public.get_my_business_id() AND deleted_at IS NULL)
  );

-- Debts
DROP POLICY IF EXISTS "Business debts" ON debts;
CREATE POLICY "Business debts" ON debts 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Debt Payments
DROP POLICY IF EXISTS "Business debt payments" ON debt_payments;
CREATE POLICY "Business debt payments" ON debt_payments 
  FOR ALL USING (
    debt_id IN (SELECT id FROM debts WHERE business_id = public.get_my_business_id() AND deleted_at IS NULL)
  );

-- Expenses
DROP POLICY IF EXISTS "Business expenses" ON expenses;
CREATE POLICY "Business expenses" ON expenses 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Deals
DROP POLICY IF EXISTS "Business deals" ON deals;
CREATE POLICY "Business deals" ON deals 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );
