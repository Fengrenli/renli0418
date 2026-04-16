import dotenv from 'dotenv';
dotenv.config();

async function testUsersDept() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.tenant_access_token;
  
  const deptId = 'od-1a259f69e1c39315d91bf7615db8f4f9'; // 总经办
  const url = `https://open.feishu.cn/open-apis/contact/v3/users?department_id_type=open_department_id&department_id=${deptId}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  console.log('Users in 总经办:', JSON.stringify(data, null, 2));
}

testUsersDept();
