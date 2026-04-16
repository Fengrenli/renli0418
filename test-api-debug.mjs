// 测试保存项目 API - 调试版
const testProject = {
  id: 'proj-1775203736057',
  name: '小龙坎朝鲜店',
  digitalAssets: [
    {
      id: 'asset-test-001',
      name: 'test-model.glb',
      type: 'model',
      url: '/uploads/proj-1775203736057/test-model.glb',
      size: '2.5 MB',
      uploadDate: '2026-04-09'
    }
  ]
};

console.log('测试保存项目 API...');
console.log('URL:', 'http://localhost:3800/api/save-project-detailed');

try {
  const response = await fetch('http://localhost:3800/api/save-project-detailed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testProject)
  });
  
  console.log('响应状态:', response.status);
  console.log('响应状态文本:', response.statusText);
  console.log('响应 headers:', Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log('响应内容:');
  console.log(text);
  
} catch (error) {
  console.error('❌ 请求失败:', error.message);
}
