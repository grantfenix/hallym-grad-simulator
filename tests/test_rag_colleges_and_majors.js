const assert = require('assert');
const RagModule = require('../js/rag_engine.js');

console.log('========================================');
console.log('Testing RAG 10 College & Major Queries (Phase 1)');
console.log('========================================');

const engine = RagModule.createEngine();
const defaultUser = { major: '경영학과', admissionYear: 2025, studentType: '재학생' };

const cases = [
  {
    q: '소프트웨어학부 졸업 요건은 무엇인가요?',
    expectDept: '소프트웨어학부',
    mustInclude: ['소프트웨어캡스톤디자인', '취업연계SW실무', '6학점']
  },
  {
    q: '빅데이터전공 졸업 요건은 무엇인가요?',
    expectDept: '소프트웨어학부',
    mustInclude: ['빅데이터전공', '빅데이터개론', '소프트웨어캡스톤디자인']
  },
  {
    q: '콘텐츠IT전공 졸업 요건은 무엇인가요?',
    expectDept: '소프트웨어학부',
    mustInclude: ['콘텐츠IT전공', 'VR/AR', '소프트웨어캡스톤디자인']
  },
  {
    q: '스마트IoT전공 졸업 요건은 무엇인가요?',
    expectDept: '소프트웨어학부',
    mustInclude: ['스마트IoT전공', 'IoT네트워크', '소프트웨어캡스톤디자인']
  },
  {
    q: '인공지능컴퓨팅학부 졸업 요건은 무엇인가요?',
    expectDept: '인공지능컴퓨팅학부',
    mustInclude: ['인공지능컴퓨팅학부', '캡스톤디자인']
  },
  {
    q: '데이터사이언스학부 졸업 요건은 무엇인가요?',
    expectDept: '데이터사이언스학부',
    mustInclude: ['데이터사이언스학부', 'TOEIC 700']
  },
  {
    q: '광고홍보학과 졸업 요건은 무엇인가요?',
    expectDept: '광고홍보학과',
    mustInclude: ['광고홍보학과', '광고홍보조사방법론']
  },
  {
    q: '간호학과 졸업 요건은 무엇인가요?',
    expectDept: '간호학과',
    mustInclude: ['간호학과', '81학점', '모의고사 2회']
  },
  {
    q: '의생명과학대학 졸업 요건은 무엇인가요?',
    expectDept: '의생명과학대학',
    mustInclude: ['의생명과학대학', '생명과학과', '바이오메디컬학과', '식품영양학과']
  },
  {
    q: '인문대학 졸업 요건은 무엇인가요?',
    expectDept: '인문대학',
    mustInclude: ['인문대학', '영어영문학과', '중국학과', '러시아학과'],
    mustNotInclude: ['경영학과']
  }
];

cases.forEach((tc, idx) => {
  const res = engine.ask(tc.q, { user: defaultUser });
  assert.strictEqual(res.grounded, true, `[#${idx + 1}] expected grounded=true for "${tc.q}"`);
  assert.strictEqual(res.targetDept, tc.expectDept, `[#${idx + 1}] expected targetDept=${tc.expectDept}, got ${res.targetDept}`);
  assert.ok(Array.isArray(res.sources) && res.sources.length >= 1, `[#${idx + 1}] missing sources`);
  tc.mustInclude.forEach((kw) => {
    assert.ok(res.answer.includes(kw), `[#${idx + 1}] answer missing "${kw}": ${res.answer}`);
  });
  (tc.mustNotInclude || []).forEach((bad) => {
    assert.ok(!res.answer.includes(bad), `[#${idx + 1}] answer must NOT contain "${bad}": ${res.answer}`);
  });
  console.log(`  [PASS] #${idx + 1} "${tc.q}" -> ${res.targetDept} (${res.sources[0].source} [${res.sources[0].loc}])`);
});

console.log('\n>>> ALL 10 COLLEGE & MAJOR RAG QUERIES PASSED! <<<');
