const fs = require('fs');
const b64 = fs.readFileSync('b64_full.txt', 'utf8').replace(/[\r\n]/g, '');
const mid = Math.floor(b64.length / 2);
fs.writeFileSync('chunk1.txt', b64.substring(0, mid));
fs.writeFileSync('chunk2.txt', b64.substring(mid));
console.log('Split into chunks: ' + b64.substring(0, mid).length + ' and ' + b64.substring(mid).length);
