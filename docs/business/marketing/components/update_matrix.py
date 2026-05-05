import re
import sys

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to replace `{ smartout: true, ` with `{ smartout_free: true, smartout_premium: true, `
    # And `{ smartout: paid("Pro"), ` with `{ smartout_free: false, smartout_premium: false, ` 
    # And `{ smartout: paid("Enterprise"), ` with `{ smartout_free: false, smartout_premium: false, `
    # And `{ smartout: paid("Premium 995 NOK"), ` with `{ smartout_free: false, smartout_premium: true, `

    content = re.sub(r'values: { smartout: true, ', 'values: { smartout_free: true, smartout_premium: true, ', content)
    content = re.sub(r'values: { smartout: false, ', 'values: { smartout_free: false, smartout_premium: false, ', content)
    content = re.sub(r'values: { smartout: paid\("Premium 995 NOK"\), ', 'values: { smartout_free: false, smartout_premium: true, ', content)
    content = re.sub(r'values: { smartout: paid\("Pro"\), ', 'values: { smartout_free: false, smartout_premium: false, ', content)
    content = re.sub(r'values: { smartout: paid\("Enterprise"\), ', 'values: { smartout_free: false, smartout_premium: false, ', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('/home/sxtnl/dev/smartout.ai/apps/landing/src/app/compare/page.tsx')
print("Done")