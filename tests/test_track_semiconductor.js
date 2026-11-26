const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-1: 반도체·디스플레이스쿨 Modular Tracks (6 Official Tracks + 미확인 표시)...\n');

const htmlPath = path.resolve(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g);
const mainScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script>/g, '');

const HALLYM_TRACKS = require('../data/tracks.js');
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

// 1. Verify 6 official 반도체·디스플레이스쿨 tracks & metadata
const semiMeta = HALLYM_TRACKS['반도체·디스플레이스쿨'];
assert(semiMeta && semiMeta.tracks, 'Missing 반도체·디스플레이스쿨 in data/tracks.js');
assert.strictEqual(semiMeta.model, 'modular');
assert.strictEqual(semiMeta.isMandatory, false);
assert(semiMeta.sourceRef.includes('2026학년도 대학안내책자.pdf'), 'Missing official PDF sourceRef');
assert(semiMeta.sourceQuote && semiMeta.sourceQuote.includes('선택'), 'Missing official sourceQuote');
assert(semiMeta.unconfirmedNote && semiMeta.unconfirmedNote.includes('469209') && semiMeta.unconfirmedNote.includes('미확인'), 'Missing transparent unconfirmedNote for code conflicts');

const expectedTracks = [
  '반도체소자공정전문가',
  '양자전문가',
  '반도체분석전문가',
  '반도체설계전문가',
  '디스플레이소자공정전문가',
  '디스플레이분석전문가'
];
assert.deepStrictEqual(Object.keys(semiMeta.tracks), expectedTracks, 'Must define all 6 official tracks');
console.log('[PASS] 1. 반도체·디스플레이스쿨 6개 공식 모듈형 트랙 및 출처/미확인 메타데이터 확인');

// 2. Verify all track courses + 2025 basic GE 4 courses + capstone 1/2 exist in courses.json
const norm = s => String(s || '').replace(/[\s·\-_:/]/g, '').toLowerCase();
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const courseByTitle = new Map(coursesJson.map(c => [norm(c.title), c]));
let verifiedCodes = 0;
let unconfirmedCodes = 0;

expectedTracks.forEach(tKey => {
  const tr = semiMeta.tracks[tKey];
  assert(tr.sourceRef && tr.sourceQuote, `Missing sourceRef/sourceQuote on ${tKey}`);
  assert(tr.subMajorNote && tr.subMajorNote.includes('물리학및실험1'), `Missing 2025 basic GE note on ${tKey}`);
  tr.modules.forEach(mod => {
    assert(mod.minCourses >= 2, `Module ${mod.code} on ${tKey} must define minCourses`);
    mod.courses.forEach(c => {
      const dbCourse = courseByCode.get(String(c.code)) || courseByTitle.get(norm(c.title));
      assert(dbCourse, `Track course ${c.title} (${c.code}) missing from data/courses.json`);
      if (String(c.code).startsWith('semi_unconf_')) {
        assert.strictEqual(c.codeStatus, '미확인');
        unconfirmedCodes++;
      } else {
        assert(/^\d{6}$/.test(String(c.code)), `Course ${c.title} must have 6-digit code`);
        verifiedCodes++;
      }
    });
  });
});

// Verify 2025 basic GE 4 courses & capstones exist in courses.json
['009068', '009069', '005021', '005022', '505550', '505553'].forEach(code => {
  assert(courseByCode.has(code), `Required graduation/basic GE course code ${code} missing from courses.json`);
});
assert(verifiedCodes > 0 && unconfirmedCodes > 0, 'Expected both verified codes and explicitly marked unconfirmed conflict codes');
console.log(`[PASS] 2. 반도체·디스플레이스쿨 트랙 교과목 및 25학번 기초교양 4과목·캡스톤 courses.json 정합성 확인 (검증 ${verifiedCodes}건, 미확인 ${unconfirmedCodes}건)`);

// 3. Verify modal track select population
populateModalTrackSelect('반도체·디스플레이스쿨', '반도체소자공정전문가');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '반도체소자공정전문가');
expectedTracks.forEach(tKey => {
  assert(mockElements['modal-track-select'].innerHTML.includes(`value="${tKey}"`), `Missing dropdown option ${tKey}`);
});
console.log('[PASS] 3. 반도체·디스플레이스쿨 6개 트랙 선택 드롭다운 동적 생성 확인');

// 4. Verify modular course-count diagnosis (반도체소자공정전문가: a+b+c 각 모듈 2과목+, 필수 반도체공학1·2)
const semiUser = { studentId: '20250501', major: '반도체·디스플레이스쿨', track: '반도체소자공정전문가' };

// 4a. 6 courses (a=2, b=2, c=2) WITHOUT 반도체공학2 -> NOT complete
const missingReqCourses = [
  { code: '469004', title: '반도체기초공정', credits: 3, grade: 'A0' },
  { code: '469005', title: '나노공정', credits: 3, grade: 'B+' },
  { code: '469301', title: '반도체공학1', credits: 3, grade: 'A0' },
  { code: '469008', title: '반도체디스플레이실험2', credits: 3, grade: 'A+' },
  { code: '469209', title: '반도체분석장비부품개론', credits: 3, grade: 'B0' },
  { code: '469011', title: '표면분석기기및응용', credits: 3, grade: 'A0' }
];
const diagNoReq = diagnoseMajorTrack(missingReqCourses, semiUser);
assert.strictEqual(diagNoReq.allModulesMet, true);
assert.strictEqual(diagNoReq.allRequiredMet, false);
assert.strictEqual(diagNoReq.isTrackComplete, false);

// 4b. 5 courses (a=2, b=2, c=1) WITH both required -> NOT complete
const missingModCount = [
  { code: '469004', title: '반도체기초공정', credits: 3, grade: 'A0' },
  { code: '469005', title: '나노공정', credits: 3, grade: 'B+' },
  { code: '469301', title: '반도체공학1', credits: 3, grade: 'A0' },
  { code: '469305', title: '반도체공학2', credits: 3, grade: 'A0' },
  { code: '469011', title: '표면분석기기및응용', credits: 3, grade: 'A0' }
];
const diagShortMod = diagnoseMajorTrack(missingModCount, semiUser);
assert.strictEqual(diagShortMod.allModulesMet, false);
assert.strictEqual(diagShortMod.allRequiredMet, true);
assert.strictEqual(diagShortMod.isTrackComplete, false);

// 4c. 6 courses (a=2, b=2, c=2) WITH both required -> COMPLETE
const completeSemi = [
  ...missingModCount,
  { code: '469303', title: '반도체분석장비', credits: 3, grade: 'B+' }
];
const diagSemiDone = diagnoseMajorTrack(completeSemi, semiUser);
assert.strictEqual(diagSemiDone.earnedCourses, 6);
assert.strictEqual(diagSemiDone.minTotalCourses, 6);
assert.strictEqual(diagSemiDone.allModulesMet, true);
assert.strictEqual(diagSemiDone.allRequiredMet, true);
assert.strictEqual(diagSemiDone.isTrackComplete, true);

// 4d. 디스플레이분석전문가 (b+c 전 과목 6과목, title match for unconfirmed codes 디스플레이재료물성·디스플레이공학2)
const dispUser = { studentId: '20250502', major: '반도체·디스플레이스쿨', track: '디스플레이분석전문가' };
const dispCourses = [
  { code: '469208', title: '디스플레이개론', credits: 3, grade: 'A0' },
  { code: '469201', title: '디스플레이공학1', credits: 3, grade: 'A0' },
  { title: '디스플레이재료물성', credits: 3, grade: 'B+' },
  { title: '디스플레이공학2', credits: 3, grade: 'A0' },
  { code: '469009', title: '기기제어기초및실습', credits: 3, grade: 'A0' },
  { code: '469206', title: '광분석기기', credits: 3, grade: 'A+' }
];
const diagDispDone = diagnoseMajorTrack(dispCourses, dispUser);
assert.strictEqual(diagDispDone.earnedCourses, 6);
assert.strictEqual(diagDispDone.allModulesMet, true);
assert.strictEqual(diagDispDone.allRequiredMet, true);
assert.strictEqual(diagDispDone.isTrackComplete, true);
console.log('[PASS] 4. 반도체·디스플레이스쿨 모듈별 과목수·필수과목 판정(반도체소자공정·디스플레이분석) 확인');

// 5. Verify UI rendering displays unconfirmed codes, sourceQuote, 25학번 기초교양, and badge
sandbox.__testCourses = dispCourses;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, dispUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('코드: 미확인'), 'UI must display 코드: 미확인 for conflict-code courses');
assert(htmlOut.includes('미확인 항목 안내:'), 'UI must display unconfirmedNote banner');
assert(htmlOut.includes('원문 인용:'), 'UI must display official sourceQuote');
assert(htmlOut.includes('2026학년도 대학안내책자.pdf'), 'UI must display official sourceRef');
assert(htmlOut.includes('물리학및실험1'), 'UI must display 2025 basic GE requirement note');
assert(htmlOut.includes('3/3과목'), 'UI must display course-count module progress');
assert(mockElements['major-track-summary-badge'].innerHTML.includes('이수 충족 ✓'));
console.log('[PASS] 5. 반도체·디스플레이스쿨 UI 렌더링(과목수진행률·미확인·출처·원문인용·배지) 확인');

// 6. Verify RAG engine TRACK_ROADMAP routing for 반도체·디스플레이스쿨
const engine = ragEngineFactory.createEngine();
const ragRes = engine.ask('반도체·디스플레이스쿨 트랙 알려줘', { user: semiUser, courses: completeSemi });
assert.strictEqual(ragRes.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragRes.grounded, true);
assert(ragRes.sources && ragRes.sources.length > 0);
expectedTracks.forEach(tKey => {
  assert(ragRes.answer.replace(/\s+/g, '').includes(tKey), `RAG answer must mention track ${tKey}`);
});
assert(ragRes.answer.includes('미확인'), 'RAG answer must mention unconfirmed note');
console.log('[PASS] 6. RAG 반도체·디스플레이스쿨 트랙 질의 응답 및 출처 검증 완료');

console.log('\nALL 반도체·디스플레이스쿨 TRACK TESTS PASSED!');
