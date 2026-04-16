// 测试本地飞书 API
async function testLocalFeishu() {
  try {
    console.log('🧪 测试本地飞书 API...');
    
    // 测试 feishu-members-all
    console.log('\n1. 测试 /api/feishu-members-all');
    const res1 = await fetch('http://localhost:3800/api/feishu-members-all');
    const json1 = await res1.json();
    console.log('  状态:', res1.status);
    console.log('  响应:', JSON.stringify(json1, null, 2));
    
    // 测试 feishu-members-by-dept（无部门ID）
    console.log('\n2. 测试 /api/feishu-members-by-dept（无部门ID）');
    const res2 = await fetch('http://localhost:3800/api/feishu-members-by-dept');
    const json2 = await res2.json();
    console.log('  状态:', res2.status);
    console.log('  响应:', JSON.stringify(json2, null, 2));
    
    // 测试 feishu-org-tree
    console.log('\n3. 测试 /api/feishu-org-tree');
    const res3 = await fetch('http://localhost:3800/api/feishu-org-tree');
    const json3 = await res3.json();
    console.log('  状态:', res3.status);
    console.log('  响应:', JSON.stringify(json3, null, 2));
    
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  }
}

testLocalFeishu();
