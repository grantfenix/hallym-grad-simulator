const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 2: 금융재무학과 Tracks (5 Official Tracks, 21cr Threshold)...\n');

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

// 1. Verify 5 official Finance tracks & metadata
const finMeta = HALLYM_TRACKS['금융재무학과'];
assert(finMeta && finMeta.tracks, 'Missing 금융재무학과 in data/tracks.js');
assert.strictEqual(finMeta.model, 'credit_threshold');
assert.strictEqual(finMeta.isMandatory, false);
assert.strictEqual(finMeta.unconfirmedNote, null, 'All Finance courses are verified on p.143');
assert(finMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));

const expectedTracks = ['은행/보험', '증권/투자', '기업재무', '글로벌금융', '금융재무학'];
assert.deepStrictEqual(Object.keys(finMeta.tracks), expectedTracks);
console.log('[PASS] 1. 금융재무학과 5개 공식 트랙 및 출처 메타데이터 확인');

// 2. Verify ALL Finance track courses exist in courses.json with verified 6-digit codes & exact credits
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();

expectedTracks.forEach(tKey => {
  const tr = finMeta.tracks[tKey];
  assert.strictEqual(tr.minTotalCredits, 21, `Finance track ${tKey} must require 21 credits`);
  assert(tr.sourceRef && tr.sourceQuote);
  [...tr.foundationCourses, ...tr.advancedCourses].forEach(c => {
    assert(/^\d{6}$/.test(String(c.code)), `Finance course ${c.title} must have verified 6-digit code`);
    assert(c.semester && c.semester !== '미확인', `Finance course ${c.title} must have verified semester`);
    const dbCourse = courseByCode.get(String(c.code));
    assert(dbCourse, `Finance track course ${c.code} (${c.title}) missing from data/courses.json`);
    assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
    uniqueCodes.add(String(c.code));
  });
});
assert(uniqueCodes.size >= 20, `Expected >=20 unique Finance track courses, got ${uniqueCodes.size}`);
console.log(`[PASS] 2. 금융재무학과 전체 트랙 교과목(고유 ${uniqueCodes.size}과목) courses.json 정합성 및 6자리 코드 검증 완료`);

// 3. Verify modal track dropdown
populateModalTrackSelect('금융재무학과', '은행/보험');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '은행/보험');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 3. 금융재무학과 5개 트랙 선택 드롭다운 동적 생성 확인');

// 4. Verify 21-credit threshold (including 2-credit 금융학원론 edge case)
const bankUser = { studentId: '20250401', major: '금융재무학과', track: '은행/보험' };
const bank20cr = [
  { code: '205102', title: '재무학원론', credits: 3, grade: 'A0' },
  { code: '206430', title: '금융학원론', credits: 2, grade: 'A+' },
  { code: '206208', title: '재무관리론', credits: 3, grade: 'B+' },
  { code: '206425', title: '투자설계론', credits: 3, grade: 'A0' },
  { code: '205290', title: '경영분석(종합설계)', credits: 3, grade: 'A0' },
  { code: '206212', title: '재무경제학', credits: 3, grade: 'B0' },
  { code: '206310', title: '금융기관론', credits: 3, grade: 'B+' }
];
const diag20 = diagnoseMajorTrack(bank20cr, bankUser);
assert.strictEqual(diag20.earnedCredits, 20);
assert.strictEqual(diag20.isTrackComplete, false, '20 credits must NOT satisfy 21cr threshold');

const bank23cr = [
  ...bank20cr,
  { code: '206426', title: '보험설계론', credits: 3, grade: 'A0' }
];
const diag23 = diagnoseMajorTrack(bank23cr, bankUser);
assert.strictEqual(diag23.earnedCredits, 23);
assert.strictEqual(diag23.isTrackComplete, true, '23 credits must satisfy 21cr threshold');

// 4b. Verify Roman numeral title normalization on 글로벌금융 track (without codes)
const globalUser = { studentId: '20250402', major: '금융재무학과', track: '글로벌금융' };
const globalCourses = [
  { title: '재무학원론', credits: 3, grade: 'A0' },
  { title: '재무관리론', credits: 3, grade: 'A0' },
  { title: '투자설계론', credits: 3, grade: 'B+' },
  { title: '금융영어1', credits: 3, grade: 'A0' },
  { title: '금융영어2', credits: 3, grade: 'A0' },
  { title: '재무학특강1', credits: 3, grade: 'B+' },
  { title: '국제재무론', credits: 3, grade: 'A0' }
];
const diagGlobal = diagnoseMajorTrack(globalCourses, globalUser);
assert.strictEqual(diagGlobal.earnedCredits, 21);
assert.strictEqual(diagGlobal.isTrackComplete, true);
console.log('[PASS] 4. 금융재무학과 21학점 기준(2학점 금융학원론 경계값 및 로마숫자 정규화) 판정 확인');

// 5. Verify UI rendering (verified codes, no '코드: 미확인', displays sourceQuote & badge)
sandbox.__testCourses = bank23cr;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, bankUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), 'Finance track courses are all verified and should not display 코드: 미확인');
assert(htmlOut.includes('원문 인용:'), 'UI must display official sourceQuote');
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'), 'UI must display official sourceRef');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 5. 금융재무학과 트랙 UI 렌더링(검증코드·출처·원문인용·배지) 확인');

// 6. Verify RAG engine TRACK_ROADMAP routing for 금융재무학과
const engine = ragEngineFactory.createEngine();
const ragRes = engine.ask('금융재무학과 트랙 알려줘', { user: bankUser, courses: bank23cr });
assert.strictEqual(ragRes.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragRes.grounded, true);
assert(ragRes.sources && ragRes.sources.length > 0);
expectedTracks.forEach(tKey => {
  assert(ragRes.answer.includes(tKey), `RAG answer must mention Finance track ${tKey}`);
});
console.log('[PASS] 6. RAG 금융재무학과 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 금융재무학과 TRACK TESTS PASSED!');
