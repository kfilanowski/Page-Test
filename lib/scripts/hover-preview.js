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
    
    // Extract the repository name from pathname
    const pathSegments = fullPath.split('/').filter(part => part);
    const repoName = pathSegments.length > 0 ? pathSegments[0] : '';
    
    console.log('URL components:', { 
      origin, 
      fullPath, 
      repoName 
    });
    
    // Handle absolute paths (starting with /)
    if (href.startsWith('/')) {
      return `${origin}${href}`;
    }
    
    // Handle relative paths
    // For paths without directory separators, treat them as in the current directory
    if (!href.includes('/')) {
      // Get the current directory path
      const dirPathParts = fullPath.split('/');
      // Remove the filename
      dirPathParts.pop();
      const currentDir = dirPathParts.join('/');
      
      const resolvedUrl = `${origin}${currentDir}/${href}`;
      
      console.log('Resolving relative URL:', {
        href,
        fullPath,
        currentDir,
        resolved: resolvedUrl
      });
      
      return resolvedUrl;
    }
    
    // For other relative paths, construct the URL properly
    // First get the directory of the current page
    const fullPathParts = fullPath.split('/');
    // Remove the filename
    fullPathParts.pop();
    const currentDir = fullPathParts.join('/');
    
    // Remove leading ./ if present
    if (href.startsWith('./')) {
      href = href.substring(2);
    }
    
    // Join the parts together with a slash in between
    const resolvedUrl = `${origin}${currentDir}/${href}`;
    
    console.log('Resolved URL:', { 
      original: href, 
      origin: origin,
      currentDir: currentDir, 
      resolved: resolvedUrl 
    });
    
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
      previewEl.classList.remove('visible');
      setTimeout(() => {
        previewEl.style.display = 'none';
      }, 150); // Wait for opacity transition to complete
      currentLink = null;
    }, 300); // Hide after 300ms
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