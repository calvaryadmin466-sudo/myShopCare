-- ╔══════════════════════════════════════════════════════════╗
-- ║     Create SQL Views for Analytics Migration           ║
-- ╚══════════════════════════════════════════════════════════╝

-- Dashboard Stats View
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT 
  s.business_id,
  COUNT(DISTINCT s.id) FILTER (WHERE s.created_at::date = CURRENT_DATE) AS today_transactions,
  COALESCE(SUM(s.total) FILTER (WHERE s.created_at::date = CURRENT_DATE), 0) AS today_sales,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(DISTINCT p.id) FILTER (WHERE p.stock_quantity <= p.low_stock_threshold) AS low_stock_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') AS total_debtors,
  COALESCE(SUM(d.balance) FILTER (WHERE d.status = 'active'), 0) AS total_debt_amount
FROM sales s
FULL OUTER JOIN products p ON p.business_id = s.business_id
FULL OUTER JOIN debts d ON d.business_id = s.business_id
WHERE s.business_id IS NOT NULL OR p.business_id IS NOT NULL OR d.business_id IS NOT NULL
GROUP BY s.business_id;

-- Sales Summary View (with profit calculation)
CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT 
  s.id,
  s.business_id,
  s.created_at,
  s.payment_method,
  s.payment_status,
  s.total,
  s.customer_name,
  s.cashier_name,
  s.total AS revenue,
  COALESCE(SUM(si.total_cost), 0) AS cogs,
  s.total - COALESCE(SUM(si.total_cost), 0) AS gross_profit,
  COUNT(si.id) AS item_count
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.business_id, s.created_at, s.payment_method, s.payment_status, s.total, s.customer_name, s.cashier_name;

-- Product Performance View
CREATE OR REPLACE VIEW vw_product_performance AS
SELECT 
  p.id AS product_id,
  p.business_id,
  p.name AS product_name,
  p.category,
  p.stock_quantity,
  p.low_stock_threshold,
  COALESCE(SUM(si.quantity), 0) AS total_sold,
  COALESCE(SUM(si.total_price), 0) AS total_revenue,
  COALESCE(SUM(si.total_cost), 0) AS total_cogs,
  COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0) AS total_profit,
  COUNT(DISTINCT si.sale_id) AS sale_count
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
LEFT JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.business_id, p.name, p.category, p.stock_quantity, p.low_stock_threshold;

-- Customer Summary View
CREATE OR REPLACE VIEW vw_customer_summary AS
SELECT 
  s.customer_name,
  s.customer_phone,
  s.business_id,
  COUNT(DISTINCT s.id) AS transaction_count,
  COALESCE(SUM(s.total), 0) AS total_purchased,
  COALESCE(SUM(s.total) FILTER (WHERE s.payment_status IN ('partial', 'pending')), 0) AS total_credit,
  COALESCE(SUM(d.balance), 0) AS outstanding_debt,
  MAX(s.created_at) AS last_purchase_date
FROM sales s
LEFT JOIN debts d ON d.customer_name = s.customer_name AND d.customer_phone = s.customer_phone AND d.business_id = s.business_id AND d.status = 'active'
WHERE s.deleted_at IS NULL
GROUP BY s.customer_name, s.customer_phone, s.business_id;

-- Payment Distribution View
CREATE OR REPLACE VIEW vw_payment_distribution AS
SELECT 
  s.business_id,
  s.payment_method,
  COUNT(DISTINCT s.id) AS transaction_count,
  COALESCE(SUM(s.total), 0) AS total_amount,
  ROUND(
    (COALESCE(SUM(s.total), 0) / NULLIF(SUM(SUM(s.total)) OVER (PARTITION BY s.business_id), 0)) * 100,
    2
  ) AS percentage
FROM sales s
WHERE s.deleted_at IS NULL
GROUP BY s.business_id, s.payment_method;

-- Grant access to views
GRANT SELECT ON vw_dashboard_stats TO authenticated;
GRANT SELECT ON vw_sales_summary TO authenticated;
GRANT SELECT ON vw_product_performance TO authenticated;
GRANT SELECT ON vw_customer_summary TO authenticated;
GRANT SELECT ON vw_payment_distribution TO authenticated;

-- Create security barriers for views
-- Note: RLS policies cannot be created on views. 
-- Security is managed through the underlying table RLS policies and view definitions.
ALTER VIEW vw_dashboard_stats SET (security_barrier = on);
ALTER VIEW vw_sales_summary SET (security_barrier = on);
ALTER VIEW vw_product_performance SET (security_barrier = on);
ALTER VIEW vw_customer_summary SET (security_barrier = on);
ALTER VIEW vw_payment_distribution SET (security_barrier = on);
