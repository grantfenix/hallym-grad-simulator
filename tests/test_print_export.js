const fs = require('fs');
const path = require('path');

// 1. Mock DOM & Environment
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
let printed = false;

global.document = mockDoc;
global.window = {
  document: mockDoc,
  addEventListener: () => {},
  print: () => { printed = true; }
};

// 2. Load index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Feature 5: Graduation Diagnosis Print & PDF Export...");

// Check 1: Check CSS for print media rules
console.log("\n--- 1. Check CSS Media Print Rules ---");
const cssChecks = [
  '@media print',
  '.print-only {',
  '.no-print',
  'size: A4 portrait;',
  '.print-report-header',
  '.print-student-info'
];

for (const pattern of cssChecks) {
  if (!html.includes(pattern)) {
    console.error(`[FAIL] Missing CSS print rule: ${pattern}`);
    process.exit(1);
  }
}
console.log("[PASS] All required @media print CSS rules verified");

// Check 2: Check HTML Markup
console.log("\n--- 2. Check HTML Markup Elements ---");
const markupChecks = [
  'id="btn-print-tab1"',
  'id="btn-print-grad-report"',
  'class="print-only print-report-header"',
  'id="print-date"',
  'id="print-student-summary"',
  'id="print-val-id"',
  'id="print-val-name"',
  'id="print-val-major"',
  'id="print-val-type"'
];

for (const pattern of markupChecks) {
  if (!html.includes(pattern)) {
    console.error(`[FAIL] Missing markup element: ${pattern}`);
    process.exit(1);
  }
}
console.log("[PASS] All print buttons, headers, and metadata markup verified");

// Check 3: Extract Script & Test Logic
console.log("\n--- 3. Extract Script & Test Functionality ---");
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

// Test printGraduationReport
global.currentUser = {
  studentId: '20250000',
  name: '유아미',
  major: '경영학과',
  studentType: '재학생',
  admissionYear: 2025
};

printed = false;
printGraduationReport();

if (!printed) {
  console.error("[FAIL] window.print() was not invoked");
  process.exit(1);
}
console.log("[PASS] window.print() triggered successfully");

const tab2El = mockDoc.getElementById('tab-content-2');
if (tab2El.style.display !== 'block') {
  console.error(`[FAIL] Expected tab-content-2 display block, got: ${tab2El.style.display}`);
  process.exit(1);
}
console.log("[PASS] Tab 2 displayed as block for report printing");

const pDate = mockDoc.getElementById('print-date');
const pId = mockDoc.getElementById('print-val-id');
const pName = mockDoc.getElementById('print-val-name');
const pMajor = mockDoc.getElementById('print-val-major');
const pType = mockDoc.getElementById('print-val-type');

if (!pDate.textContent || pDate.textContent === '-') {
  console.error("[FAIL] Print date was not populated:", pDate.textContent);
  process.exit(1);
}
console.log(`[PASS] Print date populated: ${pDate.textContent}`);

if (pId.textContent !== '20250000' || pName.textContent !== '유아미' || pMajor.textContent !== '경영학과') {
  console.error(`[FAIL] Student info mismatch: id=${pId.textContent}, name=${pName.textContent}, major=${pMajor.textContent}`);
  process.exit(1);
}
console.log(`[PASS] Student metadata populated: ${pName.textContent} (${pId.textContent}), ${pMajor.textContent}`);

console.log("\n>>> ALL FEATURE 5 TESTS PASSED! <<<");
