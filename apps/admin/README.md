# Smartout Admin

Accountant portal for Smartout. Allows Erik (and other designated accountants) to
download grunnfakturaer (orders/invoices) across granted customer companies.

Deployed at: `admin.smartout.ai`  
Dev port: **3070**

## Development

```bash
pnpm --filter admin dev
```

Requires `.env.local` at the monorepo root with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use `op run` per the project's env protocol.
