// 测试 API 返回的数据
async function testApi() {
  try {
    console.log('🧪 测试 /api/projects 接口...');
    
    const response = await fetch('https://www.renliyesheng.net/api/projects');
    const data = await response.json();
    
    console.log('✅ API 响应状态:', data.code);
    console.log('📊 项目总数:', data.data.length);
    
    // 找到朝鲜店项目
    const project = data.data.find(p => p.id === 'proj-1775203736057');
    
    if (project) {
      console.log('\n📋 朝鲜店项目信息:');
      console.log('  ID:', project.id);
      console.log('  名称:', project.name);
      console.log('  digitalAssets:', JSON.stringify(project.digitalAssets));
      console.log('  digitalAssets 长度:', project.digitalAssets?.length || 0);
      console.log('  stages:', JSON.stringify(project.stages));
      console.log('  teamMembers:', JSON.stringify(project.teamMembers));
      console.log('  progress:', project.progress);
      
      // 检查是否有 digital_assets 字段（下划线）
      console.log('\n🔍 检查原始字段:');
      console.log('  是否有 digital_assets:', 'digital_assets' in project);
      console.log('  是否有 digitalAssets:', 'digitalAssets' in project);
      
      // 打印所有字段名
      console.log('\n📋 所有字段名:');
      Object.keys(project).forEach(key => {
        console.log('  -', key);
      });
    } else {
      console.log('❌ 未找到朝鲜店项目');
    }
    
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  }
}

testApi();
