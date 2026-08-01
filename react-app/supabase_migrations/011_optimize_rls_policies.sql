-- ╔══════════════════════════════════════════════════════════╗
-- ║     Optimize RLS Policies Migration                    ║
-- ╚══════════════════════════════════════════════════════════╝

-- Optimize RLS policies to use indexes more efficiently
-- The key is to ensure business_id filtering happens first and uses indexes

-- Sales: Use index on (business_id, created_at)
DROP POLICY IF EXISTS "Business sales" ON sales;
CREATE POLICY "Business sales" ON sales 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

-- Sales: Use index on (business_id, payment_status) for status filtering
CREATE POLICY "Business sales insert" ON sales
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Sale Items: Use index on sale_id
DROP POLICY IF EXISTS "Business sale items" ON sale_items;
CREATE POLICY "Business sale items" ON sale_items 
  FOR SELECT 
  USING (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id = public.get_my_business_id() 
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "Business sale items insert" ON sale_items
  FOR INSERT
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id = public.get_my_business_id()
    )
  );

-- Products: Use index on (business_id, stock_quantity)
DROP POLICY IF EXISTS "Business products" ON products;
CREATE POLICY "Business products" ON products 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

CREATE POLICY "Business products insert" ON products
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Debts: Use index on (business_id, status)
DROP POLICY IF EXISTS "Business debts" ON debts;
CREATE POLICY "Business debts" ON debts 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

CREATE POLICY "Business debts insert" ON debts
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Debt Payments: Use index on debt_id
DROP POLICY IF EXISTS "Business debt payments" ON debt_payments;
CREATE POLICY "Business debt payments" ON debt_payments 
  FOR SELECT 
  USING (
    debt_id IN (
      SELECT id FROM debts 
      WHERE business_id = public.get_my_business_id() 
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "Business debt payments insert" ON debt_payments
  FOR INSERT
  WITH CHECK (
    debt_id IN (
      SELECT id FROM debts 
      WHERE business_id = public.get_my_business_id()
    )
  );

-- Expenses: Use index on (business_id, expense_date)
DROP POLICY IF EXISTS "Business expenses" ON expenses;
CREATE POLICY "Business expenses" ON expenses 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

CREATE POLICY "Business expenses insert" ON expenses
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Deals: Use index on (business_id, is_active)
DROP POLICY IF EXISTS "Business deals" ON deals;
CREATE POLICY "Business deals" ON deals 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

CREATE POLICY "Business deals insert" ON deals
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Workers: Use index on (business_id, is_active)
DROP POLICY IF EXISTS "Business workers" ON workers;
CREATE POLICY "Business workers" ON workers 
  FOR SELECT 
  USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );

CREATE POLICY "Business workers insert" ON workers
  FOR INSERT
  WITH CHECK (
    business_id = public.get_my_business_id()
  );

-- Enable RLS on all tables (ensure it's enabled)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
