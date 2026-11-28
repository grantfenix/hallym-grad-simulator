const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3e: 인공지능융합학부 Modular Tracks (2 Official Tracks + 학점형 모듈 검증)...\n');

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

// 1. Verify graduation_rules.json (preserve 729001 캡스톤Ⅰ)
const aiRule = gradRules['인공지능융합학부'];
assert(aiRule, '인공지능융합학부 must exist in graduation_rules.json');
assert.strictEqual(aiRule.college, '정보과학대학');
const cap = aiRule.mandatory_courses.since_2021.find(c => c.title.includes('캡스톤'));
assert.strictEqual(cap.code, '729001');
assert(aiRule.special_conditions.nano_degree.includes('실전형의료인공지능'));
assert(aiRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="인공지능융합학부">인공지능융합학부</option>'));
console.log('[PASS] 1. 인공지능융합학부 졸업요건(캡스톤Ⅰ 729001, 나노디그리, 출처) 확인');

// 2. Verify 2 official modular tracks & unconfirmedNote
const aiMeta = HALLYM_TRACKS['인공지능융합학부'];
assert(aiMeta && aiMeta.tracks);
assert.strictEqual(aiMeta.model, 'modular');
assert.strictEqual(aiMeta.isMandatory, false);
assert(aiMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(aiMeta.unconfirmedNote && aiMeta.unconfirmedNote.includes('AI기술경영융합전공') && aiMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['의료인공지능트랙', '로봇인공지능트랙'];
assert.deepStrictEqual(Object.keys(aiMeta.tracks), expectedTracks);
console.log('[PASS] 2. 인공지능융합학부 2개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 25 unique module courses + 729001 exist in courses.json with verified 6-digit codes & 768002 fixed to 3cr
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
assert(courseByCode.has('729001'), '729001 인공지능융합캡스톤디자인Ⅰ must exist in courses.json');
assert.strictEqual(courseByCode.get('768002').credits, 3, '768002 인공지능디지털헬스케어 must be 3 credits');

const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = aiMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCredits, 3);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 25, `Expected 25 unique 인공지능융합학부 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 인공지능융합학부 전체 25개 모듈 교과목 + 729001 정합성 및 768002 3학점 정정 확인');

// 4. Verify modal track dropdown
populateModalTrackSelect('인공지능융합학부', '의료인공지능트랙');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '의료인공지능트랙');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 인공지능융합학부 2개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (의료인공지능트랙: c,d,e,f 각 3cr+ AND total >= 15cr)
const aiUser = { studentId: '20251001', major: '인공지능융합학부', track: '의료인공지능트랙' };
// 12cr (each module 3cr met, but total 12 < 15 -> false)
const fourCourses12cr = [
  { code: '904401', title: '의료인공지능', credits: 3, grade: 'A0' },        // c
  { code: '904400', title: '의료데이터분석Ⅰ', credits: 3, grade: 'A0' },    // d
  { code: '768002', title: '인공지능디지털헬스케어', credits: 3, grade: 'A0' }, // e
  { code: '710026', title: '의료정보학', credits: 3, grade: 'B+' }           // f
];
const diag12 = diagnoseMajorTrack(fourCourses12cr, aiUser);
assert.strictEqual(diag12.allModulesMet, true);
assert.strictEqual(diag12.earnedCredits, 12);
assert.strictEqual(diag12.isTrackComplete, false);

// Add 1 more 3cr course -> 15cr -> true
const fiveCourses15cr = [
  ...fourCourses12cr,
  { code: '768006', title: '의료딥러닝', credits: 3, grade: 'A+' }
];
const diag15 = diagnoseMajorTrack(fiveCourses15cr, aiUser);
assert.strictEqual(diag15.earnedCredits, 15);
assert.strictEqual(diag15.allModulesMet, true);
assert.strictEqual(diag15.isTrackComplete, true);
console.log('[PASS] 5. 인공지능융합학부 의료인공지능트랙(모듈별 3학점+ & 총 12학점 미충족 / 15학점 충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = fiveCourses15cr;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, aiUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), '인공지능융합학부 verified courses must not show 코드: 미확인');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 인공지능융합학부 트랙 UI 렌더링(미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('인공지능융합학부 트랙 알려줘', { user: aiUser, courses: fiveCourses15cr });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('의료인공지능트랙'));
assert(ragTrack.answer.includes('로봇인공지능트랙'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 인공지능융합학부 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 인공지능융합학부 TRACK TESTS PASSED!');
