#!/bin/bash

# This script updates the hover preview functionality in all HTML files and webpage.js

# Make sure the necessary directories exist
mkdir -p ../lib/styles
mkdir -p ../lib/scripts

# Copy hover preview files from the hover-preview directory to the lib directory
echo "Copying hover preview files to lib directory..."
cp hover-preview.js ../lib/scripts/hover-preview.js
cp hover-preview.css ../lib/styles/hover-preview.css
echo "Hover preview files have been copied to lib directory."

# Find all HTML files in the parent directory and its subdirectories
find .. -type f -name "*.html" | while read -r file; do
  echo "Processing $file..."
  
  # Remove existing hover preview script and CSS if present
  sed -i '' 's|<link rel="stylesheet" href="lib/styles/hover-preview.css">||g' "$file"
  sed -i '' 's|<script async src="lib/scripts/hover-preview.js">.*</script>||g' "$file"
  sed -i '' 's|<script src="lib/scripts/hover-preview.js">.*</script>||g' "$file"
  
  # Add the hover preview CSS link before the closing </head> tag
  sed -i '' 's#</head>#<link rel="stylesheet" href="lib/styles/hover-preview.css">\n</head>#' "$file"
  
  # Add the hover preview JS script right before the closing </body> tag to ensure it loads last
  sed -i '' 's#</body>#<script src="lib/scripts/hover-preview.js"></script>\n</body>#' "$file"
  
  echo "  Updated $file"
done

# Wait for webpage.js to be replaced and then copy our changes into it
echo "Waiting for webpage.js to be replaced..."
while true; do
  if [ -f "../lib/scripts/webpage.js" ]; then
    echo "webpage.js found, copying changes..."
    # Add our changes to webpage.js
    cat webpage.js >> "../lib/scripts/webpage.js"
    break
  fi
  sleep 1
done

echo "All HTML files and webpage.js have been updated!" 