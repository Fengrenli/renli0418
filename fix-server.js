// 修复 server.cjs 的脚本
const fs = require('fs');
const path = '/www/wwwroot/renliyesheng/dist-server/server.cjs';
let content = fs.readFileSync(path, 'utf8');

// 查找并替换 departmentId 检查逻辑
const oldCode = `if (!departmentId) {
    return sendResponse(res, 400, {
        code: 400,
        msg: 'departmentId required (or configure FEISHU_DEFAULT_DEPT_ID)',
        success: false,
    });
}`;

const newCode = `if (!departmentId) {
    // 修复：如果没有部门ID，返回空数组而不是错误
    return sendResponse(res, 200, {
        code: 200,
        msg: 'success',
        data: [],
        sourceDepartmentId: '',
        success: true,
    });
}`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(path, content);
    console.log('✓ 修复成功');
} else {
    console.log('✗ 未找到需要修复的代码');
    // 显示实际代码
    const idx = content.indexOf('if (!departmentId)');
    if (idx >= 0) {
        console.log('实际代码:', content.substring(idx, idx + 200));
    }
}
