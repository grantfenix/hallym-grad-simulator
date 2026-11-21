const fs = require('fs');
const path = require('path');

// 1. Mock LocalStorage with Quota and Error Simulation
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.throwOnSet = null;
    this.throwOnGet = null;
  }
  getItem(k) {
    if (this.throwOnGet) throw this.throwOnGet;
    return this.store[k] !== undefined ? this.store[k] : null;
  }
  setItem(k, v) {
    if (this.throwOnSet) throw this.throwOnSet;
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();
global.localStorage = mockStorage;

// Mock DOM & Document
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag;
    this.style = {};
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c)
    };
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
  }
  appendChild(c) { this.children.push(c); }
  setAttribute() {}
}

const toastContainer = new MockElement('app-toast-container');
const mockDoc = {
  elements: {
    'app-toast-container': toastContainer
  },
  body: new MockElement('body'),
  getElementById(id) {
    if (!this.elements[id]) this.elements[id] = new MockElement(id);
    return this.elements[id];
  },
  createElement(tag) { return new MockElement('', tag); },
  addEventListener() {}
};

global.document = mockDoc;
global.window = {
  addEventListener: () => {},
  document: mockDoc
};

// 2. Load index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Feature 4: localStorage Guardrail & Resilient Storage Engine...");

// Check 1: Source code contains guardrail functions
console.log("\n--- 1. Check Function Definitions ---");
const checks = [
  'function isQuotaExceededError',
  'function safeStorageSet',
  'function safeStorageGet',
  'function safeStorageRemove'
];

for (const pattern of checks) {
  if (!html.includes(pattern)) {
    console.error(`[FAIL] Missing pattern in index.html: ${pattern}`);
    process.exit(1);
  }
}
console.log("[PASS] All guardrail functions found in index.html");

// Check 2: Evaluate Script
console.log("\n--- 2. Extract Script & Test Logic ---");
const scriptTagStart = html.lastIndexOf('<script>');
const scriptTagEnd = html.lastIndexOf('</script>');
const scriptCode = html.substring(scriptTagStart + 8, scriptTagEnd);

let instCode = scriptCode;
instCode = instCode.replace('let basketCourses = [];', 'global.basketCourses = [];');
instCode = instCode.replace('let currentUser = null;', 'global.currentUser = null;');
instCode = instCode.replace('let activeUserCourses = [];', 'global.activeUserCourses = [];');

try {
  eval(instCode);
  console.log("[PASS] Script evaluated successfully");
} catch (err) {
  console.error("[FAIL] Script evaluation failed:", err);
  process.exit(1);
}

// Test A: Normal Write and Read
console.log("\n--- 3. Test Normal Write and Read ---");
mockStorage.clear();
const setResult = safeStorageSet('test_key', { a: 1, b: 'hello' });
if (!setResult) {
  console.error("[FAIL] safeStorageSet returned false on valid data");
  process.exit(1);
}
const getResult = safeStorageGet('test_key', {});
if (!getResult || getResult.a !== 1 || getResult.b !== 'hello') {
  console.error("[FAIL] safeStorageGet did not retrieve expected object:", getResult);
  process.exit(1);
}
console.log("[PASS] Normal JSON write and read succeeded");

// Test B: QuotaExceededError Resilience
console.log("\n--- 4. Test QuotaExceededError Resilience ---");
toastContainer.children = [];
const quotaErr = new Error('Quota exceeded');
quotaErr.name = 'QuotaExceededError';
quotaErr.code = 22;
mockStorage.throwOnSet = quotaErr;

const failSetResult = safeStorageSet('quota_test', { data: 'overflow' });
if (failSetResult !== false) {
  console.error("[FAIL] safeStorageSet should return false on QuotaExceededError");
  process.exit(1);
}
const hasQuotaToast = toastContainer.children.some(t => t.className.includes('toast-error') && t.innerHTML.includes('용량'));
if (!hasQuotaToast) {
  console.error("[FAIL] Expected quota warning toast in container, got:", toastContainer.children);
  process.exit(1);
}
console.log("[PASS] QuotaExceededError caught gracefully, toast triggered, returned false");
mockStorage.throwOnSet = null;

// Test C: Corrupted Data / JSON SyntaxError Auto-Recovery
console.log("\n--- 5. Test Corrupted JSON Recovery ---");
toastContainer.children = [];
mockStorage.setItem('corrupted_key', '{ broken json: 123, ]');

const recovered = safeStorageGet('corrupted_key', { fallback: true });
if (!recovered || recovered.fallback !== true) {
  console.error("[FAIL] Expected fallback default value, got:", recovered);
  process.exit(1);
}
const hasCorruptToast = toastContainer.children.some(t => t.className.includes('toast-warning') && t.innerHTML.includes('손상'));
if (!hasCorruptToast) {
  console.error("[FAIL] Expected corruption warning toast in container, got:", toastContainer.children);
  process.exit(1);
}
// Check if storage was auto-repaired
const repairedRaw = mockStorage.getItem('corrupted_key');
if (!repairedRaw || !repairedRaw.includes('fallback')) {
  console.error("[FAIL] Corrupted storage key was not auto-repaired, stored:", repairedRaw);
  process.exit(1);
}
console.log("[PASS] Corrupted JSON cleanly intercepted, repaired, and returned default value");

// Test D: Per-User CRUD integration via safe wrappers
console.log("\n--- 6. Test Per-User Functions (getUsers, getUserCourses, getUserBasket) ---");
mockStorage.clear();
const testUsers = { '20261111': { studentId: '20261111', name: '홍길동' } };
saveUsers(testUsers);
const loadedUsers = getUsers();
if (!loadedUsers['20261111'] || loadedUsers['20261111'].name !== '홍길동') {
  console.error("[FAIL] getUsers mismatch:", loadedUsers);
  process.exit(1);
}

const testCourses = [
  { id: 'c1', semester: '1-1', title: '경영학원론', cat: '경영_전필', credits: 3, grade: 'A+' }
];
saveUserCourses('20261111', testCourses);
const loadedCourses = getUserCourses('20261111');
if (!loadedCourses || loadedCourses.length !== 1 || loadedCourses[0].title !== '경영학원론') {
  console.error("[FAIL] getUserCourses mismatch:", loadedCourses);
  process.exit(1);
}

const testBasket = [{ id: 'b1', title: '마케팅관리', cat: '경영_전필', credits: 3 }];
saveUserBasket('20261111', testBasket);
const loadedBasket = getUserBasket('20261111');
if (!loadedBasket || loadedBasket.length !== 1 || loadedBasket[0].title !== '마케팅관리') {
  console.error("[FAIL] getUserBasket mismatch:", loadedBasket);
  process.exit(1);
}

console.log("[PASS] All per-user CRUD functions work seamlessly with storage guardrails");

console.log("\n>>> ALL FEATURE 4 TESTS PASSED! <<<");
