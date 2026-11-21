const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const graduationRules = require('../data/graduation_rules.js');
const gyoyangRules = require('../data/gyoyang_rules.js');

const mockElements = {
  'profile-display-text': { innerHTML: '' },
  'info-val-id': { textContent: '' },
  'info-val-name': { textContent: '' },
  'info-val-year': { innerHTML: '', textContent: '' },
  'info-val-type': { innerHTML: '', textContent: '' },
  'info-val-major': { textContent: '' },
  'info-val-double': { textContent: '' },
  'info-special-banner': { style: {}, innerHTML: '' },
  'special-student-banner': { style: {}, innerHTML: '' },
  'simple-mode-banner': { style: {} },
  'hero-total-display': { innerHTML: '' },
  'hero-sub-display': { innerHTML: '' },
  'hero-remain-display': { innerHTML: '' },
  'deficiency-list': { innerHTML: '' },
  'major-remain-hint': { textContent: '' },
  'th-major-name': { textContent: '' },
  'td-conf-major': { innerHTML: '' },
  'td-conf-ge': { innerHTML: '' },
  'td-conf-gen': { innerHTML: '' },
  'td-conf-tot': { innerHTML: '' },
  'td-exp-major': { innerHTML: '' },
  'td-exp-ge': { innerHTML: '' },
  'td-exp-gen': { innerHTML: '' },
  'td-exp-tot': { innerHTML: '' },
  'summary-course-count': { textContent: '' },
  'summary-conf-credits': { textContent: '' },
  'summary-curr-credits': { textContent: '' },
  'summary-exp-credits': { textContent: '' },
  'summary-remain-credits': { textContent: '' },
  'help-profile-badge': { innerHTML: '', textContent: '' },
  'help-rule-badge': { innerHTML: '', textContent: '' },
  'help-code-roles-list': { innerHTML: '', textContent: '' },
  'help-rules-list': { innerHTML: '', textContent: '' },
  'seg-type-regular': { classList: { toggle: (cls, val) => {} } },
  'seg-type-transfer': { classList: { toggle: (cls, val) => {} } },
  'seg-type-intl': { classList: { toggle: (cls, val) => {} } },
  'transfer-hint': { style: {}, innerHTML: '' },
  'modal-student-type-hint': { style: {}, innerHTML: '' },
  'filter-year': { value: 'ALL' },
  'filter-term': { value: 'ALL' },
  'filter-cat': { value: 'ALL' },
  'filter-search': { value: '' },
  'auth-container': { style: {} },
  'main-app-container': { style: {} },
  'tab-content-4': { style: {} },
  'btn-tab-4': { classList: { toggle: () => {} } }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, value: 'ALL', appendChild: () => {} },
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

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
  activeUserCourses: [],
  basketCourses: [],
  customCourses: [],
  console: console
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing Special Student Types (편입생 & 외국인 유학생)...');

// 1. Test selectStudentType in Registration Form
console.log('\n--- 1. Registration selectStudentType ---');
sandbox.selectStudentType('편입생');
console.log('Transfer Hint HTML:', mockElements['transfer-hint'].innerHTML);
if (!mockElements['transfer-hint'].innerHTML.includes('70학점 인정')) {
  throw new Error('Transfer hint must mention 70학점 인정');
}

sandbox.selectStudentType('외국인 유학생');
console.log('Intl Hint HTML:', mockElements['transfer-hint'].innerHTML);
if (!mockElements['transfer-hint'].innerHTML.includes('한국어 교양')) {
  throw new Error('Intl hint must mention 한국어 교양');
}
console.log('[PASS] Registration selectStudentType verified');

// 2. Test Transfer Student in Tab 1, 2, 4
console.log('\n--- 2. Transfer Student Profile & Rules ---');
const transferUser = {
  studentId: '20249999',
  name: '편입생김한림',
  admissionYear: 2024,
  major: '경영학과',
  studentType: '편입생',
  hasDoubleMajor: false,
  doubleMajorName: ''
};
sandbox.completeLogin(transferUser);
sandbox.renderMyInfoTab();
sandbox.renderScreen1Tables();
sandbox.renderHelpTab();

const infoBannerTransfer = mockElements['info-special-banner'].innerHTML;
const helpRulesTransfer = mockElements['help-rules-list'].innerHTML;
const headerBadgeTransfer = mockElements['profile-display-text'].innerHTML;

console.log('Header Badge (Transfer):', headerBadgeTransfer);
console.log('Info Banner (Transfer):', infoBannerTransfer);
if (!headerBadgeTransfer.includes('badge-primary') || !headerBadgeTransfer.includes('편입생')) {
  throw new Error('Header badge should show badge-primary for 편입생');
}
if (!infoBannerTransfer.includes('70학점 인정') || !infoBannerTransfer.includes('전공 60학점 집중 이수')) {
  throw new Error('Info banner must explain transfer 70 credits recognition and 60 major credits');
}
if (!helpRulesTransfer.includes('편입생 특별 학사 기준') || !helpRulesTransfer.includes('통상 70학점')) {
  throw new Error('Help tab rules list must contain transfer guidance');
}
console.log('[PASS] Transfer student guidance and badges verified');

// 3. Test International Student in Tab 1, 2, 4
console.log('\n--- 3. International Student Profile & Rules ---');
const intlUser = {
  studentId: '20257777',
  name: '유학생알렉스',
  admissionYear: 2025,
  major: '경영학과',
  studentType: '외국인 유학생',
  hasDoubleMajor: false,
  doubleMajorName: ''
};
sandbox.completeLogin(intlUser);
sandbox.renderMyInfoTab();
sandbox.renderScreen1Tables();
sandbox.renderHelpTab();

const infoBannerIntl = mockElements['info-special-banner'].innerHTML;
const helpRulesIntl = mockElements['help-rules-list'].innerHTML;
const headerBadgeIntl = mockElements['profile-display-text'].innerHTML;

console.log('Header Badge (Intl):', headerBadgeIntl);
console.log('Info Banner (Intl):', infoBannerIntl);
if (!headerBadgeIntl.includes('badge-purple') || !headerBadgeIntl.includes('외국인 유학생')) {
  throw new Error('Header badge should show badge-purple for 외국인 유학생');
}
if (!infoBannerIntl.includes('한국어 교양') || !infoBannerIntl.includes('대학한국어')) {
  throw new Error('Info banner must explain international student Korean language requirements');
}
if (!helpRulesIntl.includes('외국인 유학생 특별 학사 기준') || !helpRulesIntl.includes('대학한국어2')) {
  throw new Error('Help tab rules list must contain international student guidance');
}
console.log('[PASS] International student guidance and badges verified');

console.log('\n ALL SPECIAL STUDENT TYPE TESTS PASSED (100%)!');
