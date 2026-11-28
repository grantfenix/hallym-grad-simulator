const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3d: 체육학과 Modular Tracks (3 Official Tracks + 미확인 표시)...\n');

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
const peRule = gradRules['체육학과'];
assert(peRule, '체육학과 must exist in graduation_rules.json');
assert.strictEqual(peRule.college, '자연과학대학');
assert(peRule.special_conditions.sports_cert.includes('8학점'));
assert(peRule.special_conditions.nano_degree.includes('스마트 퍼스널 트레이닝'));
assert(peRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="체육학과">체육학과</option>'));
console.log('[PASS] 1. 체육학과 졸업요건(실기 6/8/12학점, 나노디그리, 출처) 확인');

// 2. Verify 3 official modular tracks & unconfirmedNote
const peMeta = HALLYM_TRACKS['체육학과'];
assert(peMeta && peMeta.tracks);
assert.strictEqual(peMeta.model, 'modular');
assert.strictEqual(peMeta.isMandatory, false);
assert(peMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(peMeta.unconfirmedNote && peMeta.unconfirmedNote.includes('아쿠아피트니스') && peMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['건강운동관리사', '스포츠지도사', '체육일반'];
assert.deepStrictEqual(Object.keys(peMeta.tracks), expectedTracks);
console.log('[PASS] 2. 체육학과 3개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all unique module courses exist in courses.json & 아쿠아피트니스 marked 미확인
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
let foundUnconfAqua = false;
expectedTracks.forEach(tKey => {
  const tr = peMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.requiredCourses.length, 8);
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
      if (c.title === '아쿠아피트니스') {
        assert.strictEqual(c.codeStatus, '미확인');
        assert.strictEqual(dbCourse.codeStatus, '미확인');
        foundUnconfAqua = true;
      } else {
        assert(/^\d{6}$/.test(String(c.code)));
      }
    });
  });
});
assert(foundUnconfAqua, '아쿠아피트니스 must be marked codeStatus: 미확인');
console.log(`[PASS] 3. 체육학과 전체 ${uniqueCodes.size}과목 courses.json 정합성 확인 (검증 ${uniqueCodes.size - 1}건, 미확인 1건: 아쿠아피트니스)`);

// 4. Verify modal track dropdown
populateModalTrackSelect('체육학과', '스포츠지도사');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '스포츠지도사');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 체육학과 3개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (스포츠지도사: 필수 8과목 이수)
const peUser = { studentId: '20251001', major: '체육학과', track: '스포츠지도사' };
const sevenReq = [
  { code: '509310', title: '스포츠심리학', credits: 3, grade: 'A0' },
  { code: '509301', title: '스포츠사회학', credits: 3, grade: 'A0' },
  { code: '509430', title: '스포츠윤리', credits: 2, grade: 'B+' },
  { code: '509302', title: '운동생리학', credits: 3, grade: 'A0' },
  { code: '509312', title: '운동역학', credits: 3, grade: 'A0' },
  { code: '509213', title: '스포츠문화사', credits: 3, grade: 'B+' },
  { code: '509437', title: '건강교육론', credits: 3, grade: 'A0' }
];
const diagPartial = diagnoseMajorTrack(sevenReq, peUser);
assert.strictEqual(diagPartial.allRequiredMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const eightReq = [
  ...sevenReq,
  { code: '509515', title: '스포츠안전과심폐소생술', credits: 2, grade: 'A+' }
];
const diagComplete = diagnoseMajorTrack(eightReq, peUser);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);
console.log('[PASS] 5. 체육학과 스포츠지도사 트랙(필수 7/8 미충족 / 8/8 충족) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = eightReq;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, peUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for 아쿠아피트니스');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 체육학과 트랙 UI 렌더링(미확인코드·미확인안내·출처·원문인용·배지) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('체육학과 트랙 알려줘', { user: peUser, courses: eightReq });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('건강운동관리사'));
assert(ragTrack.answer.includes('스포츠지도사'));
assert(ragTrack.answer.includes('체육일반'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 체육학과 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 체육학과 TRACK TESTS PASSED!');
