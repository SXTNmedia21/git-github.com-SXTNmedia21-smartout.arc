#!/usr/bin/env bash
# gen-rich-dashboard.sh — bake all live telemetry-map data into RICH-DASHBOARD.html
#
# Produces a single self-contained HTML file with NO fetch() calls.
# Open RICH-DASHBOARD.html directly via file:// — no server needed.
# Run this after every telemetry-map agent run to refresh the snapshot.
#
# Usage:
#   bash gen-rich-dashboard.sh
#
# Output: RICH-DASHBOARD.html (same directory)
# Requires: python3 (stdlib only — json, os, sys, glob, datetime)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$SCRIPT_DIR/RICH-DASHBOARD.html"

echo "  gen-rich-dashboard — baking snapshot..."

python3 - "$SCRIPT_DIR" "$OUT" << 'PYEOF'
import json, os, sys, glob, datetime, re

ROOT = sys.argv[1]
OUT  = sys.argv[2]
GEN_TIME = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ── Read feed.jsonl ──────────────────────────────────────────────────────────
def read_jsonlines(path):
    if not os.path.exists(path):
        return []
    lines = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    lines.append(json.loads(line))
                except Exception:
                    pass
    return lines

feed_data = read_jsonlines(os.path.join(ROOT, "activity", "feed.jsonl"))
hb_data   = read_jsonlines(os.path.join(ROOT, "activity", "heartbeat.jsonl"))

# ── Read all control.json files (auto-discover) ──────────────────────────────
gates = []
for ctrl_path in sorted(glob.glob(os.path.join(ROOT, "*/control.json"))):
    with open(ctrl_path) as f:
        try:
            data = json.load(f)
            # Some are arrays (aggregate), some are plain objects
            if isinstance(data, list):
                gates.extend(data)
            else:
                gates.append(data)
        except Exception:
            pass

# ── Read all TELEMETRY-MAP.md files (auto-discover) ──────────────────────────
raw_maps = {}
for md_path in sorted(glob.glob(os.path.join(ROOT, "*/TELEMETRY-MAP.md"))):
    domain = os.path.basename(os.path.dirname(md_path))
    with open(md_path) as f:
        raw_maps[domain] = f.read()

# ── Webhook functions (hardcoded from supabase/functions discovery) ───────────
# These were verified via: ls supabase/functions/ | grep -i webhook
webhook_fns = ["stripe-webhook", "sendgrid-webhook", "livekit-webhook"]

# ── Spec files (bake inline — these are small) ───────────────────────────────
def read_text_safe(path):
    if os.path.exists(path):
        with open(path) as f:
            return f.read()
    return ""

spec_drive   = read_text_safe(os.path.join(ROOT, "DRIVE-TO-100.md"))
spec_process = read_text_safe(os.path.join(ROOT, "PROCESS-SPEC.md"))

# ── Serialise to JS ──────────────────────────────────────────────────────────
FEED_JS      = json.dumps(feed_data,   ensure_ascii=False, separators=(',', ':'))
HB_JS        = json.dumps(hb_data,     ensure_ascii=False, separators=(',', ':'))
GATES_JS     = json.dumps(gates,       ensure_ascii=False, separators=(',', ':'))
RAW_MAPS_JS  = json.dumps(raw_maps,    ensure_ascii=False, separators=(',', ':'))
WEBHOOKS_JS  = json.dumps(webhook_fns, ensure_ascii=False, separators=(',', ':'))
SPEC_D_JS    = json.dumps(spec_drive,  ensure_ascii=False)
SPEC_P_JS    = json.dumps(spec_process,ensure_ascii=False)

print(f"  feed: {len(feed_data)} events | hb: {len(hb_data)} beats | gates: {len(gates)} domains | maps: {len(raw_maps)} domains")

# ── Build the HTML ────────────────────────────────────────────────────────────
html = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SmartOut — Agent Dashboard (snapshot {GEN_TIME})</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;900&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
/* ── Design tokens (Nordic Split) ── */
:root {{
  --orange: #e8631a;
  --orange-light: #f97316;
  --orange-soft: rgba(232,99,26,0.08);
  --success: #22c55e;
  --success-soft: rgba(34,197,94,0.10);
  --fail: #ef4444;
  --fail-soft: rgba(239,68,68,0.10);
  --warn: #f59e0b;
  --warn-soft: rgba(245,158,11,0.10);
  --info: #3b82f6;
  --info-soft: rgba(59,130,246,0.10);
  --bg: #0d0c0a;
  --surface: #141210;
  --card: #1a1814;
  --card2: #201e1b;
  --border: rgba(255,255,255,0.07);
  --border-md: rgba(255,255,255,0.11);
  --fg: #f0eeeb;
  --muted: #7a756e;
  --muted-soft: #504b45;
  --font-heading: 'Instrument Serif', Georgia, serif;
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px; --r-full: 9999px;
  --sh-sm: 0 1px 3px rgba(0,0,0,0.4);
  --sh-card: 0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3);
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html {{ height: 100%; }}
body {{
  font-family: var(--font-sans);
  background: var(--bg); color: var(--fg);
  font-size: 13px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01","cv11";
  min-height: 100vh;
}}
/* Shell */
.shell {{ display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }}
/* Sidebar */
.sidebar {{
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  padding: 20px 10px 16px;
}}
.brand {{ padding: 0 8px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 3px; }}
.brand-name {{ font-family: var(--font-heading); font-size: 22px; font-weight: 400; letter-spacing: -0.02em; line-height: 1; }}
.brand-sub {{ font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }}
.nav-section {{ font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-soft); padding: 14px 10px 5px; }}
.nav-btn {{
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: var(--r-md);
  cursor: pointer; width: 100%; background: none; border: none;
  color: var(--muted); font-family: var(--font-sans); font-size: 12.5px; font-weight: 500;
  text-align: left; transition: background 0.12s, color 0.12s; white-space: nowrap;
}}
.nav-btn:hover {{ background: rgba(255,255,255,0.04); color: var(--fg); }}
.nav-btn.active {{ background: var(--card); color: var(--fg); box-shadow: var(--sh-sm); }}
.nav-btn.active .nav-ico {{ color: var(--orange); }}
.nav-ico {{ width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }}
.nav-btn.active .nav-ico {{ opacity: 1; }}
.nav-label {{ flex: 1; }}
.nav-count {{ font-family: var(--font-mono); font-size: 10px; color: var(--muted-soft); }}
.nav-count.alert {{ color: var(--fail); font-weight: 700; }}
.sidebar-foot {{ margin-top: auto; border-top: 1px solid var(--border); padding-top: 10px; }}
.snapshot-tag {{
  display: flex; flex-direction: column; gap: 3px;
  padding: 8px 10px; font-size: 10px; color: var(--muted-soft);
  font-family: var(--font-mono);
}}
.snapshot-tag .snap-label {{ font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-size: 9px; }}
.snapshot-regen {{
  margin-top: 4px; font-size: 9.5px; color: var(--muted-soft);
  padding: 5px 10px; line-height: 1.4;
  border-top: 1px solid var(--border);
}}
/* Main */
.main {{ display: flex; flex-direction: column; min-height: 100vh; overflow-x: hidden; }}
.topbar {{
  padding: 14px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); position: sticky; top: 0; z-index: 10;
}}
.topbar-title {{ font-size: 14px; font-weight: 700; flex: 1; }}
.btn {{
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: var(--r-md);
  border: 1px solid var(--border-md); background: var(--card); color: var(--fg);
  font-family: var(--font-sans); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.12s, box-shadow 0.12s;
  text-decoration: none; white-space: nowrap;
}}
.btn:hover {{ background: var(--card2); box-shadow: var(--sh-sm); }}
.btn-orange {{
  background: linear-gradient(135deg, #e8631a 0%, #c2410c 100%);
  border-color: transparent; color: #fff;
  box-shadow: 0 2px 8px rgba(232,99,26,0.3);
}}
.btn-orange:hover {{ background: linear-gradient(135deg, #f97316 0%, #e8631a 100%); box-shadow: 0 4px 14px rgba(232,99,26,0.4); }}
/* Content */
.content {{ padding: 20px 24px 40px; flex: 1; }}
.page {{ display: none; }}
.page.active {{ display: block; }}
/* Headline KPI row */
.headline {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }}
.hl-card {{
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 16px 18px;
  position: relative; overflow: hidden; box-shadow: var(--sh-card);
}}
.hl-label {{ font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }}
.hl-value {{ font-family: var(--font-mono); font-size: 28px; font-weight: 700; line-height: 1; color: var(--fg); }}
.hl-value .unit {{ font-size: 14px; font-weight: 500; color: var(--muted); margin-left: 2px; }}
.hl-sub {{ font-size: 11px; color: var(--muted); margin-top: 6px; }}
.hl-card.orange .hl-value {{ color: var(--orange-light); }}
.hl-card.green .hl-value {{ color: var(--success); }}
.hl-card.red .hl-value {{ color: var(--fail); }}
/* Progress bar */
.progress-wrap {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px 20px; margin-bottom: 20px; box-shadow: var(--sh-sm); }}
.progress-header {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }}
.progress-label {{ font-size: 12px; font-weight: 600; }}
.progress-pct {{ font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--orange-light); }}
.progress-track {{ height: 8px; border-radius: var(--r-full); background: rgba(255,255,255,0.06); overflow: hidden; }}
.progress-fill {{ height: 100%; border-radius: var(--r-full); background: linear-gradient(90deg, var(--orange) 0%, var(--orange-light) 100%); box-shadow: 0 0 10px rgba(232,99,26,0.4); }}
/* Section header */
.section-header {{ display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }}
.section-title {{ font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }}
.section-count {{ font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: var(--muted); margin-left: auto; }}
/* Channels */
.channels-row {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }}
.channel-tile {{
  background: var(--card); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 16px 18px 14px; position: relative; overflow: hidden; box-shadow: var(--sh-card);
}}
.ch-orb {{ position: absolute; border-radius: 50%; filter: blur(36px); pointer-events: none; }}
.channel-tile.ch-beating {{ border-color: rgba(34,197,94,0.3); }}
.channel-tile.ch-stalled {{ border-color: rgba(239,68,68,0.4); }}
.channel-tile.ch-idle {{ border-color: var(--border); }}
.ch-head {{ display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }}
.ch-icon {{ width: 32px; height: 32px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 15px; }}
.ch-icon.heartbeat {{ background: rgba(34,197,94,0.12); }}
.ch-icon.telemetry {{ background: rgba(59,130,246,0.12); }}
.ch-icon.webhook {{ background: rgba(255,255,255,0.05); }}
.ch-name {{ font-size: 13px; font-weight: 700; }}
.ch-state-pill {{
  margin-left: auto; font-size: 9.5px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; padding: 2px 8px; border-radius: var(--r-full); border: 1px solid;
}}
.pill-beating {{ background: var(--success-soft); color: var(--success); border-color: rgba(34,197,94,0.3); }}
.pill-stalled {{ background: var(--fail-soft); color: var(--fail); border-color: rgba(239,68,68,0.4);
  animation: stall-flash 1.5s ease-in-out infinite; }}
.pill-idle {{ background: rgba(255,255,255,0.04); color: var(--muted); border-color: var(--border); }}
.pill-active {{ background: var(--info-soft); color: var(--info); border-color: rgba(59,130,246,0.25); }}
@keyframes stall-flash {{
  0%, 100% {{ border-color: rgba(239,68,68,0.4); background: var(--fail-soft); }}
  50% {{ border-color: rgba(239,68,68,0.65); background: rgba(239,68,68,0.14); }}
}}
.ch-stat-row {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }}
.ch-stat {{ display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: var(--r-md); padding: 6px 10px; min-width: 50px; }}
.ch-stat-val {{ font-family: var(--font-mono); font-size: 18px; font-weight: 700; line-height: 1; }}
.sv-green {{ color: var(--success); }} .sv-red {{ color: var(--fail); }}
.sv-warn {{ color: var(--warn); }} .sv-blue {{ color: var(--info); }} .sv-muted {{ color: var(--muted); }}
.ch-stat-lbl {{ font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-soft); margin-top: 3px; }}
.ch-detail {{ font-size: 11px; color: var(--muted); line-height: 1.4; }}
.ch-detail .ch-ts {{ font-family: var(--font-mono); color: var(--muted-soft); font-size: 10px; }}
.stall-alert-box {{
  display: flex; align-items: flex-start; gap: 7px;
  padding: 7px 10px; border-radius: var(--r-md);
  background: var(--fail-soft); border: 1px solid rgba(239,68,68,0.4);
  margin-top: 6px; font-size: 11.5px; color: var(--fail); line-height: 1.4;
  animation: stall-flash 1.5s ease-in-out infinite;
}}
.webhook-fn-list {{ display: flex; flex-direction: column; gap: 4px; }}
.webhook-fn {{ display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10.5px; color: var(--muted); padding: 3px 0; border-bottom: 1px solid var(--border); }}
.webhook-fn:last-child {{ border-bottom: none; }}
.webhook-fn-dot {{ width: 5px; height: 5px; border-radius: 50%; background: var(--muted-soft); flex-shrink: 0; }}
.live-env-tag {{ margin-left: auto; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 5px; border-radius: var(--r-sm); background: rgba(255,255,255,0.04); color: var(--muted-soft); border: 1px solid var(--border); }}
/* Agent cards */
.agents-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; margin-bottom: 24px; }}
.agent-card {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 14px 16px; box-shadow: var(--sh-card); position: relative; overflow: hidden; }}
.agent-card.live {{ border-color: rgba(34,197,94,0.25); }}
.agent-card.stalled {{ border-color: rgba(239,68,68,0.4); }}
.orb-bg {{ position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; border-radius: 50%; opacity: 0.6; pointer-events: none; filter: blur(28px); }}
.agent-head {{ display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }}
.status-dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }}
.sd-live {{ background: var(--success); }}
.sd-off {{ background: var(--muted-soft); }}
.sd-stalled {{ background: var(--fail); animation: stall-pulse 1s ease-in-out infinite; }}
@keyframes stall-pulse {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:0.4; }} }}
.agent-name {{ font-size: 13px; font-weight: 700; flex: 1; min-width: 0; }}
.domain-badge {{ font-family: var(--font-mono); font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: var(--r-full); background: var(--orange-soft); color: var(--orange-light); border: 1px solid rgba(232,99,26,0.2); }}
.liveness-badge {{ font-size: 9.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 2px 8px; border-radius: var(--r-full); border: 1px solid; flex-shrink: 0; }}
.lb-live    {{ background: var(--success-soft); color: var(--success); border-color: rgba(34,197,94,0.3); }}
.lb-working {{ background: var(--warn-soft);    color: var(--warn);    border-color: rgba(245,158,11,0.3); }}
.lb-stalled {{ background: var(--fail-soft);    color: var(--fail);    border-color: rgba(239,68,68,0.4); animation: stall-flash 1.2s ease-in-out infinite; }}
.lb-done    {{ background: rgba(255,255,255,0.04); color: var(--muted); border-color: var(--border); }}
.agent-times {{ display: flex; gap: 12px; font-family: var(--font-mono); font-size: 10.5px; color: var(--muted); margin-bottom: 8px; }}
.agent-times span {{ display: flex; gap: 4px; align-items: center; }}
.key {{ color: var(--muted-soft); }}
.stream {{ display: flex; flex-direction: column; }}
.stream-item {{ display: flex; gap: 7px; align-items: flex-start; font-size: 11.5px; padding: 4px 0; border-bottom: 1px solid var(--border); }}
.stream-item:last-child {{ border-bottom: none; }}
.stream-ts {{ font-family: var(--font-mono); font-size: 10px; color: var(--muted-soft); flex-shrink: 0; padding-top: 1px; min-width: 44px; }}
.evt-chip {{ font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 6px; border-radius: var(--r-sm); display: inline-block; flex-shrink: 0; }}
.ec-logon    {{ background: var(--info-soft); color: var(--info); border: 1px solid rgba(59,130,246,0.2); }}
.ec-logoff   {{ background: rgba(255,255,255,0.04); color: var(--muted); border: 1px solid var(--border); }}
.ec-working  {{ background: var(--warn-soft); color: var(--warn); border: 1px solid rgba(245,158,11,0.2); }}
.ec-delivered{{ background: var(--success-soft); color: var(--success); border: 1px solid rgba(34,197,94,0.2); }}
.ec-gate-p   {{ background: var(--success-soft); color: var(--success); border: 1px solid rgba(34,197,94,0.3); }}
.ec-gate-f   {{ background: var(--fail-soft); color: var(--fail); border: 1px solid rgba(239,68,68,0.3); }}
.stream-detail {{ flex: 1; color: var(--fg); line-height: 1.4; word-break: break-word; }}
.artifact {{ display: block; font-family: var(--font-mono); font-size: 10px; color: var(--orange-light); margin-top: 2px; opacity: 0.8; }}
/* Gate grid */
.gate-grid {{ display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }}
.gate-row {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--sh-sm); }}
.gate-row.pass {{ border-color: rgba(34,197,94,0.2); }}
.gate-row.fail {{ border-color: rgba(239,68,68,0.15); }}
.gate-header {{ display: grid; grid-template-columns: 140px 1fr repeat(5, 80px) 60px; align-items: stretch; min-height: 44px; }}
.gate-col {{ padding: 10px 12px; display: flex; align-items: center; border-right: 1px solid var(--border); font-size: 12px; }}
.gate-col:last-child {{ border-right: none; }}
.gate-domain {{ font-weight: 700; }}
.gate-counts {{ display: flex; flex-direction: column; gap: 2px; font-size: 10.5px; }}
.c-row {{ display: flex; gap: 6px; color: var(--muted); }}
.c-val  {{ font-family: var(--font-mono); color: var(--fg); }}
.c-bad  {{ font-family: var(--font-mono); color: var(--fail); }}
.c-warn {{ font-family: var(--font-mono); color: var(--warn); }}
.cp-cell {{ justify-content: center; font-size: 14px; }}
.cp-pass {{ color: var(--success); }} .cp-fail {{ color: var(--fail); }}
.gate-verdict {{ justify-content: center; font-weight: 700; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }}
.vp {{ color: var(--success); background: var(--success-soft); }}
.vf {{ color: var(--fail);    background: var(--fail-soft); }}
.vu {{ color: var(--muted);   background: rgba(255,255,255,0.03); }}
.gate-blockers {{ padding: 0 12px 10px; display: flex; flex-direction: column; gap: 4px; }}
.blocker-item {{ display: flex; align-items: flex-start; gap: 7px; font-size: 11px; padding: 4px 0; border-top: 1px solid var(--border); color: var(--muted); line-height: 1.4; }}
.blocker-item:first-child {{ border-top: none; padding-top: 0; }}
.bi-icon {{ color: var(--fail); flex-shrink: 0; padding-top: 1px; font-size: 10px; }}
.gate-labels {{ display: grid; grid-template-columns: 140px 1fr repeat(5, 80px) 60px; padding: 0 0 6px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }}
.gate-lbl {{ padding: 0 12px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-soft); display: flex; align-items: center; }}
.gate-lbl.c {{ justify-content: center; }}
/* Telemetry inventory */
.tele-controls {{ display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }}
.tele-search {{ flex: 1; min-width: 200px; max-width: 320px; background: var(--card); border: 1px solid var(--border-md); border-radius: var(--r-md); padding: 7px 12px; font-family: var(--font-sans); font-size: 12px; color: var(--fg); outline: none; transition: border-color 0.15s; }}
.tele-search:focus {{ border-color: var(--orange-light); }}
.tele-search::placeholder {{ color: var(--muted-soft); }}
.flt-btn {{ padding: 6px 12px; border-radius: var(--r-md); border: 1px solid var(--border-md); background: var(--card); font-family: var(--font-sans); font-size: 11.5px; font-weight: 600; color: var(--muted); cursor: pointer; transition: all 0.12s; }}
.flt-btn:hover {{ color: var(--fg); background: var(--card2); }}
.flt-btn.on {{ background: var(--orange-soft); color: var(--orange-light); border-color: rgba(232,99,26,0.3); }}
.tele-summary {{ display: flex; gap: 14px; margin-left: auto; font-size: 11px; }}
.tele-summary span {{ display: flex; gap: 5px; align-items: center; }}
.ts-dot {{ width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }}
.ts-dot.r {{ background: var(--success); }} .ts-dot.m {{ background: var(--fail); }}
.tele-wrap {{ overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--card); box-shadow: var(--sh-sm); }}
.tele-table {{ width: 100%; border-collapse: collapse; font-size: 11.5px; }}
.tele-table th {{ padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border-md); text-align: left; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-soft); white-space: nowrap; cursor: pointer; user-select: none; }}
.tele-table th:hover {{ color: var(--muted); }}
.tele-table td {{ padding: 7px 12px; border-bottom: 1px solid var(--border); vertical-align: top; line-height: 1.35; max-width: 280px; word-break: break-word; }}
.tele-table tr:last-child td {{ border-bottom: none; }}
.tele-table tr:hover td {{ background: rgba(255,255,255,0.02); }}
.t-event {{ font-family: var(--font-mono); font-size: 11px; }}
.t-domain {{ font-family: var(--font-mono); font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-full); background: var(--orange-soft); color: var(--orange-light); border: 1px solid rgba(232,99,26,0.2); white-space: nowrap; }}
.reg-badge {{ font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 7px; border-radius: var(--r-sm); white-space: nowrap; }}
.rb-yes  {{ background: var(--success-soft); color: var(--success); border: 1px solid rgba(34,197,94,0.25); }}
.rb-miss {{ background: var(--fail-soft);    color: var(--fail);    border: 1px solid rgba(239,68,68,0.3); }}
.rb-noop {{ background: rgba(255,255,255,0.04); color: var(--muted); border: 1px solid var(--border); }}
.t-el {{ color: var(--muted); font-size: 11px; }}
.t-hook {{ font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-soft); }}
.tele-foot {{ padding: 8px 12px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); background: var(--surface); }}
/* Missing events */
.events-list {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 4px; margin-bottom: 24px; }}
.evt-item {{ font-family: var(--font-mono); font-size: 10.5px; padding: 5px 10px; border-radius: var(--r-md); background: var(--card); border: 1px solid var(--border); color: var(--muted); line-height: 1.35; display: flex; align-items: center; gap: 6px; }}
.evt-item::before {{ content: '—'; color: var(--fail); flex-shrink: 0; font-size: 12px; opacity: 0.7; }}
/* Spec */
.spec-wrap {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--r-xl); overflow: hidden; box-shadow: var(--sh-card); }}
.spec-tabs {{ display: flex; border-bottom: 1px solid var(--border); background: var(--surface); padding: 0 16px; }}
.spec-tab {{ padding: 10px 14px; font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; border: none; background: none; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.12s, border-color 0.12s; }}
.spec-tab:hover {{ color: var(--fg); }}
.spec-tab.active {{ color: var(--orange-light); border-bottom-color: var(--orange); }}
.spec-pane {{ display: none; padding: 24px; }}
.spec-pane.active {{ display: block; }}
.spec-pane pre {{ font-family: var(--font-mono); font-size: 11.5px; line-height: 1.65; color: var(--fg); white-space: pre-wrap; word-break: break-word; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 16px; overflow-x: auto; }}
/* Responsive */
@media (max-width: 900px) {{
  .shell {{ grid-template-columns: 1fr; }}
  .sidebar {{ display: none; }}
  .headline {{ grid-template-columns: repeat(2, 1fr); }}
  .channels-row {{ grid-template-columns: 1fr; }}
  .gate-header {{ grid-template-columns: 100px 1fr repeat(5, 60px) 52px; }}
  .gate-labels {{ grid-template-columns: 100px 1fr repeat(5, 60px) 52px; }}
}}
.fade-in {{ animation: fadeIn 0.3s ease-out; }}
@keyframes fadeIn {{ from {{ opacity:0; transform:translateY(6px); }} to {{ opacity:1; transform:none; }} }}
@keyframes spin {{ to {{ transform: rotate(360deg); }} }}
</style>
</head>
<body>
<div class="shell">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-name">SmartOut</div>
      <div class="brand-sub">Agent Observatory</div>
    </div>
    <div class="nav-section">Signals</div>
    <button class="nav-btn" onclick="showPage('channels')" id="nav-channels">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 8c0-3.31 2.69-6 6-6M2 8c0 3.31 2.69 6 6 6M14 8c0-3.31-2.69-6-6-6M14 8c0 3.31-2.69 6-6 6"/>
        <circle cx="8" cy="8" r="1.5"/>
      </svg>
      <span class="nav-label">Channels</span>
      <span class="nav-count" id="nav-channels-count">3</span>
    </button>
    <div class="nav-section">Views</div>
    <button class="nav-btn active" onclick="showPage('live')" id="nav-live">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="6.5" stroke-dasharray="3 2"/>
      </svg>
      <span class="nav-label">Live Feed</span>
      <span class="nav-count" id="nav-live-count">—</span>
    </button>
    <button class="nav-btn" onclick="showPage('gates')" id="nav-gates">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1"/>
        <rect x="9.5" y="1.5" width="5" height="5" rx="1"/>
        <rect x="1.5" y="9.5" width="5" height="5" rx="1"/>
        <rect x="9.5" y="9.5" width="5" height="5" rx="1"/>
      </svg>
      <span class="nav-label">Gate Grid</span>
      <span class="nav-count" id="nav-gates-count">—</span>
    </button>
    <button class="nav-btn" onclick="showPage('tele')" id="nav-tele">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 12l3-4 3 2 3-5 3 3"/><rect x="1" y="1" width="14" height="14" rx="2"/>
      </svg>
      <span class="nav-label">All Events</span>
      <span class="nav-count" id="nav-tele-count">—</span>
    </button>
    <button class="nav-btn" onclick="showPage('missing')" id="nav-missing">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4h12M2 8h9M2 12h6"/>
      </svg>
      <span class="nav-label">Missing Events</span>
      <span class="nav-count" id="nav-missing-count">—</span>
    </button>
    <div class="nav-section">Docs</div>
    <button class="nav-btn" onclick="showPage('spec')">
      <svg class="nav-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 2h8l2 2v10H3V2z"/><path d="M5 6h6M5 9h6M5 12h3"/>
      </svg>
      <span class="nav-label">Spec / Process</span>
    </button>
    <div class="sidebar-foot">
      <div class="snapshot-tag">
        <span class="snap-label">Snapshot</span>
        <span>{GEN_TIME}</span>
      </div>
      <div class="snapshot-regen">
        Refresh: <code>bash gen-rich-dashboard.sh</code>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <main class="main">
    <div class="topbar">
      <div class="topbar-title" id="topbar-title">Signal Channels</div>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted-soft);padding:3px 8px;background:var(--card);border:1px solid var(--border);border-radius:var(--r-md)">
        snapshot {GEN_TIME}
      </span>
      <button class="btn btn-orange" onclick="showPage('spec')">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2h8l2 2v10H3V2z"/></svg>
        SPEC
      </button>
    </div>

    <div class="content">

      <!-- CHANNELS -->
      <div class="page active" id="page-channels">
        <div class="section-header" style="margin-bottom:16px">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2 8c0-3.31 2.69-6 6-6M2 8c0 3.31 2.69 6 6 6M14 8c0-3.31-2.69-6-6-6M14 8c0 3.31-2.69 6-6 6"/>
            <circle cx="8" cy="8" r="1.5"/>
          </svg>
          <span class="section-title">Signal Channels — three inbound streams</span>
          <span class="section-count">per CHANNELS.md contract</span>
        </div>
        <div class="channels-row" id="channels-row"></div>
      </div>

      <!-- LIVE FEED -->
      <div class="page" id="page-live">
        <div class="headline">
          <div class="hl-card">
            <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(59,130,246,0.12);filter:blur(28px);pointer-events:none"></div>
            <div class="hl-label">Agents Seen</div>
            <div class="hl-value" id="kpi-agents">—</div>
            <div class="hl-sub" id="kpi-agents-sub">in this session</div>
          </div>
          <div class="hl-card orange">
            <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(232,99,26,0.14);filter:blur(28px);pointer-events:none"></div>
            <div class="hl-label">Domains Mapped</div>
            <div class="hl-value"><span id="kpi-domains">—</span><span class="unit">/ 13</span></div>
            <div class="hl-sub">Wave 1+2 in progress</div>
          </div>
          <div class="hl-card red">
            <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(239,68,68,0.10);filter:blur(28px);pointer-events:none"></div>
            <div class="hl-label">Events to Register</div>
            <div class="hl-value" id="kpi-missing">—</div>
            <div class="hl-sub">Target: 0</div>
          </div>
          <div class="hl-card">
            <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(34,197,94,0.08);filter:blur(28px);pointer-events:none"></div>
            <div class="hl-label">Gate PASS</div>
            <div class="hl-value green"><span id="kpi-pass">—</span><span class="unit">/ 13</span></div>
            <div class="hl-sub">Target: 13</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-header">
            <span class="progress-label">Progress to 100% — all 13 domains PASS, 0 events missing</span>
            <span class="progress-pct" id="progress-pct">0%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="progress-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
          </svg>
          <span class="section-title">Agent Activity</span>
          <span class="section-count" id="agent-count-lbl">— agents</span>
        </div>
        <div class="agents-grid" id="agents-grid"></div>
      </div>

      <!-- GATE GRID -->
      <div class="page" id="page-gates">
        <div class="headline">
          <div class="hl-card green">
            <div class="hl-label">Gate PASS</div>
            <div class="hl-value" id="gkpi-pass">—<span class="unit">/ 13</span></div>
            <div class="hl-sub">5 control points each</div>
          </div>
          <div class="hl-card red">
            <div class="hl-label">Gate FAIL</div>
            <div class="hl-value" id="gkpi-fail">—</div>
            <div class="hl-sub" id="gkpi-unmapped">— unmapped</div>
          </div>
          <div class="hl-card">
            <div class="hl-label">Total Blockers</div>
            <div class="hl-value" id="gkpi-blockers">—</div>
            <div class="hl-sub">across all domains</div>
          </div>
          <div class="hl-card orange">
            <div class="hl-label">Hooks Missing</div>
            <div class="hl-value" id="gkpi-hooks">—</div>
            <div class="hl-sub">must implement</div>
          </div>
        </div>
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="1.5" y="1.5" width="5" height="5" rx="1"/>
            <rect x="9.5" y="1.5" width="5" height="5" rx="1"/>
            <rect x="1.5" y="9.5" width="5" height="5" rx="1"/>
            <rect x="9.5" y="9.5" width="5" height="5" rx="1"/>
          </svg>
          <span class="section-title">Domain × Control-Point Matrix</span>
          <span class="section-count">5 control points per domain</span>
        </div>
        <div class="gate-labels">
          <div class="gate-lbl">Domain</div>
          <div class="gate-lbl">Counts</div>
          <div class="gate-lbl c" title="every_element_mapped">Mapped</div>
          <div class="gate-lbl c" title="every_mutation_has_event">Evt</div>
          <div class="gate-lbl c" title="every_event_registry_status_known">Reg</div>
          <div class="gate-lbl c" title="every_mutation_has_hook_or_flagged">Hook</div>
          <div class="gate-lbl c" title="baseline_count_recorded">Base</div>
          <div class="gate-lbl c">Gate</div>
        </div>
        <div class="gate-grid" id="gate-grid"></div>
      </div>

      <!-- ALL EVENTS (TELEMETRY INVENTORY) -->
      <div class="page" id="page-tele">
        <div class="headline">
          <div class="hl-card">
            <div class="hl-label">Total Events</div>
            <div class="hl-value" id="tkpi-total">—</div>
            <div class="hl-sub">across all domains</div>
          </div>
          <div class="hl-card green">
            <div class="hl-label">In Registry</div>
            <div class="hl-value" id="tkpi-reg">—</div>
            <div class="hl-sub">registered + wired</div>
          </div>
          <div class="hl-card red">
            <div class="hl-label">Missing</div>
            <div class="hl-value" id="tkpi-miss">—</div>
            <div class="hl-sub">F0.1 to-register</div>
          </div>
          <div class="hl-card">
            <div class="hl-label">Noops</div>
            <div class="hl-value" id="tkpi-noop">—</div>
            <div class="hl-sub">no telemetry needed</div>
          </div>
        </div>
        <div class="tele-controls">
          <input class="tele-search" id="tele-q" type="text" placeholder="Search events, elements, hooks…" oninput="renderTele()" />
          <button class="flt-btn on" id="fb-all"  onclick="setF('all')">All</button>
          <button class="flt-btn"    id="fb-miss" onclick="setF('missing')">Missing</button>
          <button class="flt-btn"    id="fb-reg"  onclick="setF('registered')">Registered</button>
          <button class="flt-btn"    id="fb-noop" onclick="setF('noop')">Noop</button>
          <div class="tele-summary">
            <span><span class="ts-dot r"></span><span id="ts-r">—</span> reg</span>
            <span><span class="ts-dot m"></span><span id="ts-m">—</span> missing</span>
          </div>
        </div>
        <div class="tele-wrap">
          <table class="tele-table">
            <thead>
              <tr>
                <th onclick="sortT('event')">Event</th>
                <th onclick="sortT('domain')">Domain</th>
                <th onclick="sortT('reg')">Registry</th>
                <th>Element</th>
                <th>Hook</th>
              </tr>
            </thead>
            <tbody id="tele-tbody"></tbody>
          </table>
          <div class="tele-foot" id="tele-foot">— rows</div>
        </div>
      </div>

      <!-- MISSING EVENTS -->
      <div class="page" id="page-missing">
        <div class="headline">
          <div class="hl-card red">
            <div class="hl-label">Events to Register</div>
            <div class="hl-value" id="mkpi-count">—</div>
            <div class="hl-sub">F0.1 reconcile worklist</div>
          </div>
          <div class="hl-card">
            <div class="hl-label">Domains Affected</div>
            <div class="hl-value" id="mkpi-domains">—</div>
            <div class="hl-sub">have missing events</div>
          </div>
          <div class="hl-card orange">
            <div class="hl-label">Total Mutations</div>
            <div class="hl-value" id="mkpi-mutations">—</div>
            <div class="hl-sub">write operations mapped</div>
          </div>
          <div class="hl-card green">
            <div class="hl-label">Events in Registry</div>
            <div class="hl-value" id="mkpi-reg">—</div>
            <div class="hl-sub">already registered</div>
          </div>
        </div>
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2 4h12M2 8h9M2 12h6"/>
          </svg>
          <span class="section-title">Missing Events — F0.1 Worklist</span>
          <span class="section-count" id="missing-count-lbl">— items</span>
        </div>
        <div class="events-list" id="events-list"></div>
      </div>

      <!-- SPEC -->
      <div class="page" id="page-spec">
        <div class="spec-wrap">
          <div class="spec-tabs">
            <button class="spec-tab active" onclick="showSpec('drive')">DRIVE-TO-100</button>
            <button class="spec-tab" onclick="showSpec('process')">PROCESS-SPEC</button>
          </div>
          <div class="spec-pane active" id="spec-drive"><pre id="spec-drive-pre"></pre></div>
          <div class="spec-pane" id="spec-process"><pre id="spec-process-pre"></pre></div>
        </div>
      </div>

    </div><!-- /content -->
  </main>
</div><!-- /shell -->

<script>
// ── Baked data (NO fetch) ──────────────────────────────────────────────────
const FEED      = {FEED_JS};
const HEARTBEAT = {HB_JS};
const GATES     = {GATES_JS};
const RAW_MAPS  = {RAW_MAPS_JS};
const WEBHOOKS  = {WEBHOOKS_JS};
const SPEC_DRIVE   = {SPEC_D_JS};
const SPEC_PROCESS = {SPEC_P_JS};
const TOTAL_DOMAINS = 13;

// ── Utilities ──────────────────────────────────────────────────────────────
function esc(s) {{
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}}
function fmtTime(iso) {{
  if (!iso) return '—';
  try {{ return new Date(iso).toLocaleTimeString('no-NO',{{hour:'2-digit',minute:'2-digit',second:'2-digit'}}); }}
  catch {{ return iso; }}
}}
function shortTime(iso) {{
  if (!iso) return '—';
  try {{ return new Date(iso).toLocaleTimeString('no-NO',{{hour:'2-digit',minute:'2-digit'}}); }}
  catch {{ return iso; }}
}}

// ── TELEMETRY-MAP.md parser (handles all 4 format variants) ───────────────
function parseTeleMap(text, domain) {{
  const rows = [];
  for (const line of text.split('\\n')) {{
    if (!line.startsWith('|')) continue;
    if (/^\\|[-: |]+\\|\\s*$/.test(line.trim())) continue;
    const cells = line.split('|').map(c=>c.trim()).filter((_,i,a)=>i>0&&i<a.length-1);
    if (cells.length < 2) continue;
    const id = cells[0];
    if (!id || ['#','ID','Metric','Stat','Symbol','File','Action'].includes(id) || id.startsWith('---')) continue;
    const n = cells.length;
    let evR='', regR='', elR='', hookR='';
    if (n>=9)      {{ elR=cells[1];evR=cells[5];regR=cells[6];hookR=cells[7]; }}
    else if (n===8){{ elR=cells[1];evR=cells[5];regR=cells[6];hookR=cells[7]; }}
    else if (n===7){{ elR=cells[1];evR=cells[3];regR=cells[4];hookR=cells[5]; }}
    else if (n===6){{
      elR=cells[1];
      if (/MISSING|yes|REGISTRY/i.test(cells[4])){{ evR=cells[3];regR=cells[4];hookR=cells[5]; }}
      else {{ evR=cells[3];hookR=cells[4];regR=cells[5]; }}
    }}
    else if (n===5){{ elR=cells[1];evR=cells[3];regR=cells[4]; }}
    else if (n>=3) {{ elR=cells[1];evR=cells[2];regR=cells[3]||''; }}
    const event = evR.replace(/`/g,'').replace(/^MISSING:\\s*/i,'').replace(/\\s*\\{{.*\\}}/,'').replace(/\\*\\*/g,'').trim();
    if (!event||event==='—'||event==='-') continue;
    const rl = regR.toLowerCase();
    let reg = 'unknown';
    if (/noop|local state/.test(rl)) reg='noop';
    else if (/\\byes\\b|\\bin\\b|exists|found|line \\d/i.test(rl)) reg='registered';
    else if (/\\bmissing\\b/.test(regR)) reg='missing';
    if (evR.includes('MISSING')) reg='missing';
    if (/noop/i.test(evR)) reg='noop';
    rows.push({{
      id, event, domain, reg,
      element: elR.replace(/\\*\\*/g,'').replace(/`/g,'').trim(),
      hook: hookR.replace(/`/g,'').replace(/\\*\\*/g,'').replace(/^—$/,'').trim()
    }});
  }}
  return rows;
}}

// ── Build telemetry inventory from baked RAW_MAPS ─────────────────────────
let teleEvents = [];
for (const [domain, text] of Object.entries(RAW_MAPS)) {{
  teleEvents = teleEvents.concat(parseTeleMap(text, domain));
}}

// ── Derive agents from feed ────────────────────────────────────────────────
function deriveAgents() {{
  const agents = {{}};
  for (const row of FEED) {{
    const id = row.agent; if (!id) continue;
    if (!agents[id]) agents[id] = {{id, domain:row.domain, logonTs:null, logoffTs:null, isLive:false, lastGate:null, events:[]}};
    const a = agents[id];
    if (row.event==='logon')  {{ a.logonTs=row.ts; a.isLive=true; }}
    if (row.event==='logoff') {{ a.logoffTs=row.ts; a.isLive=false; }}
    if (row.gate) a.lastGate=row.gate;
    a.events.push(row);
  }}
  return agents;
}}

// ── Liveness — latest-event-wins ────────────────────────────────────────────
// Historical stall-alerts are IGNORED if the agent later logged off.
// A logoff/gate as the latest feed event always means DONE.
const HB_ALL_STALLS = HEARTBEAT.filter(b=>b.event==='stall-alert');
const HB_LATEST = HEARTBEAT.filter(b=>b.event==='beat').slice(-1)[0]||null;

// Currently-stalled agents: have a stall-alert AND latest feed event is not logoff/gate
function currentlyStalled(agents) {{
  const seenAgents = new Set();
  return HB_ALL_STALLS.filter(s => {{
    if (seenAgents.has(s.agent)) return false;
    const a = agents[s.agent];
    if (!a) {{ seenAgents.add(s.agent); return true; }} // no feed data → treat stalled
    const last = a.events[a.events.length-1];
    if (last && (last.event==='logoff'||last.event==='gate')) return false; // finished
    seenAgents.add(s.agent);
    return true;
  }});
}}

function agentLiveness(agentId, a) {{
  const last = a.events[a.events.length-1];
  // Latest feed event is terminal → DONE, regardless of any prior stall-alerts
  if (!last || last.event==='logoff' || last.event==='gate') return 'done';
  // Still live — check if genuinely stalled (stall-alert exists AND no logoff yet)
  const ageMs = Date.now()-new Date(last.ts).getTime();
  if (ageMs>90000 && HB_ALL_STALLS.some(s=>s.agent===agentId)) return 'stalled';
  if (last.event==='working') return 'working';
  return 'live';
}}

// ── Gate helpers ───────────────────────────────────────────────────────────
function countMissing() {{
  let t=0;
  for (const d of GATES) if (Array.isArray(d.events_missing_from_registry)) t+=d.events_missing_from_registry.length;
  return t;
}}
function countPassFail() {{
  let p=0,f=0;
  for (const d of GATES) {{ if(d.gate==='PASS') p++; else if(d.gate==='FAIL') f++; }}
  return {{p,f}};
}}
function progress() {{
  const {{p}} = countPassFail();
  const miss = countMissing();
  const domP = (p/TOTAL_DOMAINS)*60;
  const evtB = 113;
  const evtP = (Math.max(0,evtB-miss)/evtB)*40;
  return Math.min(100,Math.round(domP+evtP));
}}

// ── RENDER: Channels ───────────────────────────────────────────────────────
function renderChannels() {{
  const agents  = deriveAgents();
  const ACTIVE_STALLS = currentlyStalled(agents); // only agents still live+silent
  const live    = HB_LATEST?.live||0;
  const working = HB_LATEST?.working||0;
  const stalled = HB_LATEST?.stalled||0;
  const done    = HB_LATEST?.done||0;
  const hasStalls = ACTIVE_STALLS.length>0;
  const hbClass = hasStalls ? 'ch-stalled' : (HB_LATEST ? 'ch-beating' : 'ch-idle');
  const hbPill  = hasStalls ? '<span class="ch-state-pill pill-stalled">⚠ stalled</span>'
                : HB_LATEST ? '<span class="ch-state-pill pill-beating">● beating</span>'
                : '<span class="ch-state-pill pill-idle">idle</span>';
  const {{p:gp}} = countPassFail();
  const miss = countMissing();

  let stallHtml = '';
  for (const s of ACTIVE_STALLS.slice(0,3)) {{
    stallHtml += `<div class="stall-alert-box">⚠ <span><strong>${{esc(s.agent||'agent')}}</strong> — ${{esc(s.detail||'stall detected')}}</span></div>`;
  }}

  let hbAgeStr = 'no signal';
  if (HB_LATEST) {{
    const ageMs = Date.now()-new Date(HB_LATEST.ts).getTime();
    const ageSec = Math.round(ageMs/1000);
    hbAgeStr = ageSec<60 ? ageSec+'s ago' : Math.round(ageSec/60)+'m ago (snapshot)';
  }}

  document.getElementById('channels-row').innerHTML = `
    <div class="channel-tile ${{hbClass}}">
      <div class="ch-orb" style="top:-40px;right:-40px;width:120px;height:120px;background:${{hasStalls?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.12)'}}"></div>
      <div class="ch-head">
        <div class="ch-icon heartbeat">💓</div>
        <div><div class="ch-name">Heartbeat</div><div style="font-size:10px;color:var(--muted)">liveness pulse</div></div>
        ${{hbPill}}
      </div>
      <div class="ch-stat-row">
        <div class="ch-stat"><span class="ch-stat-val sv-green">${{live}}</span><span class="ch-stat-lbl">Live</span></div>
        <div class="ch-stat"><span class="ch-stat-val sv-warn">${{working}}</span><span class="ch-stat-lbl">Working</span></div>
        <div class="ch-stat"><span class="ch-stat-val ${{stalled>0?'sv-red':'sv-muted'}}">${{stalled}}</span><span class="ch-stat-lbl">Stalled</span></div>
        <div class="ch-stat"><span class="ch-stat-val sv-muted">${{done}}</span><span class="ch-stat-lbl">Done</span></div>
      </div>
      <div class="ch-detail">
        <span class="ch-ts">Last beat: ${{HB_LATEST?shortTime(HB_LATEST.ts):'—'}} (${{hbAgeStr}})</span>
        ${{HB_LATEST?`<div style="margin-top:4px">${{esc(HB_LATEST.detail)}}</div>`:''}}
        ${{stallHtml}}
      </div>
    </div>
    <div class="channel-tile ${{FEED.length?'ch-beating':'ch-idle'}}">
      <div class="ch-orb" style="top:-40px;right:-40px;width:120px;height:120px;background:rgba(59,130,246,0.10)"></div>
      <div class="ch-head">
        <div class="ch-icon telemetry">📡</div>
        <div><div class="ch-name">Telemetry</div><div style="font-size:10px;color:var(--muted)">app-event stream</div></div>
        <span class="ch-state-pill ${{FEED.length?'pill-active':'pill-idle'}}">${{FEED.length?'active':'idle'}}</span>
      </div>
      <div class="ch-stat-row">
        <div class="ch-stat"><span class="ch-stat-val sv-blue">${{FEED.length}}</span><span class="ch-stat-lbl">Events</span></div>
        <div class="ch-stat"><span class="ch-stat-val sv-green">${{FEED.filter(e=>e.event==='delivered').length}}</span><span class="ch-stat-lbl">Delivered</span></div>
        <div class="ch-stat"><span class="ch-stat-val ${{miss>0?'sv-red':'sv-green'}}">${{miss}}</span><span class="ch-stat-lbl">Missing</span></div>
        <div class="ch-stat"><span class="ch-stat-val ${{gp>0?'sv-green':'sv-muted'}}">${{gp}}</span><span class="ch-stat-lbl">Gates ✓</span></div>
      </div>
      <div class="ch-detail">
        <div>feed.jsonl + ${{Object.keys(RAW_MAPS).length}} TELEMETRY-MAP.md files</div>
        <div style="margin-top:6px"><button class="btn" style="font-size:11px;padding:4px 10px" onclick="showPage('tele')">Browse all events →</button></div>
      </div>
    </div>
    <div class="channel-tile ch-idle">
      <div class="ch-orb" style="top:-40px;right:-40px;width:120px;height:120px;background:rgba(120,113,108,0.07)"></div>
      <div class="ch-head">
        <div class="ch-icon webhook">🔗</div>
        <div><div class="ch-name">Webhook</div><div style="font-size:10px;color:var(--muted)">external inbound</div></div>
        <span class="ch-state-pill pill-idle">idle</span>
      </div>
      <div class="ch-stat-row">
        <div class="ch-stat"><span class="ch-stat-val sv-muted">${{WEBHOOKS.length}}</span><span class="ch-stat-lbl">Functions</span></div>
        <div class="ch-stat"><span class="ch-stat-val sv-muted">0</span><span class="ch-stat-lbl">Events</span></div>
        <div class="ch-stat"><span class="ch-stat-val sv-muted">—</span><span class="ch-stat-lbl">Last hit</span></div>
      </div>
      <div class="ch-detail">
        <div class="webhook-fn-list">
          ${{WEBHOOKS.map(fn=>`<div class="webhook-fn"><span class="webhook-fn-dot"></span>${{esc(fn)}}<span class="live-env-tag">live env only</span></div>`).join('')}}
        </div>
        <div style="margin-top:8px;font-size:10.5px;color:var(--muted-soft)">No traffic in staging. Inbound only in production.</div>
      </div>
    </div>`;

  // Nav badge
  const nc = document.getElementById('nav-channels-count');
  if (hasStalls) {{ nc.textContent = ACTIVE_STALLS.length+' stall'; nc.className='nav-count alert'; }}
  else {{ nc.textContent='3'; nc.className='nav-count'; }}
}}

// ── RENDER: Live feed ──────────────────────────────────────────────────────
function renderLive() {{
  const agents = deriveAgents();
  const list = Object.values(agents);
  const {{p:gp}} = countPassFail();
  const miss = countMissing();
  const pct = progress();

  document.getElementById('kpi-agents').textContent = list.length;
  document.getElementById('kpi-agents-sub').textContent = list.filter(a=>a.isLive).length+' were live at snapshot';
  document.getElementById('kpi-domains').textContent = GATES.length;
  document.getElementById('kpi-missing').textContent = miss;
  document.getElementById('kpi-pass').textContent = gp;
  document.getElementById('progress-pct').textContent = pct+'%';
  document.getElementById('progress-fill').style.width = pct+'%';
  document.getElementById('nav-live-count').textContent = list.length;
  document.getElementById('agent-count-lbl').textContent = list.length+' agents';

  if (!list.length) {{
    document.getElementById('agents-grid').innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No agent activity in feed.</div>';
    return;
  }}
  list.sort((a,b)=>{{ if(a.isLive!==b.isLive) return a.isLive?-1:1; return (b.logonTs||'')>(a.logonTs||'')?1:-1; }});

  document.getElementById('agents-grid').innerHTML = list.map(a => {{
    const lv = agentLiveness(a.id, a);
    const isStalled = lv==='stalled';
    const orbColor = isStalled?'rgba(239,68,68,0.14)':a.isLive?'rgba(34,197,94,0.12)':'rgba(80,75,69,0.16)';
    const sdClass = isStalled?'sd-stalled':a.isLive?'sd-live':'sd-off';
    const cardClass = isStalled?'stalled':a.isLive?'live':'';
    const lbClass = {{live:'lb-live',working:'lb-working',stalled:'lb-stalled',done:'lb-done'}}[lv]||'lb-done';
    const lbLabel = {{live:'● live',working:'working',stalled:'⚠ stalled',done:'done'}}[lv]||lv;
    const stream = a.events.slice(-6).map(ev => {{
      const cc = ev.event==='gate'?(ev.gate==='PASS'?'ec-gate-p':'ec-gate-f'):`ec-${{ev.event}}`;
      const cl = ev.event==='gate'?(ev.gate||'GATE'):ev.event.toUpperCase();
      return `<div class="stream-item">
        <span class="stream-ts">${{shortTime(ev.ts)}}</span>
        <span class="evt-chip ${{cc}}">${{cl}}</span>
        <span class="stream-detail">${{esc(ev.detail)}}${{ev.artifact?`<span class="artifact">${{esc(ev.artifact)}}</span>`:''}}</span>
      </div>`;
    }}).join('');
    const last = a.events[a.events.length-1];
    return `<div class="agent-card ${{cardClass}} fade-in">
      <div class="orb-bg" style="background:${{orbColor}}"></div>
      <div class="agent-head">
        <span class="status-dot ${{sdClass}}"></span>
        <span class="agent-name">${{esc(a.id)}}</span>
        <span class="domain-badge">${{esc(a.domain)}}</span>
        <span class="liveness-badge ${{lbClass}}">${{lbLabel}}</span>
      </div>
      <div class="agent-times">
        <span><span class="key">on</span> ${{fmtTime(a.logonTs)}}</span>
        ${{a.logoffTs?`<span><span class="key">off</span> ${{fmtTime(a.logoffTs)}}</span>`:'<span style="color:var(--muted)">snapshot</span>'}}
        ${{a.lastGate?`<span><span class="key">gate</span> <span style="color:${{a.lastGate==='PASS'?'var(--success)':'var(--fail)'}};">${{a.lastGate}}</span></span>`:''}}
      </div>
      <div class="stream">${{stream}}</div>
    </div>`;
  }}).join('');
}}

// ── RENDER: Gate grid ──────────────────────────────────────────────────────
function renderGates() {{
  const {{p,f}} = countPassFail();
  let totalB=0, totalH=0;
  for (const d of GATES) {{
    if (Array.isArray(d.blockers)) totalB+=d.blockers.length; else if(d.blockers) totalB++;
    if (Array.isArray(d.hooks_missing)) totalH+=d.hooks_missing.length;
  }}
  document.getElementById('gkpi-pass').innerHTML=`${{p}}<span class="unit">/ 13</span>`;
  document.getElementById('gkpi-fail').textContent=f;
  document.getElementById('gkpi-unmapped').textContent=(TOTAL_DOMAINS-p-f)+' unmapped';
  document.getElementById('gkpi-blockers').textContent=totalB;
  document.getElementById('gkpi-hooks').textContent=totalH;
  document.getElementById('nav-gates-count').textContent=`${{p}}P / ${{f}}F`;

  const unmapped = Math.max(0, TOTAL_DOMAINS - GATES.length);
  const cpKeys = ['every_element_mapped','every_mutation_has_event','every_event_registry_status_known','every_mutation_has_hook_or_flagged','baseline_count_recorded'];

  let html = GATES.map(d => {{
    const cp = d.control_points||{{}};
    const cells = cpKeys.map(k => {{
      if (cp[k]===true)  return `<div class="gate-col cp-cell"><span class="cp-pass">✓</span></div>`;
      if (cp[k]===false) return `<div class="gate-col cp-cell"><span class="cp-fail">✗</span></div>`;
      return `<div class="gate-col cp-cell"><span style="color:var(--muted-soft)">?</span></div>`;
    }}).join('');
    const vc = d.gate==='PASS'?'vp':d.gate==='FAIL'?'vf':'vu';
    const rc = d.gate==='PASS'?'pass':d.gate==='FAIL'?'fail':'';
    const miss = Array.isArray(d.events_missing_from_registry)?d.events_missing_from_registry.length:0;
    const hooksM = Array.isArray(d.hooks_missing)?d.hooks_missing.length:0;
    let blockersHtml='';
    const bArr = Array.isArray(d.blockers)?d.blockers:(d.blockers?[d.blockers]:[]);
    if (bArr.length) {{
      blockersHtml='<div class="gate-blockers">'+bArr.map(b=>{{
        const t=typeof b==='string'?b:(b.description||JSON.stringify(b));
        return `<div class="blocker-item"><span class="bi-icon">▸</span>${{esc(t)}}</div>`;
      }}).join('')+'</div>';
    }}
    return `<div class="gate-row ${{rc}}">
      <div class="gate-header">
        <div class="gate-col gate-domain">${{esc(d.domain)}}</div>
        <div class="gate-col gate-counts">
          <div class="c-row"><span>el:</span><span class="c-val">${{d.elements_mapped||0}}/${{d.interactive_elements_total||0}}</span></div>
          <div class="c-row"><span>evt−:</span><span class="${{miss>0?'c-bad':'c-val'}}">${{miss}}</span><span style="margin-left:6px">hook−:</span><span class="${{hooksM>0?'c-warn':'c-val'}}">${{hooksM}}</span></div>
        </div>
        ${{cells}}
        <div class="gate-col gate-verdict ${{vc}}">${{d.gate||'—'}}</div>
      </div>${{blockersHtml}}</div>`;
  }}).join('');

  for (let i=0;i<unmapped;i++) {{
    html+=`<div class="gate-row" style="opacity:0.4;border-style:dashed">
      <div class="gate-header">
        <div class="gate-col gate-domain" style="color:var(--muted)">batch 2…</div>
        <div class="gate-col gate-counts"><div class="c-row" style="color:var(--muted-soft)">not yet mapped</div></div>
        ${{cpKeys.map(()=>'<div class="gate-col cp-cell"><span style="color:var(--muted-soft)">–</span></div>').join('')}}
        <div class="gate-col gate-verdict vu">–</div>
      </div></div>`;
  }}
  document.getElementById('gate-grid').innerHTML = html;
}}

// ── RENDER: Telemetry inventory ────────────────────────────────────────────
let teleFilter='all', teleSort={{col:'domain',dir:1}};

function setF(f) {{
  teleFilter=f;
  ['all','miss','reg','noop'].forEach(id=>{{
    const b=document.getElementById('fb-'+id);
    if(b) b.className='flt-btn'+(( id===f||(id==='all'&&f==='all'))?' on':'');
  }});
  renderTele();
}}
function sortT(col) {{
  if(teleSort.col===col) teleSort.dir*=-1; else {{ teleSort.col=col; teleSort.dir=1; }}
  renderTele();
}}
function renderTele() {{
  const reg  = teleEvents.filter(r=>r.reg==='registered').length;
  const miss = teleEvents.filter(r=>r.reg==='missing').length;
  const noop = teleEvents.filter(r=>r.reg==='noop').length;
  document.getElementById('tkpi-total').textContent = teleEvents.length;
  document.getElementById('tkpi-reg').textContent   = reg;
  document.getElementById('tkpi-miss').textContent  = miss;
  document.getElementById('tkpi-noop').textContent  = noop;
  document.getElementById('ts-r').textContent = reg;
  document.getElementById('ts-m').textContent = miss;
  document.getElementById('nav-tele-count').textContent = teleEvents.length;

  const q = (document.getElementById('tele-q')?.value||'').toLowerCase().trim();
  let rows = teleEvents.filter(r=>{{
    if (teleFilter==='missing')    return r.reg==='missing';
    if (teleFilter==='registered') return r.reg==='registered';
    if (teleFilter==='noop')       return r.reg==='noop';
    return true;
  }}).filter(r=>!q||[r.event,r.domain,r.element,r.hook].join(' ').toLowerCase().includes(q));

  const {{col,dir}} = teleSort;
  rows.sort((a,b)=>{{
    const av=col==='event'?a.event:col==='domain'?a.domain:a.reg;
    const bv=col==='event'?b.event:col==='domain'?b.domain:b.reg;
    return (av<bv?-1:av>bv?1:0)*dir;
  }});

  const regBadge=r=>{{
    if(r==='registered') return '<span class="reg-badge rb-yes">In Registry</span>';
    if(r==='missing')    return '<span class="reg-badge rb-miss">Missing</span>';
    if(r==='noop')       return '<span class="reg-badge rb-noop">Noop</span>';
    return `<span class="reg-badge rb-noop">${{esc(r)}}</span>`;
  }};

  if (!rows.length) {{
    document.getElementById('tele-tbody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">No events match this filter.</td></tr>';
    document.getElementById('tele-foot').textContent='0 rows';
    return;
  }}
  document.getElementById('tele-tbody').innerHTML = rows.map(r=>`
    <tr>
      <td><span class="t-event">${{esc(r.event)}}</span></td>
      <td><span class="t-domain">${{esc(r.domain)}}</span></td>
      <td>${{regBadge(r.reg)}}</td>
      <td><span class="t-el">${{esc(r.element)||'<span style="color:var(--muted-soft)">—</span>'}}</span></td>
      <td><span class="t-hook">${{esc(r.hook)||'<span style="color:var(--muted-soft)">—</span>'}}</span></td>
    </tr>`).join('');
  document.getElementById('tele-foot').textContent=`${{rows.length}} of ${{teleEvents.length}} rows`;
}}

// ── RENDER: Missing events ─────────────────────────────────────────────────
function renderMissing() {{
  const allMiss=new Set(); let totalR=0,totalM=0,da=0;
  for (const d of GATES) {{
    if (Array.isArray(d.events_missing_from_registry)&&d.events_missing_from_registry.length){{da++;for(const e of d.events_missing_from_registry)allMiss.add(e);}}
    totalR+=(d.events_in_registry||0); totalM+=(d.mutations||0);
  }}
  const miss=[...allMiss].sort();
  document.getElementById('mkpi-count').textContent    = miss.length;
  document.getElementById('mkpi-domains').textContent  = da;
  document.getElementById('mkpi-mutations').textContent= totalM;
  document.getElementById('mkpi-reg').textContent      = totalR;
  document.getElementById('missing-count-lbl').textContent = miss.length+' items';
  document.getElementById('nav-missing-count').textContent = miss.length;
  document.getElementById('events-list').innerHTML = miss.length
    ? miss.map(e=>`<div class="evt-item">${{esc(e)}}</div>`).join('')
    : '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">All events registered.</div>';
}}

// ── Navigation ─────────────────────────────────────────────────────────────
const PAGE_TITLES = {{
  channels:'Signal Channels', live:'Live Agent Feed', gates:'Domain Gate Grid',
  tele:'All Telemetry Events', missing:'Missing Events — F0.1 Worklist', spec:'Spec Documents'
}};
function showPage(id) {{
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pg=document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  const nb=document.getElementById('nav-'+id);
  if(nb) nb.classList.add('active');
  document.getElementById('topbar-title').textContent=PAGE_TITLES[id]||id;
}}
function showSpec(tab) {{
  document.querySelectorAll('.spec-tab').forEach((t,i)=>{{
    t.classList.toggle('active',['drive','process'][i]===tab);
  }});
  document.querySelectorAll('.spec-pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('spec-'+tab).classList.add('active');
}}

// ── Boot ───────────────────────────────────────────────────────────────────
document.getElementById('spec-drive-pre').textContent   = SPEC_DRIVE;
document.getElementById('spec-process-pre').textContent = SPEC_PROCESS;
renderChannels();
renderLive();
renderGates();
renderTele();
renderMissing();
showPage('channels');
</script>
</body>
</html>"""

with open(OUT, 'w') as f:
    f.write(html)

fetch_count = html.count('fetch(')
print(f"  Written: {OUT}")
print(f"  Size: {len(html):,} bytes")
print(f"  fetch() calls: {fetch_count} (must be 0)")
if fetch_count > 0:
    print("  ERROR: fetch() calls found — not self-contained!")
    sys.exit(1)
else:
    print("  OK: self-contained, no fetch()")
PYEOF

echo "  Done. Open: RICH-DASHBOARD.html"
