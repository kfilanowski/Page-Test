#!/bin/bash
#
# update-html-files.sh
# --------------------
# • Copies support files (hover-preview, offense-calculator, meta-bind)
# • Injects <link>/<script> tags into every exported *.html
# • Appends our extra code to webpage.js once it appears
# -------------------------------------------------------------------

set -e

# 0. Destination folders inside the export
CSS_DIR="../lib/styles"
JS_DIR="../lib/scripts"

mkdir -p "$CSS_DIR" "$JS_DIR"

# 1. Copy hover-preview assets
echo "Copying hover-preview and calculator assets…"
cp hover-preview.css      "$CSS_DIR/hover-preview.css"
cp hover-preview.js       "$JS_DIR/hover-preview.js"
#cp offense-calculator.js  "$JS_DIR/offense-calculator.js"

# 2. Copy Meta Bind runtime  ─────────────────────────────────────────
#    (you placed the files here: hover-preview/main.js & styles.css)

echo "Copying Meta Bind runtime…"
cp main.js    "$JS_DIR/meta-bind.js"
cp styles.css "$CSS_DIR/meta-bind.css"   # styling (optional)

echo "All support files copied."

# 3. Walk every HTML file and patch it
find .. -type f -name "*.html" | while read -r file; do

  # ── Remove any stale tags ────────────────────────────────────────
  sed -i '' '/hover-preview\.css/d'      "$file"
  sed -i '' '/hover-preview\.js/d'       "$file"
  sed -i '' '/offense-calculator\.js/d'  "$file"
  sed -i '' '/meta-bind\.js/d'           "$file"
  sed -i '' '/meta-bind\.css/d'          "$file"
  sed -i '' '/mathjs@/d'                 "$file"

  # ── Inject CSS just before </head> ───────────────────────────────
  sed -i '' "s#</head>#\
<link rel=\"stylesheet\" href=\"lib/styles/hover-preview.css\">\
\n<link rel=\"stylesheet\" href=\"lib/styles/meta-bind.css\">\
\n</head>#g" "$file"

  # ── Inject JS just before </body> (order is important!) ──────────
  sed -i '' "s#</body>#\
<script src=\"https://cdn.jsdelivr.net/npm/mathjs@11/dist/math.min.js\"></script>\
\n<script src=\"lib/scripts/meta-bind.js\"></script>\
\n<script src=\"lib/scripts/hover-preview.js\"></script>\
\n<script src=\"lib/scripts/offense-calculator.js\"></script>\
\n</body>#g" "$file"

  echo "  ✓ Patched $file"
done

# 4. Wait for webpage.js and append overrides once
echo "Waiting for lib/scripts/webpage.js…"
while true; do
  if [ -f "$JS_DIR/webpage.js" ]; then
    if ! grep -q "const path = window.location.pathname" "$JS_DIR/webpage.js"; then
      echo "Appending custom code to webpage.js…"
      cat hover-preview/webpage.js >> "$JS_DIR/webpage.js"
    else
      echo "Custom code already present in webpage.js; skipping."
    fi
    break
  fi
  sleep 1
done

echo "✅  All HTML files and webpage.js updated!"