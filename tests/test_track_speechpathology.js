const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3a: 언어병리학전공 Modular Tracks (3 Official Tracks + Graduation Rules)...\n');

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
const slpRule = gradRules['언어병리학전공'];
assert(slpRule, '언어병리학전공 must be registered in graduation_rules.json');
assert.strictEqual(slpRule.college, '자연과학대학');
assert.strictEqual(slpRule.total_credits, 130);
assert.strictEqual(slpRule.major_credits.single, 60);
assert.strictEqual(slpRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(slpRule.special_conditions.graduation_exam.includes('언어재활사 2급'));
assert(slpRule.special_conditions.national_license_req.includes('90시간'));
assert(htmlContent.includes('<option value="언어병리학전공">언어병리학전공</option>'));
console.log('[PASS] 1. 언어병리학전공 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const slpMeta = HALLYM_TRACKS['언어병리학전공'];
assert(slpMeta && slpMeta.tracks);
assert.strictEqual(slpMeta.model, 'modular');
assert.strictEqual(slpMeta.isMandatory, false);
assert(slpMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(slpMeta.unconfirmedNote && slpMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['성인의사소통장애전문가', '아동의사소통장애전문가', '말장애전문가'];
assert.deepStrictEqual(Object.keys(slpMeta.tracks), expectedTracks);
console.log('[PASS] 2. 언어병리학전공 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 21 module courses + foundation 543014 exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();

expectedTracks.forEach(tKey => {
  const tr = slpMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert(tr.requiredCourses.length >= 1);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 3);
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Course ${c.title} must have 6-digit code`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 21, `Expected 21 unique SLP module courses, got ${uniqueCodes.size}`);
assert(courseByCode.has('543014'), 'Foundation course 543014 의사소통장애개론 must exist in courses.json');
console.log(`[PASS] 3. 언어병리학전공 전체 모듈 교과목(고유 ${uniqueCodes.size}과목) 및 전공기초 543014 courses.json 정합성 확인`);

// 4. Verify modal track dropdown
populateModalTrackSelect('언어병리학전공', '말장애전문가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '말장애전문가');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 언어병리학전공 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular all-courses completion (말장애전문가: f+g 6과목 전체, 필수 조음음운/유창성/음성장애)
const speechUser = { studentId: '20251101', major: '언어병리학전공', track: '말장애전문가' };
const speechPartial = [
  { code: '540007', title: '조음음운장애', credits: 3, grade: 'A0' },
  { code: '540031', title: '유창성장애', credits: 3, grade: 'A0' },
  { code: '543012', title: '구개열언어재활', credits: 3, grade: 'B+' },
  { code: '543018', title: '말과학', credits: 3, grade: 'A0' },
  { code: '543046', title: '언어재활현장실무', credits: 3, grade: 'A0' } // missing required 음성장애
];
const diagPartial = diagnoseMajorTrack(speechPartial, speechUser);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.allRequiredMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const speechComplete = [
  ...speechPartial,
  { code: '540033', title: '음성장애', credits: 3, grade: 'A+' }
];
const diagComplete = diagnoseMajorTrack(speechComplete, speechUser);
assert.strictEqual(diagComplete.earnedCourses, 6);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 언어병리학전공 말장애전문가 트랙(f+g 6과목 전체 + 필수 3과목) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = speechComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, speechUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('언어재활사'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 언어병리학전공 트랙 UI 렌더링(출처·원문인용·국시안내·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('언어병리학전공 트랙 알려줘', { user: speechUser, courses: speechComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('성인의사소통장애'));
assert(ragTrack.answer.includes('아동의사소통장애'));
assert(ragTrack.answer.includes('말장애'));
console.log('[PASS] 7. RAG 언어병리학전공 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 언어병리학전공 TRACK TESTS PASSED!');
