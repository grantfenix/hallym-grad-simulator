const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const graduationRules = require('../data/graduation_rules.js');
const gyoyangRules = require('../data/gyoyang_rules.js');

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const mockElements = {
  'ge-cards-container': { innerHTML: '', children: [], appendChild: function(el) { this.children.push(el); } },
  'btn-toggle-all-ge': { textContent: '' }
};

class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this._classes = new Set();
    this.classList = {
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      contains: (c) => this._classes.has(c),
      toggle: (c) => {
        if (this._classes.has(c)) { this._classes.delete(c); return false; }
        else { this._classes.add(c); return true; }
      }
    };
    this.style = {};
    this.dataset = {};
    this.innerHTML = '';
  }
  set className(name) {
    this._classes.clear();
    (name || '').split(' ').filter(Boolean).forEach(c => this._classes.add(c));
  }
  get className() {
    return Array.from(this._classes).join(' ');
  }
}

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} },
  querySelectorAll: (selector) => {
    if (selector.includes('#ge-cards-container .ge-item')) {
      return mockElements['ge-cards-container'].children;
    }
    return [];
  },
  createElement: (tag) => new MockElement(tag),
  addEventListener: () => {}
};

const sandbox = {
  window: {},
  document: domMock,
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  HALLYM_GRADUATION_RULES: graduationRules,
  HALLYM_GYOYANG_RULES: gyoyangRules,
  graduationRules: graduationRules,
  gyoyangRules: gyoyangRules,
  console: console
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing GE 6-Area Accordion Simplification...');

// Sample GE Diagnosis input for 6 areas
const sampleDiagnosis = [
  { area: '정보소통', required_credits: 5, confirmed_credits: 0, in_prog_credits: 0, status: 'MISSING', sub_items: [{ name: '컴퓨팅사고', required_credits: 2, confirmed_credits: 0, status: 'MISSING', candidates: ['컴퓨팅사고와문제해결'] }] },
  { area: '생애설계', required_credits: 2, confirmed_credits: 1, in_prog_credits: 1, status: 'IN_PROGRESS', sub_items: [{ name: '오디세이세미나1', required_credits: 1, confirmed_credits: 1, status: 'PASSED', matched: [{ title: '오디세이세미나1', credits: 1, grade: 'P' }] }] },
  { area: '의사소통', required_credits: 3, confirmed_credits: 3, in_prog_credits: 0, status: 'PASSED', sub_items: [{ name: '발표와토론', required_credits: 3, confirmed_credits: 3, status: 'PASSED', matched: [{ title: '(외국인)발표와토론2', credits: 3, grade: 'A+' }] }] },
  { area: '글로벌소통', required_credits: 9, confirmed_credits: 6, in_prog_credits: 6, status: 'IN_PROGRESS', sub_items: [] },
  { area: '스포츠웰니스', required_credits: 1, confirmed_credits: 2, in_prog_credits: 0, status: 'PASSED', sub_items: [] },
  { area: '자율선택', required_credits: 6, confirmed_credits: 13, in_prog_credits: 4, status: 'PASSED', sub_items: [] }
];

// Test 1: renderGeCards creates 6 cards
mockElements['ge-cards-container'].children = [];
sandbox.renderGeCards(sampleDiagnosis, 26);

const cards = mockElements['ge-cards-container'].children;
console.log(`Rendered cards count: ${cards.length}`);
if (cards.length !== 6) throw new Error(`Expected 6 cards, got ${cards.length}`);

// Test 2: Check default folded state (NO card has .expanded by default)
cards.forEach((card, idx) => {
  const isExp = card.classList.contains('expanded');
  console.log(`Card ${idx + 1} (${card.dataset.area}): expanded = ${isExp}`);
  if (isExp) throw new Error(`Card ${card.dataset.area} should NOT be expanded by default`);
  
  if (!card.innerHTML.includes('ge-accordion-body')) {
    throw new Error(`Card ${card.dataset.area} missing ge-accordion-body container`);
  }
  if (!card.innerHTML.includes('ge-accordion-toggle')) {
    throw new Error(`Card ${card.dataset.area} missing ge-accordion-toggle`);
  }
});
console.log('[PASS] Test 1 & 2: 6 cards created and properly folded by default');

// Test 3: Toggle single card
const infoCard = cards[0]; // 정보소통
console.log('\nToggling 정보소통 card:');
sandbox.toggleGeAccordion(infoCard, '정보소통');
if (!infoCard.classList.contains('expanded')) throw new Error('정보소통 should be expanded after toggle');
console.log('[PASS] 정보소통 card expanded on click');

sandbox.toggleGeAccordion(infoCard, '정보소통');
if (infoCard.classList.contains('expanded')) throw new Error('정보소통 should be collapsed after second toggle');
console.log('[PASS] 정보소통 card collapsed on second click');

// Test 4: Toggle all cards
console.log('\nToggling ALL cards:');
sandbox.toggleAllGeAccordion(); // Should expand all
cards.forEach(c => {
  if (!c.classList.contains('expanded')) throw new Error(`Card ${c.dataset.area} should be expanded`);
});
console.log('[PASS] All 6 cards expanded');
if (mockElements['btn-toggle-all-ge'].textContent !== '전체 접기 ▲') {
  throw new Error(`Expected '전체 접기 ▲', got '${mockElements['btn-toggle-all-ge'].textContent}'`);
}

sandbox.toggleAllGeAccordion(); // Should collapse all
cards.forEach(c => {
  if (c.classList.contains('expanded')) throw new Error(`Card ${c.dataset.area} should be collapsed`);
});
console.log('[PASS] All 6 cards collapsed');
if (mockElements['btn-toggle-all-ge'].textContent !== '전체 펼치기 ▼') {
  throw new Error(`Expected '전체 펼치기 ▼', got '${mockElements['btn-toggle-all-ge'].textContent}'`);
}

console.log('\n ALL GE ACCORDION TESTS PASSED (100%)!');
