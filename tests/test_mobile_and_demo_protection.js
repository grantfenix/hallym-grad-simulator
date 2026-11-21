const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  addEventListener: () => {},
  location: { search: '' }
};
global.alert = (msg) => {};
global.prompt = (msg) => 'demo2026!';

// 2. Read and parse index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log("Testing Mobile Optimization & Demo Protection Feature...");

// Test Section 1: Viewport Meta Tag & High-DPI Font Clarity
console.log("\n--- 1. Viewport Meta Tag & High-DPI Rendering ---");
if (!html.includes('width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover')) {
  throw new Error("Missing or incomplete viewport meta tag with viewport-fit=cover");
}
console.log("  [PASS] Viewport meta tag properly configured for modern mobile displays");

if (!html.includes('text-rendering: optimizeLegibility') || !html.includes('-webkit-text-size-adjust: 100%')) {
  throw new Error("Missing mobile font clarity rules (text-rendering or -webkit-text-size-adjust)");
}
console.log("  [PASS] Font clarity CSS rules verified");

// Test Section 2: Responsive Breakpoints & Hardware Acceleration
console.log("\n--- 2. Responsive Breakpoints & GPU Transform ---");
const responsiveChecks = [
  '@media (max-width: 860px)',
  '.sim-layout {',
  'grid-template-columns: 1fr;',
  '@media (max-width: 768px)',
  '.hero-box {',
  '@media (max-width: 480px)',
  'translate3d(-50%, 0, 0)'
];

for (const pattern of responsiveChecks) {
  if (!html.includes(pattern)) {
    throw new Error(`Responsive CSS pattern missing: ${pattern}`);
  }
}
console.log("  [PASS] Mobile responsive CSS layout rules and hardware-accelerated floating bar verified");

// Test Section 3: Demo Button Stealth HTML Structure
console.log("\n--- 3. Demo Account Button Stealth HTML Structure ---");
if (!html.includes('id="auth-badge-secret"') || !html.includes('handleSecretDemoToggle()')) {
  throw new Error("Missing secret click trigger on auth badge");
}
console.log("  [PASS] Secret 3-click trigger configured on auth badge");

if (!html.includes('id="demo-account-container"') || !html.includes('style="display: none;')) {
  throw new Error("Demo account container is not hidden by default");
}
console.log("  [PASS] Demo account container hidden by default for regular users");

if (!html.includes('id="btn-demo-login"') || !html.includes('handleDemoLoginWithPrompt()')) {
  throw new Error("Missing protected demo login button with prompt handler");
}
console.log("  [PASS] Demo login button attached to password prompt handler");

// Test Section 4: Demo Authentication Logic & Hashing
console.log("\n--- 4. Demo Authentication Logic & Hashing ---");

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error("Cannot locate script tag in index.html");
}
const scriptContent = scriptMatch[1];

const demoSandbox = {
  DEMO_PW_HASHES: null,
  sha256: null,
  verifyDemoPassword: null,
  handleSecretDemoToggle: null,
  checkDemoModeUrl: null,
  document: mockDoc,
  window: global.window,
  showToast: () => {},
  alert: () => {},
  prompt: (msg) => 'demo2026!'
};

const fnExtractor = new Function('sandbox', `
  with(sandbox) {
    ${scriptContent.substring(scriptContent.indexOf('function sha256('), scriptContent.indexOf('function handleRegister('))}
    sandbox.DEMO_PW_HASHES = DEMO_PW_HASHES;
    sandbox.sha256 = sha256;
    sandbox.verifyDemoPassword = verifyDemoPassword;
    sandbox.handleSecretDemoToggle = handleSecretDemoToggle;
    sandbox.checkDemoModeUrl = checkDemoModeUrl;
  }
`);

fnExtractor(demoSandbox);

// Check sha256 hash validity
const expectedHash2026 = crypto.createHash('sha256').update('demo2026!').digest('hex');
const expectedHash1234 = crypto.createHash('sha256').update('1234').digest('hex');

if (!demoSandbox.DEMO_PW_HASHES.includes(expectedHash2026)) {
  throw new Error("DEMO_PW_HASHES does not contain sha256 hash of 'demo2026!'");
}
if (!demoSandbox.DEMO_PW_HASHES.includes(expectedHash1234)) {
  throw new Error("DEMO_PW_HASHES does not contain sha256 hash of '1234'");
}
console.log("  [PASS] DEMO_PW_HASHES securely hashes passwords");

// Test verifyDemoPassword
if (!demoSandbox.verifyDemoPassword('demo2026!')) {
  throw new Error("verifyDemoPassword failed for correct password 'demo2026!'");
}
if (!demoSandbox.verifyDemoPassword('1234')) {
  throw new Error("verifyDemoPassword failed for fallback password '1234'");
}
if (demoSandbox.verifyDemoPassword('wrong_password_9999')) {
  throw new Error("verifyDemoPassword unexpectedly accepted wrong password");
}
if (demoSandbox.verifyDemoPassword('')) {
  throw new Error("verifyDemoPassword unexpectedly accepted empty password");
}
console.log("  [PASS] Password verification correctly accepts valid credentials and rejects invalid ones");

// Test Section 5: Secret 3-Click Toggle & URL Parameter Activation
console.log("\n--- 5. Secret Toggle & URL Parameter Activation ---");
const demoContainer = mockDoc.getElementById('demo-account-container');
demoContainer.style.display = 'none';

// 1 click -> should remain 'none'
demoSandbox.handleSecretDemoToggle();
if (demoContainer.style.display !== 'none') {
  throw new Error("Demo container should not show after 1 click");
}

// 2 clicks -> should remain 'none'
demoSandbox.handleSecretDemoToggle();
if (demoContainer.style.display !== 'none') {
  throw new Error("Demo container should not show after 2 clicks");
}

// 3 clicks -> should toggle to 'block'
demoSandbox.handleSecretDemoToggle();
if (demoContainer.style.display !== 'block') {
  throw new Error("Demo container should show after 3 rapid clicks");
}
console.log("  [PASS] Secret 3-click trigger successfully reveals the demo button");

// URL query parameter check
demoContainer.style.display = 'none';
global.window.location.search = '?demo=true';
demoSandbox.checkDemoModeUrl();
if (demoContainer.style.display !== 'block') {
  throw new Error("Demo container should activate when ?demo=true is present in URL");
}
console.log("  [PASS] URL query parameter (?demo=true) successfully reveals demo container");

console.log("\n>>> ALL MOBILE OPTIMIZATION & DEMO PROTECTION TESTS PASSED SUCCESSFULLY! <<<\n");
