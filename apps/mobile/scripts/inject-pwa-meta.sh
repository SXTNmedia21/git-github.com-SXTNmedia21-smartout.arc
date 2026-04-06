#!/bin/bash
# Inject PWA meta tags into the built index.html.
# Expo Router 55 (output: single) ignores +html.tsx, so we post-process.

INDEX="dist/index.html"

if [ ! -f "$INDEX" ]; then
  echo "Error: $INDEX not found. Run expo export first."
  exit 1
fi

# Replace lang="en" with lang="no"
sed -i 's/lang="en"/lang="no"/' "$INDEX"

# Update viewport to include viewport-fit=cover for notch handling
sed -i 's/width=device-width, initial-scale=1, shrink-to-fit=no/width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover/' "$INDEX"

# Inject PWA meta tags before </head> using sed with a marker approach
sed -i 's|</head>|<!-- PWA -->\n    <link rel="manifest" href="/manifest.json" />\n    <meta name="theme-color" content="#000000" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="apple-mobile-web-app-title" content="Smartout" />\n    <link rel="apple-touch-icon" href="/icon-192.png" />\n  </head>|' "$INDEX"

echo "PWA meta tags injected into $INDEX"
