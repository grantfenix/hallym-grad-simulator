const assert = require('assert');
const RagModule = require('../js/rag_engine.js');

console.log('========================================');
console.log('Testing Hallym Local Hybrid RAG Engine');
console.log('========================================');

const engine = RagModule.createEngine();

function assertHasValidCitations(res, label) {
  assert.strictEqual(res.grounded, true, `[${label}] expected grounded=true`);
  assert.ok(Array.isArray(res.sources) && res.sources.length >= 1, `[${label}] expected at least 1 citation source`);
  res.sources.forEach((s, idx) => {
    assert.ok(s.source && s.source.length > 0, `[${label}] source[${idx}] missing filename`);
    assert.ok(s.loc && s.loc.length > 0, `[${label}] source[${idx}] missing page/line loc`);
    assert.ok(s.quote && s.quote.length >= 10, `[${label}] source[${idx}] missing verbatim quote`);
  });
}

// -------------------------------------------------------------------
// 1. 5 Core Benchmark Questions (Answer Accuracy + Source Citations)
// -------------------------------------------------------------------
console.log('\n--- 1. 5 Core Benchmark Questions ---');
const defaultUser = { major: '경영학과', admissionYear: 2025, studentType: '재학생' };

// Q1: 총 학점
const r1 = engine.ask('졸업에 필요한 총 학점은 몇 학점인가요?', { user: defaultUser });
assertHasValidCitations(r1, 'Q1 총 학점');
assert.ok(r1.answer.includes('130학점'), `Q1 missing 130학점: ${r1.answer}`);
console.log(`  [PASS] Q1 총 학점 -> ${r1.sources[0].source} [${r1.sources[0].loc}]`);

// Q2: 교양 필수 과목
const r2 = engine.ask('교양 필수 과목은 무엇인가요?', { user: defaultUser });
assertHasValidCitations(r2, 'Q2 교양 필수');
assert.ok(r2.answer.includes('정보소통') && r2.answer.includes('컴퓨팅사고') && r2.answer.includes('창의코딩'), 'Q2 missing 정보소통 details');
assert.ok(r2.answer.includes('생애설계') && r2.answer.includes('오디세이세미나1'), 'Q2 missing 생애설계 details');
console.log(`  [PASS] Q2 교양 필수 -> ${r2.sources[0].source} [${r2.sources[0].loc}]`);

// Q3: 소프트웨어학부 졸업 요건 (경영학과 학생이 타 학과 질문 시 질문 학과 우선)
const r3 = engine.ask('소프트웨어학부 졸업 요건은 무엇인가요?', { user: defaultUser });
assertHasValidCitations(r3, 'Q3 소프트웨어학부');
assert.strictEqual(r3.targetDept, '소프트웨어학부', 'Q3 should target 소프트웨어학부');
assert.ok(r3.answer.includes('소프트웨어캡스톤디자인'), 'Q3 missing 소프트웨어캡스톤디자인');
assert.ok(r3.answer.includes('오디세이세미나3'), 'Q3 missing 오디세이세미나3');
assert.ok(
  r3.sources.some((s) => s.source.includes('졸업기준_소프트웨어학부.pdf') || s.source.includes('graduation_rules.json')),
  'Q3 missing official SW graduation source'
);
console.log(`  [PASS] Q3 소프트웨어학부 -> ${r3.sources.map((s) => `${s.source}[${s.loc}]`).slice(0, 2).join(', ')}`);

// Q4: 외국인 유학생 교양 요건
const r4 = engine.ask('외국인 유학생 교양 요건은 무엇인가요?', { user: defaultUser });
assertHasValidCitations(r4, 'Q4 외국인 유학생');
assert.strictEqual(r4.targetStudentType, '외국인 유학생', 'Q4 should target 외국인 유학생');
assert.ok(r4.answer.includes('대학한국어3'), 'Q4 missing 대학한국어3');
assert.ok(r4.answer.includes('12학점'), 'Q4 missing 12학점');
assert.ok(r4.answer.includes('TOPIK'), 'Q4 missing TOPIK');
console.log(`  [PASS] Q4 외국인 유학생 -> ${r4.sources[0].source} [${r4.sources[0].loc}]`);

// Q5: 경영학과 트랙
const r5 = engine.ask('경영학과 트랙은 무엇인가요?', { user: defaultUser });
assertHasValidCitations(r5, 'Q5 경영학과 트랙');
['회계·세무', '의료경영', '글로벌혁신전략', '비즈니스인텔리전스', '관광경영', '마케팅기획'].forEach((t) => {
  assert.ok(r5.answer.includes(t), `Q5 missing track: ${t}`);
});
assert.ok(
  r5.sources.some((s) => s.source.includes('경영학과.pdf') || s.source.includes('경영대학.txt')),
  'Q5 missing official business track source'
);
console.log(`  [PASS] Q5 경영학과 6대 트랙 -> ${r5.sources[0].source} [${r5.sources[0].loc}]`);

// -------------------------------------------------------------------
// 2. Out-of-Scope External Topics & Ungrounded Campus Queries
// -------------------------------------------------------------------
console.log('\n--- 2. Out-of-Scope External & Ungrounded Queries ---');
// 2A. Campus/unverifiable facts not in official docs -> 확인 불가
const ungroundedCampusQueries = [
  '오늘 학생식당 점심 메뉴가 무엇인가요?',
  '기숙사 통금시간이 몇 시인가요?'
];
ungroundedCampusQueries.forEach((q) => {
  const res = engine.ask(q, { user: defaultUser });
  assert.strictEqual(res.grounded, false, `Ungrounded campus query should NOT be grounded: ${q}`);
  assert.ok(
    res.answer.includes('공식 자료에서 확인할 수 없습니다') && res.answer.includes('확인 불가'),
    `Ungrounded query missing 확인 불가 message: ${q}`
  );
  assert.strictEqual(res.sources.length, 0, `Ungrounded query should have 0 sources: ${q}`);
  console.log(`  [PASS] 확인 불가 차단: "${q}"`);
});

// 2B. External service out-of-scope topics (KO / EN / RU / ZH) -> polite scope refusal
const externalScopeCases = [
  { q: '오늘 날씨 어때요?', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '지금 몇 시인가요?', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '춘천 닭갈비 맛집 추천해주세요', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '최신 뉴스 알려줘', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '연애 고민 상담해줘', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '재밌는 게임 추천해줘', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: '화성 여행 로켓 티켓 가격은 얼마인가요?', lang: 'ko', expect: '서비스 범위를 벗어납니다' },
  { q: 'What is the weather today?', lang: 'en', expect: 'outside the scope' },
  { q: 'What time is it now?', lang: 'en', expect: 'outside the scope' },
  { q: 'Какая сегодня погода?', lang: 'ru', expect: 'выходит за рамки' },
  { q: 'Который сейчас час?', lang: 'ru', expect: 'выходит за рамки' },
  { q: 'Посоветуй хороший ресторан', lang: 'ru', expect: 'выходит за рамки' },
  { q: '今天天气怎么样？', lang: 'zh', expect: '超出了学业助手的服务范围' },
  { q: '现在几点了？', lang: 'zh', expect: '超出了学业助手的服务范围' }
];
externalScopeCases.forEach(({ q, lang, expect }) => {
  const res = engine.ask(q, { user: defaultUser });
  assert.strictEqual(res.intent, 'OUT_OF_SCOPE', `Expected OUT_OF_SCOPE for: ${q}`);
  assert.strictEqual(res.grounded, false, `External topic must not be grounded: ${q}`);
  assert.strictEqual(res.outOfScope, true, `Expected outOfScope=true for: ${q}`);
  assert.strictEqual(res.lang, lang, `Expected lang=${lang} for: ${q}`);
  assert.strictEqual(res.sources.length, 0, `External topic must have 0 sources: ${q}`);
  assert.ok(res.answer.includes(expect), `Expected "${expect}" in reply for "${q}", got: ${res.answer}`);
});
console.log(`  [PASS] 외부 범위 차단 (날씨·시간·맛집·뉴스·연애·게임 — KO/EN/RU/ZH ${externalScopeCases.length}건)`);

// -------------------------------------------------------------------
// 3. Personalization by Department / Admission Year / Student Type
// -------------------------------------------------------------------
console.log('\n--- 3. Personalization (학과 · 학번 · 학생유형) ---');
const ge2025 = engine.ask('교양 요건 알려주세요', { user: { major: '경영학과', admissionYear: 2025, studentType: '재학생' } });
const ge2021 = engine.ask('교양 요건 알려주세요', { user: { major: '경영학과', admissionYear: 2021, studentType: '재학생' } });
const geForeign = engine.ask('교양 요건 알려주세요', { user: { major: '경영학과', admissionYear: 2025, studentType: '외국인 유학생' } });
const geTransfer = engine.ask('교양 요건 알려주세요', { user: { major: '경영학과', admissionYear: 2025, studentType: '편입생' } });

assert.ok(ge2025.answer.includes('9학점') && ge2025.answer.includes('Career English'), '2025 cohort should require 9cr + Career English');
assert.ok(ge2021.answer.includes('6학점') && ge2021.answer.includes('의무 없음'), '2021 cohort should require 6cr without Career English');
assert.ok(geForeign.answer.includes('대학한국어3') && geForeign.answer.includes('12학점'), 'Foreigner should get Korean 12cr');
assert.ok(geTransfer.answer.includes('의무가 없습니다'), 'Transfer should get GE exemption');
console.log('  [PASS] 동일 질문에 대해 2025학번 / 2021학번 / 외국인 유학생 / 편입생 맞춤 분기 확인');

const gradAd = engine.ask('내 학과 졸업 요건 알려줘', { user: { major: '광고홍보학과', admissionYear: 2024, studentType: '재학생' } });
assertHasValidCitations(gradAd, '광고홍보학과 졸업요건');
assert.strictEqual(gradAd.targetDept, '광고홍보학과');
assert.ok(gradAd.answer.includes('광고홍보학과'), 'Should personalize to 광고홍보학과');
console.log('  [PASS] 학과별 맞춤 분기 확인 (광고홍보학과)');

// -------------------------------------------------------------------
// 4. Current Courses, Grades (F excluded, 수강중 split), Remaining Credits
// -------------------------------------------------------------------
console.log('\n--- 4. Progress, Grades, Category & Remaining Credits ---');
const sampleCourses = [
  { title: '컴퓨팅사고와문제해결', cat: '교양_정보소통', credits: 2, grade: 'A+', semester: '2025-1' },
  { title: 'AI프로젝트입문', cat: '교양_정보소통', credits: 3, grade: 'A0', semester: '2025-1' },
  { title: '오디세이세미나1', cat: '교양_생애설계', credits: 1, grade: 'P', semester: '2025-1' },
  { title: '마케팅원론', cat: '경영_전선', credits: 3, grade: 'B+', semester: '2025-1' },
  { title: '회계입문', cat: '경영_전선', credits: 3, grade: 'F', semester: '2025-1' },       // F -> MUST be excluded!
  { title: '경영통계학', cat: '경영_전선', credits: 3, grade: '수강중', semester: '2026-2' } // In-progress
];
const rProg = engine.ask('내 남은 학점과 부족한 졸업 요건을 알려주세요', {
  user: { major: '경영학과', admissionYear: 2025, studentType: '재학생' },
  courses: sampleCourses
});
assertHasValidCitations(rProg, '잔여 학점 진단');
assert.strictEqual(rProg.userProgress.confTotal, 9, `Expected confTotal=9 (F excluded), got ${rProg.userProgress.confTotal}`);
assert.strictEqual(rProg.userProgress.currTotal, 3, `Expected currTotal=3, got ${rProg.userProgress.currTotal}`);
assert.strictEqual(rProg.userProgress.expTotal, 12, `Expected expTotal=12, got ${rProg.userProgress.expTotal}`);
assert.strictEqual(rProg.userProgress.remainTotal, 118, `Expected remainTotal=118, got ${rProg.userProgress.remainTotal}`);
assert.strictEqual(rProg.userProgress.failedCount, 1, 'Expected 1 failed course detected');
assert.ok(rProg.answer.includes('잔여 118학점') || rProg.answer.includes('잔여 **118학점**'), 'Answer should mention 118 remaining credits');
assert.ok(rProg.answer.includes('오디세이세미나3'), 'Answer should flag missing mandatory major course 오디세이세미나3');
assert.ok(rProg.answer.includes('회계입문'), 'Answer should mention excluded F course 회계입문');
console.log(`  [PASS] 취득(9) + 수강중(3) = 12학점, F(회계입문) 제외, 잔여 118학점, 평점 ${rProg.userProgress.gpa}`);

// -------------------------------------------------------------------
// 5. Course Category Lookup
// -------------------------------------------------------------------
console.log('\n--- 5. Course Category Lookup ---');
const rCourseBiz = engine.ask('마케팅원론 이수구분이 무엇인가요?', { user: { major: '경영학과', admissionYear: 2025, studentType: '재학생' } });
assertHasValidCitations(rCourseBiz, '과목 이수구분 조회');
assert.ok(rCourseBiz.answer.includes('마케팅원론') && rCourseBiz.answer.includes('경영_전선'), `Unexpected course lookup: ${rCourseBiz.answer}`);
console.log(`  [PASS] 마케팅원론 이수구분 조회 (경영학과 기준 -> 경영_전선)`);

// -------------------------------------------------------------------
// 6. BM25 + Korean 2-gram Compound Search
// -------------------------------------------------------------------
console.log('\n--- 6. BM25 + Korean 2-gram Search ---');
const hits = engine.search('외국인유학생 대학한국어3', { topK: 5 });
assert.ok(hits.length > 0 && hits[0].score > 0, 'BM25 + 2-gram search should return ranked chunks');
assert.ok(hits.some((h) => h.chunk.text.includes('대학한국어3')), 'Top hits should contain 대학한국어3');
console.log(`  [PASS] 복합어 검색 성공 (Top-1 score=${hits[0].score.toFixed(2)}, ${hits[0].chunk.source}[${hits[0].chunk.loc}])`);

// -------------------------------------------------------------------
// 7. FAQ / Query Cache Verification
// -------------------------------------------------------------------
console.log('\n--- 7. FAQ / Query Cache ---');
engine.clearCache();
const c1 = engine.ask('졸업에 필요한 총 학점은 몇 학점인가요?', { user: defaultUser });
const c2 = engine.ask('졸업에 필요한 총 학점은 몇 학점인가요?', { user: defaultUser });
const c3 = engine.ask('졸업에 필요한 총 학점은 몇 학점인가요?', { user: { major: '광고홍보학과', admissionYear: 2024, studentType: '재학생' } });
assert.strictEqual(c1.fromCache, false, 'First call should miss cache');
assert.strictEqual(c2.fromCache, true, 'Second identical call should hit cache');
assert.strictEqual(c3.fromCache, false, 'Different user context should NOT collide in cache');
const cStats = engine.getCacheStats();
assert.strictEqual(cStats.hits, 1, `Expected 1 cache hit, got ${cStats.hits}`);
assert.strictEqual(cStats.misses, 2, `Expected 2 cache misses, got ${cStats.misses}`);
console.log(`  [PASS] 캐시 동작 확인 (hits=${cStats.hits}, misses=${cStats.misses}, size=${cStats.size})`);

// -------------------------------------------------------------------
// 8. Scanned PDF OCR-Excluded Transparency Notice
// -------------------------------------------------------------------
console.log('\n--- 8. Scanned PDF OCR Notice ---');
const rRus = engine.ask('러시아어학과 졸업 요건 알려주세요', { user: defaultUser });
assertHasValidCitations(rRus, '러시아어학과 졸업요건');
assert.ok(
  rRus.excludedOcrNotice && rRus.excludedOcrNotice.includes('이미지 기반 자료(OCR 미적용)'),
  'Should include OCR-excluded notice for 러시아어학과'
);
console.log(`  [PASS] OCR 제외 PDF 안내 확인: ${rRus.excludedOcrNotice}`);

// -------------------------------------------------------------------
// 9. Natural Conversational Advisor Queries + Basket + Portal Disclaimer
// -------------------------------------------------------------------
console.log('\n--- 9. Natural Conversational Advisor Queries ---');
const richCourses = [
  { title: '컴퓨팅사고와문제해결', cat: '교양_정보소통', credits: 2, grade: 'A+', semester: '2025-1' },
  { title: 'AI프로젝트입문', cat: '교양_정보소통', credits: 3, grade: 'A0', semester: '2025-1' },
  { title: '오디세이세미나1', cat: '교양_생애설계', credits: 1, grade: 'P', semester: '2025-1' },
  { title: '마케팅원론', cat: '경영_전선', credits: 3, grade: 'D0', semester: '2025-1' },       // Low grade (D0)
  { title: '회계입문', cat: '경영_전선', credits: 3, grade: 'F', semester: '2025-1' },        // Failed (F)
  { title: '경영통계학', cat: '경영_전선', credits: 3, grade: '수강중', semester: '2026-2' }   // In-progress
];
const richBasket = [
  { title: '오디세이세미나3', cat: '경영_전필', credits: 1 },
  { title: '소비자행동론', cat: '경영_전선', credits: 3 }
];
const richCtx = {
  user: { major: '경영학과', admissionYear: 2025, studentType: '재학생', track: '마케팅기획' },
  courses: richCourses,
  basket: richBasket
};

// 9-1. "다음 학기에 무엇을 들어야 하나요?"
const convNext = engine.ask('다음 학기에 무엇을 들어야 하나요?', richCtx);
assertHasValidCitations(convNext, '다음 학기 추천');
assert.ok(convNext.sections && convNext.sections.headline && convNext.sections.remainingSummary, 'Should return 4-part sections');
assert.ok(convNext.answer.includes('오디세이세미나3'), 'Should prioritize missing mandatory 오디세이세미나3');
assert.ok(convNext.answer.includes('수강바구니'), 'Should reflect basket courses');
assert.ok(convNext.sections.disclaimer && convNext.sections.disclaimer.includes('학교 포털에서 확인해야 합니다'), 'Must include portal disclaimer');
console.log('  [PASS] "다음 학기에 무엇을 들어야 하나요?" -> 우선 과목 + 바구니 반영 + 포털 안내');

// 9-2. "지금 상황에서 어떤 과목이 급한가요?" & "졸업하려면 지금 뭐부터 들어야 하나요?"
const convUrgent = engine.ask('지금 상황에서 어떤 과목이 급한가요?', richCtx);
assertHasValidCitations(convUrgent, '급한 과목');
assert.strictEqual(convUrgent.intent, 'NEXT_SEMESTER_PLAN');
const convFirst = engine.ask('졸업하려면 지금 뭐부터 들어야 하나요?', richCtx);
assertHasValidCitations(convFirst, '뭐부터 들어야');
assert.strictEqual(convFirst.intent, 'NEXT_SEMESTER_PLAN');
console.log('  [PASS] "어떤 과목이 급한가요?" / "뭐부터 들어야 하나요?" 이해 확인');

// 9-3. "제 졸업까지 얼마나 남았나요?"
const convRemain = engine.ask('제 졸업까지 얼마나 남았나요?', richCtx);
assertHasValidCitations(convRemain, '졸업까지 남은 학점');
assert.ok(convRemain.answer.includes('118학점'), 'Expected 118 remaining credits');
assert.ok(convRemain.answer.includes('114학점'), 'Expected 114 remaining credits after 4cr basket');
console.log('  [PASS] "제 졸업까지 얼마나 남았나요?" -> 잔여 118학점 / 바구니 반영 시 114학점');

// 9-4. "이 과목을 들어야 하나요?" (오디세이세미나3)
const convShould = engine.ask('오디세이세미나3 들어야 하나요?', richCtx);
assertHasValidCitations(convShould, '이 과목 들어야 하나요');
assert.strictEqual(convShould.intent, 'SHOULD_TAKE_COURSE');
assert.ok(convShould.answer.includes('전공필수'), 'Should state 오디세이세미나3 is mandatory major');
assert.ok(convShould.sections.disclaimer.includes('학교 포털에서 확인해야 합니다'), 'Should include portal disclaimer');
console.log('  [PASS] "오디세이세미나3 들어야 하나요?" -> 전공필수 + 바구니 상태 + 포털 안내');

// 9-5. "제 성적이 낮은 과목이 있나요?"
const convLow = engine.ask('제 성적이 낮은 과목이 있나요?', richCtx);
assertHasValidCitations(convLow, '낮은 성적 과목');
assert.strictEqual(convLow.intent, 'LOW_GRADES_CHECK');
assert.ok(convLow.answer.includes('회계입문') && convLow.answer.includes('마케팅원론'), 'Should flag both F(회계입문) and D0(마케팅원론)');
assert.ok(convLow.answer.includes('최대 A0'), 'Should explain retake cap rule');
console.log('  [PASS] "제 성적이 낮은 과목이 있나요?" -> F(회계입문), D0(마케팅원론) + 재이수 규정');

// 9-6. 시간표/교수님/실제 개설 여부 질문 -> 단정 금지 & 포털 확인 안내
const convPortal = engine.ask('마케팅원론 교수님과 다음 학기 시간표 알려주세요', richCtx);
assert.strictEqual(convPortal.grounded, false, 'Pure schedule/professor query should not be asserted as grounded fact');
assert.ok(convPortal.answer.includes('공식 자료에서 확인할 수 없습니다'), 'Should state 확인 불가');
assert.ok(convPortal.answer.includes('학교 포털에서 확인해야 합니다'), 'Should advise checking school portal');
console.log('  [PASS] 교수님·시간표·개설여부 단정 차단 및 학교 포털 확인 안내');

// -------------------------------------------------------------------
// 10. Multilingual (RU / EN / ZH) + Site Usage Guides + General Chat
// -------------------------------------------------------------------
console.log('\n--- 10. Multilingual (RU/EN/ZH) & Site Usage Guides ---');

// 10-1. Russian next semester query
const ruNext = engine.ask('что мне послушать на следующем семестре?', richCtx);
assertHasValidCitations(ruNext, 'Russian next semester');
assert.strictEqual(ruNext.lang, 'ru', 'Expected lang=ru');
assert.strictEqual(ruNext.intent, 'NEXT_SEMESTER_PLAN');
assert.ok(/[а-яА-ЯёЁ]/.test(ruNext.sections.headline), 'Russian answer must be in Russian');
assert.ok(ruNext.answer.includes('오디세이세미나3'), 'Russian answer must include personalized missing course');
assert.strictEqual(ruNext.labels.viewSources, 'Показать источники');
console.log('  [PASS] RU: "что мне послушать на следующем семестре?" -> Russian personalized reply');

// 10-2. English next semester query
const enNext = engine.ask('What should I take next semester?', richCtx);
assertHasValidCitations(enNext, 'English next semester');
assert.strictEqual(enNext.lang, 'en', 'Expected lang=en');
assert.strictEqual(enNext.intent, 'NEXT_SEMESTER_PLAN');
assert.ok(enNext.sections.headline.includes('priority') || enNext.sections.headline.includes('next semester'), 'English answer must be in English');
assert.strictEqual(enNext.labels.viewSources, 'View Sources');
console.log('  [PASS] EN: "What should I take next semester?" -> English personalized reply');

// 10-3. Chinese next semester query
const zhNext = engine.ask('下学期应该选什么课？', richCtx);
assertHasValidCitations(zhNext, 'Chinese next semester');
assert.strictEqual(zhNext.lang, 'zh', 'Expected lang=zh');
assert.strictEqual(zhNext.intent, 'NEXT_SEMESTER_PLAN');
assert.ok(/[\u4E00-\u9FFF]/.test(zhNext.sections.headline), 'Chinese answer must be in Chinese');
assert.strictEqual(zhNext.labels.viewSources, '查看来源');
console.log('  [PASS] ZH: "下学期应该选什么课？" -> Chinese personalized reply');

// 10-4. Site Usage How-To Guides (KO / EN / RU / ZH)
const siteAddKo = engine.ask('사이트에서 과목을 어떻게 추가하나요?', richCtx);
assert.strictEqual(siteAddKo.grounded, true);
assert.strictEqual(siteAddKo.intent, 'SITE_ADD_COURSE');
assert.ok(siteAddKo.answer.includes('내 정보') && siteAddKo.answer.includes('과목 직접 추가'));

const sitePdfKo = engine.ask('성적표는 어떻게 업로드하나요?', richCtx);
assert.strictEqual(sitePdfKo.grounded, true);
assert.strictEqual(sitePdfKo.intent, 'SITE_UPLOAD_TRANSCRIPT');
assert.ok(sitePdfKo.answer.includes('PDF'));

const siteFeatKo = engine.ask('이 기능은 무엇인가요?', richCtx);
assert.strictEqual(siteFeatKo.grounded, true);
assert.strictEqual(siteFeatKo.intent, 'SITE_OVERVIEW');

const siteAddRu = engine.ask('как добавить предмет?', richCtx);
assert.strictEqual(siteAddRu.grounded, true);
assert.strictEqual(siteAddRu.lang, 'ru');
assert.strictEqual(siteAddRu.intent, 'SITE_ADD_COURSE');

const sitePdfEn = engine.ask('How do I upload my transcript?', richCtx);
assert.strictEqual(sitePdfEn.grounded, true);
assert.strictEqual(sitePdfEn.lang, 'en');
assert.strictEqual(sitePdfEn.intent, 'SITE_UPLOAD_TRANSCRIPT');
console.log('  [PASS] 사이트 사용법 단계별 안내 (KO/EN/RU 과목추가·성적표업로드·기능안내)');

// 10-5. Friendly general conversation & tips (no fabricated numbers)
const chatHi = engine.ask('안녕하세요', richCtx);
assert.strictEqual(chatHi.grounded, true);
assert.strictEqual(chatHi.intent, 'GENERAL_CHAT');
const chatTips = engine.ask('수강신청 팁 알려줘', richCtx);
assert.strictEqual(chatTips.grounded, true);
assert.strictEqual(chatTips.intent, 'GENERAL_TIPS');
console.log('  [PASS] 일반 대화 및 수강신청 팁 자연 응답 확인');

console.log('\n>>> ALL RAG SYSTEM TESTS PASSED SUCCESSFULLY! <<<');
