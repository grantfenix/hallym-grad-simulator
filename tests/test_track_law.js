const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3c: 법학과 Tracks (3 Official Tracks + 미확인 표시 + 복수전공 필수)...\n');

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
const lawRule = gradRules['법학과'];
assert(lawRule, '법학과 must exist in graduation_rules.json');
assert.strictEqual(lawRule.college, '사회과학대학');
assert.strictEqual(lawRule.total_credits, 130);
assert.strictEqual(lawRule.major_credits.single, 60);
assert.strictEqual(lawRule.major_credits.double, 33);
assert.strictEqual(lawRule.mandatory_courses.since_2021[0].code, '006175');
assert(lawRule.special_conditions.double_major_required.includes('17학번~26학번'));
assert(lawRule.special_conditions.graduation_thesis.includes('폐지'));
assert(lawRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="법학과">법학과</option>'));
console.log('[PASS] 1. 법학과 졸업요건(오디세이세미나3, 17~26학번 복수전공 필수, 논문 폐지, 출처) 확인');

// 2. Verify 3 official tracks & unconfirmedNote
const lawMeta = HALLYM_TRACKS['법학과'];
assert(lawMeta && lawMeta.tracks);
assert.strictEqual(lawMeta.model, 'modular');
assert.strictEqual(lawMeta.isMandatory, false);
assert(lawMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(lawMeta.unconfirmedNote && lawMeta.unconfirmedNote.includes('회사법II') && lawMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['법원직검찰직', '행정직경찰직', '기업법무진학로스쿨'];
assert.deepStrictEqual(Object.keys(lawMeta.tracks), expectedTracks);
console.log('[PASS] 2. 법학과 3개 공식 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all track courses exist in courses.json & 회사법II marked 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
let foundUnconfCorp2 = false;
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = lawMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.minTotalCredits, 24);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCredits, 24);
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
      if (c.title === '회사법II') {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        foundUnconfCorp2 = true;
      } else {
        assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}`);
      }
    });
  });
});
assert(foundUnconfCorp2, '회사법II must be marked codeStatus: 미확인');
assert.strictEqual(uniqueCodes.size, 25, `Expected 25 unique 법학과 track courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 법학과 전체 25과목 courses.json 정합성 확인 (검증 24건, 미확인 1건: 회사법II)');

// 4. Verify modal track dropdown
populateModalTrackSelect('법학과', '기업법무진학로스쿨');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '기업법무진학로스쿨');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 법학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify credit threshold diagnosis (기업법무진학로스쿨: 24학점 이상, including title-matched 회사법II)
const lawUser = { studentId: '20251001', major: '법학과', track: '기업법무진학로스쿨' };
const sevenCourses = [
  { code: '207536', title: '기초법률용어', credits: 3, grade: 'A0' },
  { code: '207102', title: '헌법I', credits: 3, grade: 'A0' },
  { code: '207201', title: '헌법II', credits: 3, grade: 'B+' },
  { code: '207108', title: '민법총칙', credits: 3, grade: 'A0' },
  { code: '207222', title: '물권법', credits: 3, grade: 'A0' },
  { code: '207228', title: '상법총론', credits: 3, grade: 'B+' },
  { title: '회사법II', credits: 3, grade: 'A0' } // title match for law_unconf_01 -> 21cr
];
const diagPartial = diagnoseMajorTrack(sevenCourses, lawUser);
assert.strictEqual(diagPartial.earnedCredits, 21);
assert.strictEqual(diagPartial.isTrackComplete, false);

const eightCourses = [
  ...sevenCourses,
  { code: '207229', title: '회사법I', credits: 3, grade: 'A+' } // 24cr
];
const diagComplete = diagnoseMajorTrack(eightCourses, lawUser);
assert.strictEqual(diagComplete.earnedCredits, 24);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 법학과 기업법무/진학및로스쿨 트랙(21학점 미충족 / 24학점 충족 + 회사법II 제목 매칭) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = eightCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, lawUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 회사법II');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 법학과 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('법학과 트랙 알려줘', { user: lawUser, courses: eightCourses });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('법원직/검찰직'));
assert(ragTrack.answer.includes('행정직/경찰직'));
assert(ragTrack.answer.includes('기업법무/진학및로스쿨'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 법학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 법학과 TRACK TESTS PASSED!');
