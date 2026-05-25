---
title: WSL2 Swap Configuration
status: in_progress
updated: 2026-05-24
created: 2026-05-24
module: ops
tags: [wsl2, swap, memory, ops, playwright]
---

# WSL2 Swap Configuration

## Why This Matters

WSL2 allocates RAM dynamically but defaults to **swap=0B** -- no swap at all.

Smartout's local dev stack under full test load:

| Process | Peak RAM |
|---|---|
| Next.js 16 tsc/build (web) | ~5 GB |
| Playwright + 1 chromium tab | ~1.5 GB |
| Playwright + 2 chromium tabs | ~3 GB |
| n8n / Expo Metro (if running) | ~1 GB |
| Claude Code session | ~2 GB |

Total under a typical Playwright sweep with 2 concurrent workers: **~11-12 GB**.
WSL2 host has 15 Gi total. Without swap, OOM killer fires at ~14 Gi, killing
the largest process -- usually the Next.js dev server.

4 OOM kills were documented in the 2026-05-23 journey sweep, each cascading
`ERR_NETWORK_CHANGED` across 5-15 downstream Playwright tests (OPS-1, ADR-0408).

## Solution: Add 8-16 GB Swap

These steps run on the **Windows host** side (outside WSL). You need Administrator
access to Windows. You do NOT need to modify the WSL2 Linux instance.

### Step 1: Edit `.wslconfig` on Windows

Open `C:\Users\<username>\.wslconfig` (create if missing) and add:

```ini
[wsl2]
# Swap file: 16 GB recommended for Next.js 16 + Playwright concurrent load.
# Minimum viable: 8 GB (allows 1 worker without OOM; 2 workers marginal).
swap=16GB

# Optional: cap WSL2 RAM to leave headroom for Windows processes.
# Comment out if you want WSL2 to use all 15 GB.
# memory=12GB

# Optional: cap processors (default = all cores).
# processors=6
```

**File location:** `C:\Users\sxtnl\.wslconfig`

### Step 2: Shutdown and restart WSL2

From a Windows PowerShell (Administrator):

```powershell
wsl --shutdown
wsl
```

Or from WSL itself:

```bash
# This triggers a full WSL2 shutdown and restart
wsl.exe --shutdown
```

### Step 3: Verify swap is active

Inside WSL2:

```bash
free -h
# Expected output -- should now show swap:
#                total        used        free      shared  buff/cache   available
# Mem:            15Gi        ...         ...        ...        ...         ...
# Swap:           15Gi        0B          15Gi
```

### Step 4: Increase Playwright workers (optional)

With 16 GB swap, it is safe to increase concurrent workers:

```bash
# 2 workers -- safe with 16 GB swap
E2E_WORKERS=2 pnpm test:e2e

# Or set permanently for this project in apps/e2e/.env.local:
echo "E2E_WORKERS=2" >> apps/e2e/.env.local
```

With 8 GB swap, keep `E2E_WORKERS=1` (swap is safety net, not performance boost).

## Alternative: Per-session swap (no Windows config)

If you cannot edit `.wslconfig` (shared machine, no admin), you can create a
swap file inside the WSL2 instance temporarily:

```bash
# Create 8 GB swap file inside WSL2 (survives until next WSL2 restart)
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Verify
free -h
```

This swap resets on `wsl --shutdown`. To persist inside WSL, add to `/etc/fstab`:

```
/swapfile none swap sw 0 0
```

**Note:** This approach works but `.wslconfig` swap is simpler and persists across
WSL2 restarts automatically.

## Verification After Setup

Run the `ci:local` memory pre-flight manually:

```bash
# Should print "Memory OK" instead of failing
free -h
# Then run ci:local -- gate passes automatically when swap is available
pnpm ci:local
```

## References

- ADR-0408: OPS-1 WSL2 OOM mitigation -- 4-layer strategy
- `apps/e2e/README.md` -- E2E test suite memory constraints
- `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` -- OPS-1 evidence
- MEMORY.md: `learning_wsl2_oom_3rd_occurrence_2026_05_23.md`
- Microsoft docs: https://learn.microsoft.com/en-us/windows/wsl/wsl-config#wslconfig
