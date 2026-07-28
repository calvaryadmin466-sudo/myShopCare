-- Add expiry date tracking to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_days_alert INTEGER NOT NULL DEFAULT 30;

-- Index for efficient near-expiry queries
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(shop_id, expiry_date)
  WHERE expiry_date IS NOT NULL;
