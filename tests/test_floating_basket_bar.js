const fs = require('fs');
const path = require('path');

// 1. Mock DOM Environment
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.style = {};
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      contains: (c) => this.classList.classes.has(c)
    };
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
  }

  scrollIntoView(options) {
    this.lastScrollOptions = options;
  }
}

class MockDOM {
  constructor() {
    this.elements = {};
  }

  addEventListener(event, fn) {}
  removeEventListener(event, fn) {}

  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = new MockElement(id);
    }
    return this.elements[id];
  }
}

const mockDom = new MockDOM();
global.document = mockDom;
global.window = {
  addEventListener: () => {},
  document: mockDom
};

// 2. Load index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Feature 1: Floating Basket Mini-Bar...");

// Check 1: Markup exists
console.log("\n--- 1. Check HTML Markup & CSS ---");
const hasMarkup = html.includes('id="floating-basket-bar"');
const hasBadge = html.includes('id="floating-basket-badge"');
const hasWarn = html.includes('id="floating-basket-limit-warn"');
const hasCss = html.includes('.floating-basket-bar {');

if (hasMarkup && hasBadge && hasWarn && hasCss) {
  console.log("[PASS] Markup and CSS for floating basket bar verified");
} else {
  console.error("[FAIL] Markup or CSS missing!");
  process.exit(1);
}

// Check 2: Extract Script & Evaluate
console.log("\n--- 2. Extract Script & Test Logic ---");
const scriptTagStart = html.lastIndexOf('<script>');
const scriptTagEnd = html.lastIndexOf('</script>');
const scriptCode = html.substring(scriptTagStart + 8, scriptTagEnd);

// Instrument variables
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

// Test updateFloatingBasketBar
const barEl = mockDom.getElementById('floating-basket-bar');
const badgeEl = mockDom.getElementById('floating-basket-badge');
const warnEl = mockDom.getElementById('floating-basket-limit-warn');
const tab3El = mockDom.getElementById('tab-content-3');

// Case A: Empty basket in Tab 3
global.basketCourses = [];
tab3El.style.display = 'block';
updateFloatingBasketBar(3);
if (barEl.style.display === 'none') {
  console.log("[PASS] Case A: Empty basket -> Bar hidden");
} else {
  console.error(`[FAIL] Case A: Bar should be hidden, got ${barEl.style.display}`);
  process.exit(1);
}

// Case B: Basket has 2 courses (6 credits) in Tab 3
global.basketCourses = [
  { id: 'b1', title: '마케팅원론', credits: 3, isDuplicate: false },
  { id: 'b2', title: '회계원리', credits: 3, isDuplicate: false }
];
updateFloatingBasketBar(3);
if (barEl.style.display === 'block' && badgeEl.textContent.includes('6학점 (2과목)') && warnEl.style.display === 'none') {
  console.log("[PASS] Case B: 6 credits -> Bar visible, 6학점 (2과목), warning hidden");
} else {
  console.error(`[FAIL] Case B failed: display=${barEl.style.display}, badge=${badgeEl.textContent}`);
  process.exit(1);
}

// Case C: Basket has 19 credits (>18) in Tab 3
global.basketCourses = [
  { id: 'b1', title: '과목1', credits: 3, isDuplicate: false },
  { id: 'b2', title: '과목2', credits: 3, isDuplicate: false },
  { id: 'b3', title: '과목3', credits: 3, isDuplicate: false },
  { id: 'b4', title: '과목4', credits: 3, isDuplicate: false },
  { id: 'b5', title: '과목5', credits: 4, isDuplicate: false },
  { id: 'b6', title: '과목6', credits: 3, isDuplicate: false }
];
updateFloatingBasketBar(3);
if (barEl.style.display === 'block' && badgeEl.textContent.includes('19학점 (6과목)') && warnEl.style.display === 'inline-block' && badgeEl.className.includes('badge-danger')) {
  console.log("[PASS] Case C: 19 credits -> Bar visible, 19학점 (6과목), 18학점 초과 warning badge active");
} else {
  console.error(`[FAIL] Case C failed: warn display=${warnEl.style.display}, badge class=${badgeEl.className}`);
  process.exit(1);
}

// Case D: Switching to Tab 1 (or Tab 2, Tab 4) -> Bar should hide
tab3El.style.display = 'none';
updateFloatingBasketBar(1);
if (barEl.style.display === 'none') {
  console.log("[PASS] Case D: Tab 1 active -> Bar hidden even with courses in basket");
} else {
  console.error(`[FAIL] Case D failed: bar should hide outside Tab 3, got ${barEl.style.display}`);
  process.exit(1);
}

// Case E: Smooth scroll handlers
console.log("\n--- 3. Test Scroll Navigation Handlers ---");
const tableCardEl = mockDom.getElementById('sim-basket-table-card');
const liveCardEl = mockDom.getElementById('sim-live-panel-card');

scrollToBasketTable();
scrollToSimResult();

if (tableCardEl.lastScrollOptions && liveCardEl.lastScrollOptions) {
  console.log("[PASS] scrollToBasketTable & scrollToSimResult smooth scrolling verified");
} else {
  console.error("[FAIL] Scroll handlers failed to call scrollIntoView");
  process.exit(1);
}

console.log("\n==============================================");
console.log(" ALL FLOATING BASKET BAR TESTS PASSED (100%)! ");
console.log("==============================================");
