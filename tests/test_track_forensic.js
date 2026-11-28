const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3d: 융합과학수사학과 Modular Tracks (3 Official Tracks + 미확인 표시)...\n');

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
const foRule = gradRules['융합과학수사학과'];
assert(foRule, '융합과학수사학과 must exist in graduation_rules.json');
assert.strictEqual(foRule.college, '글로벌융합대학');
assert.strictEqual(foRule.mandatory_courses.since_2021.length, 1);
assert.strictEqual(foRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(foRule.special_conditions.graduation_thesis.includes('없음'));
assert(foRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="융합과학수사학과">융합과학수사학과</option>'));
console.log('[PASS] 1. 융합과학수사학과 졸업요건(글로벌융합대학, 오디세이세미나3, 논문·시험 없음, 출처) 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const foMeta = HALLYM_TRACKS['융합과학수사학과'];
assert(foMeta && foMeta.tracks);
assert.strictEqual(foMeta.model, 'modular');
assert.strictEqual(foMeta.isMandatory, false);
assert(foMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(foMeta.unconfirmedNote && foMeta.unconfirmedNote.includes('범죄수사절차법2') && foMeta.unconfirmedNote.includes('가상자산추적') && foMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['경찰과학수사', 'AI데이터포렌식', '사이버보안'];
assert.deepStrictEqual(Object.keys(foMeta.tracks), expectedTracks);
console.log('[PASS] 2. 융합과학수사학과 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 21 unique module courses exist in courses.json, preserving 685035 현장감식론 and marking 2 for_unconf_* as 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
assert(courseByCode.get('685035') && courseByCode.get('685035').title === '현장감식론', 'Existing 685035 현장감식론 must remain untouched');

const uniqueCodes = new Set();
const unconfFound = new Set();
expectedTracks.forEach(tKey => {
  const tr = foMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
      if (String(c.code).startsWith('for_unconf_')) {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        unconfFound.add(c.title);
      } else {
        assert(/^\d{6}$/.test(String(c.code)));
      }
    });
  });
});
assert.strictEqual(uniqueCodes.size, 21, `Expected 21 unique 융합과학수사학과 module courses, got ${uniqueCodes.size}`);
assert.strictEqual(unconfFound.size, 2, 'Expected 2 unconfirmed for_unconf_* courses');
console.log('[PASS] 3. 융합과학수사학과 전체 21과목 courses.json 정합성 확인 (검증 19건, 미확인 2건, 기존 685035 보존)');

// 4. Verify modal track dropdown
populateModalTrackSelect('융합과학수사학과', 'AI데이터포렌식');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, 'AI데이터포렌식');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 융합과학수사학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (AI데이터포렌식: b 1·2 + c 전체 + f 전체, title-matching 2 unconfirmed courses)
const foUser = { studentId: '20251001', major: '융합과학수사학과', track: 'AI데이터포렌식' };
const partialCourses = [
  { code: '775006', title: '범죄수사학1', credits: 3, grade: 'A0' },
  { code: '685038', title: '범죄수사학2', credits: 3, grade: 'A0' },
  { code: '685025', title: '범죄와형벌', credits: 3, grade: 'B+' },
  { code: '685015', title: '범죄수사절차법1', credits: 3, grade: 'A0' },
  { title: '범죄수사절차법2', credits: 3, grade: 'A0' }, // title match for for_unconf_01
  { code: '685037', title: '범죄데이터분석기초', credits: 3, grade: 'A0' },
  { code: '685039', title: '범죄데이터분석고급', credits: 3, grade: 'A+' } // missing 가상자산추적
];
const diagPartial = diagnoseMajorTrack(partialCourses, foUser);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const completeCourses = [
  ...partialCourses,
  { title: '가상자산추적', credits: 3, grade: 'A0' } // title match for for_unconf_02
];
const diagComplete = diagnoseMajorTrack(completeCourses, foUser);
assert.strictEqual(diagComplete.earnedCourses, 8);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 융합과학수사학과 AI 데이터 포렌식 트랙(b1·2, c전체, f전체 + 미확인 과목 제목 매칭) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, foUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for unconfirmed 융합과학수사학과 courses');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 융합과학수사학과 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('융합과학수사학과 트랙 알려줘', { user: foUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('경찰과학수사'));
assert(ragTrack.answer.includes('AI 데이터 포렌식'));
assert(ragTrack.answer.includes('사이버보안'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 융합과학수사학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 융합과학수사학과 TRACK TESTS PASSED!');
