const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 2: 데이터사이언스학부 Modular Tracks (6 Official Tracks + 미확인 표시)...\n');

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

// 1. Verify 6 official DS tracks & unconfirmedNote
const dsMeta = HALLYM_TRACKS['데이터사이언스학부'];
assert(dsMeta && dsMeta.tracks, 'Missing 데이터사이언스학부 in data/tracks.js');
assert.strictEqual(dsMeta.model, 'modular');
assert.strictEqual(dsMeta.isMandatory, false);
assert(dsMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'), 'Missing official PDF sourceRef');
assert(dsMeta.unconfirmedNote && dsMeta.unconfirmedNote.includes('미확인'), 'DS must declare unconfirmedNote with 미확인');

const expectedTracks = ['DSC', 'CRDS', '보험계리사', '공공보건데이터전문가', '빅데이터분석기사', 'DS연구원'];
assert.deepStrictEqual(Object.keys(dsMeta.tracks), expectedTracks, 'DS tracks must match official 6 tracks');
console.log('[PASS] 1. 데이터사이언스학부 6개 공식 모듈형 트랙 및 미확인 안내 메타데이터 확인');

// 2. Verify all DS track courses exist in courses.json & unconfirmed codes are explicitly marked
const norm = s => String(s || '').replace(/[\s·\-_:]/g, '').toLowerCase();
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const courseByTitle = new Map(coursesJson.map(c => [norm(c.title), c]));
let verifiedCodeCount = 0;
let unconfirmedCodeCount = 0;

expectedTracks.forEach(tKey => {
  const tr = dsMeta.tracks[tKey];
  assert.strictEqual(tr.minTotalCredits, 18, `DS track ${tKey} must require 18 credits`);
  assert(Array.isArray(tr.requiredCourses) && tr.requiredCourses.length >= 2, `DS track ${tKey} must define requiredCourses`);
  assert(tr.sourceRef && tr.sourceQuote, `Missing sourceRef/sourceQuote on DS track ${tKey}`);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code)) || courseByTitle.get(norm(c.title));
      assert(dbCourse, `DS track course ${c.title} (${c.code}) missing from data/courses.json`);
      if (String(c.code).startsWith('ds_mod_')) {
        assert.strictEqual(c.codeStatus, '미확인', `Internal ID ${c.code} must have codeStatus: 미확인`);
        assert.strictEqual(c.semester, '미확인', `Unconfirmed course ${c.title} must have semester: 미확인`);
        unconfirmedCodeCount++;
      } else {
        assert(/^\d{6}$/.test(String(c.code)), `Verified DS course ${c.title} must have 6-digit code`);
        verifiedCodeCount++;
      }
    });
  });
});
assert(verifiedCodeCount > 0 && unconfirmedCodeCount > 0, 'Expected both verified and unconfirmed DS courses');
console.log(`[PASS] 2. 데이터사이언스학부 교과목 courses.json 정합성 확인 (검증코드 ${verifiedCodeCount}건, 미확인표시 ${unconfirmedCodeCount}건)`);

// 3. Verify modal track select population
populateModalTrackSelect('데이터사이언스학부', 'DSC');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, 'DSC');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`), `Missing dropdown option ${tKey}`);
});
console.log('[PASS] 3. 데이터사이언스학부 6개 트랙 선택 드롭다운 동적 생성 확인');

// 4. Verify DSC track diagnosis (18cr + requiredCourses: 통계적 알고리즘, 행렬과데이터분석)
const dscUser = { studentId: '20250201', major: '데이터사이언스학부', track: 'DSC' };

// 4a. 18 credits WITHOUT 통계적 알고리즘 -> NOT complete
const dsc18NoReq = [
  { code: 'ds_mod_05', title: '행렬과데이터분석', credits: 3, grade: 'A0' },
  { code: '701007', title: '데이터구조와컴퓨팅', credits: 3, grade: 'A0' },
  { code: 'ds_mod_06', title: '기초프로그래밍:R', credits: 3, grade: 'B+' },
  { code: '505563', title: '응용프로그래밍:R', credits: 3, grade: 'A0' },
  { code: '712008', title: '데이터과학을위한파이썬', credits: 3, grade: 'A+' },
  { code: 'ds_mod_30', title: '스포츠빅데이터분석', credits: 3, grade: 'B0' }
];
const diagNoReq = diagnoseMajorTrack(dsc18NoReq, dscUser);
assert.strictEqual(diagNoReq.earnedCredits, 18);
assert.strictEqual(diagNoReq.allRequiredMet, false);
assert.strictEqual(diagNoReq.isTrackComplete, false);

// 4b. 15 credits WITH both required courses -> NOT complete
const dsc15WithReq = [
  { code: 'ds_mod_05', title: '행렬과데이터분석', credits: 3, grade: 'A0' },
  { code: 'ds_mod_08', title: '통계적 알고리즘', credits: 3, grade: 'A0' },
  { code: '701007', title: '데이터구조와컴퓨팅', credits: 3, grade: 'B+' },
  { code: '505563', title: '응용프로그래밍:R', credits: 3, grade: 'A0' },
  { code: '712008', title: '데이터과학을위한파이썬', credits: 3, grade: 'A+' }
];
const diag15 = diagnoseMajorTrack(dsc15WithReq, dscUser);
assert.strictEqual(diag15.earnedCredits, 15);
assert.strictEqual(diag15.allRequiredMet, true);
assert.strictEqual(diag15.isTrackComplete, false);

// 4c. 18 credits WITH both required courses -> COMPLETE
const dsc18Complete = [
  ...dsc15WithReq,
  { code: 'ds_mod_31', title: '확률·통계기반 인공지능', credits: 3, grade: 'A0' }
];
const diagComplete = diagnoseMajorTrack(dsc18Complete, dscUser);
assert.strictEqual(diagComplete.earnedCredits, 18);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);

// 4d. DS연구원 track requires 3 mandatory courses
const dsResUser = { studentId: '20250202', major: '데이터사이언스학부', track: 'DS연구원' };
const dsResComplete = [
  { code: '701006', title: '통계적사고와이해', credits: 3, grade: 'A0' },
  { code: 'ds_mod_01', title: '빅데이터시계열모형', credits: 3, grade: 'A0' },
  { code: 'ds_mod_11', title: '데이터분석분포론', credits: 3, grade: 'B+' },
  { code: '701020', title: '빅데이터마이닝:머신러닝', credits: 3, grade: 'A0' },
  { code: '701005', title: '데이터를 읽는 눈', credits: 3, grade: 'A0' },
  { code: '505303', title: '회귀분석및실습', credits: 3, grade: 'A+' }
];
const diagDsRes = diagnoseMajorTrack(dsResComplete, dsResUser);
assert.strictEqual(diagDsRes.requiredStatus.length, 3);
assert.strictEqual(diagDsRes.allRequiredMet, true);
assert.strictEqual(diagDsRes.isTrackComplete, true);
console.log('[PASS] 4. 데이터사이언스학부 트랙 필수과목+18학점 복합 판정(DSC, DS연구원) 확인');

// 5. Verify UI rendering displays '코드: 미확인' and '미확인 항목 안내'
sandbox.__testCourses = dsc18Complete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, dscUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'Rendered DS UI must explicitly display 코드: 미확인');
assert(htmlOut.includes('미확인 항목 안내:'), 'Rendered DS UI must display 미확인 항목 안내');
assert(htmlOut.includes('트랙 필수 지정 교과목:'), 'Rendered DS UI must display required courses section');
assert(htmlOut.includes('원문 인용:'), 'Rendered DS UI must display 원문 인용');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 5. 데이터사이언스학부 UI 미확인 코드·안내 배너·출처 렌더링 확인');

// 6. Verify RAG engine TRACK_ROADMAP routing for 데이터사이언스학부
const engine = ragEngineFactory.createEngine();
const ragRes = engine.ask('데이터사이언스학부 트랙 알려줘', { user: dscUser, courses: dsc18Complete });
assert.strictEqual(ragRes.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragRes.grounded, true);
assert(ragRes.sources && ragRes.sources.length > 0);
expectedTracks.forEach(tKey => {
  assert(ragRes.answer.replace(/\s+/g, '').includes(tKey.replace(/\s+/g, '')), `RAG answer must mention DS track ${tKey}`);
});
assert(ragRes.answer.includes('미확인'), 'RAG DS track answer must include unconfirmed note');
console.log('[PASS] 6. RAG 데이터사이언스학부 트랙 질의 응답 및 미확인 안내 검증 완료');

console.log('\nALL 데이터사이언스학부 TRACK TESTS PASSED!');
