const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3f: 국어국문학전공 Modular Tracks (5 Official Tracks)...\n');

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

// 1. Verify graduation_rules.json
const koRule = gradRules['국어국문학전공'];
assert(koRule, '국어국문학전공 must exist in graduation_rules.json');
assert.strictEqual(koRule.college, '인문대학');
assert.strictEqual(koRule.mandatory_courses.since_2021[0].code, '006175');
assert(koRule.special_conditions.graduation_thesis.includes('졸업논문'));
assert(koRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="국어국문학전공">국어국문학전공</option>'));
console.log('[PASS] 1. 국어국문학전공 졸업요건(오디세이세미나3, 졸업논문, 출처) 확인');

// 2. Verify 5 official modular tracks & unconfirmedNote
const koMeta = HALLYM_TRACKS['국어국문학전공'];
assert(koMeta && koMeta.tracks);
assert.strictEqual(koMeta.model, 'modular');
assert.strictEqual(koMeta.isMandatory, false);
assert(koMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(koMeta.unconfirmedNote && koMeta.unconfirmedNote.includes('인문_인문학부_2천_0717.pdf') && koMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['한국어교육', '문화콘텐츠기획', '문예창작출판', '국어학연구', '국문학연구'];
assert.deepStrictEqual(Object.keys(koMeta.tracks), expectedTracks);
console.log('[PASS] 2. 국어국문학전공 5개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 25 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = koMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 25, `Expected 25 unique 국어국문학전공 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 국어국문학전공 전체 25개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('국어국문학전공', '한국어교육');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '한국어교육');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 국어국문학전공 5개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (한국어교육: a 2+, b 2+ & 필수 국어학개론, 한국어교육의이해)
const koUser = { studentId: '20251001', major: '국어국문학전공', track: '한국어교육' };
const missingReq = [
  { code: '101105', title: '국어학강독', credits: 3, grade: 'A0' },
  { code: '101312', title: '국어음운론', credits: 3, grade: 'A0' }, // a: 2 (missing 국어학개론)
  { code: '101338', title: '훈민정음의이해', credits: 3, grade: 'B+' },
  { code: '101415', title: '한국어교육의이해', credits: 3, grade: 'A0' } // b: 2
];
const diagMissing = diagnoseMajorTrack(missingReq, koUser);
assert.strictEqual(diagMissing.allModulesMet, true);
assert.strictEqual(diagMissing.allRequiredMet, false);
assert.strictEqual(diagMissing.isTrackComplete, false);

const complete = [...missingReq, { code: '101102', title: '국어학개론', credits: 3, grade: 'A+' }];
const diagOk = diagnoseMajorTrack(complete, koUser);
assert.strictEqual(diagOk.allModulesMet, true);
assert.strictEqual(diagOk.allRequiredMet, true);
assert.strictEqual(diagOk.isTrackComplete, true);
console.log('[PASS] 5. 국어국문학전공 한국어교육 트랙(a·b 각 2과목+ & 필수 2과목 미충족/충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = complete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, koUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'));
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 국어국문학전공 트랙 UI 렌더링(미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('국어국문학전공 트랙 알려줘', { user: koUser, courses: complete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('한국어교육'));
assert(ragTrack.answer.includes('문화콘텐츠기획'));
assert(ragTrack.answer.includes('문예창작출판'));
assert(ragTrack.answer.includes('국어학 연구'));
assert(ragTrack.answer.includes('국문학 연구'));
console.log('[PASS] 7. RAG 국어국문학전공 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 국어국문학전공 TRACK TESTS PASSED!');
