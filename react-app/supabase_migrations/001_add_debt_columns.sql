-- Add new columns to debts table
ALTER TABLE debts
  ADD COLUMN creditor_name TEXT,
  ADD COLUMN interest_rate NUMERIC,
  ADD COLUMN min_monthly_payment NUMERIC;

-- Update existing rows to use customer_name as creditor_name (backwards compatibility)
UPDATE debts
  SET creditor_name = customer_name
  WHERE creditor_name IS NULL;

-- Make creditor_name and due_date required
ALTER TABLE debts
  ALTER COLUMN creditor_name SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;

-- RLS Policies for debts
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to debts"
ON debts
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
