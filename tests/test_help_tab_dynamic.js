const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Load JSON / JS rule files
const graduationRules = require('../data/graduation_rules.js');
const gyoyangRules = require('../data/gyoyang_rules.js');

// Mock DOM elements for Help Tab
const mockDOMElements = {
  'help-profile-badge': { innerHTML: '', textContent: '' },
  'help-rule-badge': { innerHTML: '', textContent: '' },
  'help-code-roles-list': { innerHTML: '', textContent: '' },
  'help-rules-list': { innerHTML: '', textContent: '' },
  'tab-content-4': { style: {} },
  'btn-tab-4': { classList: { toggle: () => {} } }
};

const domMock = {
  getElementById: (id) => mockDOMElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, value: 'ALL', appendChild: () => {} },
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

// Extract script
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const sandbox = {
  window: {},
  document: domMock,
  addEventListener: () => {},
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  HALLYM_GRADUATION_RULES: graduationRules,
  HALLYM_GYOYANG_RULES: gyoyangRules,
  graduationRules: graduationRules,
  gyoyangRules: gyoyangRules,
  currentUser: null,
  console: console
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing renderHelpTab dynamically...');

// Case 1: 경영학과 2025학번 단일전공
sandbox.completeLogin({
  studentId: '20250000',
  name: '유아미',
  admissionYear: 2025,
  major: '경영학과',
  studentType: '재학생',
  hasDoubleMajor: false,
  doubleMajorName: ''
});

sandbox.renderHelpTab();

const badge1 = mockDOMElements['help-profile-badge'].innerHTML;
const codeRoles1 = mockDOMElements['help-code-roles-list'].innerHTML;
const rules1 = mockDOMElements['help-rules-list'].innerHTML;

console.log('\n--- Case 1: 경영학과 2025학번 단일전공 ---');
console.log('Profile Badge:', badge1);
console.log('Code Roles List:', codeRoles1.replace(/\s+/g, ' '));
if (!badge1.includes('경영학과') || !badge1.includes('2025학번') || !badge1.includes('단일전공')) {
  throw new Error('Case 1 Badge failed');
}
if (!codeRoles1.includes('60학점') || !codeRoles1.includes('오디세이세미나3')) {
  throw new Error('Case 1 Code Roles failed');
}
if (!rules1.includes('130학점') || !rules1.includes('오디세이세미나3') || !rules1.includes('Career English')) {
  throw new Error('Case 1 Rules failed');
}
console.log('[PASS] Case 1 경영학과 2025학번 완벽 반영');

// Case 2: 러시아어학과 2021학번 단일전공
sandbox.completeLogin({
  studentId: '20211234',
  name: '러시아어학생',
  admissionYear: 2021,
  major: '러시아어학과',
  studentType: '재학생',
  hasDoubleMajor: false,
  doubleMajorName: ''
});

sandbox.renderHelpTab();

const badge2 = mockDOMElements['help-profile-badge'].innerHTML;
const codeRoles2 = mockDOMElements['help-code-roles-list'].innerHTML;
const rules2 = mockDOMElements['help-rules-list'].innerHTML;

console.log('\n--- Case 2: 러시아어학과 2021학번 단일전공 ---');
console.log('Profile Badge:', badge2);
console.log('Code Roles List:', codeRoles2.replace(/\s+/g, ' '));
if (!badge2.includes('러시아어학과') || !badge2.includes('2021학번')) {
  throw new Error('Case 2 Badge failed');
}
if (!codeRoles2.includes('러시아어학과') || codeRoles2.includes('경영학')) {
  throw new Error('Case 2 Code Roles should not contain 경영학');
}
if (!rules2.includes('러시아어학과 단일전공') || rules2.includes('Career English')) {
  throw new Error('Case 2 2021 cohort should not mandate Career English');
}
console.log('[PASS] Case 2 러시아어학과 2021학번 완벽 반영 (경영학 하드코딩 제거 검증)');

// Case 3: 소프트웨어학부 2024학번 복수전공 (+빅데이터학과)
sandbox.completeLogin({
  studentId: '20243456',
  name: '소웨학생',
  admissionYear: 2024,
  major: '소프트웨어학부',
  studentType: '재학생',
  hasDoubleMajor: true,
  doubleMajorName: '빅데이터학과'
});

sandbox.renderHelpTab();

const badge3 = mockDOMElements['help-profile-badge'].innerHTML;
const codeRoles3 = mockDOMElements['help-code-roles-list'].innerHTML;
const rules3 = mockDOMElements['help-rules-list'].innerHTML;

console.log('\n--- Case 3: 소프트웨어학부 2024학번 복수전공 ---');
console.log('Profile Badge:', badge3);
console.log('Code Roles List:', codeRoles3.replace(/\s+/g, ' '));
if (!badge3.includes('소프트웨어학부 + 빅데이터학과 복수전공')) {
  throw new Error('Case 3 Badge failed');
}
if (!codeRoles3.includes('소프트웨어학부 복수전공') || codeRoles3.includes('경영학')) {
  throw new Error('Case 3 Code Roles failed');
}
if (!rules3.includes('소프트웨어학부 복수전공 기준')) {
  throw new Error('Case 3 Rules failed');
}
console.log('[PASS] Case 3 소프트웨어학부 복수전공 완벽 반영');

console.log('\n ALL HELP TAB DYNAMIC TESTS PASSED (100%)!');
