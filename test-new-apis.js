async function testApis() {
  const baseUrl = 'http://127.0.0.1:3800/api';
  
  const endpoints = [
    '/projects',
    '/feishu-members-all',
    '/feishu-org-tree',
    '/list-campaign',
    '/list-users'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(baseUrl + endpoint);
      const data = await res.json();
      console.log(`✅ ${endpoint}:`, {
        status: res.status,
        success: data.success,
        count: Array.isArray(data.data) ? data.data.length : 'N/A'
      });
      if (endpoint === '/feishu-members-all' && data.data.length > 0) {
        console.log('   Sample member:', data.data[0].name);
      }
    } catch (err) {
      console.log(`❌ ${endpoint}:`, err.message);
    }
  }
}

testApis();
