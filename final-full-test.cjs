const http = require('http');

function fetchJson(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, data: data.substring(0, 200) }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fullTest() {
  const base = 'http://127.0.0.1:3800/api';
  const results = [];

  // GET endpoints
  const gets = [
    ['projects', '/projects'],
    ['list-users', '/list-users'],
    ['list-campaign', '/list-campaign'],
    ['list-materials', '/list-materials'],
    ['list-brands', '/list-brands'],
    ['feishu-org-tree', '/feishu-org-tree'],
    ['feishu-members-all', '/feishu-members-all'],
  ];
  for (const [name, path] of gets) {
    try {
      const r = await fetchJson(base + path);
      const count = Array.isArray(r.data?.data) ? r.data.data.length : 'N/A';
      results.push(`GET ${name}: ${r.status} count=${count}`);
    } catch(e) { results.push(`GET ${name}: FAILED ${e.message}`); }
  }

  // POST: login
  try {
    const r = await fetchJson(base + '/login', 'POST', { username: 'admin', password: 'Renli2026' });
    results.push(`POST login: ${r.status} success=${r.data?.success} role=${r.data?.role}`);
  } catch(e) { results.push(`POST login: FAILED ${e.message}`); }

  // POST: geocode/resolve
  try {
    const r = await fetchJson(base + '/geocode/resolve', 'POST', { name: 'Berlin', location: 'Germany' });
    results.push(`POST geocode: ${r.status} success=${r.data?.success} lat=${r.data?.data?.best?.lat}`);
  } catch(e) { results.push(`POST geocode: FAILED ${e.message}`); }

  // Digital assets check
  try {
    const r = await fetchJson(base + '/project/proj-1774851876525');
    const assets = r.data?.data?.digitalAssets || [];
    results.push(`GET project-detail: ${r.status} assets=${assets.length} progress=${r.data?.data?.progress}`);
  } catch(e) { results.push(`GET project-detail: FAILED ${e.message}`); }

  console.log('\\n=== FULL SITE VERIFICATION ===');
  results.forEach(r => console.log(r.includes('FAILED') || r.includes('count=0') ? '❌ ' + r : '✅ ' + r));
  console.log('==============================');
}

fullTest();
