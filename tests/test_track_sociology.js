const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3c: 사회학과 Modular Tracks (3 Official Tracks + 비교과 미확인 안내)...\n');

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

// 1. Verify graduation_rules.json (전필 사회연구를위한기초통계학 202118 + 오디세이세미나3 006175)
const socRule = gradRules['사회학과'];
assert(socRule, '사회학과 must exist in graduation_rules.json');
assert.strictEqual(socRule.college, '사회과학대학');
assert.strictEqual(socRule.total_credits, 130);
assert.strictEqual(socRule.major_credits.single, 60);
const mandCodes = socRule.mandatory_courses.since_2021.map(m => m.code);
assert.deepStrictEqual(mandCodes, ['202118', '006175']);
assert(socRule.special_conditions.graduation_thesis.includes('사회조사분석사 2급'));
assert(socRule.special_conditions.common_elective.includes('미확인'));
assert(socRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="사회학과">사회학과</option>'));
console.log('[PASS] 1. 사회학과 졸업요건(전필 202118·006175, 졸업논문 대체, 공통선택 미확인, 출처) 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const socMeta = HALLYM_TRACKS['사회학과'];
assert(socMeta && socMeta.tracks);
assert.strictEqual(socMeta.model, 'modular');
assert.strictEqual(socMeta.isMandatory, false);
assert(socMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(socMeta.unconfirmedNote && socMeta.unconfirmedNote.includes('비교과') && socMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['일반사회학', '청소년', '문화기획'];
assert.deepStrictEqual(Object.keys(socMeta.tracks), expectedTracks);
console.log('[PASS] 2. 사회학과 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 26 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = socMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 26, `Expected 26 unique 사회학과 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 사회학과 전체 26개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('사회학과', '일반사회학');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '일반사회학');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 사회학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis:
// (a) 일반사회학: 필수 4과목 + a,b,e,h 각 1과목+ (missing h -> false, adding h -> true)
const genUser = { studentId: '20251001', major: '사회학과', track: '일반사회학' };
const genMissingH = [
  { code: '202138', title: '사회학원론', credits: 3, grade: 'A0' },
  { code: '202202', title: '사회학이론', credits: 3, grade: 'A0' },
  { code: '202509', title: '다문화사회론', credits: 3, grade: 'B+' },
  { code: '202118', title: '사회연구를위한기초통계학', credits: 3, grade: 'A0' }
];
const diagMissingH = diagnoseMajorTrack(genMissingH, genUser);
assert.strictEqual(diagMissingH.allRequiredMet, true);
assert.strictEqual(diagMissingH.allModulesMet, false);
assert.strictEqual(diagMissingH.isTrackComplete, false);

const genComplete = [...genMissingH, { code: '202506', title: '미래사회학', credits: 3, grade: 'A+' }];
const diagGenOk = diagnoseMajorTrack(genComplete, genUser);
assert.strictEqual(diagGenOk.allModulesMet, true);
assert.strictEqual(diagGenOk.isTrackComplete, true);

// (b) 문화기획: 5 required courses complete -> badge displays '교과 요건 충족 · 비교과 확인 필요'
const cultUser = { studentId: '20251001', major: '사회학과', track: '문화기획' };
const cultCourses = [
  { code: '202318', title: '문화사회학', credits: 3, grade: 'A0' },
  { code: '202439', title: '질적연구방법론', credits: 3, grade: 'A0' },
  { code: '202508', title: '도시사회학', credits: 3, grade: 'B+' },
  { code: '202529', title: '공간과일상의사회학', credits: 3, grade: 'A0' },
  { code: '202526', title: '문화분석과현장연구:캡스톤디자인', credits: 3, grade: 'A+' }
];
sandbox.__testCourses = cultCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, cultUser);
assert(mockElements['major-track-summary-badge'].innerHTML.includes('교과 요건 충족 · 비교과 확인 필요'));
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), '사회학과 verified courses must not show 코드: 미확인');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
console.log('[PASS] 5-6. 사회학과 일반사회학(h모듈 분기) 및 문화기획(비교과 확인 필요 배지·UI 렌더링) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('사회학과 트랙 알려줘', { user: genUser, courses: genComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('일반사회학'));
assert(ragTrack.answer.includes('청소년'));
assert(ragTrack.answer.includes('문화기획'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 사회학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 사회학과 TRACK TESTS PASSED!');
