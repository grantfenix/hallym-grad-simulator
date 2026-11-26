const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-2: 식품영양학과 Modular Tracks (2 Official Tracks + Graduation Rules)...\n');

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
const fnRule = gradRules['식품영양학과'];
assert(fnRule, '식품영양학과 must be registered in graduation_rules.json');
assert.strictEqual(fnRule.college, '의생명과학대학');
assert.strictEqual(fnRule.total_credits, 130);
assert.strictEqual(fnRule.major_credits.single, 60);
assert.strictEqual(fnRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(fnRule.special_conditions.graduation_exam_or_cert.includes('TOEIC 700'));
assert(fnRule.special_conditions.graduation_exam_or_cert.includes('영양사'));
assert(htmlContent.includes('<option value="식품영양학과">식품영양학과</option>'));
console.log('[PASS] 1. 식품영양학과 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 2 official modular tracks
const fnMeta = HALLYM_TRACKS['식품영양학과'];
assert(fnMeta && fnMeta.tracks);
assert.strictEqual(fnMeta.model, 'modular');
assert.strictEqual(fnMeta.isMandatory, false);
assert.strictEqual(fnMeta.unconfirmedNote, null);
assert(fnMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));

const expectedTracks = ['식품위생가공', '지역사회응용영양'];
assert.deepStrictEqual(Object.keys(fnMeta.tracks), expectedTracks);
console.log('[PASS] 2. 식품영양학과 2개 공식 모듈형 트랙 및 출처 메타데이터 확인');

// 3. Verify all 13 module courses exist in courses.json with verified 6-digit codes & matching credits
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = fnMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert(tr.subMajorNote && tr.subMajorNote.includes('TOEIC 700'));
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 3);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Course ${c.title} must have 6-digit code`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 13, `Expected 13 unique Food&Nutrition track courses, got ${uniqueCodes.size}`);
console.log(`[PASS] 3. 식품영양학과 전체 모듈 교과목(고유 ${uniqueCodes.size}과목) courses.json 정합성 및 6자리 코드 검증 완료`);

// 4. Verify modal track dropdown
populateModalTrackSelect('식품영양학과', '식품위생가공');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '식품위생가공');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 식품영양학과 2개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis for both tracks
const hygUser = { studentId: '20250901', major: '식품영양학과', track: '식품위생가공' };
const hygPartial = [
  { code: '215118', title: '공중보건학', credits: 3, grade: 'A0' },
  { code: '508208', title: '식품위생관계법규', credits: 3, grade: 'A0' },
  { code: '508327', title: '식품위생학', credits: 3, grade: 'B+' },
  { code: '508201', title: '식품학개론', credits: 3, grade: 'A0' },
  { code: '508212', title: '식품미생물학및실험', credits: 3, grade: 'A0' }
];
const diagHygPartial = diagnoseMajorTrack(hygPartial, hygUser);
assert.strictEqual(diagHygPartial.allModulesMet, false);
assert.strictEqual(diagHygPartial.allRequiredMet, false);
assert.strictEqual(diagHygPartial.isTrackComplete, false);

const hygComplete = [
  ...hygPartial,
  { code: '508303', title: '식품가공학', credits: 3, grade: 'A+' }
];
const diagHygDone = diagnoseMajorTrack(hygComplete, hygUser);
assert.strictEqual(diagHygDone.earnedCourses, 6);
assert.strictEqual(diagHygDone.allModulesMet, true);
assert.strictEqual(diagHygDone.allRequiredMet, true);
assert.strictEqual(diagHygDone.isTrackComplete, true);

const commUser = { studentId: '20250902', major: '식품영양학과', track: '지역사회응용영양' };
const commComplete = [
  { code: '636702', title: '영양학용어', credits: 1, grade: 'A0' },
  { code: '508102', title: '기초영양학', credits: 3, grade: 'A0' },
  { code: '508325', title: '고급영양학', credits: 3, grade: 'B+' },
  { code: '508321', title: '지역사회영양학', credits: 3, grade: 'A0' },
  { code: '508429', title: '영양교육및상담실습', credits: 3, grade: 'A0' },
  { code: '508413', title: '영양판정및실험', credits: 3, grade: 'A+' }
];
const diagCommDone = diagnoseMajorTrack(commComplete, commUser);
assert.strictEqual(diagCommDone.earnedCourses, 6);
assert.strictEqual(diagCommDone.allModulesMet, true);
assert.strictEqual(diagCommDone.allRequiredMet, true);
assert.strictEqual(diagCommDone.isTrackComplete, true);
console.log('[PASS] 5. 식품영양학과 2개 트랙(식품위생가공·지역사회응용영양) 이수 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = hygComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, hygUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), 'All Food&Nutrition track courses have verified 6-digit codes');
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('TOEIC 700'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 식품영양학과 트랙 UI 렌더링(검증코드·출처·원문인용·졸업기준안내·배지) 확인');

// 7. Verify RAG routing for 식품영양학과
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('식품영양학과 트랙 알려줘', { user: hygUser, courses: hygComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('식품위생가공'));
assert(ragTrack.answer.includes('지역사회응용영양'));

const ragGrad = engine.ask('식품영양학과 졸업 요건 알려줘', { user: hygUser, courses: hygComplete });
assert.strictEqual(ragGrad.grounded, true);
assert(ragGrad.answer.includes('TOEIC 700') || ragGrad.answer.includes('졸업시험') || ragGrad.answer.includes('130'));
console.log('[PASS] 7. RAG 식품영양학과 트랙·졸업요건 질의 응답 및 출처 검증 완료');

console.log('\nALL 식품영양학과 TRACK TESTS PASSED!');

