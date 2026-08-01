-- ╔══════════════════════════════════════════════════════════╗
-- ║     Create PostgreSQL Functions Migration              ║
-- ╚══════════════════════════════════════════════════════════╝

-- Calculate revenue for a business within a date range
CREATE OR REPLACE FUNCTION calculate_revenue(p_business_id UUID, p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_revenue NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total), 0)
  INTO v_revenue
  FROM sales
  WHERE business_id = p_business_id
    AND deleted_at IS NULL
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
  
  RETURN v_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate profit for a business within a date range
CREATE OR REPLACE FUNCTION calculate_profit(p_business_id UUID, p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_revenue NUMERIC;
  v_cogs NUMERIC;
  v_profit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(s.total), 0)
  INTO v_revenue
  FROM sales s
  WHERE s.business_id = p_business_id
    AND s.deleted_at IS NULL
    AND (p_start_date IS NULL OR s.created_at >= p_start_date)
    AND (p_end_date IS NULL OR s.created_at <= p_end_date);
  
  SELECT COALESCE(SUM(si.total_cost), 0)
  INTO v_cogs
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.business_id = p_business_id
    AND s.deleted_at IS NULL
    AND (p_start_date IS NULL OR s.created_at >= p_start_date)
    AND (p_end_date IS NULL OR s.created_at <= p_end_date);
  
  v_profit := v_revenue - v_cogs;
  RETURN v_profit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get low stock products for a business
CREATE OR REPLACE FUNCTION get_low_stock_products(p_business_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity NUMERIC,
  low_stock_threshold NUMERIC,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.low_stock_threshold,
    p.category
  FROM products p
  WHERE p.business_id = p_business_id
    AND p.deleted_at IS NULL
    AND p.stock_quantity <= p.low_stock_threshold
  ORDER BY p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit entry
CREATE OR REPLACE FUNCTION log_audit(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_business_id UUID;
  v_user_id UUID;
  v_audit_id UUID;
BEGIN
  -- Get current business context
  v_business_id := public.get_my_business_id();
  
  -- Get current user
  v_user_id := auth.uid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    business_id,
    user_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    v_business_id,
    v_user_id,
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get top products by revenue for a business
CREATE OR REPLACE FUNCTION get_top_products(p_business_id UUID, p_limit INT DEFAULT 10, p_days INT DEFAULT 30)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category TEXT,
  total_sold NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    COALESCE(SUM(si.quantity), 0) AS total_sold,
    COALESCE(SUM(si.total_price), 0) AS total_revenue
  FROM products p
  LEFT JOIN sale_items si ON si.product_id = p.id
  LEFT JOIN sales s ON s.id = si.sale_id 
    AND s.business_id = p_business_id 
    AND s.deleted_at IS NULL
    AND s.created_at >= NOW() - (p_days || ' days')::INTERVAL
  WHERE p.business_id = p_business_id
    AND p.deleted_at IS NULL
  GROUP BY p.id, p.name, p.category
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get daily revenue for a business (for charts)
CREATE OR REPLACE FUNCTION get_daily_revenue(p_business_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  revenue NUMERIC,
  transactions INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.created_at::date AS date,
    COALESCE(SUM(s.total), 0) AS revenue,
    COUNT(DISTINCT s.id) AS transactions
  FROM sales s
  WHERE s.business_id = p_business_id
    AND s.deleted_at IS NULL
    AND s.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY s.created_at::date
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_profit TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_revenue TO authenticated;
