const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3b: 심리학과 Modular Tracks (4 Official Tracks + 전필 정정/미확인 안내)...\n');

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

// 1. Verify graduation_rules.json (corrected mandatory 심리통계 208414 + 오디세이세미나3 006175, 졸업시험 미확인 안내)
const psyRule = gradRules['심리학과'];
assert(psyRule, '심리학과 must exist in graduation_rules.json');
assert.strictEqual(psyRule.college, '사회과학대학');
assert.strictEqual(psyRule.total_credits, 130);
assert.strictEqual(psyRule.major_credits.single, 60);
const mandCodes = psyRule.mandatory_courses.since_2021.map(m => m.code);
assert.deepStrictEqual(mandCodes, ['208414', '006175']);
assert(psyRule.special_conditions.graduation_exam.includes('미확인'));
assert(psyRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="심리학과">심리학과</option>'));
console.log('[PASS] 1. 심리학과 졸업요건(전필 208414·006175 정정, 졸업시험 미확인 안내, 출처) 확인');

// 2. Verify 4 official modular tracks & unconfirmedNote
const psyMeta = HALLYM_TRACKS['심리학과'];
assert(psyMeta && psyMeta.tracks);
assert.strictEqual(psyMeta.model, 'modular');
assert.strictEqual(psyMeta.isMandatory, false);
assert(psyMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(psyMeta.unconfirmedNote && psyMeta.unconfirmedNote.includes('졸업시험') && psyMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['조직및계량심리', '인지및지각심리', '임상및상담심리', '사회및범죄심리'];
assert.deepStrictEqual(Object.keys(psyMeta.tracks), expectedTracks);
console.log('[PASS] 2. 심리학과 4개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 22 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = psyMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.modules.length, 2);
  assert.strictEqual(tr.minTotalCredits, 12);
  assert.strictEqual(tr.requiredCourses.length, 2);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCredits, 6);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 22, `Expected 22 unique 심리학과 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 심리학과 전체 22개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('심리학과', '임상및상담심리');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '임상및상담심리');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 심리학과 4개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (임상및상담심리: c 6cr+ & f 6cr+ + 필수 임상심리학, 상담이론및실습(캡스톤디자인))
const psyUser = { studentId: '20251001', major: '심리학과', track: '임상및상담심리' };
// Negative case: c 6cr + f 6cr (=12cr) but missing required '임상심리학'
const missingRequired = [
  { code: '208215', title: '이상심리학', credits: 3, grade: 'A0' },
  { code: '208205', title: '생리심리학', credits: 3, grade: 'B+' },
  { code: '208418', title: '심리상담의기초', credits: 3, grade: 'A0' },
  { code: '208342', title: '상담이론및실습(캡스톤디자인)', credits: 3, grade: 'A+' }
];
const diagMissingReq = diagnoseMajorTrack(missingRequired, psyUser);
assert.strictEqual(diagMissingReq.allModulesMet, true);
assert.strictEqual(diagMissingReq.allRequiredMet, false);
assert.strictEqual(diagMissingReq.isTrackComplete, false);

// Positive case: add required '임상심리학' (208307)
const completeCourses = [
  ...missingRequired,
  { code: '208307', title: '임상심리학', credits: 3, grade: 'A0' }
];
const diagComplete = diagnoseMajorTrack(completeCourses, psyUser);
assert.strictEqual(diagComplete.earnedCredits, 15);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 심리학과 임상및상담심리 트랙(c·f 각 6학점+ & 필수 2과목 미충족/충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, psyUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), '심리학과 verified courses must not show 코드: 미확인');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('임상심리학') && htmlOut.includes('상담이론및실습(캡스톤디자인)'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 심리학과 트랙 UI 렌더링(미확인안내·출처·원문인용·필수과목·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('심리학과 트랙 알려줘', { user: psyUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('조직 및 계량심리'));
assert(ragTrack.answer.includes('인지 및 지각심리'));
assert(ragTrack.answer.includes('임상 및 상담심리'));
assert(ragTrack.answer.includes('사회 및 범죄심리'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 심리학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 심리학과 TRACK TESTS PASSED!');
