async function testLogin() {
  const baseUrl = 'http://127.0.0.1:3800/api';
  try {
    console.log('Testing login with admin / Renli2026...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Renli2026' }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Login test failed:', err.message);
  }
}

testLogin();
