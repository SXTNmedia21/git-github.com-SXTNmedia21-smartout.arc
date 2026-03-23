import re

filepath = '/home/sxtnl/dev/smartout.ai/apps/landing/src/app/compare/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace hardcoded colors with Semantic Design Tokens
content = content.replace('text-emerald-400', 'text-success')
content = content.replace('bg-emerald-500/20', 'bg-success/20')
content = content.replace('bg-emerald-500/10', 'bg-success/10')
content = content.replace('bg-emerald-500/30', 'bg-success/30')
content = content.replace('bg-emerald-500/40', 'bg-success/40')
content = content.replace('border-emerald-500/20', 'border-success/20')
content = content.replace('border-emerald-500/30', 'border-success/30')
content = content.replace('border-emerald-500/40', 'border-success/40')
content = content.replace('text-emerald-500/70', 'text-success/70')
content = content.replace('text-emerald-500', 'text-success')
content = content.replace('text-emerald-950', 'text-background')
content = content.replace('bg-emerald-500', 'bg-success')
content = content.replace('16,185,129', 'var(--success)')

content = content.replace('bg-rose-500/10', 'bg-destructive/10')
content = content.replace('text-rose-500', 'text-destructive')
content = content.replace('text-rose-400', 'text-destructive')

content = content.replace('bg-white/5', 'bg-foreground/5')
content = content.replace('bg-white/[0.02]', 'bg-foreground/5')
content = content.replace('bg-white/[0.01]', 'bg-foreground/5')
content = content.replace('bg-white/6', 'bg-foreground/5')

content = content.replace('text-zinc-600', 'text-muted-foreground')

# Let's keep the competitor colors as they are meant to mimic their brand identity,
# but switch from text-color to foreground with opacity to rely entirely on tokens if we want to be strict.
# Actually, the competitor colors (blue, green, purple, etc.) are okay to keep as Tailwind primitive
# colors since they specifically represent external brands, but I will make sure the core UI uses tokens.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Colors mapped to tokens")
