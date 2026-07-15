-- ╔══════════════════════════════════════════════════════════╗
-- ║          Fix User Deletion Foreign Key Constraints        ║
-- ║  This migration fixes blocking constraints that prevent  ║
-- ║  Supabase auth users from being deleted.                  ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── Audit current foreign key constraints on auth.users ────────────────
-- The sales table has a foreign key that blocks user deletion:
-- cashier_id UUID NOT NULL REFERENCES auth.users(id)
-- This defaults to ON DELETE RESTRICT, preventing deletion of users with sales

-- ── Fix sales.cashier_id foreign key ───────────────────────────────────
-- Change to SET NULL to preserve sales history while allowing user deletion
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cashier_id_fkey;
ALTER TABLE sales 
  ADD CONSTRAINT sales_cashier_id_fkey 
  FOREIGN KEY (cashier_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- ── Verify the fix ─────────────────────────────────────────────────────
-- This allows users to be deleted from Supabase Dashboard
-- Sales records will be preserved with cashier_id set to NULL
-- cashier_name field already exists as a fallback for display purposes
