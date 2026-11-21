const fs = require('fs');
const path = require('path');

// 1. Mock DOM Environment
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag;
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      toggle: (c, force) => {
        if (force === true) this.classList.classes.add(c);
        else if (force === false) this.classList.classes.delete(c);
        else if (this.classList.classes.has(c)) this.classList.classes.delete(c);
        else this.classList.classes.add(c);
      },
      contains: (c) => this.classList.classes.has(c)
    };
  }
  appendChild(c) { this.children.push(c); }
  setAttribute() {}
  removeAttribute() {}
}

class MockDOM {
  constructor() {
    this.elements = {};
  }
  getElementById(id) {
    if (!this.elements[id]) this.elements[id] = new MockElement(id);
    return this.elements[id];
  }
  createElement(tag) { return new MockElement('', tag); }
  addEventListener() {}
}

const mockDoc = new MockDOM();
global.document = mockDoc;
global.window = {
  document: mockDoc,
  addEventListener: () => {}
};

// 2. Load index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Feature: 2-Tier Graduation Diagnosis (Summary + Detailed)...");

// Check 1: HTML Markup & CSS
console.log("\n--- 1. Check HTML Markup & CSS ---");
const checks = [
  'id="diag-summary-card"',
  'id="diag-details-section"',
  'id="btn-toggle-diag-details"',
  'id="diag-kpi-total"',
  'id="diag-kpi-major"',
  'id="diag-kpi-remain"',
  'id="diag-top3-problems"',
  'id="diag-core-recommendations"',
  '.diag-summary-card {',
  '.diag-kpi-grid {',
  '.diag-action-grid {'
];

for (const pattern of checks) {
  if (!html.includes(pattern)) {
    console.error(`[FAIL] Missing pattern in index.html: ${pattern}`);
    process.exit(1);
  }
}
console.log("[PASS] All required 2-tier markup and CSS styles are present");

// Check 2: Extract Script & Evaluate
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

// Check 3: renderDiagSummaryCard
console.log("\n--- 3. Test renderDiagSummaryCard ---");
const mockUser = {
  studentId: '20250000',
  name: '유아미',
  major: '경영학과',
  studentType: '재학생',
  admissionYear: 2025,
  hasDoubleMajor: false
};

const mockMetrics = {
  confTotal: 34,
  currTotal: 17,
  expTotal: 51,
  remainTotal: 79,
  reqTotalCredits: 130,
  confMajor: 9,
  expMajor: 13,
  remainMajor: 47,
  reqMajorCredits: 60,
  mandatoryStatus: [
    { title: '마케팅관리', credits: 3, status: 'MISSING' },
    { title: '경영정보시스템', credits: 3, status: 'MISSING' }
  ],
  hasOdyssey2: false,
  infoDeficit: 3,
  careerEnglishRequired: true,
  hasCareerEnglish: false
};

renderDiagSummaryCard(mockMetrics, mockUser);

const kpiTotalEl = mockDoc.getElementById('diag-kpi-total');
const kpiMajorEl = mockDoc.getElementById('diag-kpi-major');
const kpiRemainEl = mockDoc.getElementById('diag-kpi-remain');

if (!kpiTotalEl.innerHTML.includes('51') || !kpiTotalEl.innerHTML.includes('130')) {
  console.error("[FAIL] KPI Total credits mismatch:", kpiTotalEl.innerHTML);
  process.exit(1);
}
console.log("[PASS] KPI Total credits verified: 51 / 130");

if (!kpiMajorEl.innerHTML.includes('13') || !kpiMajorEl.innerHTML.includes('60')) {
  console.error("[FAIL] KPI Major credits mismatch:", kpiMajorEl.innerHTML);
  process.exit(1);
}
console.log("[PASS] KPI Major credits verified: 13 / 60");

if (!kpiRemainEl.innerHTML.includes('79')) {
  console.error("[FAIL] KPI Remaining credits mismatch:", kpiRemainEl.innerHTML);
  process.exit(1);
}
console.log("[PASS] KPI Remaining credits verified: 79");

const probContainer = mockDoc.getElementById('diag-top3-problems');
if (probContainer.children.length === 0) {
  console.error("[FAIL] Top 3 problems container has no items");
  process.exit(1);
}
console.log(`[PASS] Top problems populated with ${probContainer.children.length} items (Max 3)`);

const recContainer = mockDoc.getElementById('diag-core-recommendations');
if (recContainer.children.length === 0) {
  console.error("[FAIL] Core recommendations container has no items");
  process.exit(1);
}
console.log(`[PASS] Core recommendations populated with ${recContainer.children.length} items`);

// Check 4: toggleDiagDetails Collapsible Logic
console.log("\n--- 4. Test toggleDiagDetails Collapsible ---");
const detailsSec = mockDoc.getElementById('diag-details-section');
const toggleBtn = mockDoc.getElementById('btn-toggle-diag-details');
const toggleText = mockDoc.getElementById('diag-toggle-text');

detailsSec.style.display = 'none';

// First toggle: expand
toggleDiagDetails();
if (detailsSec.style.display !== 'block') {
  console.error("[FAIL] Details section should be 'block' after first toggle, got:", detailsSec.style.display);
  process.exit(1);
}
if (!toggleText.textContent.includes('접기')) {
  console.error("[FAIL] Toggle button should indicate collapse action, got:", toggleText.textContent);
  process.exit(1);
}
console.log("[PASS] Expanded details section successfully (display: block, button text updated to '접기')");

// Second toggle: collapse
toggleDiagDetails();
if (detailsSec.style.display !== 'none') {
  console.error("[FAIL] Details section should be 'none' after second toggle, got:", detailsSec.style.display);
  process.exit(1);
}
if (!toggleText.textContent.includes('세부 진단 내역 보기')) {
  console.error("[FAIL] Toggle button should indicate expand action, got:", toggleText.textContent);
  process.exit(1);
}
console.log("[PASS] Collapsed details section successfully (display: none, button text updated to '보기')");

console.log("\n>>> ALL 2-TIER DIAGNOSIS TESTS PASSED! <<<");
