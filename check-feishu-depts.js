async function checkFeishu() {
  const baseUrl = 'http://localhost:3800/api';
  try {
    const res = await fetch(baseUrl + '/feishu-org-tree');
    const data = await res.json();
    console.log('Departments:', JSON.stringify(data.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
checkFeishu();
