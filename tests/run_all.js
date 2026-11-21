const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testsDir = __dirname;
const files = fs.readdirSync(testsDir).filter(f => f.startsWith('test_') && f.endsWith('.js'));

console.log(`========================================`);
console.log(`Running all test suites (${files.length} suites found)...`);
console.log(`========================================\n`);

let passedCount = 0;
let failedCount = 0;

for (const file of files) {
  const filePath = path.join(testsDir, file);
  process.stdout.write(`[RUNNING] ${file} ... `);
  try {
    const output = execSync(`node "${filePath}"`, { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    console.log(`PASSED`);
    passedCount++;
  } catch (err) {
    console.log(`FAILED!`);
    console.error(err.stdout || err.message);
    failedCount++;
    process.exit(1);
  }
}

console.log(`\n========================================`);
console.log(`Summary: ${passedCount} passed, ${failedCount} failed.`);
console.log(`========================================`);
