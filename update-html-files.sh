#!/bin/bash

# This script updates the hover preview functionality in all HTML files

# Make sure the necessary directories exist
mkdir -p lib/styles
mkdir -p lib/scripts

# Ensure hover preview files exist by recreating them
cat > lib/scripts/hover-preview.js << 'EOF'
/**
 * Obsidian-like Hover Preview functionality
 * This script adds the ability to hover over internal links and see a preview of the linked content
 */

// Wait for the page to fully load
document.addEventListener('DOMContentLoaded', function() {
  initializeHoverPreview();
});

// Initialize immediately if the document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeHoverPreview();
}

function initializeHoverPreview() {
  // Prevent multiple initializations
  if (window.hoverPreviewInitialized) return;
  window.hoverPreviewInitialized = true;

  // Create the preview element that will be shown when hovering over links
  const previewEl = document.createElement('div');
  previewEl.classList.add('hover-preview');
  previewEl.style.display = 'none';
  document.body.appendChild(previewEl);
  
  // Add loading state
  const loadingEl = document.createElement('div');
  loadingEl.classList.add('hover-preview-loading');
  loadingEl.innerHTML = '<div></div><div></div><div></div><div></div>';
  previewEl.appendChild(loadingEl);
  
  // Content container
  const contentEl = document.createElement('div');
  contentEl.classList.add('hover-preview-content');
  previewEl.appendChild(contentEl);
  
  // Track hover state
  let currentLink = null;
  let isHoveringPreview = false;
  let hoverTimeout = null;
  let activePreview = null; // Track the currently active preview
  
  // Check if we're just arriving from a clicked link and should hide any previews
  document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('linkClicked') === 'true') {
      hidePreview();
      sessionStorage.removeItem('linkClicked');
    }
  });
  
  // Find all internal links in the document
  function findAndProcessLinks() {
    // Process internal links that match the Obsidian export format
    const allLinks = document.querySelectorAll('.internal-link');
    
    // Also look for text containing [[...]] patterns that aren't already links
    const textNodes = getTextNodesWithBrackets(document.body);
    
    // Process regular internal links
    allLinks.forEach(link => {
      setupLinkHover(link);
    });
    
    // Process bracket links in text
    processTextNodesWithBrackets(textNodes);
  }
  
  // Get base URL for resolving relative paths
  function getBasePath() {
    // First check for a base tag
    const baseTag = document.querySelector('base');
    if (baseTag && baseTag.getAttribute('href')) {
      return baseTag.getAttribute('href');
    }
    
    // Determine the base path from the current URL
    const url = window.location;
    
    // Extract the pathname parts
    const pathnameParts = url.pathname.split('/');
    
    // GitHub Pages structure: /repository-name/... 
    // We need to preserve this structure in our path resolution
    
    // Remove the filename from the path
    if (pathnameParts[pathnameParts.length - 1].includes('.')) {
      pathnameParts.pop();
    }
    
    // Join the path parts and ensure it ends with a slash
    let basePath = pathnameParts.join('/');
    if (!basePath.endsWith('/')) {
      basePath += '/';
    }
    
    console.log('Detected base path:', basePath);
    return basePath;
  }
  
  // Resolve relative paths consistently
  function resolveUrl(href) {
    // If it's already an absolute URL, return it
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }
    
    // Get the URL parts
    const origin = window.location.origin; // e.g. https://kfilanowski.github.io
    const fullPath = window.location.pathname; // e.g. /Page-Test/some/path.html
    
    console.log('Resolving URL:', { origin, fullPath, href });
    
    // Extract the repository name from pathname
    const pathSegments = fullPath.split('/').filter(part => part);
    const repoName = pathSegments.length > 0 ? pathSegments[0] : '';
    
    // Handle absolute paths (starting with /)
    if (href.startsWith('/')) {
      return `${origin}${href}`;
    }
    
    // For Obsidian-style links that might start with the root path components
    // First check if the href matches a pattern that suggests it's a full path from repo root
    // e.g. "core-rules,-how-to-play/attacking/attack.html"
    
    // Check if href starts with common top-level directories
    const isFullPathFromRoot = href.startsWith('core-rules') || 
                              href.startsWith('templates/') || 
                              href.includes('/-') ||
                              pathSegments.some(segment => href.startsWith(segment + '/'));
    
    if (isFullPathFromRoot) {
      // It's likely a path from the repo root, so just append to origin/repoName
      const resolvedUrl = `${origin}/${repoName}/${href}`;
      console.log('Resolved as full path from root:', resolvedUrl);
      return resolvedUrl;
    }
    
    // Otherwise, it's a path relative to the current directory
    // Get the current directory path
    const dirPathParts = fullPath.split('/');
    // Remove the filename
    dirPathParts.pop();
    const currentDir = dirPathParts.join('/');
    
    // Remove leading ./ if present
    if (href.startsWith('./')) {
      href = href.substring(2);
    }
    
    // Join the parts together with a slash in between
    const resolvedUrl = `${origin}${currentDir}/${href}`;
    
    console.log('Resolved as relative to current dir:', resolvedUrl);
    
    return resolvedUrl;
  }
  
  // Position the element within the viewport bounds
  function positionElementInViewport(element, x, y, width, height, pointsUp = false) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Check if the element would go outside the right edge
    if (x + width > viewportWidth - 20) {
      x = viewportWidth - width - 20;
    }
    
    // Check if the element would go outside the left edge
    if (x < 20) {
      x = 20;
    }
    
    // First try to position below
    let finalY = y;
    let isBelow = true;
    
    // If it would go below the viewport, try to position it above the link
    if (y + height > viewportHeight - 20) {
      const spaceAbove = y - height - 30; // Account for pointer and some margin
      if (spaceAbove > 20) {
        finalY = spaceAbove;
        isBelow = false;
      } else {
        // If there's not enough space above, position it at the top with scrolling
        finalY = 20;
      }
    }
    
    // Update arrow position based on whether we're above or below
    if (pointsUp) {
      element.classList.toggle('points-up', !isBelow);
      element.classList.toggle('points-down', isBelow);
    }
    
    // Return the adjusted position
    return { x, y: finalY, isBelow };
  }
  
  // Set up hover behavior for a link
  function setupLinkHover(link) {
    // Skip if already processed
    if (link.hasAttribute('data-hover-processed')) return;
    link.setAttribute('data-hover-processed', 'true');
    
    link.addEventListener('mouseenter', function(e) {
      cancelHoverTimeout();
      
      currentLink = link;
      
      // Set a timeout to show the preview (to avoid flickering on quick mouse movements)
      hoverTimeout = setTimeout(() => {
        const linkRect = link.getBoundingClientRect();
        
        // Default position (below and centered on the link)
        let top = linkRect.bottom + window.scrollY + 10;
        let left = linkRect.left + window.scrollX + (linkRect.width / 2) - 250; // 500px width / 2
        
        // Store the active preview link for reference
        activePreview = link;
        
        // Set initial position to calculate size
        previewEl.style.top = `${top}px`;
        previewEl.style.left = `${left}px`;
        previewEl.style.display = 'block';
        previewEl.classList.add('visible');
        
        // Wait a bit for the element to render, then adjust position
        setTimeout(() => {
          const previewRect = previewEl.getBoundingClientRect();
          const { x, y, isBelow } = positionElementInViewport(
            previewEl, 
            left, 
            top, 
            previewRect.width, 
            previewRect.height,
            true
          );
          
          // Update position
          previewEl.style.top = `${y}px`;
          previewEl.style.left = `${x}px`;
        }, 10);
        
        loadingEl.style.display = 'inline-block';
        contentEl.style.display = 'none';
        contentEl.innerHTML = '';
        
        // Get the target href
        let targetHref = link.getAttribute('href');
        
        // If there's no href, try data-href (used in some Obsidian exports)
        if (!targetHref && link.hasAttribute('data-href')) {
          // Convert data-href (like "Attack") to a file path
          const dataHref = link.getAttribute('data-href');
          targetHref = dataHref.replace(/\s+/g, '-').toLowerCase() + '.html';
        }
        
        // Skip if the link is to an external site
        if (targetHref && (targetHref.startsWith('http://') || targetHref.startsWith('https://'))) {
          if (!targetHref.includes(window.location.hostname)) {
            contentEl.innerHTML = '<div class="preview-message">External link: ' + targetHref + '</div>';
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            return;
          }
        }
        
        // Skip if the link has a hash (it's an anchor link)
        if (targetHref && targetHref.includes('#') && !targetHref.startsWith('#')) {
          const hashParts = targetHref.split('#');
          const currentPage = window.location.pathname.split('/').pop();
          
          // If it's a link to an anchor in the current page
          if (hashParts[0] === currentPage || hashParts[0] === '') {
            const anchorId = hashParts[1];
            const anchorElement = document.getElementById(anchorId);
            
            if (anchorElement) {
              contentEl.innerHTML = '<div class="preview-content">' + anchorElement.innerHTML + '</div>';
              loadingEl.style.display = 'none';
              contentEl.style.display = 'block';
              return;
            }
          }
        }
        
        // Resolve the URL to handle relative paths correctly
        targetHref = resolveUrl(targetHref);
        
        // Remove any hash or query parameters
        targetHref = targetHref.split('#')[0].split('?')[0];
        
        // Fetch and display the content
        fetchPreviewContent(targetHref);
      }, 300); // Show preview after 300ms hover
    });
    
    link.addEventListener('mouseleave', function(e) {
      // Only hide if not hovering the preview itself
      if (!isHoveringPreview) {
        cancelHoverTimeout();
        hidePreviewAfterDelay();
      }
    });
    
    // Add click handler to hide preview and store state
    link.addEventListener('click', function() {
      hidePreview();
      sessionStorage.setItem('linkClicked', 'true');
    });
  }
  
  // Handle hover events on the preview itself
  previewEl.addEventListener('mouseenter', function() {
    isHoveringPreview = true;
    cancelHidePreviewTimeout();
  });
  
  previewEl.addEventListener('mouseleave', function() {
    isHoveringPreview = false;
    hidePreviewAfterDelay();
  });
  
  // Timeout to hide the preview
  let hideTimeout = null;
  
  function hidePreviewAfterDelay() {
    cancelHidePreviewTimeout();
    hideTimeout = setTimeout(() => {
      hidePreview();
    }, 300); // Hide after 300ms
  }
  
  function hidePreview() {
    previewEl.classList.remove('visible');
    setTimeout(() => {
      previewEl.style.display = 'none';
    }, 150); // Wait for opacity transition to complete
    currentLink = null;
    activePreview = null;
  }
  
  function cancelHidePreviewTimeout() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }
  
  function cancelHoverTimeout() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  }
  
  // Fetch the content of the linked page
  async function fetchPreviewContent(href) {
    try {
      // If href doesn't end with .html, add it
      if (!href.endsWith('.html')) {
        href = href + '.html';
      }
      
      console.log('Fetching preview content from:', href);
      
      const response = await fetch(href);
      if (!response.ok) {
        console.error('Failed to fetch content:', response.status, response.statusText);
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log('Content fetched, length:', html.length);
      
      // Parse the HTML to extract just the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to find the title first
      const title = doc.querySelector('title')?.textContent || '';
      
      // Find the main content using various selectors that might be present
      let contentContainer = doc.querySelector('.markdown-preview-sizer');
      
      // If we can't find the sizer, try other common containers
      if (!contentContainer) {
        // Try Obsidian-specific classes first
        contentContainer = doc.querySelector('.markdown-preview-section') || 
                           doc.querySelector('.markdown-preview-view') ||
                           doc.querySelector('.document-container');
      }
      
      // If still not found, try generic content containers
      if (!contentContainer) {
        contentContainer = doc.querySelector('main') ||
                          doc.querySelector('article') ||
                          doc.querySelector('.content') ||
                          doc.querySelector('#content');
      }
      
      // Last resort: look for specific elements that might indicate content
      if (!contentContainer) {
        // Find the element with the most paragraph tags
        const allElements = Array.from(doc.body.querySelectorAll('div'));
        let bestElement = null;
        let maxParagraphs = 0;
        
        for (const el of allElements) {
          const paragraphs = el.querySelectorAll('p').length;
          if (paragraphs > maxParagraphs) {
            maxParagraphs = paragraphs;
            bestElement = el;
          }
        }
        
        if (bestElement && maxParagraphs > 0) {
          contentContainer = bestElement;
        } else {
          // If all else fails, just use the body
          contentContainer = doc.body;
        }
      }
      
      if (contentContainer) {
        // Create a wrapper with the title
        const wrapper = document.createElement('div');
        
        // Only add title if we found one and not using body as container
        if (title && contentContainer !== doc.body) {
          const titleEl = document.createElement('h1');
          titleEl.textContent = title;
          titleEl.classList.add('preview-title');
          wrapper.appendChild(titleEl);
        }
        
        // Remove any script tags for security
        const scripts = contentContainer.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Clone the content
        const contentClone = contentContainer.cloneNode(true);
        
        // Append the content
        wrapper.appendChild(contentClone);
        
        // Hide loading and show content
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        contentEl.innerHTML = wrapper.innerHTML;
        
        // Adjust position again after content is loaded
        setTimeout(() => {
          // Only adjust position if this is still the active preview
          if (currentLink === activePreview) {
            const previewRect = previewEl.getBoundingClientRect();
            const linkRect = currentLink.getBoundingClientRect();
            const top = linkRect.bottom + window.scrollY + 10;
            const left = linkRect.left + window.scrollX + (linkRect.width / 2) - 250;
            
            const { x, y, isBelow } = positionElementInViewport(
              previewEl, 
              left, 
              top, 
              previewRect.width, 
              previewRect.height,
              true
            );
            
            // Update position
            previewEl.style.top = `${y}px`;
            previewEl.style.left = `${x}px`;
          }
        }, 10);
        
        // Make internal links in the preview also have hover functionality
        const previewLinks = contentEl.querySelectorAll('.internal-link');
        previewLinks.forEach(link => {
          setupLinkHover(link);
        });
      } else {
        contentEl.innerHTML = '<div class="preview-error">No preview available</div>';
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
      }
    } catch (error) {
      contentEl.innerHTML = '<div class="preview-error">Error loading preview</div>';
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }
  
  // Find text nodes that contain [[...]] patterns
  function getTextNodesWithBrackets(node) {
    const textNodes = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    
    let textNode;
    while (textNode = walker.nextNode()) {
      if (textNode.nodeValue.includes('[[') && textNode.nodeValue.includes(']]')) {
        textNodes.push(textNode);
      }
    }
    
    return textNodes;
  }
  
  // Process text nodes with [[...]] to make them hoverable
  function processTextNodesWithBrackets(textNodes) {
    textNodes.forEach(node => {
      if (node.parentNode.tagName === 'SCRIPT' || 
          node.parentNode.tagName === 'STYLE' ||
          node.parentNode.closest('.hover-preview')) {
        return; // Skip script and style tags, and nodes inside the preview itself
      }
      
      const text = node.nodeValue;
      const regex = /\[\[([^\]]+)\]\]/g;
      let match;
      let lastIndex = 0;
      const fragments = [];
      
      while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        
        // Create link for the match
        const linkText = match[1];
        const linkHref = linkText.replace(/\s+/g, '-').toLowerCase() + '.html';
        
        const link = document.createElement('a');
        link.textContent = linkText;
        link.classList.add('internal-link', 'bracket-link');
        link.setAttribute('href', linkHref);
        link.setAttribute('data-href', linkText);
        link.setAttribute('data-original-text', `[[${linkText}]]`);
        fragments.push(link);
        
        // Setup hover behavior for this link
        setupLinkHover(link);
        
        lastIndex = regex.lastIndex;
      }
      
      // Add remaining text after the last match
      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace the original text node with the fragments
      if (fragments.length > 1) {
        const parent = node.parentNode;
        fragments.forEach(fragment => {
          parent.insertBefore(fragment, node);
        });
        parent.removeChild(node);
      }
    });
  }
  
  // Handle window resize events
  window.addEventListener('resize', function() {
    // Hide preview on resize to avoid position issues
    if (previewEl.style.display !== 'none') {
      previewEl.classList.remove('visible');
      previewEl.style.display = 'none';
    }
  });
  
  // Handle page unload events to clean up
  window.addEventListener('beforeunload', function() {
    // Hide any active previews
    hidePreview();
  });
  
  // Hide previews when clicking elsewhere on the page
  document.addEventListener('click', function(e) {
    // Check if the click is outside of any preview or link
    if (!e.target.closest('.hover-preview') && !e.target.closest('.internal-link')) {
      hidePreview();
    }
  });
  
  // Initial call to process links
  findAndProcessLinks();
  
  // Set up a mutation observer to process new links that might be added dynamically
  const observer = new MutationObserver(mutations => {
    let shouldProcess = false;
    
    mutations.forEach(mutation => {
      // Only process if new nodes were added
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
      }
    });
    
    if (shouldProcess) {
      findAndProcessLinks();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
} 
EOF

cat > lib/styles/hover-preview.css << 'EOF'
/* Hover Preview Styles */

.hover-preview {
  position: absolute;
  z-index: 9999;
  width: 500px;
  max-width: 90vw;
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 15px;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.9em;
  line-height: 1.5;
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: auto !important;
  box-sizing: border-box;
}

.hover-preview.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Preview title */
.preview-title {
  margin-top: 0;
  margin-bottom: 0.8em;
  font-size: 1.2em;
  padding-bottom: 0.5em;
  border-bottom: 1px solid var(--background-modifier-border);
}

/* Arrow pointing down (when preview is above link) */
.hover-preview.points-up::after {
  content: "";
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid var(--background-primary);
  z-index: 1;
}

/* Arrow pointing up (when preview is below link) */
.hover-preview.points-down::after {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid var(--background-primary);
  z-index: 1;
}

/* Loading animation */
.hover-preview-loading {
  display: inline-block;
  position: relative;
  width: 80px;
  height: 40px;
  margin: 20px auto;
  text-align: center;
}

.hover-preview-loading div {
  display: inline-block;
  position: absolute;
  top: 15px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--interactive-accent);
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}

.hover-preview-loading div:nth-child(1) {
  left: 8px;
  animation: hover-preview-loading1 0.6s infinite;
}

.hover-preview-loading div:nth-child(2) {
  left: 8px;
  animation: hover-preview-loading2 0.6s infinite;
}

.hover-preview-loading div:nth-child(3) {
  left: 32px;
  animation: hover-preview-loading2 0.6s infinite;
}

.hover-preview-loading div:nth-child(4) {
  left: 56px;
  animation: hover-preview-loading3 0.6s infinite;
}

@keyframes hover-preview-loading1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes hover-preview-loading3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes hover-preview-loading2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(24px, 0);
  }
}

/* Content styles */
.hover-preview-content {
  position: relative;
}

.hover-preview-content img {
  max-width: 100%;
  height: auto;
}

.hover-preview-content * {
  max-width: 100%;
}

/* Handle headings */
.hover-preview-content h1,
.hover-preview-content h2,
.hover-preview-content h3,
.hover-preview-content h4,
.hover-preview-content h5,
.hover-preview-content h6 {
  margin-top: 0.5em;
  margin-bottom: 0.3em;
}

/* Handle code blocks */
.hover-preview-content pre,
.hover-preview-content code {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* Handle tables */
.hover-preview-content table {
  width: 100%;
  display: block;
  overflow-x: auto;
}

.hover-preview .preview-error {
  color: var(--text-error);
  text-align: center;
  padding: 15px;
  font-style: italic;
}

.hover-preview .preview-message {
  color: var(--text-normal);
  text-align: center;
  padding: 15px;
  font-style: italic;
}

.hover-preview .preview-content {
  padding: 5px;
}

/* Bracket link styling */
.internal-link.bracket-link {
  color: var(--text-accent);
  text-decoration: none;
  border-bottom: 1px dotted var(--text-accent);
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.internal-link.bracket-link:hover {
  color: var(--text-accent-hover);
  border-bottom-color: var(--text-accent-hover);
}

/* Override any global styles that might interfere */
.internal-link {
  position: relative;
}

/* Fix theme-specific compatibility issues */
body.theme-dark .hover-preview {
  background-color: var(--background-primary, #2d3032);
  color: var(--text-normal, #dcddde);
}

body.theme-light .hover-preview {
  background-color: var(--background-primary, #ffffff);
  color: var(--text-normal, #2e3338);
} 
EOF

echo "Hover preview files have been created/updated."

# Find all HTML files in the current directory and subdirectories
find . -type f -name "*.html" | while read -r file; do
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

echo "All HTML files have been updated!" 