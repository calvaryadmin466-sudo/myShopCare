-- ╔══════════════════════════════════════════════════════════╗
-- ║     Create Sale Attachments Table Migration            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Create sale_attachments table
CREATE TABLE IF NOT EXISTS sale_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sale_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Business sale attachments" ON sale_attachments
  FOR SELECT USING (business_id = public.get_my_business_id());

CREATE POLICY "Insert sale attachments" ON sale_attachments
  FOR INSERT WITH CHECK (
    business_id = public.get_my_business_id()
    AND sale_id IN (SELECT id FROM sales WHERE business_id = public.get_my_business_id())
  );

CREATE POLICY "Update sale attachments" ON sale_attachments
  FOR UPDATE USING (business_id = public.get_my_business_id());

CREATE POLICY "Delete sale attachments" ON sale_attachments
  FOR DELETE USING (business_id = public.get_my_business_id());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sale_attachments_sale ON sale_attachments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_attachments_business ON sale_attachments(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_attachments_created ON sale_attachments(created_at DESC);
