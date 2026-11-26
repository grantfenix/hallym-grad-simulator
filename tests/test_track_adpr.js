const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 2: 광고홍보학과 Tracks (3 Official Tracks + IAA Diploma + 미확인 표시)...\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const HALLYM_TRACKS = require('../data/tracks.js');
const coursesJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/courses.json'), 'utf8'));
const ragEngineFactory = require('../js/rag_engine.js');

const mockElements = {
  'major-track-card': { style: {}, innerHTML: '' },
  'major-track-container': { innerHTML: '', appendChild: () => {} },
  'major-track-title': { textContent: '' },
  'major-track-summary-badge': { innerHTML: '', textContent: '' },
  'modal-track-select': { innerHTML: '', value: 'none' },
  'modal-track-wrap': { style: {} },
  'modal-track-hint': { textContent: '' }
};

const domMock = {
  getElementById: (id) => mockElements[id] || { innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ innerHTML: '', textContent: '', style: {}, classList: { toggle: () => {} }, appendChild: () => {} })
};

const sandbox = {
  window: { addEventListener: () => {}, HALLYM_TRACKS },
  HALLYM_TRACKS,
  document: domMock,
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  setTimeout,
  clearTimeout,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  encodeURIComponent
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

const diagnoseMajorTrack = vm.runInContext('diagnoseMajorTrack', sandbox);
const renderTrackDiagnosis = vm.runInContext('renderTrackDiagnosis', sandbox);
const populateModalTrackSelect = vm.runInContext('populateModalTrackSelect', sandbox);

// 1. Verify 3 official AdPR tracks & metadata
const adprMeta = HALLYM_TRACKS['광고홍보학과'];
assert(adprMeta && adprMeta.tracks, 'Missing 광고홍보학과 in data/tracks.js');
assert.strictEqual(adprMeta.model, 'credit_threshold');
assert.strictEqual(adprMeta.isMandatory, false);
assert(adprMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(adprMeta.unconfirmedNote && adprMeta.unconfirmedNote.includes('광고촉진론') && adprMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['표준트랙', '전략커뮤니케이션', '콘텐츠마케팅'];
assert.deepStrictEqual(Object.keys(adprMeta.tracks), expectedTracks);
console.log('[PASS] 1. 광고홍보학과 3개 공식 트랙 및 출처/미확인 메타데이터 확인');

// 2. Verify all AdPR track courses exist in courses.json & 광고촉진론 is marked 미확인
const norm = s => String(s || '').replace(/[\s·\-_:]/g, '').toLowerCase();
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const courseByTitle = new Map(coursesJson.map(c => [norm(c.title), c]));
let foundUnconfPromo = false;

expectedTracks.forEach(tKey => {
  const tr = adprMeta.tracks[tKey];
  assert.strictEqual(tr.minTotalCredits, 33, `AdPR track ${tKey} must require 33 credits`);
  assert.deepStrictEqual(tr.requiredCourses, ['광고홍보조사방법론']);
  assert(tr.sourceRef && tr.sourceQuote);
  [...tr.foundationCourses, ...tr.advancedCourses].forEach(c => {
    const dbCourse = courseByCode.get(String(c.code)) || courseByTitle.get(norm(c.title));
    assert(dbCourse, `AdPR track course ${c.title} (${c.code}) missing from data/courses.json`);
    if (c.title === '광고촉진론') {
      assert.strictEqual(c.codeStatus, '미확인');
      assert.strictEqual(c.semester, '미확인');
      foundUnconfPromo = true;
    } else {
      assert(/^\d{6}$/.test(String(c.code)), `Verified AdPR course ${c.title} must have 6-digit code`);
    }
  });
});
assert(foundUnconfPromo, 'Expected 광고촉진론 with 미확인 status');
console.log('[PASS] 2. 광고홍보학과 전체 트랙 교과목 courses.json 정합성 및 광고촉진론 미확인 표시 검증 완료');

// 3. Verify modal track dropdown
populateModalTrackSelect('광고홍보학과', '표준트랙');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '표준트랙');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 3. 광고홍보학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 4. Verify credit threshold (33cr) + mandatory 광고홍보조사방법론 + IAA Diploma
const adprUser = { studentId: '20250301', major: '광고홍보학과', track: '표준트랙' };
const stdFoundation = [
  { code: '209401', title: '광고개론', credits: 3, grade: 'A0' },
  { code: '209415', title: '홍보개론', credits: 3, grade: 'A0' },
  { code: '209466', title: '마케팅이론', credits: 3, grade: 'B+' },
  { code: '209111', title: '커뮤니케이션입문', credits: 3, grade: 'A0' },
  { code: '209447', title: '광고와사회', credits: 3, grade: 'B+' },
  { code: '900398', title: '소비자행동원론', credits: 3, grade: 'A0' }
];
const stdAdvNoReq = [
  { code: '209431', title: '매체계획론', credits: 3, grade: 'A0' },
  { code: '209469', title: '인터액티브미디어', credits: 3, grade: 'B+' },
  { code: '209486', title: '캡스톤디자인-IMC캠페인', credits: 3, grade: 'A0' },
  { code: '209478', title: '국제마케팅커뮤니케이션특강', credits: 3, grade: 'A0' },
  { code: '210001', title: '광고홍보사례분석', credits: 3, grade: 'B+' }
];

// 4a. 33cr WITHOUT 광고홍보조사방법론 -> NOT complete
const diagNoReq = diagnoseMajorTrack([...stdFoundation, ...stdAdvNoReq], adprUser);
assert.strictEqual(diagNoReq.earnedCredits, 33);
assert.strictEqual(diagNoReq.allRequiredMet, false);
assert.strictEqual(diagNoReq.isTrackComplete, false);

// 4b. 30cr WITH 광고홍보조사방법론 -> NOT complete
const diag30 = diagnoseMajorTrack([
  ...stdFoundation,
  { code: '209112', title: '광고홍보조사방법론', credits: 3, grade: 'A0' },
  ...stdAdvNoReq.slice(0, 3)
], adprUser);
assert.strictEqual(diag30.earnedCredits, 30);
assert.strictEqual(diag30.allRequiredMet, true);
assert.strictEqual(diag30.isTrackComplete, false);

// 4c. 33cr WITH 광고홍보조사방법론 (using alias title IAA조사방법론 + code 209112) + IAA eligible (6 + 5, 0 low grades)
const completeCourses = [
  ...stdFoundation,
  { code: '209112', title: 'IAA조사방법론', credits: 3, grade: 'A0' },
  ...stdAdvNoReq.slice(0, 4)
];
const diagComplete = diagnoseMajorTrack(completeCourses, adprUser);
assert.strictEqual(diagComplete.earnedCredits, 33);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
assert(diagComplete.iaaStatus, 'AdPR diagnosis must include iaaStatus');
assert.strictEqual(diagComplete.iaaStatus.level1Passed, 6);
assert.strictEqual(diagComplete.iaaStatus.level2Passed, 5);
assert.strictEqual(diagComplete.iaaStatus.lowGradeCount, 0);
assert.strictEqual(diagComplete.iaaStatus.isIaaEligible, true);

// 4d. IAA negative case: 3 courses with C0/D0/D+ -> Track still complete (33cr), but IAA ineligible
const lowGradeCourses = completeCourses.map((c, idx) => {
  if (idx === 0) return { ...c, grade: 'C0' };
  if (idx === 1) return { ...c, grade: 'D+' };
  if (idx === 2) return { ...c, grade: 'D0' };
  return c;
});
const diagLowGrade = diagnoseMajorTrack(lowGradeCourses, adprUser);
assert.strictEqual(diagLowGrade.isTrackComplete, true);
assert.strictEqual(diagLowGrade.iaaStatus.lowGradeCount, 3);
assert.strictEqual(diagLowGrade.iaaStatus.isIaaEligible, false);
console.log('[PASS] 4. 광고홍보학과 33학점+전필(코드별칭포함)+IAA 디플로마(C0이하 3과목미만) 판정 확인');

// 5. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, adprUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('IAA 디플로마 이수 현황'), 'UI must display IAA Diploma tracker');
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 광고촉진론');
assert(htmlOut.includes('미확인 항목 안내:'), 'UI must display unconfirmed note banner');
assert(htmlOut.includes('원문 인용:'), 'UI must display official sourceQuote');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 5. 광고홍보학과 트랙 UI 렌더링(IAA·미확인·출처·원문인용) 확인');

// 6. Verify RAG engine TRACK_ROADMAP routing for 광고홍보학과
const engine = ragEngineFactory.createEngine();
const ragRes = engine.ask('광고홍보학과 트랙 알려줘', { user: adprUser, courses: completeCourses });
assert.strictEqual(ragRes.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragRes.grounded, true);
assert(ragRes.sources && ragRes.sources.length > 0);
assert(ragRes.answer.includes('표준 트랙') || ragRes.answer.includes('표준트랙'));
assert(ragRes.answer.includes('전략커뮤니케이션'));
assert(ragRes.answer.includes('콘텐츠마케팅'));
assert(ragRes.answer.includes('미확인'));
console.log('[PASS] 6. RAG 광고홍보학과 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 광고홍보학과 TRACK TESTS PASSED!');
