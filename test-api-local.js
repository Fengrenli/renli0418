// 测试本地 API
fetch('http://127.0.0.1:3800/api/projects')
  .then(res => res.json())
  .then(data => {
    const project = data.data.find(p => p.id === 'proj-1775203736057');
    if (project) {
      console.log('✅ 找到项目:', project.name);
      console.log('✅ digitalAssets 数量:', project.digitalAssets.length);
      console.log('✅ digitalAssets:', JSON.stringify(project.digitalAssets, null, 2));
      
      if (project.digitalAssets.length > 0) {
        console.log('\n🎉 成功！API 返回了正确的文件列表');
      } else {
        console.log('\n❌ 失败！API 返回空数组');
      }
    } else {
      console.log('❌ 未找到项目 proj-1775203736057');
    }
  })
  .catch(err => {
    console.error('❌ 请求失败:', err.message);
  });
