const http = require('http');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const options = { hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d.substring(0,500) }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d.substring(0,500) }); } });
    }).on('error', reject);
  });
}

async function test() {
  const base = 'http://127.0.0.1:3800/api';
  console.log('\n=== TEST 1: GET /api/bom/rules ===');
  const r1 = await getJson(base + '/bom/rules');
  console.log('Status:', r1.status, 'Rules:', r1.data?.data?.length);
  if (r1.data?.data) r1.data.data.forEach(r => console.log('  Rule: ' + r.code + ' (' + r.name + ') -> ' + r.items?.length + ' items'));

  console.log('\n=== TEST 2: POST /api/bom/calculate (筒瓦, 10m 延米) ===');
  const r2 = await postJson(base + '/bom/calculate', { sku_code: 'BR99-GYHG-ABETH-001', measured_length: 10 });
  console.log('Status:', r2.status);
  if (r2.data?.data) {
    const d = r2.data.data;
    console.log('  ' + d.name + ': 原始=' + d.raw_qty + ' -> 含损耗=' + d.final_qty + d.unit + ', 单价=¥' + d.unit_price + ', 总价=¥' + d.total_price + ', 模式=' + d.calc_mode);
  }

  console.log('\n=== TEST 3: POST /api/bom/calculate (青砖墙板, 50㎡) ===');
  const r3 = await postJson(base + '/bom/calculate', { sku_code: 'BR99-GYHG-ABMRR-002', measured_area: 50 });
  console.log('Status:', r3.status);
  if (r3.data?.data) {
    const d = r3.data.data;
    console.log('  ' + d.name + ': 原始=' + d.raw_qty + ' -> 含损耗=' + d.final_qty + d.unit + ', 单价=¥' + d.unit_price + ', 总价=¥' + d.total_price + ', 模式=' + d.calc_mode);
  }

  console.log('\n=== TEST 4: POST /api/bom/calculate-scene (混合场景) ===');
  const r4 = await postJson(base + '/bom/calculate-scene', {
    scene: [
      { sku: 'BR99-GYHG-ABETH-001', length: 20 },
      { sku: 'BR99-GYHG-X8D5-001', length: 20 },
      { sku: 'BR99-GYHG-ABHRG-001', length: 20 },
      { sku: 'BR99-GYHG-ABTIE-001', length: 20 },
      { sku: 'BR99-GYHG-ABRAF-001', length: 20 },
      { sku: 'BR99-GYHG-ABMRR-002', area: 80 },
      { sku: 'BR99-GYHG-ABMRR-001', area: 80 },
    ],
    waste_rate: 0.10
  });
  console.log('Status:', r4.status);
  if (r4.data?.data) {
    const d = r4.data.data;
    console.log('  Summary: 总价=¥' + d.summary.total_price + ', SKU数=' + d.summary.total_skus + ', 总件数=' + d.summary.total_items);
    d.groups.forEach(g => {
      console.log('  Group: ' + g.group_name + ' (小计=¥' + g.subtotal + ')');
      g.items.forEach(i => console.log('    ' + i.sku_code + ' ' + i.name + ': ' + i.final_qty + i.unit + ' = ¥' + i.total_price + ' [' + i.calc_mode + ']'));
    });
  }

  console.log('\n=== TEST 5: POST /api/bom/calculate (不存在的 SKU) ===');
  const r5 = await postJson(base + '/bom/calculate', { sku_code: 'INVALID-999' });
  console.log('Status:', r5.status, 'Msg:', r5.data?.msg);
}

test().catch(console.error);