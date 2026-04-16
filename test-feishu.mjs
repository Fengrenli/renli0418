// 测试飞书 API 连通性
import dotenv from 'dotenv';
dotenv.config();

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

console.log('🔍 飞书配置检查:');
console.log('  App ID:', FEISHU_APP_ID ? '已配置' : '未配置');
console.log('  App Secret:', FEISHU_APP_SECRET ? '已配置' : '未配置');

async function testFeishuAPI() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    console.error('❌ 飞书配置缺失');
    return;
  }

  try {
    // 1. 获取 tenant_access_token
    console.log('\n📝 步骤1: 获取 tenant_access_token...');
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });
    
    const tokenData = await tokenRes.json();
    console.log('  Token 响应:', JSON.stringify(tokenData, null, 2));
    
    if (tokenData.code !== 0 || !tokenData.tenant_access_token) {
      console.error('❌ 获取 Token 失败:', tokenData.msg);
      return;
    }
    
    const token = tokenData.tenant_access_token;
    console.log('✅ Token 获取成功');
    
    // 2. 测试获取用户列表
    console.log('\n📝 步骤2: 测试获取用户列表...');
    const usersRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/users?page_size=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const usersData = await usersRes.json();
    console.log('  用户列表响应:', JSON.stringify(usersData, null, 2));
    
    if (usersData.code !== 0) {
      console.error('❌ 获取用户列表失败:', usersData.msg);
      return;
    }
    
    console.log('✅ 飞书 API 测试成功！');
    console.log('  用户数量:', usersData.data?.items?.length || 0);
    
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  }
}

testFeishuAPI();
