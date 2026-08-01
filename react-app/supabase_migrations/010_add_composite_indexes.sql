-- ╔══════════════════════════════════════════════════════════╗
-- ║     Add Composite Indexes Migration                     ║
-- ╚══════════════════════════════════════════════════════════╝

-- Sales indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_business_created ON sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_status ON sales(business_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_business_method ON sales(business_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_business_customer ON sales(business_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_business_cashier ON sales(business_id, cashier_id);

-- Sale items indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product ON sale_items(sale_id, product_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_business_stock ON products(business_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_business_category ON products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_business_name ON products(business_id, name);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(business_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- Debts indexes
CREATE INDEX IF NOT EXISTS idx_debts_business_status ON debts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_business_customer ON debts(business_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_debts_business_due ON debts(business_id, due_date) WHERE due_date IS NOT NULL;

-- Debt payments indexes
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created ON debt_payments(created_at DESC);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_business_category ON expenses(business_id, category);

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_business_active ON deals(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deals_business_dates ON deals(business_id, start_date, end_date);

-- Workers indexes
CREATE INDEX IF NOT EXISTS idx_workers_business_active ON workers(business_id, is_active) WHERE is_active = true;
