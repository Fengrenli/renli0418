// 测试保存项目 API
async function testSaveApi() {
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
  console.log('请求数据:', JSON.stringify(testProject, null, 2));
  
  try {
    const response = await fetch('http://localhost:3800/api/save-project-detailed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProject)
    });
    
    const result = await response.json();
    console.log('响应:', result);
    
    if (result.success) {
      console.log('✅ API 测试成功！');
    } else {
      console.log('❌ API 返回错误:', result.msg);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

testSaveApi();
