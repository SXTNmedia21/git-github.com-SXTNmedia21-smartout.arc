-- ============================================
-- 20260422100400_payroll_seed_holidays.sql
-- Payroll: Norwegian public holidays 2026-2027
-- Seeds into public_holiday (Cascade A1 table)
-- ============================================

-- Upsert pattern: ON CONFLICT DO NOTHING (idempotent)

-- 2026 Norwegian public holidays
INSERT INTO public.public_holiday (country_code, holiday_date, name, name_no, is_full_day) VALUES
  ('NO', '2026-01-01', 'New Year''s Day', 'Nyaarsdagen', true),
  ('NO', '2026-04-02', 'Maundy Thursday', 'Skjaertorsdag', true),
  ('NO', '2026-04-03', 'Good Friday', 'Langfredag', true),
  ('NO', '2026-04-05', 'Easter Sunday', 'Foerste paaskedag', true),
  ('NO', '2026-04-06', 'Easter Monday', 'Andre paaskedag', true),
  ('NO', '2026-05-01', 'Labour Day', 'Arbeidernes dag', true),
  ('NO', '2026-05-14', 'Ascension Day', 'Kristi himmelfartsdag', true),
  ('NO', '2026-05-17', 'Constitution Day', 'Grunnlovsdagen', true),
  ('NO', '2026-05-24', 'Whit Sunday', 'Foerste pinsedag', true),
  ('NO', '2026-05-25', 'Whit Monday', 'Andre pinsedag', true),
  ('NO', '2026-12-25', 'Christmas Day', 'Foerste juledag', true),
  ('NO', '2026-12-26', 'Boxing Day', 'Andre juledag', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- 2027 Norwegian public holidays
INSERT INTO public.public_holiday (country_code, holiday_date, name, name_no, is_full_day) VALUES
  ('NO', '2027-01-01', 'New Year''s Day', 'Nyaarsdagen', true),
  ('NO', '2027-03-25', 'Maundy Thursday', 'Skjaertorsdag', true),
  ('NO', '2027-03-26', 'Good Friday', 'Langfredag', true),
  ('NO', '2027-03-28', 'Easter Sunday', 'Foerste paaskedag', true),
  ('NO', '2027-03-29', 'Easter Monday', 'Andre paaskedag', true),
  ('NO', '2027-05-01', 'Labour Day', 'Arbeidernes dag', true),
  ('NO', '2027-05-06', 'Ascension Day', 'Kristi himmelfartsdag', true),
  ('NO', '2027-05-16', 'Whit Sunday', 'Foerste pinsedag', true),
  ('NO', '2027-05-17', 'Constitution Day / Whit Monday', 'Grunnlovsdagen / Andre pinsedag', true),
  ('NO', '2027-12-25', 'Christmas Day', 'Foerste juledag', true),
  ('NO', '2027-12-26', 'Boxing Day', 'Andre juledag', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- Common "almost-holidays" that many hospitality businesses treat as holidays
-- (Christmas Eve, New Year's Eve — not official public holidays but often paid as such)
-- These are NOT inserted as public_holiday — they go in workspace-scoped payroll_holiday_entry
-- when the admin configures their calendar. Just a comment for awareness.
