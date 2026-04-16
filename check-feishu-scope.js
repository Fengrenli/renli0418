import dotenv from 'dotenv';
dotenv.config();

async function checkScope() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.tenant_access_token;
  
  const url = 'https://open.feishu.cn/open-apis/contact/v3/scopes';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.log('App scope:', JSON.stringify(data.data, null, 2));
}

checkScope();
