const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-2: 바이오메디컬학과 Tracks (2 Official Tracks + 33cr + 미확인 표시)...\n');

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
const bmdRule = gradRules['바이오메디컬학과'];
assert(bmdRule, '바이오메디컬학과 must be registered in graduation_rules.json');
assert.strictEqual(bmdRule.college, '의생명과학대학');
assert.strictEqual(bmdRule.total_credits, 130);
assert.strictEqual(bmdRule.major_credits.single, 60);
assert.strictEqual(bmdRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(bmdRule.special_conditions.graduation_thesis.includes('없음'));
assert(htmlContent.includes('<option value="바이오메디컬학과">바이오메디컬학과</option>'));
console.log('[PASS] 1. 바이오메디컬학과 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 2 official credit-threshold tracks & unconfirmedNote
const bmdMeta = HALLYM_TRACKS['바이오메디컬학과'];
assert(bmdMeta && bmdMeta.tracks);
assert.strictEqual(bmdMeta.model, 'credit_threshold');
assert.strictEqual(bmdMeta.isMandatory, false);
assert(bmdMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(bmdMeta.unconfirmedNote && bmdMeta.unconfirmedNote.includes('분자생물학실험') && bmdMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['엘리트생명과학자', '현장실무전문가'];
assert.deepStrictEqual(Object.keys(bmdMeta.tracks), expectedTracks);
console.log('[PASS] 2. 바이오메디컬학과 2개 공식 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all track courses exist in courses.json & 분자생물학실험 marked 미확인
const norm = s => String(s || '').replace(/[\s·\-_:]/g, '').toLowerCase();
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const courseByTitle = new Map(coursesJson.map(c => [norm(c.title), c]));
let foundUnconfMolBio = false;

expectedTracks.forEach(tKey => {
  const tr = bmdMeta.tracks[tKey];
  assert.strictEqual(tr.minTotalCredits, 33);
  assert(tr.sourceRef && tr.sourceQuote);
  [...tr.foundationCourses, ...tr.advancedCourses].forEach(c => {
    const dbCourse = courseByCode.get(String(c.code)) || courseByTitle.get(norm(c.title));
    assert(dbCourse, `Course ${c.title} (${c.code}) missing from courses.json`);
    if (c.title === '분자생물학실험') {
      assert.strictEqual(c.codeStatus, '미확인');
      assert.strictEqual(c.semester, '미확인');
      foundUnconfMolBio = true;
    } else {
      assert(/^\d{6}$/.test(String(c.code)), `Verified course ${c.title} must have 6-digit code`);
    }
  });
});
assert(foundUnconfMolBio, 'Expected 분자생물학실험 with codeStatus: 미확인');
console.log('[PASS] 3. 바이오메디컬학과 전체 교과목 courses.json 정합성 및 분자생물학실험 미확인 표시 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('바이오메디컬학과', '현장실무전문가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '현장실무전문가');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 바이오메디컬학과 2개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify 33-credit threshold (including 2-credit lab courses boundary: 32cr vs 34cr)
const fieldUser = { studentId: '20250801', major: '바이오메디컬학과', track: '현장실무전문가' };
const courses32 = [
  { code: '005073', title: '기초생명과학및실험I', credits: 3, grade: 'A0' },
  { code: '005083', title: '기초생명과학및실험II', credits: 3, grade: 'A0' },
  { code: '009062', title: '생체유기화학', credits: 3, grade: 'B+' },
  { code: '507003', title: '기초유전학', credits: 3, grade: 'A0' },
  { code: '507004', title: '단백질생화학', credits: 3, grade: 'A0' },
  { code: '507518', title: '유전자면역세포치료개론', credits: 3, grade: 'A0' },
  { code: '507311', title: '세포생물학', credits: 3, grade: 'B+' },
  { code: '507226', title: 'Trends in Biotechnology', credits: 3, grade: 'A0' },
  { code: '507010', title: '유전자론', credits: 3, grade: 'A0' },
  { code: '507424', title: '시스템대사생화학', credits: 3, grade: 'A0' },
  { code: '507008', title: '기초유전학실험', credits: 2, grade: 'A+' }
];
const diag32 = diagnoseMajorTrack(courses32, fieldUser);
assert.strictEqual(diag32.earnedCredits, 32);
assert.strictEqual(diag32.isTrackComplete, false);

const courses34 = [
  ...courses32,
  { title: '분자생물학실험', credits: 2, grade: 'A0' }
];
const diag34 = diagnoseMajorTrack(courses34, fieldUser);
assert.strictEqual(diag34.earnedCredits, 34);
assert.strictEqual(diag34.isTrackComplete, true);
console.log('[PASS] 5. 바이오메디컬학과 33학점 기준(2학점 실험과목 경계값 32 vs 34학점) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = courses34;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, fieldUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 분자생물학실험');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 바이오메디컬학과 트랙 UI 렌더링(미확인코드·출처·원문인용·배지) 확인');

// 7. Verify RAG routing for 바이오메디컬학과
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('바이오메디컬학과 트랙 알려줘', { user: fieldUser, courses: courses34 });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('엘리트 생명과학자'));
assert(ragTrack.answer.includes('현장실무 전문가'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 바이오메디컬학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 바이오메디컬학과 TRACK TESTS PASSED!');

