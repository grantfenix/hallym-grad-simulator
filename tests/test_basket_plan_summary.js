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
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
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

  createElement(tagName) {
    return new MockElement('', tagName);
  }

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

console.log("Testing Feature 3: Basket Plan Summary & Impact Visualization...");

// Check 1: HTML Markup & CSS
console.log("\n--- 1. Check HTML Markup & CSS ---");
const checks = [
  'id="sim-plan-summary-card"',
  'id="sim-plan-total-badge"',
  'id="sim-plan-categories"',
  'id="sim-impact-curr-total"',
  'id="sim-impact-after-total"',
  'id="sim-impact-req-total"',
  'id="sim-impact-curr-biz"',
  'id="sim-impact-after-biz"',
  'id="sim-impact-curr-remain"',
  'id="sim-impact-after-remain"',
  '.sim-plan-grid {',
  '.sim-plan-cat-card {',
  '.sim-plan-impact-box {'
];

for (const pattern of checks) {
  if (!html.includes(pattern)) {
    console.error(`[FAIL] Missing pattern: ${pattern}`);
    process.exit(1);
  }
}
console.log("[PASS] All required HTML markup and CSS classes are present");

// Check 2: Extract Script & Evaluate
console.log("\n--- 2. Extract Script & Test Logic ---");
const scriptTagStart = html.lastIndexOf('<script>');
const scriptTagEnd = html.lastIndexOf('</script>');
const scriptCode = html.substring(scriptTagStart + 8, scriptTagEnd);

// Instrument variables for testing
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

const planCard = mockDom.getElementById('sim-plan-summary-card');
const totalBadge = mockDom.getElementById('sim-plan-total-badge');
const catContainer = mockDom.getElementById('sim-plan-categories');
const currTotalEl = mockDom.getElementById('sim-impact-curr-total');
const afterTotalEl = mockDom.getElementById('sim-impact-after-total');
const currBizEl = mockDom.getElementById('sim-impact-curr-biz');
const afterBizEl = mockDom.getElementById('sim-impact-after-biz');
const currRemainEl = mockDom.getElementById('sim-impact-curr-remain');
const afterRemainEl = mockDom.getElementById('sim-impact-after-remain');

// Mock graduation metrics (m)
const mockM = {
  expTotal: 50,
  expMajor: 24,
  reqTotalCredits: 130,
  reqMajorCredits: 60
};

// Case A: Empty Basket
console.log("\n--- 3. Case A: Empty Basket ---");
global.basketCourses = [];
renderBasketPlanSummary(0, 0, mockM, 130, 50, 50, 80);
if (planCard.style.display !== 'none') {
  console.error(`[FAIL] Plan card should be hidden when basket is empty, got: ${planCard.style.display}`);
  process.exit(1);
}
console.log("[PASS] Plan card successfully hidden on empty basket");

// Case B: Basket with 2 Major Courses and 1 GE Course (9 credits total)
console.log("\n--- 4. Case B: Basket with 3 courses (9 credits) ---");
global.basketCourses = [
  { id: 'b1', title: '경영통계', cat: '경영_전선', credits: 3 },
  { id: 'b2', title: '마케팅관리', cat: '경영_전필', credits: 3 },
  { id: 'b3', title: '컴퓨팅사고', cat: '교양_정보소통', credits: 3 }
];

renderBasketPlanSummary(9, 6, mockM, 130, 50, 59, 71);

if (planCard.style.display !== 'block') {
  console.error(`[FAIL] Plan card should be visible, got: ${planCard.style.display}`);
  process.exit(1);
}
console.log("[PASS] Plan card displayed as block");

if (!totalBadge.textContent.includes('9학점') || !totalBadge.textContent.includes('3과목')) {
  console.error(`[FAIL] Total badge text mismatch: ${totalBadge.textContent}`);
  process.exit(1);
}
console.log(`[PASS] Total badge text: ${totalBadge.textContent}`);

if (catContainer.children.length !== 2) {
  console.error(`[FAIL] Expected 2 category cards (major & gyoyang), got: ${catContainer.children.length}`);
  process.exit(1);
}
console.log(`[PASS] Created ${catContainer.children.length} category cards`);

if (currTotalEl.textContent != 50 || afterTotalEl.textContent != 59) {
  console.error(`[FAIL] Total credit metric mismatch: curr=${currTotalEl.textContent}, after=${afterTotalEl.textContent}`);
  process.exit(1);
}
console.log(`[PASS] Total credit metrics: ${currTotalEl.textContent} -> ${afterTotalEl.textContent}`);

if (currBizEl.textContent != 24 || afterBizEl.textContent != 30) {
  console.error(`[FAIL] Major credit metric mismatch: curr=${currBizEl.textContent}, after=${afterBizEl.textContent}`);
  process.exit(1);
}
console.log(`[PASS] Major credit metrics: ${currBizEl.textContent} -> ${afterBizEl.textContent}`);

if (currRemainEl.textContent != 80 || afterRemainEl.textContent != 71) {
  console.error(`[FAIL] Remaining credit metric mismatch: curr=${currRemainEl.textContent}, after=${afterRemainEl.textContent}`);
  process.exit(1);
}
console.log(`[PASS] Remaining credit metrics: ${currRemainEl.textContent} -> ${afterRemainEl.textContent}`);

// Case C: Over 18 credits (e.g. 21 credits)
console.log("\n--- 5. Case C: Over 18 Credits Warning ---");
global.basketCourses = [
  { id: 'c1', title: '과목1', cat: '경영_전선', credits: 3 },
  { id: 'c2', title: '과목2', cat: '경영_전선', credits: 3 },
  { id: 'c3', title: '과목3', cat: '경영_전선', credits: 3 },
  { id: 'c4', title: '과목4', cat: '경영_전선', credits: 3 },
  { id: 'c5', title: '과목5', cat: '경영_전선', credits: 3 },
  { id: 'c6', title: '과목6', cat: '경영_전선', credits: 3 },
  { id: 'c7', title: '과목7', cat: '경영_전선', credits: 3 } // 21 credits
];
renderBasketPlanSummary(21, 21, mockM, 130, 50, 71, 59);

if (totalBadge.className !== 'badge badge-danger') {
  console.error(`[FAIL] Expected badge-danger for >18 credits, got: ${totalBadge.className}`);
  process.exit(1);
}
console.log(`[PASS] Badge class set to badge-danger for 21 credits: ${totalBadge.className}`);

console.log("\n>>> ALL FEATURE 3 TESTS PASSED! <<<");
