// Extract repository name from the current URL
const currentPath = window.location.pathname;
const pathSegments = currentPath.split('/').filter(part => part);
const repoName = pathSegments.length > 0 ? pathSegments[0] : '';

// If the path doesn't start with the repository name, add it
if (repoName && !n.pathname.startsWith('/' + repoName)) {
  n.pathname = '/' + repoName + n.pathname;
} 