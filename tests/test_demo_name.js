const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const mockElements = {
  'profile-display-text': { innerHTML: '' },
  'info-val-name': { textContent: '' },
  'auth-container': { style: {} },
  'main-app-container': { style: {} },
  'summary-course-count': { textContent: '' },
  'summary-conf-credits': { textContent: '' },
  'summary-curr-credits': { textContent: '' },
  'summary-exp-credits': { textContent: '' },
  'summary-remain-credits': { textContent: '' }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} },
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

const mockStorage = {};
const sandbox = {
  window: {},
  document: domMock,
  addEventListener: () => {},
  localStorage: {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  },
  console: console
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing Demo User Name Update ("김한림" -> "유아미")...');

// 1. Check Button in HTML
console.log('\n--- 1. Login Screen Demo Button ---');
const btnMatch = htmlContent.match(/class="btn-demo"[\s\S]*?<\/button>/);
console.log('Demo Button HTML:', btnMatch ? btnMatch[0].replace(/\s+/g, ' ') : 'NOT FOUND');
if (!btnMatch || !btnMatch[0].includes('유아미') || btnMatch[0].includes('김한림')) {
  throw new Error('Demo button must contain 유아미 and not contain 김한림');
}
console.log('[PASS] Demo button contains 유아미');

// 2. Check Fresh Creation
console.log('\n--- 2. ensureDefaultDemoUser Fresh Creation ---');
sandbox.ensureDefaultDemoUser();
const usersAfterFresh = JSON.parse(mockStorage['hallym_users']);
const demoFresh = usersAfterFresh['20250000'] || usersAfterFresh['20258044'];
console.log('Created Demo User:', demoFresh.name, demoFresh.studentId);
if (demoFresh.name !== '유아미') throw new Error(`Expected name '유아미', got '${demoFresh.name}'`);
if (demoFresh.studentId !== '20250000') throw new Error(`Expected studentId '20250000', got '${demoFresh.studentId}'`);
console.log('[PASS] Fresh user name is 유아미 (studentId: 20250000)');

// 3. Check Legacy Migration ('김한림' in localStorage upgraded to '유아미')
console.log('\n--- 3. ensureDefaultDemoUser Legacy Migration ---');
mockStorage['hallym_users'] = JSON.stringify({
  '20250000': { studentId: '20250000', name: '김한림', major: '경영학과' }
});
sandbox.ensureDefaultDemoUser();
const usersAfterMigrate = JSON.parse(mockStorage['hallym_users']);
const demoMigrated = usersAfterMigrate['20250000'] || usersAfterMigrate['20258044'];
console.log('Migrated Demo User:', demoMigrated.name);
if (demoMigrated.name !== '유아미') throw new Error(`Expected migrated name '유아미', got '${demoMigrated.name}'`);
console.log('[PASS] Legacy user auto-upgraded to 유아미');

// 4. Check completeLogin Profile Display
console.log('\n--- 4. Profile Display Update on Login ---');
sandbox.completeLogin(demoMigrated);
const profileText = mockElements['profile-display-text'].innerHTML;
console.log('Profile Header Text:', profileText);
if (!profileText.includes('유아미') || profileText.includes('김한림')) {
  throw new Error('Profile text must include 유아미 and not include 김한림');
}
console.log('[PASS] Profile header correctly displays 유아미');

console.log('\n ALL DEMO USER TESTS PASSED (100%)!');
