-- ╔══════════════════════════════════════════════════════════╗
-- ║     Add Audit Triggers Migration                       ║
-- ╚══════════════════════════════════════════════════════════╝

-- Generic trigger function for audit logging
CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_action TEXT;
  v_record_id UUID;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_values := to_jsonb(OLD);
    v_record_id := OLD.id;
    RETURN OLD;
  END IF;
  
  -- Log the audit entry
  PERFORM public.log_audit(
    p_table_name := TG_TABLE_NAME,
    p_record_id := v_record_id,
    p_action := v_action,
    p_old_values := v_old_values,
    p_new_values := v_new_values
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sales audit triggers
DROP TRIGGER IF EXISTS audit_sales_insert ON sales;
DROP TRIGGER IF EXISTS audit_sales_update ON sales;
DROP TRIGGER IF EXISTS audit_sales_delete ON sales;

CREATE TRIGGER audit_sales_insert
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_sales_update
  AFTER UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_sales_delete
  AFTER DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Products audit triggers
DROP TRIGGER IF EXISTS audit_products_insert ON products;
DROP TRIGGER IF EXISTS audit_products_update ON products;
DROP TRIGGER IF EXISTS audit_products_delete ON products;

CREATE TRIGGER audit_products_insert
  AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_products_update
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_products_delete
  AFTER DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Debts audit triggers
DROP TRIGGER IF EXISTS audit_debts_insert ON debts;
DROP TRIGGER IF EXISTS audit_debts_update ON debts;
DROP TRIGGER IF EXISTS audit_debts_delete ON debts;

CREATE TRIGGER audit_debts_insert
  AFTER INSERT ON debts
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_debts_update
  AFTER UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_debts_delete
  AFTER DELETE ON debts
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Expenses audit triggers
DROP TRIGGER IF EXISTS audit_expenses_insert ON expenses;
DROP TRIGGER IF EXISTS audit_expenses_update ON expenses;
DROP TRIGGER IF EXISTS audit_expenses_delete ON expenses;

CREATE TRIGGER audit_expenses_insert
  AFTER INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_expenses_update
  AFTER UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_expenses_delete
  AFTER DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Businesses audit triggers
DROP TRIGGER IF EXISTS audit_businesses_insert ON businesses;
DROP TRIGGER IF EXISTS audit_businesses_update ON businesses;
DROP TRIGGER IF EXISTS audit_businesses_delete ON businesses;

CREATE TRIGGER audit_businesses_insert
  AFTER INSERT ON businesses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_businesses_update
  AFTER UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_businesses_delete
  AFTER DELETE ON businesses
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Workers audit triggers
DROP TRIGGER IF EXISTS audit_workers_insert ON workers;
DROP TRIGGER IF EXISTS audit_workers_update ON workers;
DROP TRIGGER IF EXISTS audit_workers_delete ON workers;

CREATE TRIGGER audit_workers_insert
  AFTER INSERT ON workers
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_workers_update
  AFTER UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_workers_delete
  AFTER DELETE ON workers
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Deals audit triggers
DROP TRIGGER IF EXISTS audit_deals_insert ON deals;
DROP TRIGGER IF EXISTS audit_deals_update ON deals;
DROP TRIGGER IF EXISTS audit_deals_delete ON deals;

CREATE TRIGGER audit_deals_insert
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_deals_update
  AFTER UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_deals_delete
  AFTER DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();
