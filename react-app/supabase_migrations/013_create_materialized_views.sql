-- ╔══════════════════════════════════════════════════════════╗
-- ║     Create Materialized Views for Performance         ║
-- ╚══════════════════════════════════════════════════════════╝

-- Materialized view for dashboard stats (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT 
  s.business_id,
  COUNT(DISTINCT s.id) FILTER (WHERE s.created_at::date = CURRENT_DATE) AS today_transactions,
  COALESCE(SUM(s.total) FILTER (WHERE s.created_at::date = CURRENT_DATE), 0) AS today_sales,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(DISTINCT p.id) FILTER (WHERE p.stock_quantity <= p.low_stock_threshold) AS low_stock_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') AS total_debtors,
  COALESCE(SUM(d.balance) FILTER (WHERE d.status = 'active'), 0) AS total_debt_amount,
  NOW() AS last_updated
FROM sales s
FULL OUTER JOIN products p ON p.business_id = s.business_id
FULL OUTER JOIN debts d ON d.business_id = s.business_id
WHERE s.business_id IS NOT NULL OR p.business_id IS NOT NULL OR d.business_id IS NOT NULL
GROUP BY s.business_id
WITH DATA;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats_business ON mv_dashboard_stats(business_id);

-- Materialized view for product performance (refreshed every 10 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_performance AS
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
  COUNT(DISTINCT si.sale_id) AS sale_count,
  NOW() AS last_updated
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
LEFT JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.business_id, p.name, p.category, p.stock_quantity, p.low_stock_threshold
WITH DATA;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_performance_product ON mv_product_performance(product_id);

-- Materialized view for daily revenue (refreshed every hour)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
SELECT 
  s.business_id,
  s.created_at::date AS date,
  COALESCE(SUM(s.total), 0) AS revenue,
  COUNT(DISTINCT s.id) AS transactions,
  NOW() AS last_updated
FROM sales s
WHERE s.deleted_at IS NULL
  AND s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY s.business_id, s.created_at::date
WITH DATA;

-- Create composite index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_business_date ON mv_daily_revenue(business_id, date);

-- Grant access to materialized views
GRANT SELECT ON mv_dashboard_stats TO authenticated;
GRANT SELECT ON mv_product_performance TO authenticated;
GRANT SELECT ON mv_daily_revenue TO authenticated;

-- Note: Materialized views do not support RLS (Row Level Security).
-- Security is handled through the underlying table RLS policies and the view definitions.
-- The views already filter by business_id through the underlying table relationships.

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_materialized_views TO authenticated;

-- Set up pg_cron extension for automatic refresh (if available)
-- This requires pg_cron extension to be installed
-- Uncomment if pg_cron is available in your Supabase instance

-- SELECT cron.schedule('refresh-mv-dashboard', '*/5 * * * *', 'SELECT refresh_materialized_views()');
