const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-1: 글로벌비즈니스전공 Modular Tracks (4 Official Tracks + Graduation Rules)...\n');

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

// 1. Verify graduation_rules.json & HTML dropdown registration for 글로벌비즈니스전공
const gbRule = gradRules['글로벌비즈니스전공'];
assert(gbRule, '글로벌비즈니스전공 must be registered in data/graduation_rules.json');
assert.strictEqual(gbRule.college, '글로벌융합대학');
assert.strictEqual(gbRule.total_credits, 130);
assert.strictEqual(gbRule.major_credits.single, 60);
assert.strictEqual(gbRule.major_credits.double, 33);
assert.strictEqual(gbRule.mandatory_courses.since_2021.length, 3);
assert(gbRule.special_conditions.english_requirement.includes('TOEIC 850'));
assert(gbRule.special_conditions.graduation_exam.includes('TESAT 170'));
assert(gbRule.special_conditions.capstone_since_2026.includes('680099'));
assert(htmlContent.includes('<option value="글로벌비즈니스전공">글로벌비즈니스전공</option>'), 'index.html must include 글로벌비즈니스전공 option');
console.log('[PASS] 1. 글로벌비즈니스전공 졸업요건(graduation_rules.json) 및 UI 전공 드롭다운 등록 확인');

// 2. Verify 4 official 글로벌비즈니스전공 tracks & metadata
const gbMeta = HALLYM_TRACKS['글로벌비즈니스전공'];
assert(gbMeta && gbMeta.tracks, 'Missing 글로벌비즈니스전공 in data/tracks.js');
assert.strictEqual(gbMeta.model, 'modular');
assert.strictEqual(gbMeta.isMandatory, false);
assert(gbMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'));
assert(gbMeta.unconfirmedNote && gbMeta.unconfirmedNote.includes('미확인'));

const expectedTracks = ['경제정책분석', '국제통상및무역', '데이터분석', '국제경제분석'];
assert.deepStrictEqual(Object.keys(gbMeta.tracks), expectedTracks);
console.log('[PASS] 2. 글로벌비즈니스전공 4개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 3. Verify all 21 module courses + capstone 680099 exist in courses.json with verified 6-digit codes
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const uniqueCodes = new Set();
expectedTracks.forEach(tKey => {
  const tr = gbMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote);
  assert(tr.subMajorNote && tr.subMajorNote.includes('TOEIC 850'));
  tr.modules.forEach(mod => {
    mod.courses.forEach(c => {
      assert(/^\d{6}$/.test(String(c.code)), `GlobalBiz course ${c.title} must have 6-digit code`);
      const dbCourse = courseByCode.get(String(c.code));
      assert(dbCourse, `GlobalBiz course ${c.code} (${c.title}) missing from courses.json`);
      assert.strictEqual(dbCourse.credits, c.credits);
      uniqueCodes.add(String(c.code));
    });
  });
});
assert.strictEqual(uniqueCodes.size, 21, `Expected all 21 unique module courses (a~g), got ${uniqueCodes.size}`);
assert(courseByCode.has('680099'), 'Missing mandatory capstone 680099 AI-글로벌비즈니스융합연구(캡스톤디자인)');
console.log(`[PASS] 3. 글로벌비즈니스전공 전체 모듈 교과목(고유 ${uniqueCodes.size}과목) 및 캡스톤 680099 courses.json 정합성 확인`);

// 4. Verify modal track select population
populateModalTrackSelect('글로벌비즈니스전공', '경제정책분석');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '경제정책분석');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`));
});
console.log('[PASS] 4. 글로벌비즈니스전공 4개 트랙 선택 드롭다운 동적 생성 확인');

// 5. Verify exact modular rules for 경제정책분석, 국제통상및무역, 국제경제분석
// 5a. 경제정책분석 (a 전체 3 + d 1·2번)
const econUser = { studentId: '20250601', major: '글로벌비즈니스전공', track: '경제정책분석' };
const econWrongD = [
  { code: '640100', title: 'PRINCIPLES OF ECONOMICS', credits: 3, grade: 'A0' },
  { code: '680076', title: 'MICROECONOMIC ANALYSIS', credits: 3, grade: 'A0' },
  { code: '680078', title: 'MACROECONOMIC ANALYSIS', credits: 3, grade: 'B+' },
  { code: '680077', title: 'EMPIRICAL MICROECONOMICS', credits: 3, grade: 'A0' },
  { code: '680082', title: 'INTERNATIONAL TRADE AND ECONOMICS', credits: 3, grade: 'A0' } // d3 instead of required d2!
];
const diagWrongD = diagnoseMajorTrack(econWrongD, econUser);
assert.strictEqual(diagWrongD.allModulesMet, true);
assert.strictEqual(diagWrongD.allRequiredMet, false);
assert.strictEqual(diagWrongD.isTrackComplete, false);

const econComplete = [
  ...econWrongD.slice(0, 4),
  { code: '680079', title: 'ECONOMIC FLUCTUATIONS AND GOVERNMENT POLICY', credits: 3, grade: 'A+' }
];
const diagEconDone = diagnoseMajorTrack(econComplete, econUser);
assert.strictEqual(diagEconDone.allModulesMet, true);
assert.strictEqual(diagEconDone.allRequiredMet, true);
assert.strictEqual(diagEconDone.isTrackComplete, true);

// 5b. 국제경제분석 (f 전체 3 + g 택 2)
const intlUser = { studentId: '20250602', major: '글로벌비즈니스전공', track: '국제경제분석' };
const intlShortG = [
  { code: '680091', title: 'EVOLVING ECONOMIES', credits: 3, grade: 'A0' },
  { code: '691004', title: 'FUNDAMENTAL ISSUES FOR INTERNATIONAL BUSINESS IN KOREA', credits: 3, grade: 'A0' },
  { code: '691008', title: 'KOREAN ECONOMY: DYNAMICS AND FUTURE', credits: 3, grade: 'B+' },
  { code: '680098', title: 'STUDIES IN REGIONAL ECONOMIES', credits: 3, grade: 'A0' }
];
const diagShortG = diagnoseMajorTrack(intlShortG, intlUser);
assert.strictEqual(diagShortG.allModulesMet, false);
assert.strictEqual(diagShortG.isTrackComplete, false);

const intlComplete = [
  ...intlShortG,
  { code: '680047', title: 'INTERNATIONAL BUSINESS', credits: 3, grade: 'A0' }
];
const diagIntlDone = diagnoseMajorTrack(intlComplete, intlUser);
assert.strictEqual(diagIntlDone.allModulesMet, true);
assert.strictEqual(diagIntlDone.allRequiredMet, true);
assert.strictEqual(diagIntlDone.isTrackComplete, true);

// 5c. 국제통상및무역 (d 전체 3 + e 전체 3 + f 3번)
const tradeUser = { studentId: '20250603', major: '글로벌비즈니스전공', track: '국제통상및무역' };
const tradeBase = [
  { code: '680077', title: 'EMPIRICAL MICROECONOMICS', credits: 3, grade: 'A0' },
  { code: '680079', title: 'ECONOMIC FLUCTUATIONS AND GOVERNMENT POLICY', credits: 3, grade: 'A0' },
  { code: '680082', title: 'INTERNATIONAL TRADE AND ECONOMICS', credits: 3, grade: 'B+' },
  { code: '640055', title: 'MARKETING PRINCIPLES', credits: 3, grade: 'A0' },
  { code: '680064', title: 'GLOBAL/INTERNATIONAL MARKETING', credits: 3, grade: 'A0' },
  { code: '680081', title: 'MANAGEMENT STRATEGY', credits: 3, grade: 'A0' }
];
const diagTradeWrongF = diagnoseMajorTrack([...tradeBase, { code: '680091', title: 'EVOLVING ECONOMIES', credits: 3, grade: 'A0' }], tradeUser);
assert.strictEqual(diagTradeWrongF.allRequiredMet, false);
assert.strictEqual(diagTradeWrongF.isTrackComplete, false);

const diagTradeDone = diagnoseMajorTrack([...tradeBase, { code: '691008', title: 'KOREAN ECONOMY: DYNAMICS AND FUTURE', credits: 3, grade: 'A0' }], tradeUser);
assert.strictEqual(diagTradeDone.allModulesMet, true);
assert.strictEqual(diagTradeDone.allRequiredMet, true);
assert.strictEqual(diagTradeDone.isTrackComplete, true);
console.log('[PASS] 5. 글로벌비즈니스전공 트랙별 세부 이수요건(경제정책·국제경제·국제통상) 판정 확인');

// 6. Verify UI rendering
sandbox.__testCourses = econComplete;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, econUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('미확인 항목 안내:'), 'UI must display unconfirmedNote (SAP & 필수교양 코드 미확인)');
assert(htmlOut.includes('원문 인용:'), 'UI must display official sourceQuote');
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'), 'UI must display official sourceRef');
assert(htmlOut.includes('TOEIC 850'), 'UI must display graduation requirements summary note');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 6. 글로벌비즈니스전공 트랙 UI 렌더링(출처·원문인용·졸업요건안내·배지) 확인');

// 7. Verify RAG TRACK_ROADMAP and GRAD_REQ for 글로벌비즈니스전공
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('글로벌비즈니스전공 트랙 알려줘', { user: econUser, courses: econComplete });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
expectedTracks.forEach(tKey => {
  assert(ragTrack.answer.replace(/\s+/g, '').includes(tKey), `RAG track answer must mention ${tKey}`);
});

const ragGrad = engine.ask('글로벌비즈니스전공 졸업 요건 알려줘', { user: econUser, courses: econComplete });
assert.strictEqual(ragGrad.grounded, true);
assert(ragGrad.sources && ragGrad.sources.length > 0);
assert(ragGrad.answer.includes('130') || ragGrad.answer.includes('MICROECONOMIC') || ragGrad.answer.includes('TOEIC 850'));
console.log('[PASS] 7. RAG 글로벌비즈니스전공 트랙 및 졸업요건 질의 응답·출처 검증 완료');

console.log('\nALL 글로벌비즈니스전공 TRACK TESTS PASSED!');
