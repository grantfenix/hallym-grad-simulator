const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3e: 미디어스쿨 Modular Tracks (2 Official Tracks + 포트폴리오 미확인 안내)...\n');

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
const msRule = gradRules['미디어스쿨'];
assert(msRule, '미디어스쿨 must exist in graduation_rules.json');
assert.strictEqual(msRule.college, '미디어스쿨');
assert.strictEqual(msRule.mandatory_courses.since_2021[0].code, '006175');
assert(msRule.special_conditions.major_ratio.includes('39학점'));
assert(msRule.special_conditions.graduation_evaluation.includes('미확인'));
assert(msRule.special_conditions.source_ref.includes('2026학년도 대학안내책자.pdf'));
assert(htmlContent.includes('<option value="미디어스쿨">미디어스쿨</option>'));
console.log('[PASS] 1. 미디어스쿨 졸업요건(오디세이세미나3, 원전공 비율, 졸업평가 미확인, 출처) 확인');

// 2. Verify 2 official modular tracks & unconfirmedNote
const msMeta = HALLYM_TRACKS['미디어스쿨'];
assert(msMeta && msMeta.tracks);
assert.strictEqual(msMeta.model, 'modular');
assert.strictEqual(msMeta.isMandatory, false);
assert(msMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(msMeta.unconfirmedNote && msMeta.unconfirmedNote.includes('포트폴리오 2건') && msMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['AI저널리즘미래', 'AI콘텐츠크리에이터'];
assert.deepStrictEqual(Object.keys(msMeta.tracks), expectedTracks);
console.log('[PASS] 2. 미디어스쿨 2개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 18 unique module courses exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = msMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert.strictEqual(tr.requiredCourses.length, 6);
  assert(tr.nonCurricularNote && tr.nonCurricularNote.includes('포트폴리오'));
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `Expected 6-digit code for ${c.title}, got ${c.code}`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits, `Credits mismatch for ${c.title}`);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 18, `Expected 18 unique 미디어스쿨 module courses, got ${uniqueCodes.size}`);
console.log('[PASS] 3. 미디어스쿨 전체 18개 모듈 교과목 courses.json 정합성 및 6자리 코드 검증 완료');

// 4. Verify modal track dropdown
populateModalTrackSelect('미디어스쿨', 'AI저널리즘미래');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, 'AI저널리즘미래');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 미디어스쿨 2개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify modular diagnosis (AI저널리즘미래: 5/6 false -> 6/6 true + non-curricular badge)
const msUser = { studentId: '20251001', major: '미디어스쿨', track: 'AI저널리즘미래' };
const fiveReq = [
  { code: '209803', title: 'AI와뉴스의미래', credits: 3, grade: 'A0' },
  { code: '209388', title: '취재보도실습', credits: 3, grade: 'A0' },
  { code: '300014', title: 'AI와논픽션스토리텔링', credits: 3, grade: 'B+' },
  { code: '209106', title: 'AI활용조사방법론', credits: 3, grade: 'A0' },
  { code: '209802', title: 'AI와그래픽인포메이션', credits: 3, grade: 'A0' }
];
const diagPartial = diagnoseMajorTrack(fiveReq, msUser);
assert.strictEqual(diagPartial.allRequiredMet, false);
assert.strictEqual(diagPartial.isTrackComplete, false);

const sixReq = [...fiveReq, { code: '209666', title: 'AI콘텐츠프로젝트', credits: 3, grade: 'A+' }];
const diagComplete = diagnoseMajorTrack(sixReq, msUser);
assert.strictEqual(diagComplete.allRequiredMet, true);
assert.strictEqual(diagComplete.isTrackComplete, true);

// 6. Verify UI rendering (nonCurricularNote badge: '교과 요건 충족 · 비교과 확인 필요')
sandbox.__testCourses = sixReq;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, msUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(!htmlOut.includes('코드: 미확인'), '미디어스쿨 verified courses must not show 코드: 미확인');
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'));
assert(mockElements['major-track-summary-badge'].innerHTML.includes('교과 요건 충족 · 비교과 확인 필요'));
console.log('[PASS] 5-6. 미디어스쿨 AI 저널리즘 미래 트랙(필수 6과목 판정 + 비교과 확인 배지·UI 렌더링) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('미디어스쿨 트랙 알려줘', { user: msUser, courses: sixReq });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('AI 저널리즘 미래'));
assert(ragTrack.answer.includes('AI 콘텐츠 크리에이터'));
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 미디어스쿨 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 미디어스쿨 TRACK TESTS PASSED!');
