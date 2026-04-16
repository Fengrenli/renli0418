const fs = require('fs');
let content = fs.readFileSync('components/EngineeringAssistantModal.tsx', 'utf8');

// EAVES: 筒瓦 - 替换为数据库中的 BR99-GYHG-ABETH-001 (瓦片-筒瓦, ¥0.79)
content = content.replace(
  "cands: ['ABETH-002', 'CE01-GYHG-ABETH-002']",
  "cands: ['BR99-GYHG-ABETH-001', 'ABETH-002', 'ABETH-001', 'CE01-GYHG-ABETH-002']"
);

// EAVES: 板瓦 - 替换为数据库中的 BR99-GYHG-X8D5-001 (瓦片-普通瓦片, ¥0.60)
content = content.replace(
  "cands: ['ABDET-001', 'CE01-GYHG-ABDET-001']",
  "cands: ['BR99-GYHG-X8D5-001', 'ABDET-001', 'CE01-GYHG-ABDET-001']"
);

// EAVES: 正脊 - 替换为数据库中的 BR99-GYHG-ABHRG-001
content = content.replace(
  "cands: ['ABHRG-002', 'ABHRG-001', 'CE01-GYHG-ABHRG-002', 'CE01-GYHG-ABHRG-001']",
  "cands: ['BR99-GYHG-ABHRG-001', 'ABHRG-002', 'ABHRG-001', 'CE01-GYHG-ABHRG-002', 'CE01-GYHG-ABHRG-001']"
);

// EAVES: 滴水 - 替换为数据库中的 BR99-GYHG-ABTIE-001
content = content.replace(
  "cands: ['ABTIE-001', 'CE01-GYHG-ABTIE-001']",
  "cands: ['BR99-GYHG-ABTIE-001', 'ABTIE-001', 'CE01-GYHG-ABTIE-001']"
);

// EAVES: 挡沟 - 替换为数据库中的 BR99-GYHG-ABRAF-001
content = content.replace(
  "cands: ['ABRAF-001', 'CE01-GYHG-ABRAF-001']",
  "cands: ['BR99-GYHG-ABRAF-001', 'ABRAF-001', 'CE01-GYHG-ABRAF-001']"
);

// WALL: 预制墙板 - 替换为数据库中的 BR99-GYHG-ABMRR-002 (青砖-预制工字拼青砖墙板, ¥325.71)
content = content.replace(
  "cands: ['ABCEC-002', 'CE01-GYHG-ABCEC-002']",
  "cands: ['BR99-GYHG-ABMRR-002', 'ABCEC-002', 'CE01-GYHG-ABCEC-002']"
);

// WALL: 青砖片 - 替换为数据库中的 BR99-GYHG-ABMRR-001 (青砖-旧青砖片, ¥0.93)
content = content.replace(
  "cands: ['ABMRR-001', 'CE01-GYHG-ABMRR-001']",
  "cands: ['BR99-GYHG-ABMRR-001', 'ABMRR-001', 'CE01-GYHG-ABMRR-001']"
);

fs.writeFileSync('components/EngineeringAssistantModal.tsx', content);
console.log('Done. All seed material codes updated to match database.');
