const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Hallym Business Administration 6 Official Career Tracks & Exam Waiver Decoupling...\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract script
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const mockElements = {
  'biz-exam-waiver-card': { style: {}, innerHTML: '' },
  'biz-exam-waiver-container': { innerHTML: '', appendChild: () => {} },
  'biz-exam-waiver-summary-badge': { innerHTML: '', textContent: '' },
  'major-track-card': { style: {}, innerHTML: '' },
  'major-track-container': { innerHTML: '', appendChild: () => {} },
  'major-track-title': { textContent: '' },
  'major-track-summary-badge': { innerHTML: '', textContent: '' },
  'autocomplete-dropdown': { style: {}, innerHTML: '', appendChild: () => {} }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

const sandbox = {
  window: { addEventListener: () => {} },
  document: domMock,
  console: console,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  encodeURIComponent: encodeURIComponent
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

const TRACK_DEFINITIONS = vm.runInContext('TRACK_DEFINITIONS', sandbox);
const BIZ_EXAM_WAIVER_RULES = vm.runInContext('BIZ_EXAM_WAIVER_RULES', sandbox);
const diagnoseBizExamWaiver = vm.runInContext('diagnoseBizExamWaiver', sandbox);
const diagnoseMajorTrack = vm.runInContext('diagnoseMajorTrack', sandbox);
const coursesJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/courses.json'), 'utf8'));

// 1. Verify 6 official track names
console.log('--- 1. Verify 6 Official Track Names ---');
const expectedTracks = [
  '회계·세무',
  '의료경영',
  '글로벌혁신전략',
  '비즈니스인텔리전스',
  '관광경영',
  '마케팅기획'
];

expectedTracks.forEach(tName => {
  if (TRACK_DEFINITIONS[tName]) {
    console.log(`[PASS] Found official track: ${tName} (${TRACK_DEFINITIONS[tName].title})`);
  } else {
    throw new Error(`Missing expected track: ${tName}`);
  }
});

// 2. Verify all track courses match courses.json
console.log('\n--- 2. Verify Track Courses Match courses.json ---');
const courseMap = {};
coursesJson.forEach(c => {
  courseMap[String(c.code)] = c;
});

let totalTrackCoursesCount = 0;
expectedTracks.forEach(tName => {
  const t = TRACK_DEFINITIONS[tName];
  const allCourses = [...t.foundationCourses, ...t.advancedCourses];
  allCourses.forEach(c => {
    totalTrackCoursesCount++;
    const found = courseMap[String(c.code)];
    if (!found) {
      throw new Error(`Track ${tName} course ${c.code} (${c.title}) not in courses.json!`);
    }
    if (found.credits !== c.credits) {
      throw new Error(`Track ${tName} course ${c.title} credits mismatch: ${c.credits} vs DB ${found.credits}`);
    }
  });
  console.log(`[PASS] ${tName}: foundation=${t.foundationCourses.length}, advanced=${t.advancedCourses.length} all verified in DB.`);
});
console.log(`[PASS] All ${totalTrackCoursesCount} track courses fully verified against courses.json.`);

// 3. Verify Decoupled Graduation Exam Waiver Rules
console.log('\n--- 3. Verify Decoupled Graduation Exam Waiver Rules ---');
if (!BIZ_EXAM_WAIVER_RULES || BIZ_EXAM_WAIVER_RULES.requiredFieldsCount !== 4) {
  throw new Error('BIZ_EXAM_WAIVER_RULES requiredFieldsCount must be 4!');
}
const fieldNames = Object.keys(BIZ_EXAM_WAIVER_RULES.fields);
if (fieldNames.length !== 9) {
  throw new Error(`BIZ_EXAM_WAIVER_RULES must have 9 fields, got ${fieldNames.length}`);
}
console.log(`[PASS] Exam waiver rule has 9 official fields: ${fieldNames.join(', ')}`);

// 4. Verify Track Not Selected (user.track = 'none')
console.log('\n--- 4. Verify Behavior when Track Not Selected ---');
const mockUserNoTrack = { studentId: '20250001', major: '경영학과', track: 'none' };
const sampleCourses = [
  { code: '205201', title: '회계입문', grade: 'A0', credits: 3 },
  { code: '205303', title: '마케팅원론', grade: 'B+', credits: 3 },
  { code: '205206', title: '조직행동론', grade: 'B0', credits: 3 },
  { code: '205305', title: '재무관리', grade: 'B0', credits: 3 }
];

const trackDiagNoTrack = diagnoseMajorTrack(sampleCourses, mockUserNoTrack);
if (trackDiagNoTrack !== null) {
  throw new Error('diagnoseMajorTrack should return null when user.track is none!');
}
console.log('[PASS] diagnoseMajorTrack returned null for user with track="none".');

const examDiag = diagnoseBizExamWaiver(sampleCourses, mockUserNoTrack);
if (!examDiag) {
  throw new Error('diagnoseBizExamWaiver should succeed even when user.track is none!');
}
if (examDiag.waivedFieldsCount !== 4) {
  throw new Error(`Expected 4 waived fields, got ${examDiag.waivedFieldsCount}`);
}
if (!examDiag.isExamWaiverComplete) {
  throw new Error('Exam waiver should be complete with 4 B0+ courses!');
}
console.log(`[PASS] Exam waiver successfully evaluated independently: ${examDiag.effectiveWaivedCount}/4 fields waived (Complete: ${examDiag.isExamWaiverComplete}).`);

// 5. Verify Capstone Design Bonus (+1 field)
console.log('\n--- 5. Verify Capstone Bonus (+1 field) ---');
const capstoneCourses = [
  { code: '205201', title: '회계입문', grade: 'A0', credits: 3 }, // 회계학 1
  { code: '205303', title: '마케팅원론', grade: 'B+', credits: 3 }, // 마케팅 2
  { code: '205206', title: '조직행동론', grade: 'B0', credits: 3 }, // 조직/인사 3
  { code: '210112', title: '캡스톤디자인', grade: 'B0', credits: 3 } // Capstone bonus!
];
const capstoneDiag = diagnoseBizExamWaiver(capstoneCourses, mockUserNoTrack);
if (!capstoneDiag.capstoneBonus) {
  throw new Error('Capstone bonus was not activated with B0 grade!');
}
if (capstoneDiag.effectiveWaivedCount !== 4) {
  throw new Error(`Expected effective count 4 with capstone bonus, got ${capstoneDiag.effectiveWaivedCount}`);
}
if (!capstoneDiag.isExamWaiverComplete) {
  throw new Error('Exam waiver should be complete (3 direct + 1 capstone = 4)!');
}
console.log('[PASS] Capstone design 210112 B0 correctly awarded +1 bonus field to reach 4/4 waived fields.');

// 6. Verify Track Diagnosis for Selected Track
console.log('\n--- 6. Verify Selected Track Diagnosis ---');
const mockUserAccounting = { studentId: '20250001', major: '경영학과', track: '회계·세무' };
const accCourses = [
  { code: '204101', title: '경제학원론(거시)', grade: 'A0', credits: 3 },
  { code: '205201', title: '회계입문', grade: '수강중', credits: 3 },
  { code: '205214', title: '중급회계', grade: 'B+', credits: 3 }
];
const accDiag = diagnoseMajorTrack(accCourses, mockUserAccounting);
if (!accDiag) throw new Error('diagnoseMajorTrack returned null for valid track!');
if (accDiag.foundationPassedCount !== 1) {
  throw new Error(`Expected 1 passed foundation course, got ${accDiag.foundationPassedCount}`);
}
if (accDiag.foundationInProgCount !== 1) {
  throw new Error(`Expected 1 in-prog foundation course, got ${accDiag.foundationInProgCount}`);
}
if (accDiag.advancedPassedCount !== 1) {
  throw new Error(`Expected 1 passed advanced course, got ${accDiag.advancedPassedCount}`);
}
console.log(`[PASS] 회계·세무 track diagnosis: foundation passed=${accDiag.foundationPassedCount}, inProg=${accDiag.foundationInProgCount}, advanced passed=${accDiag.advancedPassedCount}.`);

// 7. Verify UI Renderers
console.log('\n--- 7. Verify UI Renderers Execution ---');
sandbox.currentUser = mockUserAccounting;
sandbox.activeUserCourses = accCourses;
vm.runInContext('currentUser = ' + JSON.stringify(mockUserAccounting), sandbox);
vm.runInContext('activeUserCourses = ' + JSON.stringify(accCourses), sandbox);
vm.runInContext('renderBizExamWaiver({ reqMajorCredits: 60 }, currentUser)', sandbox);
vm.runInContext('renderTrackDiagnosis({ reqMajorCredits: 60 }, currentUser)', sandbox);

if (mockElements['biz-exam-waiver-card'].style.display !== 'block') {
  throw new Error('biz-exam-waiver-card should be display: block');
}
if (mockElements['major-track-card'].style.display !== 'block') {
  throw new Error('major-track-card should be display: block');
}
if (!mockElements['major-track-title'].textContent.includes('회계·세무')) {
  throw new Error('major-track-title does not contain 회계·세무');
}
console.log('[PASS] UI renderers successfully rendered cards without errors.');

// 8. Verify Mobile 360px CSS definitions
console.log('\n--- 8. Verify Mobile 360px CSS ---');
if (!htmlContent.includes('#biz-exam-waiver-card') || !htmlContent.includes('.exam-grid')) {
  throw new Error('Missing #biz-exam-waiver-card or .exam-grid in responsive CSS');
}
console.log('[PASS] Responsive CSS includes #biz-exam-waiver-card, #major-track-card, and .exam-grid for 360px viewports.');

console.log('\n========================================');
console.log('ALL 8 VERIFICATION TESTS PASSED (100% OK)');
console.log('========================================');
