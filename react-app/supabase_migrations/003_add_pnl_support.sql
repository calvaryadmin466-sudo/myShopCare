ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE sale_items si
SET
  unit_cost = p.buying_price,
  total_cost = si.quantity * p.buying_price
FROM products p
WHERE
  si.product_id = p.id
  AND (si.total_cost = 0 OR si.unit_cost = 0);

CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL,
  category       TEXT NOT NULL DEFAULT 'General',
  description    TEXT,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','mobile_money','card','bank','other')),
  expense_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop expenses" ON expenses;
CREATE POLICY "Shop expenses" ON expenses FOR ALL USING (shop_id = public.get_my_shop_id());

CREATE INDEX IF NOT EXISTS idx_expenses_shop ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
