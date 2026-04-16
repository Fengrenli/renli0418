import dotenv from 'dotenv';
dotenv.config();

async function checkDepts() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.tenant_access_token;
  
  const url = 'https://open.feishu.cn/open-apis/contact/v3/departments?page_size=50&department_id_type=open_department_id';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.log('Departments (open_id):', JSON.stringify(data.data?.items, null, 2));
  
  const url2 = 'https://open.feishu.cn/open-apis/contact/v3/departments?page_size=50&department_id_type=department_id';
  const res2 = await fetch(url2, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data2 = await res2.json();
  console.log('Departments (dept_id):', JSON.stringify(data2.data?.items, null, 2));
}

checkDepts();
