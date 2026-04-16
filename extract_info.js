(async () => {
  const result = {
    title: document.title,
    url: window.location.href,
    projectName: '',
    assetFiles: [],
    links: [],
    projectId: null
  };

  // Try to find project name
  // Common patterns for project names in UI
  const projectHeaders = Array.from(document.querySelectorAll('h1, h2, h3, .project-name, [id*="project-name"]'));
  result.projectName = projectHeaders[0]?.innerText?.trim() || '';

  // Look for project ID in URL or body
  const urlParams = new URLSearchParams(window.location.search);
  result.projectId = urlParams.get('id') || urlParams.get('projectId');
  
  if (!result.projectId) {
     const match = window.location.href.match(/\/project\/(\d+)/) || window.location.href.match(/\/(\d+)\//);
     if (match) result.projectId = match[1];
  }

  // Look for digital assets (filenames)
  // Assuming they are in a list or table
  const assetArea = Array.from(document.querySelectorAll('.asset-list, .file-list, table, ul, .digital-assets'));
  assetArea.forEach(area => {
    const text = area.innerText;
    // This is very generic, let's refine later if needed
  });

  // Collect all text for manual review if snapshot fails
  result.allText = document.body.innerText.substring(0, 5000);

  // Look for preview/download links
  const links = Array.from(document.querySelectorAll('a[href*="download"], a[href*="preview"], button[onclick*="download"]'));
  result.links = links.map(a => ({ text: a.innerText, href: a.href || a.getAttribute('onclick') }));

  return result;
})()