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
    const basePath = document.querySelector('base')?.getAttribute('href') || './';
    return basePath;
  }
  
  // Resolve relative paths consistently
  function resolveUrl(href) {
    // If it's already an absolute URL, return it
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }
    
    // Get the base path
    const basePath = getBasePath();
    
    // Join paths, handling trailing slashes
    let url = basePath;
    if (url.endsWith('/') && href.startsWith('/')) {
      url = url + href.substring(1);
    } else if (!url.endsWith('/') && !href.startsWith('/')) {
      url = url + '/' + href;
    } else {
      url = url + href;
    }
    
    return url;
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
          targetHref = dataHref.toLowerCase().replace(/\s+/g, '-') + '.html';
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
      
      const response = await fetch(href);
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }
      
      const html = await response.text();
      
      // Parse the HTML to extract just the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the main content - looking for the markdown preview sizer
      let contentContainer = doc.querySelector('.markdown-preview-sizer');
      
      // If we can't find the sizer, try other common containers
      if (!contentContainer) {
        contentContainer = doc.querySelector('.markdown-preview-section') || 
                           doc.querySelector('.markdown-preview-view') ||
                           doc.querySelector('.document-container');
      }
      
      if (contentContainer) {
        // Remove any script tags for security
        const scripts = contentContainer.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Limit content length if too long
        let previewHTML = contentContainer.innerHTML;
        
        // Hide loading and show content
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        contentEl.innerHTML = previewHTML;
        
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