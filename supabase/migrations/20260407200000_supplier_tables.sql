SET search_path TO public, extensions;

-- ============================================
-- Supplier management: directory + order tracking
-- Enables food cost analysis, price trend tracking,
-- and delivery reliability scoring for analytics platforms.
-- ============================================

-- ── supplier ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier (
  supplier_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  org_number        TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'NO',
  category          TEXT,
  payment_terms     TEXT,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_supplier" ON supplier;
CREATE POLICY "jwt_read_supplier" ON supplier
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_supplier" ON supplier;
CREATE POLICY "jwt_manage_supplier" ON supplier
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_supplier" ON supplier;
CREATE POLICY "api_key_read_supplier" ON supplier
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_supplier" ON supplier;
CREATE POLICY "service_role_supplier" ON supplier
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_supplier_workspace ON supplier (workspace_id);
CREATE TRIGGER set_supplier_updated_at BEFORE UPDATE ON supplier FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── supplier_order ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_order (
  order_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES supplier(supplier_id) ON DELETE CASCADE,
  department_id     UUID REFERENCES department(department_id),
  order_date        DATE NOT NULL,
  delivery_date     DATE,
  total_amount      NUMERIC(12,2),
  currency          TEXT DEFAULT 'NOK',
  status            TEXT NOT NULL DEFAULT 'ordered',
  delivery_rating   INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_supplier_order" ON supplier_order;
CREATE POLICY "jwt_read_supplier_order" ON supplier_order
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_supplier_order" ON supplier_order;
CREATE POLICY "jwt_manage_supplier_order" ON supplier_order
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_supplier_order" ON supplier_order;
CREATE POLICY "api_key_read_supplier_order" ON supplier_order
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_supplier_order" ON supplier_order;
CREATE POLICY "service_role_supplier_order" ON supplier_order
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_supplier_order_workspace ON supplier_order (workspace_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_order_supplier ON supplier_order (supplier_id, order_date DESC);
CREATE TRIGGER set_supplier_order_updated_at BEFORE UPDATE ON supplier_order FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE supplier IS 'Supplier directory with contact info and payment terms.';
COMMENT ON TABLE supplier_order IS 'Order/delivery records for price tracking and reliability scoring.';
