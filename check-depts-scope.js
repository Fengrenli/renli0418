import dotenv from 'dotenv';
dotenv.config();

async function checkDeptsScope() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.tenant_access_token;
  
  const scopeUrl = 'https://open.feishu.cn/open-apis/contact/v3/scopes';
  const scopeRes = await fetch(scopeUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  const scopeData = await scopeRes.json();
  const deptIds = scopeData.data.department_ids;
  
  for (const id of deptIds) {
    const url = `https://open.feishu.cn/open-apis/contact/v3/departments/${id}?department_id_type=open_department_id`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    console.log(`Dept ${id}:`, data.data?.department?.name, 'members:', data.data?.department?.member_count);
  }
}

checkDeptsScope();
