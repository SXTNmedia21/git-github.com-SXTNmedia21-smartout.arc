import re
import sys

filepath = '/home/sxtnl/dev/smartout.ai/apps/landing/src/app/compare/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the features dictionary objects.
# We need to map:
# smartout: true -> smartout_free: true, smartout_premium: true
# smartout: paid("Pro") -> smartout_free: false, smartout_premium: false
# smartout: paid("Enterprise") -> smartout_free: false, smartout_premium: false
# smartout: paid("Premium 995 NOK") -> smartout_free: false, smartout_premium: true

def replacer(match):
    val = match.group(1)
    if 'true' in val:
        return 'smartout_free: true,\n          smartout_premium: true,'
    elif '"Premium' in val:
        return 'smartout_free: false,\n          smartout_premium: true,'
    elif '"Pro"' in val or '"Enterprise"' in val:
        return 'smartout_free: false,\n          smartout_premium: false,'
    else:
        return f'smartout_free: {val},\n          smartout_premium: {val},'

content = re.sub(r'smartout:\s+([^,]+),', replacer, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Values fixed")
