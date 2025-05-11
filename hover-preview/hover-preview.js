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
  let nestedPreviews = []; // Track nested previews
  
  // Create a map to store nested preview elements
  const previewsMap = new Map();
  
  // Check if we're just arriving from a clicked link and should hide any previews
  document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('linkClicked') === 'true') {
      hideAllPreviews();
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
    
    // Check if this link is inside a preview
    const isNested = link.closest('.hover-preview-content') !== null;
    
    link.addEventListener('mouseenter', function(e) {
      cancelHoverTimeout();
      
      // If this is a link inside a preview
      if (isNested) {
        // Create or retrieve a nested preview element
        let nestedPreviewEl = previewsMap.get(link);
        
        if (!nestedPreviewEl) {
          nestedPreviewEl = document.createElement('div');
          nestedPreviewEl.classList.add('hover-preview', 'nested-preview');
          nestedPreviewEl.style.display = 'none';
          document.body.appendChild(nestedPreviewEl);
          
          // Add loading state to nested preview
          const nestedLoadingEl = document.createElement('div');
          nestedLoadingEl.classList.add('hover-preview-loading');
          nestedLoadingEl.innerHTML = '<div></div><div></div><div></div><div></div>';
          nestedPreviewEl.appendChild(nestedLoadingEl);
          
          // Content container for nested preview
          const nestedContentEl = document.createElement('div');
          nestedContentEl.classList.add('hover-preview-content');
          nestedPreviewEl.appendChild(nestedContentEl);
          
          // Store it for future reference
          previewsMap.set(link, nestedPreviewEl);
          
          // Set up hover events for the nested preview
          nestedPreviewEl.addEventListener('mouseenter', function() {
            isHoveringPreview = true;
            cancelHidePreviewTimeout();
          });
          
          nestedPreviewEl.addEventListener('mouseleave', function() {
            isHoveringPreview = false;
            hidePreviewAfterDelay(nestedPreviewEl);
          });
        }
        
        // Use the nested preview instead of the main one
        currentLink = link;
        activePreview = link;
        nestedPreviews.push(nestedPreviewEl);
        
        // Set a timeout to show the nested preview
        hoverTimeout = setTimeout(() => {
          // Show the nested preview
          showPreview(link, nestedPreviewEl, nestedPreviewEl.querySelector('.hover-preview-loading'), nestedPreviewEl.querySelector('.hover-preview-content'));
        }, 300);
      } else {
        // Regular link (not inside a preview)
        currentLink = link;
        
        // Set a timeout to show the preview
        hoverTimeout = setTimeout(() => {
          // Hide any nested previews first
          hideNestedPreviews();
          
          // Store the active preview link for reference
          activePreview = link;
          
          // Show the main preview
          showPreview(link, previewEl, loadingEl, contentEl);
        }, 300); // Show preview after 300ms hover
      }
    });
    
    link.addEventListener('mouseleave', function(e) {
      // Only hide if not hovering the preview itself
      if (!isHoveringPreview) {
        cancelHoverTimeout();
        
        // If inside a preview, only hide the nested preview
        if (isNested) {
          if (nestedPreviews.length > 0) {
            const lastNestedPreview = nestedPreviews[nestedPreviews.length - 1];
            hidePreviewAfterDelay(lastNestedPreview);
          }
        } else {
          hidePreviewAfterDelay(previewEl);
        }
      }
    });
    
    // Add click handler to hide preview and store state
    link.addEventListener('click', function() {
      hideAllPreviews();
      sessionStorage.setItem('linkClicked', 'true');
    });
  }
  
  // Function to show a preview
  function showPreview(link, previewElement, loadingElement, contentElement) {
    const linkRect = link.getBoundingClientRect();
    
    // Default position (below and centered on the link)
    let top = linkRect.bottom + window.scrollY + 10;
    let left = linkRect.left + window.scrollX + (linkRect.width / 2) - 250; // 500px width / 2
    
    // Set initial position to calculate size
    previewElement.style.top = `${top}px`;
    previewElement.style.left = `${left}px`;
    previewElement.style.display = 'block';
    previewElement.classList.add('visible');
    
    // Wait a bit for the element to render, then adjust position
    setTimeout(() => {
      const previewRect = previewElement.getBoundingClientRect();
      const { x, y, isBelow } = positionElementInViewport(
        previewElement, 
        left, 
        top, 
        previewRect.width, 
        previewRect.height,
        true
      );
      
      // Update position
      previewElement.style.top = `${y}px`;
      previewElement.style.left = `${x}px`;
    }, 10);
    
    loadingElement.style.display = 'inline-block';
    contentElement.style.display = 'none';
    contentElement.innerHTML = '';
    
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
        contentElement.innerHTML = '<div class="preview-message">External link: ' + targetHref + '</div>';
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';
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
          contentElement.innerHTML = '<div class="preview-content">' + anchorElement.innerHTML + '</div>';
          loadingElement.style.display = 'none';
          contentElement.style.display = 'block';
          return;
        }
      }
    }
    
    // Resolve the URL to handle relative paths correctly
    targetHref = resolveUrl(targetHref);
    
    // Remove any hash or query parameters
    targetHref = targetHref.split('#')[0].split('?')[0];
    
    // Fetch and display the content
    fetchPreviewContent(targetHref, link, previewElement, loadingElement, contentElement);
  }
  
  // Handle hover events on the preview itself
  previewEl.addEventListener('mouseenter', function() {
    isHoveringPreview = true;
    cancelHidePreviewTimeout();
  });
  
  previewEl.addEventListener('mouseleave', function() {
    isHoveringPreview = false;
    if (nestedPreviews.length === 0) { // Only hide if there are no nested previews
      hidePreviewAfterDelay(previewEl);
    }
  });
  
  // Timeout to hide the preview
  let hideTimeout = null;
  
  function hidePreviewAfterDelay(previewElement) {
    cancelHidePreviewTimeout();
    hideTimeout = setTimeout(() => {
      if (previewElement === previewEl) {
        // Hide main preview and all nested previews
        hideAllPreviews();
      } else {
        // Just hide this specific nested preview
        hidePreview(previewElement);
        // Remove from nested previews array
        const index = nestedPreviews.indexOf(previewElement);
        if (index !== -1) {
          nestedPreviews.splice(index, 1);
        }
      }
    }, 300); // Hide after 300ms
  }
  
  function hideAllPreviews() {
    // Hide main preview
    hidePreview(previewEl);
    // Hide all nested previews
    hideNestedPreviews();
    // Reset tracking variables
    currentLink = null;
    activePreview = null;
  }
  
  function hideNestedPreviews() {
    // Hide all nested previews
    nestedPreviews.forEach(preview => {
      hidePreview(preview);
    });
    nestedPreviews = [];
  }
  
  function hidePreview(previewElement) {
    previewElement.classList.remove('visible');
    setTimeout(() => {
      previewElement.style.display = 'none';
    }, 150); // Wait for opacity transition to complete
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
  async function fetchPreviewContent(href, link, previewElement, loadingElement, contentElement) {
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
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';
        contentElement.innerHTML = wrapper.innerHTML;
        
        // Adjust position again after content is loaded
        setTimeout(() => {
          // Make sure the link is still valid
          if (link && document.body.contains(link)) {
            const previewRect = previewElement.getBoundingClientRect();
            const linkRect = link.getBoundingClientRect();
            const top = linkRect.bottom + window.scrollY + 10;
            const left = linkRect.left + window.scrollX + (linkRect.width / 2) - 250;
            
            const { x, y, isBelow } = positionElementInViewport(
              previewElement, 
              left, 
              top, 
              previewRect.width, 
              previewRect.height,
              true
            );
            
            // Update position
            previewElement.style.top = `${y}px`;
            previewElement.style.left = `${x}px`;
          }
        }, 10);
        
        // Make internal links in the preview also have hover functionality
        const previewLinks = contentElement.querySelectorAll('.internal-link');
        previewLinks.forEach(link => {
          setupLinkHover(link);
        });
      } else {
        contentElement.innerHTML = '<div class="preview-error">No preview available</div>';
        loadingElement.style.display = 'none';
        contentElement.style.display = 'block';
      }
    } catch (error) {
      contentElement.innerHTML = '<div class="preview-error">Error loading preview</div>';
      loadingElement.style.display = 'none';
      contentElement.style.display = 'block';
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
    hideAllPreviews();
  });
  
  // Hide previews when clicking elsewhere on the page
  document.addEventListener('click', function(e) {
    // Check if the click is outside of any preview or link
    if (!e.target.closest('.hover-preview') && !e.target.closest('.internal-link')) {
      hideAllPreviews();
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