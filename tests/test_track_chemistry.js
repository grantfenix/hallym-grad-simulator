const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3d: 화학과 Modular Tracks (6 Official Tracks + 미확인 표시)...\n');

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
const chemRule = gradRules['화학과'];
assert(chemRule, '화학과 must exist in graduation_rules.json');
assert.strictEqual(chemRule.college, '자연과학대학');
assert.strictEqual(chemRule.major_credits.single, 60);
assert.strictEqual(chemRule.mandatory_courses.since_2021.length, 1);
assert.strictEqual(chemRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(chemRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="화학과">화학과</option>'));
console.log('[PASS] 1. 화학과 졸업요건(오디세이세미나3 전필, 바이오나노화학 나노디그리, 출처) 확인');

// 2. Verify 6 official modular tracks & unconfirmedNote
const chemMeta = HALLYM_TRACKS['화학과'];
assert(chemMeta && chemMeta.tracks);
assert.strictEqual(chemMeta.model, 'modular');
assert.strictEqual(chemMeta.isMandatory, false);
assert(chemMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(chemMeta.unconfirmedNote && chemMeta.unconfirmedNote.includes('바이오소재화학') && chemMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['유기합성전공', '의약화학전공', '향장화학전공', '진단약물전달전공', '바이오소재전공', '분자나노소재전공'];
assert.deepStrictEqual(Object.keys(chemMeta.tracks), expectedTracks);
console.log('[PASS] 2. 화학과 6개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all unique module courses exist in courses.json & 2 unconfirmed marked 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
const unconfFound = new Set();
expectedTracks.forEach(tKey => {
  const tr = chemMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
      if (String(c.code).startsWith('chem_unconf_')) {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        unconfFound.add(c.title);
      } else {
        assert(/^\d{6}$/.test(String(c.code)));
      }
    });
  });
});
assert.strictEqual(unconfFound.size, 2, 'Expected 2 unconfirmed 화학과 courses');
console.log(`[PASS] 3. 화학과 전체 ${uniqueCodes.size}과목 courses.json 정합성 확인 (검증 ${uniqueCodes.size - 2}건, 미확인 2건)`);

// 4. Verify modal track dropdown
populateModalTrackSelect('화학과', '향장화학전공');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '향장화학전공');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 화학과 6개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (향장화학전공: a 3+, b 3+, h 2+, j 2+ & 필수 유기화학I, 화학생물학개론)
const chemUser = { studentId: '20251001', major: '화학과', track: '향장화학전공' };
const partialCourses = [
  { code: '503301', title: '무기화학I', credits: 3, grade: 'A0' },
  { code: '503203', title: '물리화학I', credits: 3, grade: 'A0' },
  { code: '503508', title: '분석화학I', credits: 3, grade: 'B+' }, // a: 3, but missing required 유기화학I
  { code: '503202', title: '유기화학II', credits: 3, grade: 'A0' },
  { code: '503311', title: '유기화학III', credits: 3, grade: 'B+' },
  { code: '503006', title: '유기화학실험', credits: 2, grade: 'A0' }, // b: 3
  { code: '506529', title: '화학생물학개론', credits: 3, grade: 'A0' }, // h+j
  { title: '바이오소재화학', credits: 3, grade: 'A+' } // h+j (title match for chem_unconf_02)
];
const diagPartial = diagnoseMajorTrack(partialCourses, chemUser);
assert.strictEqual(diagPartial.allModulesMet, true);
assert.strictEqual(diagPartial.allRequiredMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const completeCourses = [
  ...partialCourses,
  { code: '503201', title: '유기화학I', credits: 3, grade: 'A0' }
];
const diagComplete = diagnoseMajorTrack(completeCourses, chemUser);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 화학과 향장화학전공 트랙(모듈 충족·필수 미충족/충족 + 바이오소재화학 제목 매칭) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, chemUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for unconfirmed 화학과 courses');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 화학과 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('화학과 트랙 알려줘', { user: chemUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('유기합성전공'));
assert(ragTrack.answer.includes('의약화학전공'));
assert(ragTrack.answer.includes('향장화학전공'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 화학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 화학과 TRACK TESTS PASSED!');
