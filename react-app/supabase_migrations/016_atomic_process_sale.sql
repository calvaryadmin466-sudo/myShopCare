-- ╔══════════════════════════════════════════════════════════╗
-- ║   Atomic, transactional POS checkout                    ║
-- ╚══════════════════════════════════════════════════════════╝
-- Previously the client did: insert sale -> insert sale_items -> loop
-- updating each product's stock_quantity from a client-side snapshot ->
-- optionally insert a debt. Each step was a separate round trip with no
-- shared transaction, which meant:
--   1) Two concurrent checkouts on the same product could both read the same
--      stale stock_quantity and both succeed, overselling stock.
--   2) A failure partway through (e.g. the stock update) left a sale record
--      committed with no corresponding stock change or items, silently.
-- process_sale() does the whole checkout as a single DB transaction: the
-- stock update is a guarded UPDATE ... WHERE stock_quantity >= qty (atomic
-- check-and-decrement), and the whole function rolls back automatically if
-- any step raises.

DROP FUNCTION IF EXISTS process_sale(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION process_sale(
  p_business_id UUID,
  p_cashier_id UUID,
  p_cashier_worker_id UUID,
  p_cashier_name TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_amount_paid NUMERIC,
  p_change_given NUMERIC,
  p_items JSONB -- [{product_id, product_name, quantity, unit_price, total_price, unit_cost, total_cost}, ...]
)
RETURNS SETOF sales AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_qty NUMERIC;
  v_updated_id UUID;
  v_outstanding NUMERIC;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_cart' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO sales (
    business_id, cashier_id, cashier_worker_id, cashier_name,
    customer_name, customer_phone, subtotal, discount, total,
    payment_method, payment_status, amount_paid, change_given
  ) VALUES (
    p_business_id, p_cashier_id, p_cashier_worker_id, p_cashier_name,
    p_customer_name, p_customer_phone, p_subtotal, p_discount, p_total,
    p_payment_method, p_payment_status, p_amount_paid, p_change_given
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;

    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, unit_cost, total_cost)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      v_qty,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total_price')::NUMERIC,
      (v_item->>'unit_cost')::NUMERIC,
      (v_item->>'total_cost')::NUMERIC
    );

    UPDATE products
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID
      AND business_id = p_business_id
      AND deleted_at IS NULL
      AND stock_quantity >= v_qty
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
      RAISE EXCEPTION 'insufficient_stock: %', v_item->>'product_name' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Track any non-fully-paid sale (credit, or a partial cash/mobile/card
  -- payment) as a debt for the outstanding balance.
  IF p_payment_status <> 'paid' AND p_customer_name IS NOT NULL THEN
    v_outstanding := p_total - p_amount_paid;
    IF v_outstanding > 0 THEN
      INSERT INTO debts (business_id, customer_name, customer_phone, original_amount, amount_paid, sale_id)
      VALUES (p_business_id, p_customer_name, p_customer_phone, v_outstanding, 0, v_sale_id);
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM sales WHERE id = v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_sale TO authenticated;
