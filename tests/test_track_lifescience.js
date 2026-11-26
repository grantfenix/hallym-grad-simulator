const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-2: 생명과학과 Modular Tracks (7 Official Tracks + Graduation Rules)...\n');

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
const bioRule = gradRules['생명과학과'];
assert(bioRule, '생명과학과 must be registered in graduation_rules.json');
assert.strictEqual(bioRule.college, '의생명과학대학');
assert.strictEqual(bioRule.total_credits, 130);
assert.strictEqual(bioRule.major_credits.single, 60);
assert.strictEqual(bioRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(bioRule.special_conditions.graduation_thesis.includes('없음'));
assert(htmlContent.includes('<option value="생명과학과">생명과학과</option>'));
console.log('[PASS] 1. 생명과학과 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 7 official modular tracks
const bioMeta = HALLYM_TRACKS['생명과학과'];
assert(bioMeta && bioMeta.tracks);
assert.strictEqual(bioMeta.model, 'modular');
assert.strictEqual(bioMeta.isMandatory, false);
assert(bioMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(bioMeta.unconfirmedNote && bioMeta.unconfirmedNote.includes('식물계통학실험'));

const expectedTracks = [
  '계통진화오믹스',
  '식물오믹스',
  '미생물오믹스',
  '동물오믹스',
  '식물소재바이오헬스케어',
  '미생물소재바이오헬스케어',
  '동물소재바이오헬스케어'
];
assert.deepStrictEqual(Object.keys(bioMeta.tracks), expectedTracks);
console.log('[PASS] 2. 생명과학과 7개 공식 모듈형 트랙 및 출처/주의 안내 메타데이터 확인');

// 3. Verify all module courses exist in courses.json with 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = bioMeta.tracks[tKey];
  assert.strictEqual(tr.modules.length, 5, `${tKey} must combine 5 modules`);
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 2);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Course ${c.title} must have 6-digit code`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert(uniqueCodes.size >= 30, `Expected >=30 unique bio module courses, got ${uniqueCodes.size}`);
console.log(`[PASS] 3. 생명과학과 전체 모듈 교과목(고유 ${uniqueCodes.size}과목) courses.json 정합성 확인`);

// 4. Verify modal track dropdown
populateModalTrackSelect('생명과학과', '계통진화오믹스');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '계통진화오믹스');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 생명과학과 7개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular 5 x 2 courses diagnosis (계통진화오믹스: a+b+c+d+f 각 모듈 2과목+)
const bioUser = { studentId: '20250701', major: '생명과학과', track: '계통진화오믹스' };
const bioPartial = [
  { code: '504425', title: '생명과학I', credits: 3, grade: 'A0' },
  { code: '504426', title: '생명과학II', credits: 3, grade: 'A0' },
  { code: '504241', title: '세포생물학및실험', credits: 3, grade: 'B+' },
  { code: '504424', title: '기초분자생물학', credits: 3, grade: 'A0' },
  { code: '636505', title: '생명과학실험', credits: 2, grade: 'A0' },
  { code: '504305', title: '분자생물학실험법', credits: 2, grade: 'A+' },
  { code: '504436', title: 'Genomics', credits: 3, grade: 'A0' },
  { code: '504397', title: '후성유전학', credits: 3, grade: 'B+' },
  { code: '504395', title: '생물다양성', credits: 3, grade: 'A0' }
];
const diagPartial = diagnoseMajorTrack(bioPartial, bioUser);
assert.strictEqual(diagPartial.earnedCourses, 9);
assert.strictEqual(diagPartial.minTotalCourses, 10);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const bioComplete = [
  ...bioPartial,
  { code: '504417', title: '진화학', credits: 3, grade: 'A0' }
];
const diagComplete = diagnoseMajorTrack(bioComplete, bioUser);
assert.strictEqual(diagComplete.earnedCourses, 10);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 생명과학과 5모듈×2과목 이수 판정(미충족 9과목 vs 충족 10과목) 확인');

// 6. Verify UI rendering
sandbox.__testCourses = bioComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, bioUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('2/2과목'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 생명과학과 트랙 UI 렌더링(과목수진행률·출처·원문인용·배지) 확인');

// 7. Verify RAG routing for 생명과학과
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('생명과학과 트랙 알려줘', { user: bioUser, courses: bioComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
expectedTracks.forEach(tKey => {
  assert(ragTrack.answer.replace(/\s+/g, '').includes(tKey), `RAG must mention ${tKey}`);
});

const ragGrad = engine.ask('생명과학과 졸업 요건 알려줘', { user: bioUser, courses: bioComplete });
assert.strictEqual(ragGrad.grounded, true);
assert(ragGrad.answer.includes('130') || ragGrad.answer.includes('오디세이세미나3'));
console.log('[PASS] 7. RAG 생명과학과 트랙·졸업요건 질의 응답 및 출처 검증 완료');

console.log('\nALL 생명과학과 TRACK TESTS PASSED!');

