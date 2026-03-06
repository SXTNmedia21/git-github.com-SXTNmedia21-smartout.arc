-- Template: Restaurant Schedule (3 months)
-- Industry:   restaurant (NACE 56.101)
-- Duration:   CURRENT_DATE -> CURRENT_DATE + 90 days
-- Shifts:     ~4,500 total
-- Patterns:   Full-time 5/week, minors 2/week (4 summer), pensioners 2-3/week, freelancers 1-3/week
-- Depends:    employees.sql (profiles must exist)
-- Usage:      SELECT template_restaurant_schedule(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_schedule(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profiles uuid[];
  v_count   integer;
BEGIN
  -- ── 1. Load all profiles for this workspace ──────────────────
  SELECT array_agg(profile_id ORDER BY created_at, profile_id)
    INTO v_profiles
    FROM profile
   WHERE workspace_id = p_workspace_id;

  v_count := coalesce(array_length(v_profiles, 1), 0);

  IF v_count < 50 THEN
    RAISE EXCEPTION 'Need at least 50 profiles, found %', v_count;
  END IF;

  -- ── 2. Delete existing shifts in the date range ──────────────
  DELETE FROM schedule_shift
   WHERE workspace_id = p_workspace_id
     AND shift_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90;

  -- ── 3. Insert all shifts in one statement ────────────────────
  --
  -- Employee layout (0-indexed):
  --   0..5   = Kitchen staff (Kokk)           — full-time adults
  --   6..10  = Restaurant staff (Servitor)    — full-time adults
  --  11..14  = Bar staff (Bartender)          — full-time adults
  --  15..17  = Catering (Catering)            — full-time adults
  --  18..20  = Cleaning (Renhold)             — full-time adults
  --  21..22  = Delivery (Levering)            — full-time adults
  --  23..24  = Event (Event)                  — full-time adults
  --  25..34  = Foreign workers (same depts)   — full-time
  --  35..39  = Minors (Hjelpeservitor)        — restricted
  --  40..43  = Pensioners (Hjelpeservitor)    — part-time
  --  44..49  = Freelancers (Frilanser)        — irregular

  INSERT INTO schedule_shift (
    workspace_id,
    employee_id,
    shift_date,
    role,
    start_time,
    end_time,
    work_hours,
    breaks,
    day_category,
    status,
    is_published,
    indicator
  )
  SELECT
    p_workspace_id,
    emp.profile_id,
    d.shift_date,
    emp.role,
    emp.start_time,
    emp.end_time,
    emp.work_hours,
    emp.breaks,
    -- Day category: weekend override for Sat/Sun
    CASE
      WHEN extract(isodow FROM d.shift_date) IN (6, 7) THEN 'weekend'::day_category
      WHEN emp.start_time < '11:00'::time                THEN 'morning'::day_category
      WHEN emp.start_time < '14:00'::time                THEN 'midday'::day_category
      WHEN emp.start_time < '17:00'::time                THEN 'afternoon'::day_category
      WHEN emp.start_time < '21:00'::time                THEN 'evening'::day_category
      ELSE 'night'::day_category
    END,
    'published'::shift_status,
    true,
    emp.indicator
  FROM
    -- Generate 91 days (today + 90)
    generate_series(CURRENT_DATE, CURRENT_DATE + 90, '1 day'::interval) AS d(shift_date)
  CROSS JOIN LATERAL (
    -- For each date, determine which employees work and their shift details
    SELECT
      v_profiles[i + 1] AS profile_id,
      i,
      dow,
      week_num,
      is_summer,
      -- Role assignment
      CASE
        WHEN i BETWEEN 0  AND 5  THEN 'Kokk'
        WHEN i BETWEEN 6  AND 10 THEN 'Servitor'
        WHEN i BETWEEN 11 AND 14 THEN 'Bartender'
        WHEN i BETWEEN 15 AND 17 THEN 'Catering'
        WHEN i BETWEEN 18 AND 20 THEN 'Renhold'
        WHEN i BETWEEN 21 AND 22 THEN 'Levering'
        WHEN i BETWEEN 23 AND 24 THEN 'Event'
        -- Foreign workers mirror departments
        WHEN i = 25 THEN 'Kokk'
        WHEN i = 26 THEN 'Kokk'
        WHEN i = 27 THEN 'Servitor'
        WHEN i = 28 THEN 'Servitor'
        WHEN i = 29 THEN 'Bartender'
        WHEN i = 30 THEN 'Bartender'
        WHEN i = 31 THEN 'Catering'
        WHEN i = 32 THEN 'Renhold'
        WHEN i = 33 THEN 'Levering'
        WHEN i = 34 THEN 'Event'
        -- Minors
        WHEN i BETWEEN 35 AND 39 THEN 'Hjelpeservitor'
        -- Pensioners
        WHEN i BETWEEN 40 AND 43 THEN 'Hjelpeservitor'
        -- Freelancers
        WHEN i BETWEEN 44 AND 49 THEN 'Frilanser'
      END AS role,
      -- Shift start time
      CASE
        -- Kitchen: even-index morning, odd evening; swap every 2 weeks
        WHEN i BETWEEN 0 AND 5 OR i IN (25, 26) THEN
          CASE WHEN ((i % 2) + (week_num % 2)) % 2 = 0
               THEN '07:00'::time ELSE '14:00'::time END
        -- Restaurant: even lunch, odd dinner; swap every 2 weeks
        WHEN i BETWEEN 6 AND 10 OR i IN (27, 28) THEN
          CASE WHEN ((i % 2) + (week_num % 2)) % 2 = 0
               THEN '10:00'::time ELSE '16:00'::time END
        -- Bar: always evening
        WHEN i BETWEEN 11 AND 14 OR i IN (29, 30) THEN '16:00'::time
        -- Catering: day shift
        WHEN i BETWEEN 15 AND 17 OR i = 31 THEN '08:00'::time
        -- Cleaning: even morning, odd evening
        WHEN i BETWEEN 18 AND 20 OR i = 32 THEN
          CASE WHEN i % 2 = 0 THEN '06:00'::time ELSE '22:00'::time END
        -- Delivery: alternate lunch/dinner by day
        WHEN i IN (21, 22, 33) THEN
          CASE WHEN dow % 2 = 0 THEN '10:00'::time ELSE '17:00'::time END
        -- Event: evening
        WHEN i IN (23, 24, 34) THEN '17:00'::time
        -- Minors: afternoon
        WHEN i BETWEEN 35 AND 39 THEN
          CASE WHEN i % 2 = 0 THEN '15:00'::time ELSE '16:00'::time END
        -- Pensioners: late morning
        WHEN i BETWEEN 40 AND 43 THEN
          CASE WHEN i % 2 = 0 THEN '10:00'::time ELSE '11:00'::time END
        -- Freelancers: dinner/event or lunch
        WHEN i BETWEEN 44 AND 49 THEN
          CASE WHEN dow IN (5, 6) THEN '17:00'::time ELSE '11:00'::time END
      END AS start_time,
      -- Shift end time
      CASE
        -- Kitchen
        WHEN i BETWEEN 0 AND 5 OR i IN (25, 26) THEN
          CASE WHEN ((i % 2) + (week_num % 2)) % 2 = 0
               THEN '15:00'::time ELSE '22:00'::time END
        -- Restaurant
        WHEN i BETWEEN 6 AND 10 OR i IN (27, 28) THEN
          CASE WHEN ((i % 2) + (week_num % 2)) % 2 = 0
               THEN '16:00'::time ELSE '23:00'::time END
        -- Bar
        WHEN i BETWEEN 11 AND 14 OR i IN (29, 30) THEN '01:00'::time
        -- Catering
        WHEN i BETWEEN 15 AND 17 OR i = 31 THEN '16:00'::time
        -- Cleaning
        WHEN i BETWEEN 18 AND 20 OR i = 32 THEN
          CASE WHEN i % 2 = 0 THEN '12:00'::time ELSE '02:00'::time END
        -- Delivery
        WHEN i IN (21, 22, 33) THEN
          CASE WHEN dow % 2 = 0 THEN '14:00'::time ELSE '21:00'::time END
        -- Event
        WHEN i IN (23, 24, 34) THEN '01:00'::time
        -- Minors
        WHEN i BETWEEN 35 AND 39 THEN
          CASE WHEN i % 2 = 0 THEN '21:00'::time ELSE '22:00'::time END
        -- Pensioners
        WHEN i BETWEEN 40 AND 43 THEN
          CASE WHEN i % 2 = 0 THEN '15:00'::time ELSE '16:00'::time END
        -- Freelancers
        WHEN i BETWEEN 44 AND 49 THEN
          CASE WHEN dow IN (5, 6) THEN '01:00'::time ELSE '16:00'::time END
      END AS end_time,
      -- Work hours (pre-calculated)
      CASE
        -- Kitchen: 8h - 0.5h break = 7.5
        WHEN i BETWEEN 0 AND 5 OR i IN (25, 26) THEN 7.50
        -- Restaurant: lunch 6h-0.5=5.5, dinner 7h-0.5=6.5
        WHEN i BETWEEN 6 AND 10 OR i IN (27, 28) THEN
          CASE WHEN ((i % 2) + (week_num % 2)) % 2 = 0
               THEN 5.50 ELSE 6.50 END
        -- Bar: 9h - 0.5 = 8.5
        WHEN i BETWEEN 11 AND 14 OR i IN (29, 30) THEN 8.50
        -- Catering: 8h - 0.5 = 7.5
        WHEN i BETWEEN 15 AND 17 OR i = 31 THEN 7.50
        -- Cleaning: 6h or 4h, no break for short
        WHEN i BETWEEN 18 AND 20 OR i = 32 THEN 6.00
        -- Delivery: 4h, no break
        WHEN i IN (21, 22, 33) THEN 4.00
        -- Event: 8h - 0.5 = 7.5
        WHEN i IN (23, 24, 34) THEN 7.50
        -- Minors: 6h, no break
        WHEN i BETWEEN 35 AND 39 THEN 6.00
        -- Pensioners: 5h, no break
        WHEN i BETWEEN 40 AND 43 THEN 5.00
        -- Freelancers: Fri/Sat 8h-0.5=7.5, weekday 5h
        WHEN i BETWEEN 44 AND 49 THEN
          CASE WHEN dow IN (5, 6) THEN 7.50 ELSE 5.00 END
      END AS work_hours,
      -- Breaks (minutes)
      CASE
        WHEN i BETWEEN 0 AND 5 OR i IN (25, 26) THEN 30   -- Kitchen
        WHEN i BETWEEN 6 AND 10 OR i IN (27, 28) THEN 30  -- Restaurant
        WHEN i BETWEEN 11 AND 14 OR i IN (29, 30) THEN 30 -- Bar
        WHEN i BETWEEN 15 AND 17 OR i = 31 THEN 30        -- Catering
        WHEN i BETWEEN 18 AND 20 OR i = 32 THEN 0         -- Cleaning
        WHEN i IN (21, 22, 33) THEN 0                     -- Delivery
        WHEN i IN (23, 24, 34) THEN 30                    -- Event
        WHEN i BETWEEN 35 AND 39 THEN 0                   -- Minors
        WHEN i BETWEEN 40 AND 43 THEN 0                   -- Pensioners
        WHEN i BETWEEN 44 AND 49 THEN                     -- Freelancers
          CASE WHEN dow IN (5, 6) THEN 30 ELSE 0 END
      END AS breaks,
      -- Indicator color by department
      CASE
        WHEN i BETWEEN 0 AND 5 OR i IN (25, 26) THEN 'orange'   -- Kitchen
        WHEN i BETWEEN 6 AND 10 OR i IN (27, 28) THEN 'blue'    -- Restaurant
        WHEN i BETWEEN 11 AND 14 OR i IN (29, 30) THEN 'purple' -- Bar
        WHEN i BETWEEN 15 AND 17 OR i = 31 THEN 'emerald'       -- Catering
        WHEN i BETWEEN 18 AND 20 OR i = 32 THEN 'blue'          -- Cleaning
        WHEN i IN (21, 22, 33) THEN 'blue'                      -- Delivery
        WHEN i IN (23, 24, 34) THEN 'purple'                    -- Event
        WHEN i BETWEEN 35 AND 39 THEN 'blue'                    -- Minors
        WHEN i BETWEEN 40 AND 43 THEN 'blue'                    -- Pensioners
        WHEN i BETWEEN 44 AND 49 THEN 'purple'                  -- Freelancers
        ELSE 'blue'
      END AS indicator
    FROM
      generate_series(0, 49) AS g(i),
      LATERAL (SELECT
        extract(isodow FROM d.shift_date)::integer AS dow,          -- 1=Mon .. 7=Sun
        (extract(day FROM d.shift_date - CURRENT_DATE)::integer / 7) AS week_num,
        extract(month FROM d.shift_date) IN (6, 7, 8) AS is_summer
      ) AS ctx
    WHERE
      -- ── Scheduling rules: who works on which days ────────────

      -- Full-time adults (0..24) and foreign workers (25..34): 5 days/week
      -- Days off: (i % 7) and ((i + 3) % 7)
      CASE WHEN i BETWEEN 0 AND 34 THEN
        dow <> ((i % 7) + 1)           -- first day off (map 0-6 to 1-7)
        AND dow <> (((i + 3) % 7) + 1) -- second day off
        -- Catering: weekdays only (no weekends unless needed)
        AND (CASE WHEN i BETWEEN 15 AND 17 OR i = 31
                  THEN dow NOT IN (6, 7) ELSE true END)
        -- Event staff: mainly Fri-Sat, occasional Wed-Thu
        AND (CASE WHEN i IN (23, 24, 34)
                  THEN dow IN (3, 4, 5, 6) ELSE true END)

      -- Minors (35..39): 2 days/week (weekends), 4 in summer
      WHEN i BETWEEN 35 AND 39 THEN
        CASE WHEN is_summer THEN
          -- Summer: work up to 4 days — specific days based on index
          dow IN (
            ((i % 5) + 1),
            (((i + 1) % 5) + 1),
            6,  -- Saturday
            7   -- Sunday
          )
        ELSE
          -- School year: weekends only, with staggered coverage
          (dow = 6 AND i % 2 = 0)   -- even-index minors: Saturday
          OR (dow = 7 AND i % 2 = 1) -- odd-index: Sunday
          OR (dow = 6 AND i % 3 = 0) -- some work both days
          OR (dow = 7 AND i % 3 = 0)
        END

      -- Pensioners (40..43): 2-3 days/week, mainly weekdays
      WHEN i BETWEEN 40 AND 43 THEN
        dow IN (
          ((i % 5) + 1),       -- first weekday
          (((i + 2) % 5) + 1), -- second weekday
          (((i + 4) % 5) + 1)  -- third weekday (gives 2-3 days depending on overlap)
        )
        AND dow NOT IN (6, 7)  -- no weekends (occasional override below)
        -- One pensioner works Saturday
        OR (i = 40 AND dow = 6)

      -- Freelancers (44..49): mainly Fri+Sat, occasional Wed/Thu
      WHEN i BETWEEN 44 AND 49 THEN
        CASE
          -- All freelancers work Friday and Saturday
          WHEN dow IN (5, 6) THEN
            -- Stagger: not all freelancers every Fri/Sat
            (i + extract(week FROM d.shift_date)::integer) % 3 <> 0
          -- Some also work Wed or Thu
          WHEN dow IN (3, 4) THEN
            (i + extract(week FROM d.shift_date)::integer) % 4 = 0
          ELSE false
        END

      ELSE false
      END
  ) AS emp
  WHERE emp.profile_id IS NOT NULL;

  -- Log the result
  RAISE NOTICE 'template_restaurant_schedule: inserted shifts for workspace %', p_workspace_id;
END;
$$;

COMMENT ON FUNCTION template_restaurant_schedule(uuid) IS
  'Generates 3 months of realistic restaurant schedule_shift data for 50 employees.';
