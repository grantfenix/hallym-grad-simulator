const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 2: 소프트웨어학부 Modular Tracks (4 Official Tracks)...\n');

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

// 1. Verify 4 official SW tracks & source metadata
const swMeta = HALLYM_TRACKS['소프트웨어학부'];
assert(swMeta && swMeta.tracks, 'Missing 소프트웨어학부 in data/tracks.js');
assert.strictEqual(swMeta.model, 'modular');
assert.strictEqual(swMeta.isMandatory, false);
assert(swMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'), 'Missing official PDF sourceRef');
assert(swMeta.sourceQuote && swMeta.sourceQuote.length > 10, 'Missing official sourceQuote');

const expectedTracks = ['빅데이터AI융합', 'IoT네트워크통신', 'VR/AR/게임개발', '웹'];
assert.deepStrictEqual(Object.keys(swMeta.tracks), expectedTracks, 'SW tracks must match official 4 tracks');
console.log('[PASS] 1. 소프트웨어학부 4개 공식 모듈형 트랙 및 출처 메타데이터 확인');

// 2. Verify all SW track courses exist in courses.json with verified 6-digit codes & matching credits
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
let checkedCourses = 0;
expectedTracks.forEach(tKey => {
  const tr = swMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote, `Missing sourceRef/sourceQuote on SW track ${tKey}`);
  assert(tr.subMajorNote && tr.subMajorNote.includes('소프트웨어캡스톤디자인'), `Missing subMajorNote on SW track ${tKey}`);
  assert.strictEqual(tr.modules.length, 2, `SW track ${tKey} must have 2 modules`);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCredits, 6, `SW module ${mod.code} minCredits must be 6`);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `SW course ${c.title} must have verified 6-digit code, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `SW track course ${c.code} (${c.title}) missing from data/courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      checkedCourses++;
    });
  });
});
console.log(`[PASS] 2. 소프트웨어학부 트랙 전체 교과목(${checkedCourses}건) courses.json 정합성 및 6자리 코드 검증 완료`);

// 3. Verify modal track dropdown population
populateModalTrackSelect('소프트웨어학부', '빅데이터AI융합');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '빅데이터AI융합');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`), `Missing dropdown option ${tKey}`);
});
assert(mockElements['modal-track-hint'].textContent.includes('소프트웨어학부'), 'Hint must name 소프트웨어학부');
console.log('[PASS] 3. 소프트웨어학부 트랙 선택 드롭다운 동적 생성 확인');

// 4. Verify modular track diagnosis (module a >= 6cr AND module b >= 6cr)
const swUser = { studentId: '20250101', major: '소프트웨어학부', track: '빅데이터AI융합' };

// 4a. Incomplete: module a = 6cr, module b = 3cr
const partialCourses = [
  { code: '603126', title: '데이터사이언스기초', credits: 3, grade: 'A0' },
  { code: '603111', title: '데이터베이스기초', credits: 3, grade: 'B+' },
  { code: '603138', title: '인공지능기초', credits: 3, grade: 'A+' }
];
const diagPartial = diagnoseMajorTrack(partialCourses, swUser);
assert.strictEqual(diagPartial.model, 'modular');
assert.strictEqual(diagPartial.earnedCredits, 9);
assert.strictEqual(diagPartial.moduleResults[0].isModuleMet, true);
assert.strictEqual(diagPartial.moduleResults[1].isModuleMet, false);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

// 4b. Incomplete with F grade & in-progress
const withFailAndInProg = [
  ...partialCourses,
  { code: '506209', title: '머신러닝', credits: 3, grade: 'F' },
  { code: '600004', title: '딥러닝이론및응용', credits: 3, grade: '수강중' }
];
const diagFailInProg = diagnoseMajorTrack(withFailAndInProg, swUser);
assert.strictEqual(diagFailInProg.earnedCredits, 9);
assert.strictEqual(diagFailInProg.inProgCredits, 3);
assert.strictEqual(diagFailInProg.isTrackComplete, false);

// 4c. Complete: module a = 6cr, module b = 6cr (total 12cr)
const completeCourses = [
  ...partialCourses,
  { code: '506209', title: '머신러닝', credits: 3, grade: 'B0' }
];
const diagComplete = diagnoseMajorTrack(completeCourses, swUser);
assert.strictEqual(diagComplete.earnedCredits, 12);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 4. 소프트웨어학부 모듈형 트랙 이수 판정(미충족/F제외/수강중/충족) 확인');

// 5. Verify UI rendering includes sourceRef, sourceQuote, subMajorNote & badge
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, swUser);
assert.strictEqual(mockElements['major-track-card'].style.display, 'block');
assert(mockElements['major-track-container'].innerHTML.includes('원문 인용:'), 'Rendered UI must display 원문 인용');
assert(mockElements['major-track-container'].innerHTML.includes('2026학년도 대학안내책자.pdf'), 'Rendered UI must display official sourceRef');
assert(mockElements['major-track-container'].innerHTML.includes('졸업 인정과목 안내:'), 'Rendered UI must display subMajorNote');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'), 'Badge must show 이수 충족 ✓');
console.log('[PASS] 5. 소프트웨어학부 트랙 UI 렌더링(출처·원문인용·졸업인정과목·배지) 확인');

// 6. Verify RAG engine TRACK_ROADMAP routing for 소프트웨어학부
const engine = ragEngineFactory.createEngine();
const ragRes = engine.ask('소프트웨어학부 트랙 알려줘', { user: swUser, courses: completeCourses });
assert.strictEqual(ragRes.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragRes.grounded, true);
assert(ragRes.sources && ragRes.sources.length > 0, 'RAG response must include official sources');
expectedTracks.forEach(tKey => {
  assert(ragRes.answer.includes(tKey), `RAG answer must mention SW track ${tKey}`);
});
console.log('[PASS] 6. RAG 소프트웨어학부 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 소프트웨어학부 TRACK TESTS PASSED!');
