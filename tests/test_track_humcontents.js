const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Phase 3-3f: 인문콘텐츠융합전공 (33학점 융합전공 기준 + 트랙 미확인 투명 안내)...\n');

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

// 1. Verify graduation_rules.json (필수과목 없음, 33학점, 9+9=18학점 대체인정, 졸업프로젝트 미확인)
const hcRule = gradRules['인문콘텐츠융합전공'];
assert(hcRule, '인문콘텐츠융합전공 must exist in graduation_rules.json');
assert.strictEqual(hcRule.college, '인문대학');
assert.strictEqual(hcRule.mandatory_courses.since_2021.length, 0);
assert(hcRule.special_conditions.credit_coordinating.includes('33학점') && hcRule.special_conditions.credit_coordinating.includes('18학점'));
assert(hcRule.special_conditions.graduation_project.includes('미확인'));
assert(hcRule.special_conditions.source_ref.includes('졸업기준_인문콘텐츠융합전공.txt'));
assert(htmlContent.includes('<option value="인문콘텐츠융합전공">인문콘텐츠융합전공</option>'));
console.log('[PASS] 1. 인문콘텐츠융합전공 졸업요건(필수과목 없음, 33학점/18학점 대체인정, 미확인, 출처) 확인');

// 2. Verify track guide metadata explicitly marks track availability as 미확인
const hcMeta = HALLYM_TRACKS['인문콘텐츠융합전공'];
assert(hcMeta && hcMeta.tracks);
assert.strictEqual(hcMeta.isMandatory, false);
assert(hcMeta.sourceRef.includes('졸업기준_인문콘텐츠융합전공.txt'));
assert(hcMeta.unconfirmedNote && hcMeta.unconfirmedNote.includes('트랙 운영 여부는 \'미확인\''));
assert.deepStrictEqual(Object.keys(hcMeta.tracks), ['융합전공이수안내']);
console.log('[PASS] 2. 인문콘텐츠융합전공 이수 안내(트랙 미확인 투명 명시) 메타데이터 확인');

// 3. Verify all 7 verified 655xxx code-sharing courses exist in courses.json
const courseByCode = new Map(coursesJson.map(c => [String(c.code), c]));
const tr = hcMeta.tracks['융합전공이수안내'];
assert.strictEqual(tr.modules[0].courses.length, 7);
tr.modules[0].courses.forEach(c => {
  assert(/^655\d{3}$/.test(String(c.code)), `Expected 655xxx code for ${c.title}`);
  const dbCourse = courseByCode.get(String(c.code));
  assert(dbCourse, `Course ${c.code} (${c.title}) missing from courses.json`);
  assert.strictEqual(dbCourse.credits, c.credits);
});
console.log('[PASS] 3. 인문콘텐츠융합전공 확인된 655xxx 코드쉐어링 7과목 courses.json 정합성 확인');

// 4. Verify modal track dropdown & UI rendering
populateModalTrackSelect('인문콘텐츠융합전공', '융합전공이수안내');
assert.strictEqual(mockElements['modal-track-wrap'].style.display, 'block');
assert.strictEqual(mockElements['modal-track-select'].value, '융합전공이수안내');

const hcUser = { studentId: '20251001', major: '인문콘텐츠융합전공', track: '융합전공이수안내' };
const sample = [
  { code: '655026', title: '현대소설과OTT드라마', credits: 3, grade: 'A0' },
  { code: '655005', title: '미디어로본한국사', credits: 3, grade: 'A0' }
];
const diag = diagnoseMajorTrack(sample, hcUser);
assert.strictEqual(diag.earnedCredits, 6);
assert.strictEqual(diag.minTotalCredits, 33);
assert.strictEqual(diag.isTrackComplete, false);

sandbox.__testCourses = sample;
vm.runInContext('activeUserCourses = __testCourses;', sandbox);
renderTrackDiagnosis({}, hcUser);
const htmlOut = mockElements['major-track-container'].innerHTML;
assert(htmlOut.includes('미확인 항목 안내:'));
assert(htmlOut.includes('원문 인용:'));
assert(htmlOut.includes('졸업기준_인문콘텐츠융합전공.txt'));
console.log('[PASS] 4-6. 인문콘텐츠융합전공 드롭다운·진단·UI 렌더링(미확인안내·출처·원문인용) 확인');

// 7. Verify RAG routing
const engine = ragEngineFactory.createEngine();
const ragTrack = engine.ask('인문콘텐츠융합전공 트랙 알려줘', { user: hcUser, courses: sample });
assert.strictEqual(ragTrack.intent, 'TRACK_ROADMAP');
assert.strictEqual(ragTrack.grounded, true);
assert(ragTrack.sources && ragTrack.sources.length > 0);
assert(ragTrack.answer.includes('미확인'));
console.log('[PASS] 7. RAG 인문콘텐츠융합전공 트랙 질의 응답 및 미확인 안내·출처 검증 완료');

console.log('\nALL 인문콘텐츠융합전공 TRACK TESTS PASSED!');
