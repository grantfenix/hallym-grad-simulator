const assert = require('assert');
const gradJson = require('../data/graduation_rules.json');
const gradJs = require('../data/graduation_rules.js');

console.log('========================================');
console.log('Testing Graduation Rules Official Integrity (Phase 1)');
console.log('========================================');

// 1. JSON & JS wrapper parity
assert.deepStrictEqual(gradJs, gradJson, 'data/graduation_rules.js must match data/graduation_rules.json');
assert.strictEqual(Object.keys(gradJson).length, 23, 'All 23 existing department keys must be preserved');
console.log('  [PASS] graduation_rules.json & .js parity (23 departments)');

// 2. 화학과: 오디세이세미나3만 전필 (물리/유기/분석/무기 오기재 제거)
const chem = gradJson['화학과'];
assert.strictEqual(chem.mandatory_courses.since_2021.length, 1);
assert.strictEqual(chem.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert.strictEqual(chem.major_credits.single, 60);
console.log('  [PASS] 화학과: 전필=오디세이세미나3만, 단일 60학점');

// 3. 융합과학수사학과: 글로벌융합대학 소속, 오디세이세미나3만 전필, 졸업논문/시험 없음
const forensic = gradJson['융합과학수사학과'];
assert.strictEqual(forensic.college, '글로벌융합대학');
assert.strictEqual(forensic.mandatory_courses.since_2021.length, 1);
assert.strictEqual(forensic.mandatory_courses.since_2021[0].title, '오디세이세미나3');
assert.ok(forensic.special_conditions.graduation_thesis.includes('없음'));
console.log('  [PASS] 융합과학수사학과: 글로벌융합대학, 전필=오디세이세미나3, 졸업시험/논문 없음');

// 4. 소프트웨어학부: 복수전공 6학점 동일, 취업연계SW실무 대체, 3개 세부전공 9과목씩
const sw = gradJson['소프트웨어학부'];
assert.ok(sw.special_conditions.approved_courses.includes('6학점') && sw.special_conditions.approved_courses.includes('단일·복수·부전공 동일'));
assert.ok(sw.special_conditions.graduation_project.includes('취업연계SW실무'));
assert.strictEqual(sw.special_conditions.sub_majors['빅데이터전공'].length, 9);
assert.strictEqual(sw.special_conditions.sub_majors['콘텐츠IT전공'].length, 9);
assert.strictEqual(sw.special_conditions.sub_majors['스마트IoT전공'].length, 9);
console.log('  [PASS] 소프트웨어학부: 복수 6학점, 취업연계SW실무 대체, 3개 세부전공 9종 인정과목');

// 5. 금융재무학과: 경영대학 소속
assert.strictEqual(gradJson['금융재무학과'].college, '경영대학');
console.log('  [PASS] 금융재무학과: 경영대학 소속 정정');

// 6. 인공지능융합학부: 캡스톤Ⅰ 코드 729001 정정
const aiConv = gradJson['인공지능융합학부'];
const cap = aiConv.mandatory_courses.since_2021.find((c) => c.title.includes('캡스톤'));
assert.strictEqual(cap.code, '729001');
console.log('  [PASS] 인공지능융합학부: 캡스톤Ⅰ 코드 729001 정정');

// 7. 영어영문학과: TOEIC 700 / 650 / 600 및 기본 3과목 A0+
assert.ok(gradJson['영어영문학과'].special_conditions.language_cert.includes('TOEIC 700'));
assert.ok(gradJson['영어영문학과'].special_conditions.language_cert.includes('글로벌영미문화'));
console.log('  [PASS] 영어영문학과: TOEIC 700/650/600 및 기본 3과목 A0+ 반영');

// 8. 러시아어학과: 공식명 러시아학과, 토르플 1급 이상 및 4과목 중 2과목 B+ 대체
assert.strictEqual(gradJson['러시아어학과'].official_name, '러시아학과');
assert.ok(gradJson['러시아어학과'].special_conditions.language_cert.includes('1급 이상'));
assert.ok(gradJson['러시아어학과'].special_conditions.language_cert.includes('B+'));
console.log('  [PASS] 러시아어학과(러시아학과): 토르플 1급 + 2과목 B+ 대체 반영');

// 9. 데이터사이언스학부: 비교과 자율역량 5개 중 택 1 (TOEIC 700 포함)
assert.ok(gradJson['데이터사이언스학부'].special_conditions.graduation_cert.includes('TOEIC 700'));
assert.ok(gradJson['데이터사이언스학부'].special_conditions.graduation_cert.includes('5개'));
console.log('  [PASS] 데이터사이언스학부: 비교과 자율역량 5개 중 택 1 반영');

// 10. 반도체·디스플레이스쿨: 2025학번 기초교양 4과목 필수
assert.ok(gradJson['반도체·디스플레이스쿨'].special_conditions.basic_ge_since_2025.includes('물리학및실험1'));
assert.ok(gradJson['반도체·디스플레이스쿨'].special_conditions.basic_ge_since_2025.includes('일반화학및실험2'));
console.log('  [PASS] 반도체·디스플레이스쿨: 2025학번 기초교양 4과목 필수 반영');

// 11. 체육학과: 나노디그리 실기 8학점 완화 반영
assert.ok(gradJson['체육학과'].special_conditions.sports_cert.includes('8학점'));
console.log('  [PASS] 체육학과: 나노디그리 실기 8학점 완화 반영');

// 12. 경영학과 기존 6대 트랙/졸업시험 9개 분야 무결성 보존
assert.strictEqual(Object.keys(gradJson['경영학과'].special_conditions.exam_fields).length, 9);
console.log('  [PASS] 경영학과 기존 9개 졸업시험 분야 무결성 유지');

console.log('\n>>> ALL PHASE 1 GRADUATION RULES INTEGRITY TESTS PASSED! <<<');
