'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'STCharacters.txt');
const out = path.join(__dirname, '..', 's2t.js');
const lines = fs.readFileSync(src, 'utf8').split(/\n/);
const map = {};
for (const line of lines) {
  if (!line || line[0] === '#') continue;
  const p = line.trim().split(/\s+/);
  if (p.length >= 2) map[p[0]] = p[1];
}

const code = [
  "'use strict';",
  '/* OpenCC STCharacters — Apache-2.0 (https://github.com/BYVoid/OpenCC) */',
  `const S2T_MAP = ${JSON.stringify(map)};`,
  'function toTraditional(s) {',
  "  let o = '';",
  '  for (const c of s) o += S2T_MAP[c] || c;',
  '  return o;',
  '}',
].join('\n');

fs.writeFileSync(out, code);
console.log('written', out, Object.keys(map).length, 'entries');
