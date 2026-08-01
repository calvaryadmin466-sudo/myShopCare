-- ╔══════════════════════════════════════════════════════════╗
-- ║   Fix RLS to support real multi-business membership      ║
-- ╚══════════════════════════════════════════════════════════╝
-- Root cause of a whole class of "works for my main shop but not my other
-- business" bugs (stats/reports showing 0, logo upload rejected, product
-- edits/deletes silently not applying, debt payments not saving):
--
-- public.get_my_business_id() (005_multi_business_support.sql) returns a
-- single arbitrary row via `SELECT business_id FROM business_users WHERE
-- user_id = auth.uid() LIMIT 1` — NOT the business currently selected in the
-- app's header switcher. Nearly every RLS policy checks
-- `business_id = public.get_my_business_id()`, so as soon as a user has more
-- than one business (owner of two shops, or a manager/cashier added to
-- someone else's business — the whole point of this multi-business feature),
-- every table silently filters to just whichever one business Postgres
-- happened to return first, no matter which business is actually selected.
--
-- Separately, 011_optimize_rls_policies.sql replaced the original `FOR ALL`
-- policies on products/sales/debts/debt_payments/expenses/deals/workers with
-- SELECT-only and INSERT-only policies and never added UPDATE/DELETE back.
-- With RLS enabled and no matching policy, Postgres just silently matches
-- zero rows — so editing a product, deleting a product, recording a debt
-- payment, toggling/deleting a deal, and deleting a worker have all been
-- silently no-ops (no error, just "0 rows updated") since that migration.
--
-- This migration fixes both: a real membership check instead of an
-- arbitrary single business, and restores UPDATE/DELETE policies.

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM business_users
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id
      AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_business_member TO authenticated;

-- ── Products ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business products" ON products;
DROP POLICY IF EXISTS "Business products insert" ON products;
CREATE POLICY "Business products select" ON products FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business products insert" ON products FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business products update" ON products FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business products delete" ON products FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Sales ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business sales" ON sales;
DROP POLICY IF EXISTS "Business sales insert" ON sales;
CREATE POLICY "Business sales select" ON sales FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business sales insert" ON sales FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business sales update" ON sales FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business sales delete" ON sales FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Sale Items (scoped via the parent sale's business) ──────
DROP POLICY IF EXISTS "Business sale items" ON sale_items;
DROP POLICY IF EXISTS "Business sale items insert" ON sale_items;
CREATE POLICY "Business sale items select" ON sale_items FOR SELECT
  USING (sale_id IN (SELECT id FROM sales WHERE public.is_business_member(business_id) AND deleted_at IS NULL));
CREATE POLICY "Business sale items insert" ON sale_items FOR INSERT
  WITH CHECK (sale_id IN (SELECT id FROM sales WHERE public.is_business_member(business_id)));
CREATE POLICY "Business sale items update" ON sale_items FOR UPDATE
  USING (sale_id IN (SELECT id FROM sales WHERE public.is_business_member(business_id)));
CREATE POLICY "Business sale items delete" ON sale_items FOR DELETE
  USING (sale_id IN (SELECT id FROM sales WHERE public.is_business_member(business_id)));

-- ── Debts ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business debts" ON debts;
DROP POLICY IF EXISTS "Business debts insert" ON debts;
CREATE POLICY "Business debts select" ON debts FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business debts insert" ON debts FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business debts update" ON debts FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business debts delete" ON debts FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Debt Payments (scoped via the parent debt's business) ────
DROP POLICY IF EXISTS "Business debt payments" ON debt_payments;
DROP POLICY IF EXISTS "Business debt payments insert" ON debt_payments;
CREATE POLICY "Business debt payments select" ON debt_payments FOR SELECT
  USING (debt_id IN (SELECT id FROM debts WHERE public.is_business_member(business_id) AND deleted_at IS NULL));
CREATE POLICY "Business debt payments insert" ON debt_payments FOR INSERT
  WITH CHECK (debt_id IN (SELECT id FROM debts WHERE public.is_business_member(business_id)));
CREATE POLICY "Business debt payments update" ON debt_payments FOR UPDATE
  USING (debt_id IN (SELECT id FROM debts WHERE public.is_business_member(business_id)));
CREATE POLICY "Business debt payments delete" ON debt_payments FOR DELETE
  USING (debt_id IN (SELECT id FROM debts WHERE public.is_business_member(business_id)));

-- ── Expenses ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business expenses" ON expenses;
DROP POLICY IF EXISTS "Business expenses insert" ON expenses;
CREATE POLICY "Business expenses select" ON expenses FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business expenses insert" ON expenses FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business expenses update" ON expenses FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business expenses delete" ON expenses FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Deals ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business deals" ON deals;
DROP POLICY IF EXISTS "Business deals insert" ON deals;
CREATE POLICY "Business deals select" ON deals FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business deals insert" ON deals FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business deals update" ON deals FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business deals delete" ON deals FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Workers ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Business workers" ON workers;
DROP POLICY IF EXISTS "Business workers insert" ON workers;
CREATE POLICY "Business workers select" ON workers FOR SELECT
  USING (public.is_business_member(business_id) AND deleted_at IS NULL);
CREATE POLICY "Business workers insert" ON workers FOR INSERT
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Business workers update" ON workers FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business workers delete" ON workers FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Audit logs (007_create_audit_log.sql) ───────────────────
DROP POLICY IF EXISTS "Business audit logs" ON audit_logs;
CREATE POLICY "Business audit logs select" ON audit_logs FOR SELECT
  USING (public.is_business_member(business_id));

-- ── Sale attachments (014_create_sale_attachments.sql) ──────
DROP POLICY IF EXISTS "Business sale attachments" ON sale_attachments;
DROP POLICY IF EXISTS "Insert sale attachments" ON sale_attachments;
DROP POLICY IF EXISTS "Update sale attachments" ON sale_attachments;
DROP POLICY IF EXISTS "Delete sale attachments" ON sale_attachments;
CREATE POLICY "Business sale attachments select" ON sale_attachments FOR SELECT
  USING (public.is_business_member(business_id));
CREATE POLICY "Business sale attachments insert" ON sale_attachments FOR INSERT
  WITH CHECK (public.is_business_member(business_id) AND sale_id IN (SELECT id FROM sales WHERE public.is_business_member(business_id)));
CREATE POLICY "Business sale attachments update" ON sale_attachments FOR UPDATE
  USING (public.is_business_member(business_id));
CREATE POLICY "Business sale attachments delete" ON sale_attachments FOR DELETE
  USING (public.is_business_member(business_id));

-- ── Business logo storage bucket (015_create_storage_bucket.sql) ──
DROP POLICY IF EXISTS "Authenticated users can upload business logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload business logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND public.is_business_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Authenticated users can update business logos"
ON storage.objects FOR UPDATE TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND public.is_business_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Authenticated users can delete business logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND public.is_business_member(((storage.foldername(name))[1])::uuid)
);

-- "Public can view business logos" (SELECT, bucket_id only) is unaffected
-- and left as-is.

-- ── Audit log attribution: use the row's actual business_id ─────
-- trigger_audit_log() previously relied on log_audit() defaulting to
-- get_my_business_id() (the same arbitrary-business problem), so audit
-- entries for a non-default business were mislabeled. Extract the row's own
-- business_id and pass it through explicitly.
CREATE OR REPLACE FUNCTION public.log_audit(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_business_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_business_id UUID;
  v_user_id UUID;
  v_audit_id UUID;
BEGIN
  v_business_id := COALESCE(p_business_id, public.get_my_business_id());
  v_user_id := auth.uid();

  INSERT INTO audit_logs (
    business_id, user_id, table_name, record_id, action,
    old_values, new_values, ip_address, user_agent
  ) VALUES (
    v_business_id, v_user_id, p_table_name, p_record_id, p_action,
    p_old_values, p_new_values, p_ip_address, p_user_agent
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_action TEXT;
  v_record_id UUID;
  v_business_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_business_id := CASE WHEN TG_TABLE_NAME = 'businesses' THEN NEW.id ELSE (v_new_values->>'business_id')::UUID END;
    PERFORM public.log_audit(TG_TABLE_NAME, v_record_id, v_action, NULL, v_new_values, NULL, NULL, v_business_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_business_id := CASE WHEN TG_TABLE_NAME = 'businesses' THEN NEW.id ELSE (v_new_values->>'business_id')::UUID END;
    PERFORM public.log_audit(TG_TABLE_NAME, v_record_id, v_action, v_old_values, v_new_values, NULL, NULL, v_business_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_values := to_jsonb(OLD);
    v_record_id := OLD.id;
    v_business_id := CASE WHEN TG_TABLE_NAME = 'businesses' THEN OLD.id ELSE (v_old_values->>'business_id')::UUID END;
    PERFORM public.log_audit(TG_TABLE_NAME, v_record_id, v_action, v_old_values, NULL, NULL, NULL, v_business_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
