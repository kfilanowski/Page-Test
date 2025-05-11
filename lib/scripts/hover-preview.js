/**
 * Obsidian-like Hover Preview functionality
 * This script adds the ability to hover over internal links and see a preview of the linked content
 */

// Wait for the page to fully load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Hover preview script loaded and DOM content loaded');
  initializeHoverPreview();
});

function initializeHoverPreview() {
  console.log('Initializing hover preview functionality');
  
  // Create the preview element that will be shown when hovering over links
  const previewEl = document.createElement('div');
  previewEl.classList.add('hover-preview');
  previewEl.style.display = 'none';
  document.body.appendChild(previewEl);
  console.log('Preview element created and added to body');
  
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
    // Process internal links (both .internal-link class and bracket link syntax)
    const allLinks = document.querySelectorAll('.internal-link, a[href]:not([href^="http"]):not([href^="#"]):not([href^="/"]):not(.external-link)');
    console.log('Found links to process:', allLinks.length);
    
    // Also look for text containing [[...]] patterns that aren't already links
    const textNodes = getTextNodesWithBrackets(document.body);
    console.log('Found text nodes with brackets:', textNodes.length);
    
    // Process regular internal links
    allLinks.forEach(link => {
      setupLinkHover(link);
    });
    
    // Process bracket links in text
    processTextNodesWithBrackets(textNodes);
  }
  
  // Set up hover behavior for a link
  function setupLinkHover(link) {
    // Skip if already processed
    if (link.hasAttribute('data-hover-processed')) return;
    link.setAttribute('data-hover-processed', 'true');
    
    console.log('Setting up hover for link:', link.textContent, link.getAttribute('href'));
    
    link.addEventListener('mouseenter', function(e) {
      console.log('Mouse entered link:', link.textContent);
      cancelHoverTimeout();
      
      currentLink = link;
      
      // Set a timeout to show the preview (to avoid flickering on quick mouse movements)
      hoverTimeout = setTimeout(() => {
        console.log('Hover timeout triggered for:', link.textContent);
        const linkRect = link.getBoundingClientRect();
        
        // Position the preview below and centered on the link
        const top = linkRect.bottom + window.scrollY + 10;
        const left = linkRect.left + window.scrollX + (linkRect.width / 2) - 250; // 500px width / 2
        
        previewEl.style.top = `${top}px`;
        previewEl.style.left = `${left}px`;
        
        // Show the preview element
        previewEl.style.display = 'block';
        previewEl.classList.add('visible'); // Add visible class for opacity transition
        loadingEl.style.display = 'inline-block';
        contentEl.style.display = 'none';
        contentEl.innerHTML = '';
        
        // Get the target href
        let targetHref = link.getAttribute('href');
        console.log('Fetching content for:', targetHref);
        
        // Remove any hash or query parameters
        targetHref = targetHref.split('#')[0].split('?')[0];
        
        // Fetch and display the content
        fetchPreviewContent(targetHref);
      }, 300); // Show preview after 300ms hover
    });
    
    link.addEventListener('mouseleave', function(e) {
      console.log('Mouse left link:', link.textContent);
      // Only hide if not hovering the preview itself
      if (!isHoveringPreview) {
        cancelHoverTimeout();
        hidePreviewAfterDelay();
      }
    });
  }
  
  // Handle hover events on the preview itself
  previewEl.addEventListener('mouseenter', function() {
    console.log('Mouse entered preview');
    isHoveringPreview = true;
    cancelHidePreviewTimeout();
  });
  
  previewEl.addEventListener('mouseleave', function() {
    console.log('Mouse left preview');
    isHoveringPreview = false;
    hidePreviewAfterDelay();
  });
  
  // Timeout to hide the preview
  let hideTimeout = null;
  
  function hidePreviewAfterDelay() {
    cancelHidePreviewTimeout();
    hideTimeout = setTimeout(() => {
      console.log('Hiding preview after delay');
      previewEl.classList.remove('visible'); // Remove visible class for opacity transition
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
      
      console.log('Fetching from URL:', href);
      const response = await fetch(href);
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }
      
      const html = await response.text();
      console.log('Content fetched, length:', html.length);
      
      // Parse the HTML to extract just the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the main content - looking for the markdown preview sizer
      const contentContainer = doc.querySelector('.markdown-preview-sizer');
      
      if (contentContainer) {
        console.log('Content container found');
        // Remove any script tags for security
        const scripts = contentContainer.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Limit content length if too long
        let previewHTML = contentContainer.innerHTML;
        
        // Hide loading and show content
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        contentEl.innerHTML = previewHTML;
        
        // Make internal links in the preview also have hover functionality
        const previewLinks = contentEl.querySelectorAll('.internal-link');
        previewLinks.forEach(link => {
          setupLinkHover(link);
        });
      } else {
        console.log('Content container not found');
        contentEl.innerHTML = '<div class="preview-error">No preview available</div>';
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
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
        
        console.log('Created bracket link for:', linkText, 'href:', linkHref);
        
        const link = document.createElement('a');
        link.textContent = linkText;
        link.classList.add('internal-link', 'bracket-link');
        link.setAttribute('href', linkHref);
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
        console.log('Replaced text node with fragments containing links');
      }
    });
  }
  
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
      console.log('Detected new content, reprocessing links');
      findAndProcessLinks();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
  console.log('Mutation observer started');
} 