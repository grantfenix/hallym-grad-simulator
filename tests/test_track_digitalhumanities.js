const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3a: 디지털인문예술전공 Modular Tracks (4 Official Tracks + 18cr + Graduation Rules)...\n');

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

// 1. Verify graduation_rules.json & UI dropdown
const dahRule = gradRules['디지털인문예술전공'];
assert(dahRule, '디지털인문예술전공 must be registered in graduation_rules.json');
assert.strictEqual(dahRule.college, '미래융합스쿨');
assert.strictEqual(dahRule.total_credits, 130);
assert.strictEqual(dahRule.major_credits.double, 33);
assert.strictEqual(dahRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(dahRule.special_conditions.double_major_focus.includes('미확인'));
assert(htmlContent.includes('<option value="디지털인문예술전공">디지털인문예술전공</option>'));
console.log('[PASS] 1. 디지털인문예술전공 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 4 official modular tracks & unconfirmedNote
const dahMeta = HALLYM_TRACKS['디지털인문예술전공'];
assert(dahMeta && dahMeta.tracks);
assert.strictEqual(dahMeta.model, 'modular');
assert.strictEqual(dahMeta.isMandatory, false);
assert(dahMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(dahMeta.unconfirmedNote && dahMeta.unconfirmedNote.includes('미확인') && dahMeta.unconfirmedNote.includes('713002'));

const expectedTracks = ['스마트경험디자인', 'AI콘텐츠디자인', '디자인의사회적책임', 'AI서비스개발'];
assert.deepStrictEqual(Object.keys(dahMeta.tracks), expectedTracks);
console.log('[PASS] 2. 디지털인문예술전공 4개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 18 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = dahMeta.tracks[tKey];
  assert.strictEqual(tr.minTotalCredits, 18);
  assert(tr.requiredCourses.length >= 3);
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)));
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 18, `Expected 18 unique DAH module courses, got ${uniqueCodes.size}`);
console.log(`[PASS] 3. 디지털인문예술전공 전체 모듈 교과목(고유 ${uniqueCodes.size}과목) courses.json 정합성 및 6자리 코드 검증 완료`);

// 4. Verify modal track dropdown
populateModalTrackSelect('디지털인문예술전공', 'AI서비스개발');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, 'AI서비스개발');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 디지털인문예술전공 4개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify 18cr + requiredCourses diagnosis (AI서비스개발: d+e+f, 필수 인문DB설계/디지털문화콘텐츠마케팅/UX디자인/서비스디자인)
// Also test code-based matching when student transcript has DB title 'AI서비스와DB' for code 713002!
const dahUser = { studentId: '20251201', major: '디지털인문예술전공', track: 'AI서비스개발' };
const dah18NoReq = [
  { code: '713031', title: '서비스디자인', credits: 3, grade: 'A0' },
  { code: '713041', title: '사회혁신디자인', credits: 3, grade: 'A0' },
  { code: '713033', title: '경험디자인특강', credits: 3, grade: 'B+' },
  { code: '713018', title: '인문데이터마이닝', credits: 3, grade: 'A0' },
  { code: '713046', title: '지역혁신연구방법론', credits: 3, grade: 'A0' },
  { code: '713045', title: '생성형AI와지역문화데이터', credits: 3, grade: 'A+' } // missing UX디자인, 인문DB설계, 디지털문화콘텐츠마케팅
];
const diagNoReq = diagnoseMajorTrack(dah18NoReq, dahUser);
assert.strictEqual(diagNoReq.earnedCredits, 18);
assert.strictEqual(diagNoReq.allRequiredMet, false);
assert.strictEqual(diagNoReq.isTrackComplete, false);

const dahComplete = [
  { code: '713002', title: 'AI서비스와DB', credits: 3, grade: 'A0' }, // matches 인문DB설계 by code 713002!
  { code: '713028', title: '디지털문화콘텐츠마케팅', credits: 3, grade: 'A0' },
  { code: '713014', title: 'UX디자인', credits: 3, grade: 'B+' },
  { code: '713031', title: '서비스디자인', credits: 3, grade: 'A0' },
  { code: '713018', title: '인문데이터마이닝', credits: 3, grade: 'A0' },
  { code: '713045', title: '생성형AI와지역문화데이터', credits: 3, grade: 'A+' }
];
const diagComplete = diagnoseMajorTrack(dahComplete, dahUser);
assert.strictEqual(diagComplete.earnedCredits, 18);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 디지털인문예술전공 AI서비스개발 트랙(18학점+필수4과목·코드713002연계) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = dahComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, dahUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 디지털인문예술전공 트랙 UI 렌더링(출처·원문인용·미확인안내·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('디지털인문예술전공 트랙 알려줘', { user: dahUser, courses: dahComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('스마트경험디자인'));
assert(ragTrack.answer.includes('AI콘텐츠디자인'));
assert(ragTrack.answer.includes('디자인의 사회적책임'));
assert(ragTrack.answer.includes('AI서비스개발'));

const ragGrad = engine.ask('디지털인문예술전공 졸업 요건 알려줘', { user: dahUser, courses: dahComplete });
assert.strictEqual(ragGrad.grounded, true);
assert(ragGrad.answer.includes('33') || ragGrad.answer.includes('오디세이세미나3') || ragGrad.answer.includes('130'));
console.log('[PASS] 7. RAG 디지털인문예술전공 트랙·졸업요건 질의 응답 및 출처 검증 완료');

console.log('\nALL 디지털인문예술전공 TRACK TESTS PASSED!');
