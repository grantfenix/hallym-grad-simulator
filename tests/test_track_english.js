const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3f: 영어영문학과 Modular Track (융합영어교육전문가 + 스캔PDF/명칭변경 안내)...\n');

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

// 1. Verify graduation_rules.json (preserve TOEIC 700 & 글로벌영미문화)
const enRule = gradRules['영어영문학과'];
assert(enRule, '영어영문학과 must exist in graduation_rules.json');
assert.strictEqual(enRule.college, '인문대학');
assert(enRule.special_conditions.language_cert.includes('TOEIC 700'));
assert(enRule.special_conditions.language_cert.includes('글로벌영미문화'));
assert(enRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="영어영문학과">영어영문학과</option>'));
console.log('[PASS] 1. 영어영문학과 졸업요건(TOEIC 700/글로벌영미문화 보존, 출처) 확인');

// 2. Verify 1 official modular track & unconfirmedNote
const enMeta = HALLYM_TRACKS['영어영문학과'];
assert(enMeta && enMeta.tracks);
assert.strictEqual(enMeta.model, 'modular');
assert.strictEqual(enMeta.isMandatory, false);
assert(enMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(enMeta.unconfirmedNote && enMeta.unconfirmedNote.includes('인문_영어영문_1천_0717.pdf') && enMeta.unconfirmedNote.includes('미확인'));
assert.deepStrictEqual(Object.keys(enMeta.tracks), ['융합영어교육전문가']);
console.log('[PASS] 2. 영어영문학과 공식 모듈형 트랙(융합영어교육전문가) 및 출처/미확인 메타데이터 확인');

// 3. Verify all 8 module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const tr = enMeta.tracks['융합영어교육전문가'];
assert.strictEqual(tr.minTotalCredits, 18);
assert.strictEqual(tr.modules[0].minCourses, 3);
let count = 0;
tr.modules.forEach(mod => {
  mod.courses.forEach(c => {
    assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}`);
    const dbCourse = courseByCode.get(String(c.code));
    assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
    assert.strictEqual(dbCourse.credits, c.credits);
    count++;
  });
});
assert.strictEqual(count, 8);
console.log('[PASS] 3. 영어영문학과 전체 8개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('영어영문학과', '융합영어교육전문가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '융합영어교육전문가');
console.log('[PASS] 4. 영어영문학과 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (a 3과목+ AND total >= 18cr)
const enUser = { studentId: '20251001', major: '영어영문학과', track: '융합영어교육전문가' };
// Negative: 6 courses = 18cr, but only 2 in module a -> false
const only2InA = [
  { code: '010008', title: '영어지도법', credits: 3, grade: 'A0' },
  { code: '102409', title: '영어교육자료개발', credits: 3, grade: 'A0' },
  { code: '102204', title: '기초영어학', credits: 3, grade: 'B+' },
  { code: '102419', title: '코퍼스언어학', credits: 3, grade: 'A0' },
  { code: '102421', title: '영미문학과네트워크', credits: 3, grade: 'A0' },
  { code: '102416', title: '디지털시대의영어영문학', credits: 3, grade: 'A+' }
];
const diagFail = diagnoseMajorTrack(only2InA, enUser);
assert.strictEqual(diagFail.earnedCredits, 18);
assert.strictEqual(diagFail.allModulesMet, false);
assert.strictEqual(diagFail.isTrackComplete, false);

// Positive: add 3rd course in module a (102407) -> true
const complete = [...only2InA, { code: '102407', title: '아동문학과영어교육', credits: 3, grade: 'A0' }];
const diagOk = diagnoseMajorTrack(complete, enUser);
assert.strictEqual(diagOk.allModulesMet, true);
assert.strictEqual(diagOk.isTrackComplete, true);
console.log('[PASS] 5. 영어영문학과 융합영어교육전문가 트랙(a모듈 2과목 미충족 / 3과목+ & 18학점+ 충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = complete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, enUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'));
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 영어영문학과 트랙 UI 렌더링(미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('영어영문학과 트랙 알려줘', { user: enUser, courses: complete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('융합영어교육전문가'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 영어영문학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 영어영문학과 TRACK TESTS PASSED!');
