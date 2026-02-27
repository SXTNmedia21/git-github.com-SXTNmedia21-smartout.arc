import sys, re
with open("c:/Users/sxtnl/Dev/Genesis/smartout.ai/apps/web/src/app/dashboard/chat/page.tsx", "r", encoding="utf-8") as f: content = f.read()
content = re.sub(r"//.*", "", content)
tags = []
for m in re.finditer(r"<(/?)(div|motion\.div|AnimatePresence|>[0-9]*<)([^>]*?)(/?)>", content):
  tag = m.group(2)
  if tag.startswith(">"): continue
  is_close = bool(m.group(1))
  is_self = bool(m.group(4))
  line = content[:m.start()].count("\\n") + 1
  if is_close:
    if tags and tags[-1][0] == tag: tags.pop()
    else: print(f"Mismatch at {line}: expected {tags[-1][0] if tags else None}, got {tag}")
  elif not is_self: tags.append((tag, line))
for t in tags: print(f"Unclosed {t[0]} from line {t[1]}")
