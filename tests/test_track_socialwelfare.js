const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3c: 사회복지학부 Modular Tracks (6 Official Tracks + 전필코드 정정/미확인 표시)...\n');

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

// 1. Verify graduation_rules.json (corrected mandatory codes 203115, 203203, 006175)
const welfRule = gradRules['사회복지학부'];
assert(welfRule, '사회복지학부 must exist in graduation_rules.json');
assert.strictEqual(welfRule.college, '사회과학대학');
assert.strictEqual(welfRule.total_credits, 130);
assert.strictEqual(welfRule.major_credits.single, 60);
const mandCodes = welfRule.mandatory_courses.since_2021.map(m => m.code);
assert.deepStrictEqual(mandCodes, ['203115', '203203', '006175']);
assert(welfRule.special_conditions.graduation_exam.includes('사회복지사 1급'));
assert(welfRule.special_conditions.graduation_exam.includes('노인복지학전공'));
assert(welfRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="사회복지학부">사회복지학부</option>'));
console.log('[PASS] 1. 사회복지학부 졸업요건(전필 203115·203203·006175 정정, 졸업시험/노인복지 면제, 출처) 확인');

// 2. Verify 6 official modular tracks & unconfirmedNote
const welfMeta = HALLYM_TRACKS['사회복지학부'];
assert(welfMeta && welfMeta.tracks);
assert.strictEqual(welfMeta.model, 'modular');
assert.strictEqual(welfMeta.isMandatory, false);
assert(welfMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(welfMeta.unconfirmedNote && welfMeta.unconfirmedNote.includes('갈등개입실천과회복적정의') && welfMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['공공복지', '지역복지', '노인복지', '아동청소년복지', '의료정신건강복지', '가족복지'];
assert.deepStrictEqual(Object.keys(welfMeta.tracks), expectedTracks);
console.log('[PASS] 2. 사회복지학부 6개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 28 unique module courses exist in courses.json & 갈등개입실천과회복적정의 marked 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
let foundUnconfConflict = false;
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = welfMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.minTotalCredits, 18);
  assert.strictEqual(tr.requiredCourses.length, 4);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
      if (c.title === '갈등개입실천과회복적정의') {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        foundUnconfConflict = true;
      } else {
        assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}`);
      }
    });
  });
});
assert(foundUnconfConflict, '갈등개입실천과회복적정의 must be marked codeStatus: 미확인');
assert.strictEqual(uniqueCodes.size, 28, `Expected 28 unique 사회복지학부 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 사회복지학부 전체 28과목 courses.json 정합성 확인 (검증 27건, 미확인 1건: 갈등개입실천과회복적정의)');

// 4. Verify modal track dropdown
populateModalTrackSelect('사회복지학부', '가족복지');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '가족복지');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 사회복지학부 6개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (가족복지: 필수 4과목 + 2과목 이상 = 18학점+, including title-matched 갈등개입실천과회복적정의)
const welfUser = { studentId: '20251001', major: '사회복지학부', track: '가족복지' };
const onlyRequired = [
  { code: '203115', title: '사회복지실천론', credits: 3, grade: 'A0' },
  { code: '203220', title: '사회복지실천기술론', credits: 3, grade: 'A0' },
  { code: '203316', title: '가족복지론', credits: 3, grade: 'B+' },
  { code: '203604', title: '해결중심단기치료', credits: 3, grade: 'A0' }
];
const diagOnlyReq = diagnoseMajorTrack(onlyRequired, welfUser);
assert.strictEqual(diagOnlyReq.allRequiredMet, true);
assert.strictEqual(diagOnlyReq.earnedCredits, 12);
assert.strictEqual(diagOnlyReq.isTrackComplete, false);

const completeCourses = [
  ...onlyRequired,
  { code: '203113', title: '인간행동과사회환경', credits: 3, grade: 'A0' },
  { title: '갈등개입실천과회복적정의', credits: 3, grade: 'A+' } // title match for welf_unconf_01
];
const diagComplete = diagnoseMajorTrack(completeCourses, welfUser);
assert.strictEqual(diagComplete.earnedCredits, 18);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 사회복지학부 가족복지(F) 트랙(필수 4과목만 12학점 미충족 / +2과목 18학점 충족 + 미확인 과목 제목 매칭) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = completeCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, welfUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 갈등개입실천과회복적정의');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 사회복지학부 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('사회복지학부 트랙 알려줘', { user: welfUser, courses: completeCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('공공복지'));
assert(ragTrack.answer.includes('지역복지'));
assert(ragTrack.answer.includes('노인복지'));
assert(ragTrack.answer.includes('아동·청소년복지'));
assert(ragTrack.answer.includes('의료·정신건강복지'));
assert(ragTrack.answer.includes('가족복지'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 사회복지학부 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 사회복지학부 TRACK TESTS PASSED!');
