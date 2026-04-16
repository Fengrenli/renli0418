const fs = require('fs');
let c = fs.readFileSync('components/EngineeringAssistantModal.tsx', 'utf8');

const oldLine = "const matches = materials.filter((x) => String(x.id) === String(code));";
const newLines = [
  "// 优先按 code 字段匹配，其次按 id 匹配（兼容旧数据）",
  "  const byCode = materials.filter((x) => String((x as any).code || '') === String(code));",
  "  if (byCode.length > 0) return byCode[byCode.length - 1];",
  "  const matches = materials.filter((x) => String(x.id) === String(code));"
].join("\r\n");

if (c.includes(oldLine)) {
  c = c.replace(oldLine, newLines);
  fs.writeFileSync('components/EngineeringAssistantModal.tsx', c);
  console.log('pickMaterialByCode updated successfully.');
} else {
  console.log('ERROR: Old line not found.');
}
