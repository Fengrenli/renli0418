import dotenv from 'dotenv';
dotenv.config();

async function testFeishu() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.tenant_access_token;
  
  const url = 'https://open.feishu.cn/open-apis/contact/v3/users?page_size=50&department_id_type=open_department_id&department_id=0';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.log('Feishu data code:', data.code);
  console.log('Feishu data msg:', data.msg);
  console.log('Feishu items count:', data.data?.items?.length || 0);
  console.log('Feishu has_more:', data.data?.has_more);
}

testFeishu();
