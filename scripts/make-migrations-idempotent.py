#!/usr/bin/env python3
"""Make SQL migrations idempotent by adding IF NOT EXISTS, OR REPLACE, etc."""

import re
import sys
import os
import glob

def make_idempotent(sql: str) -> str:
    """Transform SQL to be idempotent."""

    # 1. CREATE TABLE → CREATE TABLE IF NOT EXISTS
    sql = re.sub(
        r'CREATE TABLE (?!IF NOT EXISTS)(public\.)?(\w+)',
        r'CREATE TABLE IF NOT EXISTS \1\2',
        sql
    )

    # 2. CREATE INDEX → CREATE INDEX IF NOT EXISTS
    sql = re.sub(
        r'CREATE INDEX (?!IF NOT EXISTS|CONCURRENTLY)',
        r'CREATE INDEX IF NOT EXISTS ',
        sql
    )
    sql = re.sub(
        r'CREATE UNIQUE INDEX (?!IF NOT EXISTS|CONCURRENTLY)',
        r'CREATE UNIQUE INDEX IF NOT EXISTS ',
        sql
    )

    # 3. CREATE EXTENSION → CREATE EXTENSION IF NOT EXISTS
    sql = re.sub(
        r'CREATE EXTENSION (?!IF NOT EXISTS)',
        r'CREATE EXTENSION IF NOT EXISTS ',
        sql
    )

    # 4. CREATE TYPE → DO $$ block with IF NOT EXISTS check
    # Match: CREATE TYPE name AS ENUM (...)
    def wrap_create_type(match):
        full = match.group(0)
        schema_prefix = match.group(1) or ''
        type_name = match.group(2)
        schema = 'public'
        if schema_prefix:
            schema = schema_prefix.rstrip('.')
        return f"""DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{type_name}') THEN
    {full}
  END IF;
END $$;"""

    # Only wrap if not already in a DO $$ block
    sql = re.sub(
        r'(?<!THEN\n\s{4})CREATE TYPE ((?:public\.)?)(\w+) AS ENUM\s*\([^)]+\)',
        wrap_create_type,
        sql,
        flags=re.DOTALL
    )

    # 5. CREATE POLICY → DROP POLICY IF EXISTS first
    def add_drop_policy(match):
        full = match.group(0)
        policy_name = match.group(1)
        # Find the ON clause
        on_match = re.search(r'ON\s+((?:public\.)?\w+)', full)
        if on_match:
            table = on_match.group(1)
            return f'DROP POLICY IF EXISTS "{policy_name}" ON {table};\n{full}'
        return full

    sql = re.sub(
        r'CREATE POLICY "([^"]+)"[^;]+;',
        add_drop_policy,
        sql
    )

    # 6. CREATE TRIGGER → DROP TRIGGER IF EXISTS first
    def add_drop_trigger(match):
        full = match.group(0)
        trigger_name = match.group(1)
        on_match = re.search(r'ON\s+((?:public\.)?\w+)', full)
        if on_match:
            table = on_match.group(1)
            return f'DROP TRIGGER IF EXISTS {trigger_name} ON {table};\n{full}'
        return full

    sql = re.sub(
        r'CREATE TRIGGER (\w+)\s+[^;]+;',
        add_drop_trigger,
        sql
    )

    # 7. CREATE FUNCTION → CREATE OR REPLACE FUNCTION
    sql = re.sub(
        r'CREATE FUNCTION ',
        r'CREATE OR REPLACE FUNCTION ',
        sql
    )

    # 8. ALTER TABLE ... ADD COLUMN → DO $$ with IF NOT EXISTS
    def wrap_add_column(match):
        full = match.group(0).rstrip(';')
        table = match.group(1)
        column = match.group(2)
        schema = 'public'
        table_name = table
        if '.' in table:
            schema, table_name = table.split('.', 1)
        return f"""DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '{schema}' AND table_name = '{table_name}' AND column_name = '{column}') THEN
    {full};
  END IF;
END $$;"""

    sql = re.sub(
        r'ALTER TABLE ((?:public\.)?\w+)\s+ADD COLUMN (?!IF NOT EXISTS)(\w+)[^;]+;',
        wrap_add_column,
        sql
    )

    # Also handle ADD COLUMN IF NOT EXISTS natively (PG 9.6+)
    # Actually, let's use the native syntax instead:
    sql = re.sub(
        r'ALTER TABLE ((?:public\.)?\w+)\s+ADD COLUMN (?!IF NOT EXISTS)',
        lambda m: f'ALTER TABLE {m.group(1)} ADD COLUMN IF NOT EXISTS ',
        sql
    )

    # 9. INSERT INTO storage.buckets → ON CONFLICT DO NOTHING
    sql = re.sub(
        r'(INSERT INTO storage\.buckets\s*\([^)]+\)\s*VALUES\s*\([^)]+\))(?!\s*ON CONFLICT)',
        r'\1 ON CONFLICT DO NOTHING',
        sql
    )

    # 10. ALTER TYPE ... ADD VALUE → IF NOT EXISTS
    sql = re.sub(
        r"ALTER TYPE (\w+) ADD VALUE (?!IF NOT EXISTS)'",
        r"ALTER TYPE \1 ADD VALUE IF NOT EXISTS '",
        sql
    )

    return sql


def process_file(filepath: str, dry_run: bool = False) -> bool:
    """Process a single migration file. Returns True if changes were made."""
    with open(filepath, 'r') as f:
        original = f.read()

    modified = make_idempotent(original)

    if modified != original:
        if dry_run:
            print(f"  WOULD MODIFY: {os.path.basename(filepath)}")
        else:
            with open(filepath, 'w') as f:
                f.write(modified)
            print(f"  MODIFIED: {os.path.basename(filepath)}")
        return True
    else:
        print(f"  unchanged: {os.path.basename(filepath)}")
        return False


def main():
    dry_run = '--dry-run' in sys.argv

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'supabase', 'migrations')

    # Only process pending migrations (20260228 onwards)
    patterns = [
        '2026022[89]*.sql',
        '2026030*.sql',
        '2026031*.sql',
        '2026032*.sql',
    ]

    files = []
    for pattern in patterns:
        files.extend(sorted(glob.glob(os.path.join(migrations_dir, pattern))))

    # Skip the first 4 that are already applied on remote
    already_applied = {
        '20260225232118', '20260227120000', '20260227193936', '20260227210000'
    }
    files = [f for f in files if not any(ts in os.path.basename(f) for ts in already_applied)]

    print(f"Processing {len(files)} migration files...")
    if dry_run:
        print("(DRY RUN - no files will be modified)\n")

    modified_count = 0
    for filepath in files:
        if process_file(filepath, dry_run):
            modified_count += 1

    print(f"\n{'Would modify' if dry_run else 'Modified'}: {modified_count}/{len(files)} files")


if __name__ == '__main__':
    main()
