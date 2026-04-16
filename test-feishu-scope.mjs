// 测试飞书通讯录权限
import dotenv from 'dotenv';
dotenv.config();

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

console.log('🔍 飞书配置检查:');
console.log('  App ID:', FEISHU_APP_ID ? '已配置' : '未配置');
console.log('  App Secret:', FEISHU_APP_SECRET ? '已配置' : '未配置');

async function testFeishuScopes() {
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
    if (tokenData.code !== 0) {
      console.error('❌ 获取 Token 失败:', tokenData.msg);
      return;
    }
    
    const token = tokenData.tenant_access_token;
    console.log('✅ Token 获取成功');
    
    // 2. 获取应用信息（查看权限）
    console.log('\n📝 步骤2: 获取应用信息...');
    const appRes = await fetch(`https://open.feishu.cn/open-apis/application/v3/apps/${FEISHU_APP_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    const appData = await appRes.json();
    console.log('  应用信息:', JSON.stringify(appData, null, 2));
    
    // 3. 尝试不同的用户列表 API
    console.log('\n📝 步骤3: 尝试获取用户列表（不同参数）...');
    
    // 3.1 不带 department_id 参数
    console.log('\n  3.1 不带 department_id 参数:');
    const usersRes1 = await fetch('https://open.feishu.cn/open-apis/contact/v3/users', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const usersData1 = await usersRes1.json();
    console.log('    响应:', JSON.stringify(usersData1, null, 2));
    
    // 3.2 使用 department_id=0
    console.log('\n  3.2 使用 department_id=0:');
    const usersRes2 = await fetch('https://open.feishu.cn/open-apis/contact/v3/users?department_id_type=open_department_id&department_id=0', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const usersData2 = await usersRes2.json();
    console.log('    响应:', JSON.stringify(usersData2, null, 2));
    
    // 3.3 使用 user_id_type
    console.log('\n  3.3 使用 user_id_type=open_id:');
    const usersRes3 = await fetch('https://open.feishu.cn/open-apis/contact/v3/users?user_id_type=open_id&department_id_type=open_department_id&department_id=0', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const usersData3 = await usersRes3.json();
    console.log('    响应:', JSON.stringify(usersData3, null, 2));
    
    // 4. 获取部门列表详细信息
    console.log('\n📝 步骤4: 获取部门列表...');
    const deptsRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/departments?department_id_type=open_department_id&department_id=0', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const deptsData = await deptsRes.json();
    console.log('  部门列表:', JSON.stringify(deptsData, null, 2));
    
    // 5. 如果有子部门，尝试获取子部门的用户
    if (deptsData.code === 0 && deptsData.data?.items?.length > 0) {
      console.log('\n📝 步骤5: 尝试获取子部门用户...');
      for (const dept of deptsData.data.items.slice(0, 3)) {
        console.log(`\n  部门: ${dept.name} (ID: ${dept.open_department_id})`);
        const deptUsersRes = await fetch(`https://open.feishu.cn/open-apis/contact/v3/users?department_id_type=open_department_id&department_id=${dept.open_department_id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const deptUsersData = await deptUsersRes.json();
        console.log(`    用户数量: ${deptUsersData.data?.items?.length || 0}`);
        if (deptUsersData.data?.items?.length > 0) {
          console.log(`    第一个用户: ${deptUsersData.data.items[0].name}`);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  }
}

testFeishuScopes();
