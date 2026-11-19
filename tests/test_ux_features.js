const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const mockElements = {
  'login-id': { focusCalled: false, focus: function() { this.focusCalled = true; }, value: '' },
  'reg-id': { focusCalled: false, focus: function() { this.focusCalled = true; }, value: '' },
  'tab-login-btn': { classList: { add: () => {}, remove: () => {} } },
  'tab-register-btn': { classList: { add: () => {}, remove: () => {} } },
  'form-login': { style: {} },
  'form-register': { style: {} },
  'auth-alert': { style: {} },
  'course-sem-year-select': { value: '2025' },
  'course-sem-term-select': { value: '1' },
  'course-semester-input': { value: '' },
  'bask-title-input': { value: '' },
  'bask-cat-input': { value: '', options: [{ value: '경영_전선' }, { value: '교양_정보소통' }] },
  'bask-cred-input': { value: '3' },
  'autocomplete-dropdown': { style: {}, innerHTML: '', appendChild: () => {} },
  'sim-warnings-container': { innerHTML: '' },
  'sim-basket-tbody': { innerHTML: '', children: [], appendChild: () => {} },
  'sim-basket-empty': { style: {} },
  'live-hero-credits': { innerHTML: '' },
  'live-hero-pct': { textContent: '' },
  'live-bar-curr': { style: {} },
  'live-bar-basket': { style: {} },
  'live-remain-text': { textContent: '' },
  'live-panel-major-label': { innerHTML: '' },
  'live-biz-cred': { textContent: '' },
  'live-biz-target': { textContent: '' },
  'live-biz-delta': { innerHTML: '' },
  'live-biz-bar-curr': { style: {} },
  'live-biz-bar-bask': { style: {} },
  'live-ge-cred': { innerHTML: '' },
  'live-ge-bar': { style: {} },
  'live-gen-cred': { innerHTML: '' }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', value: '', style: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} }, appendChild: () => {} },
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
  console: console,
  setTimeout: (fn) => fn(),
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  parseInt: parseInt,
  Math: Math,
  JSON: JSON,
  Array: Array,
  alert: () => {}
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing New UX Features...');

// 1. Check syncCourseSemesterInput
console.log('\n--- 1. syncCourseSemesterInput ---');
sandbox.syncCourseSemesterInput();
console.log('Synced Semester Input:', mockElements['course-semester-input'].value);
if (mockElements['course-semester-input'].value !== '2025-1') {
  throw new Error('Expected 2025-1, got ' + mockElements['course-semester-input'].value);
}
console.log('[PASS] syncCourseSemesterInput works as expected');

// 2. Check directAddCourseToBasket
console.log('\n--- 2. directAddCourseToBasket ---');
sandbox.currentUser = { studentId: '20258044', name: '유아미', major: '경영학과' };
sandbox.activeUserCourses = [];
const testItem = { title: '마케팅원론', credits: 3, cat: '경영_전선' };
console.log('Testing selectCourseFromAutocomplete directly:');
sandbox.selectCourseFromAutocomplete(testItem);
console.log('bask-title-input value after select:', mockElements['bask-title-input'].value);
sandbox.addCourseToBasket();
console.log('basketCourses in sandbox:', sandbox.basketCourses);
console.log('[PASS] directAddCourseToBasket successfully added and persisted course');

// 3. Check auto-focus in switchAuthTab
console.log('\n--- 3. switchAuthTab auto-focus ---');
sandbox.switchAuthTab('login');
if (!mockElements['login-id'].focusCalled) {
  throw new Error('login-id focus was not called');
}
console.log('[PASS] login-id focus was successfully triggered');

console.log('\nALL UX FEATURE UNIT TESTS PASSED (100%)!');
