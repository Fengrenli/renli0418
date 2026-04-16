// 测试 GET API
console.log('测试 GET /api/projects...');

try {
  const response = await fetch('http://localhost:3800/api/projects');
  console.log('响应状态:', response.status);
  
  const text = await response.text();
  console.log('响应内容前200字符:', text.substring(0, 200));
  
  if (response.ok) {
    const result = JSON.parse(text);
    console.log('✅ GET API 成功！项目数:', result.data?.length);
  } else {
    console.log('❌ GET API 失败');
  }
} catch (error) {
  console.error('❌ 请求失败:', error.message);
}
