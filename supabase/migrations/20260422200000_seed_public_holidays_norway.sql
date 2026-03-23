-- Seed Norwegian public holidays (helligdager) for 2026 and 2027.
-- These are platform-owned (K1a) and apply to all workspaces.
-- Easter dates are pre-calculated per Norwegian calendar.

INSERT INTO public.public_holiday (country_code, holiday_date, name, name_no, is_full_day) VALUES
  -- 2026
  ('NO', '2026-01-01', 'New Year''s Day',          'Nyttarsdag',               true),
  ('NO', '2026-03-29', 'Palm Sunday',              'Palmesundag',              true),
  ('NO', '2026-04-02', 'Maundy Thursday',          'Skjaertorsdag',            true),
  ('NO', '2026-04-03', 'Good Friday',              'Langfredag',               true),
  ('NO', '2026-04-05', 'Easter Sunday',            'Forste paskesdag',         true),
  ('NO', '2026-04-06', 'Easter Monday',            'Andre paskesdag',          true),
  ('NO', '2026-05-01', 'Labour Day',               'Forste mai',               true),
  ('NO', '2026-05-14', 'Ascension Day',            'Kristi himmelfartsdag',    true),
  ('NO', '2026-05-17', 'Constitution Day',         'Grunnlovsdag',             true),
  ('NO', '2026-05-24', 'Whit Sunday',              'Forste pinsedag',          true),
  ('NO', '2026-05-25', 'Whit Monday',              'Andre pinsedag',           true),
  ('NO', '2026-12-25', 'Christmas Day',            'Forste juledag',           true),
  ('NO', '2026-12-26', 'Boxing Day',               'Andre juledag',            true),

  -- 2027
  ('NO', '2027-01-01', 'New Year''s Day',          'Nyttarsdag',               true),
  ('NO', '2027-03-21', 'Palm Sunday',              'Palmesundag',              true),
  ('NO', '2027-03-25', 'Maundy Thursday',          'Skjaertorsdag',            true),
  ('NO', '2027-03-26', 'Good Friday',              'Langfredag',               true),
  ('NO', '2027-03-28', 'Easter Sunday',            'Forste paskesdag',         true),
  ('NO', '2027-03-29', 'Easter Monday',            'Andre paskesdag',          true),
  ('NO', '2027-05-01', 'Labour Day',               'Forste mai',               true),
  ('NO', '2027-05-06', 'Ascension Day',            'Kristi himmelfartsdag',    true),
  ('NO', '2027-05-16', 'Whit Sunday',              'Forste pinsedag',          true),
  ('NO', '2027-05-17', 'Constitution Day / Whit Monday', 'Grunnlovsdag / Andre pinsedag', true),
  ('NO', '2027-12-25', 'Christmas Day',            'Forste juledag',           true),
  ('NO', '2027-12-26', 'Boxing Day',               'Andre juledag',            true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;
