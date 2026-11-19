const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const mockElements = {
  'filter-year': { value: 'ALL', options: [] },
  'filter-term': { value: 'ALL' },
  'filter-category': { value: 'ALL' },
  'filter-search': { value: '' },
  'my-courses-tbody': { innerHTML: '', appendChild: () => {} },
  'my-courses-empty': { style: {} }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} },
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

const sandbox = {
  window: {},
  document: domMock,
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console: console
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Testing Semester Filter Split (Year + Term)...');

// 1. Test parseSemesterParts
console.log('\n--- 1. parseSemesterParts Unit Tests ---');
const testCases = [
  { input: '2025-1', expectedYear: '2025', expectedTerm: '1' },
  { input: '2025-2', expectedYear: '2025', expectedTerm: '2' },
  { input: '2026-1학기', expectedYear: '2026', expectedTerm: '1' },
  { input: '2026-2 (수강중)', expectedYear: '2026', expectedTerm: '2' },
  { input: '2024-여름', expectedYear: '2024', expectedTerm: '여름' },
  { input: '2024-겨울', expectedYear: '2024', expectedTerm: '겨울' },
  { input: '기타', expectedYear: '기타', expectedTerm: '기타' },
  { input: null, expectedYear: '기타', expectedTerm: '기타' }
];

testCases.forEach(({ input, expectedYear, expectedTerm }) => {
  const res = sandbox.parseSemesterParts(input);
  if (res.year !== expectedYear || res.term !== expectedTerm) {
    throw new Error(`parseSemesterParts failed for "${input}": got ${JSON.stringify(res)}, expected { year: "${expectedYear}", term: "${expectedTerm}" }`);
  }
  console.log(`[PASS] "${input}" -> year: ${res.year}, term: ${res.term}`);
});

// 2. Test Filtering with DEMO Courses
console.log('\n--- 2. Filter Combination Tests ---');
const sampleCourses = [
  { id: '1', title: '과목A', semester: '2025-1', cat: '전선', credits: 3, grade: 'A0' },
  { id: '2', title: '과목B', semester: '2025-2', cat: '전선', credits: 3, grade: 'B0' },
  { id: '3', title: '과목C', semester: '2026-1', cat: '전필', credits: 3, grade: 'A+' },
  { id: '4', title: '과목D', semester: '2026-2', cat: '교양', credits: 3, grade: '수강중' },
  { id: '5', title: '과목E', semester: '2026-2', cat: '전선', credits: 3, grade: '수강중' }
];

const mockStorage = {
  'hallym_courses_20258044': JSON.stringify(sampleCourses)
};

sandbox.localStorage.getItem = (k) => mockStorage[k] || null;

sandbox.completeLogin({
  studentId: '20258044',
  name: '유아미',
  admissionYear: 2025,
  major: '경영학과',
  studentType: '재학생',
  hasDoubleMajor: false,
  doubleMajorName: ''
});

// Helper to run renderMyInfoCoursesTable and count created rows
function getFilteredCount(year, term, cat = 'ALL', search = '') {
  mockElements['filter-year'].value = year;
  mockElements['filter-term'].value = term;
  mockElements['filter-category'].value = cat;
  mockElements['filter-search'].value = search;
  
  let rowCount = 0;
  mockElements['my-courses-tbody'].appendChild = () => { rowCount++; };
  sandbox.renderMyInfoCoursesTable();
  return rowCount;
}

// Case A: ALL + ALL -> 5
const countAll = getFilteredCount('ALL', 'ALL');
console.log(`ALL + ALL: ${countAll} courses`);
if (countAll !== 5) throw new Error(`Expected 5, got ${countAll}`);

// Case B: Year 2025 + ALL -> 2 (2025-1, 2025-2)
const count2025 = getFilteredCount('2025', 'ALL');
console.log(`2025 + ALL: ${count2025} courses`);
if (count2025 !== 2) throw new Error(`Expected 2, got ${count2025}`);

// Case C: Year 2026 + ALL -> 3 (2026-1, 2026-2, 2026-2)
const count2026 = getFilteredCount('2026', 'ALL');
console.log(`2026 + ALL: ${count2026} courses`);
if (count2026 !== 3) throw new Error(`Expected 3, got ${count2026}`);

// Case D: ALL + Term 1 -> 2 (2025-1, 2026-1)
const countTerm1 = getFilteredCount('ALL', '1');
console.log(`ALL + Term 1: ${countTerm1} courses`);
if (countTerm1 !== 2) throw new Error(`Expected 2, got ${countTerm1}`);

// Case E: ALL + Term 2 -> 3 (2025-2, 2026-2, 2026-2)
const countTerm2 = getFilteredCount('ALL', '2');
console.log(`ALL + Term 2: ${countTerm2} courses`);
if (countTerm2 !== 3) throw new Error(`Expected 3, got ${countTerm2}`);

// Case F: 2026 + Term 2 -> 2 (2026-2, 2026-2)
const count2026Term2 = getFilteredCount('2026', '2');
console.log(`2026 + Term 2: ${count2026Term2} courses`);
if (count2026Term2 !== 2) throw new Error(`Expected 2, got ${count2026Term2}`);

// Case G: 2027 + ALL -> 0
const count2027 = getFilteredCount('2027', 'ALL');
console.log(`2027 + ALL: ${count2027} courses`);
if (count2027 !== 0) throw new Error(`Expected 0, got ${count2027}`);

console.log('\n ALL SEMESTER FILTER TESTS PASSED (100%)!');
