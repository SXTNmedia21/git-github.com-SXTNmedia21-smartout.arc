-- Email Template Creator for platform communications
-- Stores structured email templates with configurable sections

CREATE TABLE platform_email_template (
  template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  subject text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]',
  placeholders jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS: platform-admin tables use service role only
COMMENT ON TABLE platform_email_template IS 'Email templates for platform communications. Categories: trial, newsletter, alert, announcement, custom';
COMMENT ON COLUMN platform_email_template.sections IS 'JSON array of sections: [{id, type, content, items?, imageUrl?, imageAlt?, buttonText?, buttonUrl?}]';
COMMENT ON COLUMN platform_email_template.placeholders IS 'JSON array of placeholders: [{key, label, defaultValue?}]';
