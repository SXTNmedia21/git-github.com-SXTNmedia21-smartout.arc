#!/usr/bin/env python3
"""control-server.py — serves the live panel AND handles start/stop/assign/verify.

The static http.server can't DO anything — buttons need a backend. This is it.
A button POST writes the INTENT (task status + a signal file); the orchestrator
(separate instance) reads the signal and acts. Honest bridge: the webpage never
spawns an agent — it raises a flag the agent obeys. Start = GO, Stop = HALT.

  python3 control-server.py [port]      # default 8088, serves docs/campaign/

POST /api/task/<id>/<action>
  start          → status=in_progress + signals/<id>.go     (orchestrator: begin)
  stop           → status=paused      + signals/<id>.stop    (orchestrator: halt)
  assign?to=NAME → assigned_to=NAME
  verify         → runs task.sh verify <id>, returns its output + gate verdict
Every action regenerates tasks-index.json so the panel reflects it on next poll.
"""
import json, os, subprocess, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
TASKS = os.path.join(HERE, "tasks")
SIG = os.path.join(TASKS, ".signals")
os.makedirs(SIG, exist_ok=True)

def sh(args, cwd=TASKS):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=180)
    return p.returncode, (p.stdout or "") + (p.stderr or "")

def regen():
    sh(["bash", "gen-index.sh"])

def signal(tid, kind, note):
    with open(os.path.join(SIG, f"{tid}.{kind}"), "w") as f:
        f.write(note + "\n")
    # one-shot opposite removal so the latest intent wins
    other = "stop" if kind == "go" else "go"
    p = os.path.join(SIG, f"{tid}.{other}")
    if os.path.exists(p):
        os.remove(p)

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        u = urlparse(self.path)
        parts = u.path.strip("/").split("/")
        # /api/task/<id>/<action>
        if len(parts) == 4 and parts[0] == "api" and parts[1] == "task":
            tid, action = parts[2], parts[3]
            q = parse_qs(u.query)
            os.environ["TASK_ACTOR"] = "pontus"
            if action == "start":
                sh(["./task.sh", "set", tid, "status", "in_progress"])
                signal(tid, "go", f"START {tid} — Pontus pressed Start")
                regen(); return self._json(200, {"ok": True, "tid": tid, "status": "in_progress", "signal": "go"})
            if action == "stop":
                sh(["./task.sh", "set", tid, "status", "paused"])
                signal(tid, "stop", f"STOP {tid} — Pontus pressed Stop")
                regen(); return self._json(200, {"ok": True, "tid": tid, "status": "paused", "signal": "stop"})
            if action == "assign":
                to = (q.get("to") or ["orchestrator"])[0]
                sh(["./task.sh", "set", tid, "assigned_to", to])
                regen(); return self._json(200, {"ok": True, "tid": tid, "assigned_to": to})
            if action == "verify":
                rc, out = sh(["./task.sh", "verify", tid])
                regen(); return self._json(200, {"ok": rc == 0, "tid": tid, "rc": rc, "output": out})
            return self._json(400, {"ok": False, "error": "unknown action"})
        return self._json(404, {"ok": False, "error": "not found"})

    def log_message(self, *a):  # quiet
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    print(f"control-server on :{port} — serving {HERE}, POST /api/task/<id>/<start|stop|assign|verify>")
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
