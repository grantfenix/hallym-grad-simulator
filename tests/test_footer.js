const fs = require('fs');
const path = require('path');

console.log('Testing Footer & Copyright notices...');

const htmlPath = path.resolve(__dirname, '../index.html');
const licensePath = path.resolve(__dirname, '../LICENSE');
const readmePath = path.resolve(__dirname, '../README.md');

const html = fs.readFileSync(htmlPath, 'utf8');
const license = fs.readFileSync(licensePath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');

const targetNotice = '© 2026 유아미 · 한림대학교 경영과인공지능 수업 프로젝트';

// 1. Check index.html
console.log('\n--- 1. Check index.html Footers ---');
const footerMatches = html.match(/<footer class="app-footer">[\s\S]*?<\/footer>/g);
console.log(`Found ${footerMatches ? footerMatches.length : 0} footer elements`);
if (!footerMatches || footerMatches.length < 2) {
  throw new Error(`Expected at least 2 footer elements (auth and main app), found ${footerMatches ? footerMatches.length : 0}`);
}

footerMatches.forEach((f, idx) => {
  console.log(`Footer ${idx + 1}:`, f.replace(/\s+/g, ' '));
  if (!f.includes(targetNotice)) {
    throw new Error(`Footer ${idx + 1} does not contain exact target notice: ${targetNotice}`);
  }
  if (!f.includes('MIT License') || !f.includes('저작권자: 유아미')) {
    throw new Error(`Footer ${idx + 1} does not contain license or copyright holder`);
  }
  if (f.includes('팀') || f.includes('3조')) {
    throw new Error(`Footer ${idx + 1} should NOT mention team/3조`);
  }
});
console.log('[PASS] index.html footers verified');

// 2. Check LICENSE
console.log('\n--- 2. Check LICENSE file ---');
console.log(license.split('\n').slice(0, 5).join('\n'));
if (!license.includes('Copyright (c) 2026 유아미')) {
  throw new Error("LICENSE must contain 'Copyright (c) 2026 유아미'");
}
if (license.includes('프로젝트 팀') || license.includes('3조')) {
  throw new Error("LICENSE must not mention team/3조");
}
console.log('[PASS] LICENSE file verified');

// 3. Check README.md
console.log('\n--- 3. Check README.md file ---');
if (!readme.includes(targetNotice)) {
  throw new Error(`README.md does not contain exact target notice: ${targetNotice}`);
}
if (!readme.includes('저작권자: 유아미')) {
  throw new Error("README.md must specify '저작권자: 유아미'");
}
console.log('[PASS] README.md verified');

console.log('\n ALL FOOTER & COPYRIGHT TESTS PASSED (100%)!');
