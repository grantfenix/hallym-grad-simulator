const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3b: 정치행정학과 Modular Tracks (3 Official Tracks + 미확인 표시)...\n');

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
const polRule = gradRules['정치행정학과'];
assert(polRule, '정치행정학과 must exist in graduation_rules.json');
assert.strictEqual(polRule.college, '사회과학대학');
assert.strictEqual(polRule.total_credits, 130);
assert.strictEqual(polRule.major_credits.single, 60);
assert.strictEqual(polRule.mandatory_courses.since_2021[0].code, '006175');
assert(polRule.special_conditions.graduation_thesis.includes('폐지'));
assert(polRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="정치행정학과">정치행정학과</option>'));
console.log('[PASS] 1. 정치행정학과 졸업요건(오디세이세미나3 전필, 졸업요건 폐지, 출처) 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const polMeta = HALLYM_TRACKS['정치행정학과'];
assert(polMeta && polMeta.tracks);
assert.strictEqual(polMeta.model, 'modular');
assert.strictEqual(polMeta.isMandatory, false);
assert(polMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(polMeta.unconfirmedNote && polMeta.unconfirmedNote.includes('정치와정치이념') && polMeta.unconfirmedNote.includes('한반도의평화론') && polMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['일반행정', '정치입법행정', '국제협력평화'];
assert.deepStrictEqual(Object.keys(polMeta.tracks), expectedTracks);
console.log('[PASS] 2. 정치행정학과 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 25 module courses exist in courses.json, preserving 201528 평화통일민주의이해 and marking 4 pol_unconf_* as 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
assert(courseByCode.get('201528') && courseByCode.get('201528').title === '평화통일민주의이해', 'Existing 201528 평화통일민주의이해 must remain untouched');

let verifiedCount = 0;
let unconfirmedCount = 0;
expectedTracks.forEach(tKey => {
  const tr = polMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 1);
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      if (String(c.code).startsWith('pol_unconf_')) {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        unconfirmedCount++;
      } else {
        assert(/^\d{6}$/.test(String(c.code)));
        verifiedCount++;
      }
    });
  });
});
assert.strictEqual(verifiedCount, 21, `Expected 21 verified 6-digit courses, got ${verifiedCount}`);
assert.strictEqual(unconfirmedCount, 4, `Expected 4 unconfirmed pol_unconf_* courses, got ${unconfirmedCount}`);
console.log(`[PASS] 3. 정치행정학과 전체 25과목 courses.json 정합성 확인 (검증 ${verifiedCount}건, 미확인 ${unconfirmedCount}건, 기존 201528 보존)`);

// 4. Verify modal track dropdown
populateModalTrackSelect('정치행정학과', '국제협력평화');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '국제협력평화');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 정치행정학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (국제협력평화: f+g+h 각 1과목+, title-matching unconfirmed courses)
const polUser = { studentId: '20251001', major: '정치행정학과', track: '국제협력평화' };
const partialCourses = [
  { title: '한반도의평화론', credits: 3, grade: 'A0' }, // f (title match for pol_unconf_04)
  { title: '정치와정치이념', credits: 3, grade: 'B+' }  // g (title match for pol_unconf_01)
];
const diagPartial = diagnoseMajorTrack(partialCourses, polUser);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const completeCourses = [
  ...partialCourses,
  { code: '201534', title: '국제정치의이해', credits: 3, grade: 'A+' } // h
];
const diagComplete = diagnoseMajorTrack(completeCourses, polUser);
assert.strictEqual(diagComplete.earnedCourses, 3);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 정치행정학과 국제협력평화 트랙(f·g·h 각 1과목+ 및 미확인 과목 제목 매칭) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, polUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for unconfirmed 정치행정학과 courses');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 정치행정학과 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('정치행정학과 트랙 알려줘', { user: polUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('일반행정'));
assert(ragTrack.answer.includes('정치입법행정'));
assert(ragTrack.answer.includes('국제협력평화'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 정치행정학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 정치행정학과 TRACK TESTS PASSED!');
