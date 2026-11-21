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

  appendChild(child) {
    if (!this.children) this.children = [];
    this.children.push(child);
  }

  scrollIntoView() {}
}

class MockDOM {
  constructor() {
    this.elements = {};
  }

  addEventListener() {}
  removeEventListener() {}

  createElement(tag) {
    return new MockElement('', tag);
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

let confirmPromptText = '';
let confirmResponse = true;
global.confirm = (msg) => {
  confirmPromptText = msg;
  return confirmResponse;
};

// 2. Load index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Feature 2: Sample Transcript Quick-Fill...");

// Check 1: HTML Markup
console.log("\n--- 1. Check HTML Markup ---");
const countQuickFillButtons = (html.match(/handleQuickFillSampleTranscript/g) || []).length;
console.log(`Found ${countQuickFillButtons} handleQuickFillSampleTranscript triggers in HTML`);

if (countQuickFillButtons >= 3) {
  console.log("[PASS] Tab 2 toolbar, Tab 2 empty state, and PDF modal triggers verified");
} else {
  console.error(`[FAIL] Expected at least 3 triggers, found ${countQuickFillButtons}`);
  process.exit(1);
}

// Check 2: Extract Script & Evaluate
console.log("\n--- 2. Extract Script & Test Logic ---");
const scriptTagStart = html.lastIndexOf('<script>');
const scriptTagEnd = html.lastIndexOf('</script>');
const scriptCode = html.substring(scriptTagStart + 8, scriptTagEnd);

let instCode = scriptCode;
instCode = instCode.replace('let parsedCourseItems = [];', 'global.parsedCourseItems = [];');
instCode = instCode.replace('let currentUser = null;', 'global.currentUser = null;');
instCode = instCode.replace('let activeUserCourses = [];', 'global.activeUserCourses = [];');

try {
  eval(instCode);
  console.log("[PASS] Script evaluated successfully");
} catch (err) {
  console.error("[FAIL] Script evaluation failed:", err);
  process.exit(1);
}

// Test Case A: Fresh Quick-Fill
global.parsedCourseItems = [];
handleQuickFillSampleTranscript();

if (global.parsedCourseItems && global.parsedCourseItems.length === 8) {
  console.log("[PASS] Case A: Successfully populated 8 sample courses in parsedCourseItems");
} else {
  console.error(`[FAIL] Case A failed: expected 8 courses, got ${global.parsedCourseItems ? global.parsedCourseItems.length : 0}`);
  process.exit(1);
}

const titles = global.parsedCourseItems.map(c => c.title);
if (titles.includes('경영학원론') && titles.includes('마케팅원론') && titles.includes('컴퓨팅사고')) {
  console.log("[PASS] Case A Course content verified:", titles.slice(0, 4).join(', '));
} else {
  console.error("[FAIL] Expected courses missing in sample!");
  process.exit(1);
}

// Check UI Elements updated
const modalEl = mockDom.getElementById('pdf-upload-modal');
const parsedTableEl = mockDom.getElementById('pdf-parsed-results-container');
const previewEl = mockDom.getElementById('pdf-extracted-preview');

if (modalEl.style.display === 'flex' && parsedTableEl.style.display === 'block' && previewEl.textContent.includes('010001 경영학원론')) {
  console.log("[PASS] Case A: Modal opened, parsed table rendered, preview text loaded");
} else {
  console.error("[FAIL] Case A UI elements not updated properly");
  process.exit(1);
}

// Test Case B: Overwrite protection (Cancel)
console.log("\n--- 3. Overwrite Protection Test ---");
confirmResponse = false;
confirmPromptText = '';

// Manually modify parsed items
global.parsedCourseItems = [{ id: 'custom_1', title: '사용자_입력_과목' }];
handleQuickFillSampleTranscript();

if (global.parsedCourseItems.length === 1 && global.parsedCourseItems[0].title === '사용자_입력_과목') {
  console.log("[PASS] Case B: User clicked Cancel -> existing data protected from overwrite!");
} else {
  console.error("[FAIL] Case B failed: data was overwritten despite confirm cancellation");
  process.exit(1);
}

// Test Case C: Overwrite confirmed
confirmResponse = true;
handleQuickFillSampleTranscript();

if (global.parsedCourseItems.length === 8 && global.parsedCourseItems.some(c => c.title === '경영학원론')) {
  console.log("[PASS] Case C: User clicked OK -> safely reloaded 8 sample courses");
} else {
  console.error("[FAIL] Case C failed: could not reload sample courses on confirmation");
  process.exit(1);
}

console.log("\n==============================================");
console.log(" ALL SAMPLE QUICK-FILL TESTS PASSED (100%)! ");
console.log("==============================================");
