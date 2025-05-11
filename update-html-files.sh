#!/bin/bash

# This script adds the hover preview functionality to all HTML files

# Find all HTML files in the current directory and subdirectories
find . -type f -name "*.html" | while read -r file; do
  echo "Processing $file..."
  
  # Check if the hover preview script is already included
  if grep -q "hover-preview.js" "$file"; then
    echo "  Already has hover preview script, skipping."
    continue
  fi
  
  # Backup the file
  #cp "$file" "${file}.bak"
  
  # Add the hover preview CSS link before the closing </head> tag
  sed -i '' 's#</head>#<link rel="stylesheet" href="lib/styles/hover-preview.css">\n</head>#' "$file"
  
  # Add the hover preview JS script before the closing </head> tag
  sed -i '' 's#</head>#<script async src="lib/scripts/hover-preview.js"></script>\n</head>#' "$file"
  
  echo "  Updated $file"
done

echo "All HTML files have been updated!" 