const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3a: 환경생명공학과 Modular Tracks (3 Official Tracks + 미확인 표시)...\n');

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
const envRule = gradRules['환경생명공학과'];
assert(envRule, '환경생명공학과 must be registered in graduation_rules.json');
assert.strictEqual(envRule.college, '자연과학대학');
assert.strictEqual(envRule.total_credits, 130);
assert.strictEqual(envRule.major_credits.single, 60);
assert.strictEqual(envRule.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert(envRule.special_conditions.graduation_thesis_or_cert.includes('TOEIC 750'));
assert(htmlContent.includes('<option value="환경생명공학과">환경생명공학과</option>'));
console.log('[PASS] 1. 환경생명공학과 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const envMeta = HALLYM_TRACKS['환경생명공학과'];
assert(envMeta && envMeta.tracks);
assert.strictEqual(envMeta.model, 'modular');
assert.strictEqual(envMeta.isMandatory, false);
assert(envMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(envMeta.unconfirmedNote && envMeta.unconfirmedNote.includes('기후변화개론') && envMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['수질전문가', '대기전문가', '환경보전전문가'];
assert.deepStrictEqual(Object.keys(envMeta.tracks), expectedTracks);
console.log('[PASS] 2. 환경생명공학과 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 21 module courses + capstone II (531347) exist in courses.json & 기후변화개론 marked 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
let foundUnconfClimate = false;
let verifiedCodes = 0;

expectedTracks.forEach(tKey => {
  const tr = envMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  tr.modules.forEach(mod => {
    assert.strictEqual(mod.minCourses, 3);
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      if (c.title === '기후변화개론') {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(c.semester, '미확인');
        foundUnconfClimate = true;
      } else {
        assert(/^\d{6}$/.test(String(c.code)));
        verifiedCodes++;
      }
    });
  });
});
assert(foundUnconfClimate, 'Expected 기후변화개론 with codeStatus: 미확인');
assert(courseByCode.has('531346') && courseByCode.has('531347'), 'Capstones I & II must exist in courses.json');
console.log(`[PASS] 3. 환경생명공학과 전체 교과목 courses.json 정합성 확인 (검증 ${verifiedCodes}건, 미확인 1건)`);

// 4. Verify modal track dropdown
populateModalTrackSelect('환경생명공학과', '대기전문가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '대기전문가');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 환경생명공학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (대기전문가: c 3과목+ & d 전체 3과목)
const airUser = { studentId: '20251001', major: '환경생명공학과', track: '대기전문가' };
const airPartial = [
  { code: '531207', title: '대기오염제어', credits: 3, grade: 'A0' },
  { code: '531110', title: '환경화학', credits: 3, grade: 'A0' },
  { title: '기후변화개론', credits: 3, grade: 'B+' }, // title match for unconfirmed code
  { code: '531204', title: '폐기물처리', credits: 3, grade: 'A0' },
  { code: '531109', title: '공정양론', credits: 3, grade: 'A0' } // d only has 2/3
];
const diagPartial = diagnoseMajorTrack(airPartial, airUser);
assert.strictEqual(diagPartial.allModulesMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const airComplete = [
  ...airPartial,
  { code: '531341', title: '환경에너지공학', credits: 3, grade: 'A+' }
];
const diagComplete = diagnoseMajorTrack(airComplete, airUser);
assert.strictEqual(diagComplete.earnedCourses, 6);
assert.strictEqual(diagComplete.allModulesMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 환경생명공학과 대기전문가 트랙(c 3과목+ & d 전체 3과목) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = airComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, airUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 기후변화개론');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(htmlOut.includes('TOEIC 750'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 환경생명공학과 트랙 UI 렌더링(미확인코드·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('환경생명공학과 트랙 알려줘', { user: airUser, courses: airComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('수질 전문가'));
assert(ragTrack.answer.includes('대기 전문가'));
assert(ragTrack.answer.includes('환경보전 전문가'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 환경생명공학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 환경생명공학과 TRACK TESTS PASSED!');
