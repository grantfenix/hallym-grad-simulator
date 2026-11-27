const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3b: 경제학과 Modular Tracks (4 Official Tracks + 졸업요건 검증)...\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const HALLYM_TRACKS = require('../data/tracks.js');
const gradRules = require('../data/graduation_rules.json');
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

// 1. Verify graduation_rules.json (corrected mandatory codes 204506 / 204508 + 23학번+ exam waiver)
const econRule = gradRules['경제학과'];
assert(econRule, '경제학과 must exist in graduation_rules.json');
assert.strictEqual(econRule.college, '사회과학대학');
assert.strictEqual(econRule.total_credits, 130);
assert.strictEqual(econRule.major_credits.single, 60);
assert.strictEqual(econRule.major_credits.double, 33);
const mandCodes = econRule.mandatory_courses.since_2021.map(m => m.code);
assert.deepStrictEqual(mandCodes, ['204506', '204508', '006175']);
assert(econRule.special_conditions.exam_waiver.includes('23학번 이후'));
assert(econRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="경제학과">경제학과</option>'));
console.log('[PASS] 1. 경제학과 졸업요건(전필 204506·204508·006175, 23학번+ 면제기준, 출처) 확인');

// 2. Verify 4 official modular tracks & metadata
const econMeta = HALLYM_TRACKS['경제학과'];
assert(econMeta && econMeta.tracks);
assert.strictEqual(econMeta.model, 'modular');
assert.strictEqual(econMeta.isMandatory, false);
assert(econMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert.strictEqual(econMeta.unconfirmedNote, null);

const expectedTracks = ['기업가', '금융혁신가', '정책전문가', '연구자'];
assert.deepStrictEqual(Object.keys(econMeta.tracks), expectedTracks);
console.log('[PASS] 2. 경제학과 4개 공식 모듈형 트랙 및 출처 메타데이터 확인');

// 3. Verify all 24 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = econMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.modules.length, 3);
  assert.strictEqual(tr.requiredCourses.length, 2);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 3);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 24, `Expected 24 unique 경제학과 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 경제학과 전체 24개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('경제학과', '기업가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '기업가');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 경제학과 4개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (기업가: a+b+c 각 3과목 + 필수 국제무역론, 시장구조와기업전략)
const econUser = { studentId: '20251001', major: '경제학과', track: '기업가' };
// Negative case: 3 courses in a, b, c each (=9 courses), but missing required course '국제무역론'
const missingRequired = [
  { code: '204102', title: '경제학원론(미시)', credits: 3, grade: 'A0' },
  { code: '204101', title: '경제학원론(거시)', credits: 3, grade: 'A0' },
  { code: '204297', title: '경제와수학적분석', credits: 3, grade: 'B+' },
  { code: '204506', title: '미시경제학I', credits: 3, grade: 'A0' },
  { code: '204507', title: '미시경제학II', credits: 3, grade: 'B+' },
  { code: '204508', title: '거시경제학I', credits: 3, grade: 'A0' },
  { code: '204411', title: '노동시장론', credits: 3, grade: 'A0' },
  { code: '204523', title: '인사관리경제학', credits: 3, grade: 'B+' },
  { code: '204317', title: '시장구조와기업전략', credits: 3, grade: 'A+' }
];
const diagMissingReq = diagnoseMajorTrack(missingRequired, econUser);
assert.strictEqual(diagMissingReq.allModulesMet, true);
assert.strictEqual(diagMissingReq.allRequiredMet, false);
assert.strictEqual(diagMissingReq.isTrackComplete, false);

// Positive case: add required '국제무역론' (204315)
const completeCourses = [
  ...missingRequired,
  { code: '204315', title: '국제무역론', credits: 3, grade: 'A0' }
];
const diagComplete = diagnoseMajorTrack(completeCourses, econUser);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 경제학과 기업가 트랙(a·b·c 각 3과목 + 필수 2과목 미충족/충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, econUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), '경제학과 verified courses must not show 코드: 미확인');
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('국제무역론') && htmlOut.includes('시장구조와기업전략'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 경제학과 트랙 UI 렌더링(출처·원문인용·필수과목·이수충족 배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('경제학과 트랙 알려줘', { user: econUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('기업가'));
assert(ragTrack.answer.includes('금융혁신가'));
assert(ragTrack.answer.includes('정책전문가'));
assert(ragTrack.answer.includes('연구자'));
const ragGrad = engine.ask('경제학과 졸업 요건 알려줘', { user: econUser, courses: completeCourses });
assert.strictEqual(ragGrad.grounded, true);
assert(ragGrad.answer.includes('미시경제학') && ragGrad.answer.includes('거시경제학'));
console.log('[PASS] 7. RAG 경제학과 트랙 및 졸업요건 질의 응답·출처 검증 완료');

console.log('\nALL 경제학과 TRACK TESTS PASSED!');
