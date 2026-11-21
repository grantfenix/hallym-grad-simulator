const fs = require('fs');
const path = require('path');

// 1. Mock DOM Environment
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.style = {};
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList.classes.has(c)) this.classList.classes.delete(c);
          else this.classList.classes.add(c);
        } else if (force) {
          this.classList.classes.add(c);
        } else {
          this.classList.classes.delete(c);
        }
      },
      contains: (c) => this.classList.classes.has(c)
    };
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.options = [];
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector(sel) {
    return null;
  }

  querySelectorAll(sel) {
    return [];
  }

  focus() {}
}

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

const mockDocument = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = new MockElement(id);
    }
    return this.elements[id];
  },
  createElement(tag) {
    return new MockElement('', tag);
  },
  addEventListener() {}
};

global.document = mockDocument;
global.window = global;
global.window.addEventListener = () => {};
global.addEventListener = () => {};
global.localStorage = new MockLocalStorage();
let alerts = [];
let confirms = [];
let confirmResponse = true;

global.alert = (msg) => { alerts.push(msg); };
global.confirm = (msg) => {
  confirms.push(msg);
  return confirmResponse;
};

// Load data files into window
require('../data/courses.js');
require('../data/graduation_rules.js');
require('../data/gyoyang_rules.js');

// Read and extract full script from index.html
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// Find the main inline script in index.html
const scriptTagStart = html.lastIndexOf('<script>');
const scriptTagEnd = html.lastIndexOf('</script>');
const fullScript = html.substring(scriptTagStart + 8, scriptTagEnd);

console.log('Script extracted from index.html, length:', fullScript.length);

// Wrap variables in global scope for testing
let instrumentedScript = fullScript;
// Expose functions and module variables
instrumentedScript = instrumentedScript.replace('let courseDatabase = [];', 'global.courseDatabase = [];');
instrumentedScript = instrumentedScript.replace('let currentUser = null;', 'global.currentUser = null;');
instrumentedScript = instrumentedScript.replace('let activeUserCourses = [];', 'global.activeUserCourses = [];');
instrumentedScript = instrumentedScript.replace('let basketCourses = [];', 'global.basketCourses = [];');
instrumentedScript = instrumentedScript.replace('let customCourses = [];', 'global.customCourses = [];');
instrumentedScript = instrumentedScript.replace('let graduationRules = {};', 'global.graduationRules = {};');
instrumentedScript = instrumentedScript.replace('let gyoyangRules = {};', 'global.gyoyangRules = {};');
instrumentedScript = instrumentedScript.replace('let parsedCourseItems = [];', 'global.parsedCourseItems = [];');
instrumentedScript = instrumentedScript.replace("let parsedDupStrategy = 'overwrite';", "global.parsedDupStrategy = 'overwrite';");

// Execute script into global scope
try {
  eval(instrumentedScript);
  console.log('Main application script evaluated successfully.');
} catch (err) {
  console.error('Script evaluation failed:', err);
  process.exit(1);
}

// Suite execution
const testResults = [];
function recordResult(testName, passed, details = '') {
  testResults.push({ testName, passed, details });
  if (passed) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}: ${details}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   HALLYM GRAD SIMULATOR FULL COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  // Load database
  await loadCourseDatabase();
  await loadGraduationRules();
  await loadGyoyangRules();
  ensureDefaultDemoUser();

  console.log(`Courses loaded: ${courseDatabase.length}`);
  console.log(`Graduation rule depts: ${Object.keys(graduationRules).length}`);
  console.log(`Gyoyang cohorts: ${Object.keys(gyoyangRules).join(', ')}`);

  // -------------------------------------------------------------------
  // TEST 1: 회원가입 / 로그인 / 로그아웃
  // -------------------------------------------------------------------
  console.log('\n--- 1. 회원가입 / 로그인 / 로그아웃 ---');
  try {
    // 1-1. 회원가입 유효성 검사 (학번 오류)
    document.getElementById('reg-id').value = 'abc';
    document.getElementById('reg-name').value = '테스터';
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw-confirm').value = '1234';
    document.getElementById('reg-major').value = '경영학과';
    document.getElementById('reg-admission-year').value = '2024';
    document.getElementById('reg-has-double').checked = false;
    document.getElementById('reg-double-name').value = '';

    handleRegister({ preventDefault: () => {} });
    const alertEl = document.getElementById('auth-alert');
    const idValidationPass = alertEl.innerHTML.includes('숫자 4~10자리');
    recordResult('1-1. 회원가입 학번 숫자 검증', idValidationPass);

    // 1-2. 비밀번호 불일치 검증
    document.getElementById('reg-id').value = '20241111';
    document.getElementById('reg-pw-confirm').value = '9999';
    handleRegister({ preventDefault: () => {} });
    const pwMismatchPass = alertEl.innerHTML.includes('비밀번호와 비밀번호 확인이 일치하지 않습니다');
    recordResult('1-2. 회원가입 비밀번호 불일치 검증', pwMismatchPass);

    // 1-3. 정상 회원가입
    document.getElementById('reg-pw-confirm').value = '1234';
    handleRegister({ preventDefault: () => {} });
    const users = getUsers();
    const registeredUser = users['20241111'];
    const regSuccess = registeredUser && registeredUser.name === '테스터' && registeredUser.admissionYear === 2024;
    recordResult('1-3. 정상 회원가입 및 사용자 데이터 저장', regSuccess);

    // 1-4. 잘못된 비밀번호 로그인 실패
    document.getElementById('login-id').value = '20241111';
    document.getElementById('login-pw').value = 'wrongpw';
    handleLogin({ preventDefault: () => {} });
    const wrongPwPass = alertEl.innerHTML.includes('비밀번호가 올바르지 않습니다');
    recordResult('1-4. 로그인 비밀번호 불일치 방어', wrongPwPass);

    // 1-5. 정상 로그인
    document.getElementById('login-pw').value = '1234';
    handleLogin({ preventDefault: () => {} });
    const loginPass = currentUser && currentUser.studentId === '20241111';
    recordResult('1-5. 정상 로그인 및 사용자 세션 생성', loginPass);

    // 1-6. 데모 로그인
    handleDemoLogin();
    const demoLoginPass = currentUser && (currentUser.studentId === '20250000' || currentUser.studentId === '20258044') && activeUserCourses.length >= 20;
    recordResult('1-6. 데모 계정(20250000) 원클릭 로그인 및 기이수 과목 로드', demoLoginPass);

    // 1-7. 로그아웃
    confirmResponse = true;
    handleLogout();
    const logoutPass = currentUser === null && localStorage.getItem('hallym_current_user_id') === null;
    recordResult('1-7. 로그아웃 세션 해제', logoutPass);

    // Re-login with our test user 20241111 for subsequent tests
    completeLogin(registeredUser);
  } catch (err) {
    recordResult('1. 회원가입/로그인/로그아웃', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 2: 과목 직접 추가 / 수정 / 삭제 (CRUD)
  // -------------------------------------------------------------------
  console.log('\n--- 2. 과목 직접 추가 / 수정 / 삭제 (CRUD) ---');
  try {
    // 2-1. 공백 과목명 추가 시도 -> 경고
    alerts = [];
    document.getElementById('course-edit-id').value = '';
    document.getElementById('course-title-input').value = '   ';
    document.getElementById('course-credits-input').value = '3';
    document.getElementById('course-cat-input').value = '경영_전선';
    document.getElementById('course-semester-input').value = '2024-1';
    document.getElementById('course-grade-input').value = 'A+';
    saveCourseFromModal();
    const emptyTitleBlocked = alerts.some(a => a.includes('과목명을 입력'));
    recordResult('2-1. 과목명 공백 유효성 검증', emptyTitleBlocked);

    // 2-2. 정상 과목 추가 (마케팅원론, 3학점, 경영_전선, A+)
    document.getElementById('course-title-input').value = '마케팅원론';
    saveCourseFromModal();
    const addedCourse = activeUserCourses.find(c => c.title === '마케팅원론');
    const addSuccess = addedCourse && addedCourse.credits === 3 && addedCourse.grade === 'A+';
    recordResult('2-2. 신규 과목 직접 추가', addSuccess);

    // 2-3. 과목 정보 수정 (성적 A+ -> A0, 학점 3)
    document.getElementById('course-edit-id').value = addedCourse.id;
    document.getElementById('course-title-input').value = '마케팅원론';
    document.getElementById('course-grade-input').value = 'A0';
    saveCourseFromModal();
    const updatedCourse = activeUserCourses.find(c => c.id === addedCourse.id);
    const updateSuccess = updatedCourse && updatedCourse.grade === 'A0';
    recordResult('2-3. 과목 정보 수정', updateSuccess);

    // 2-4. 과목 삭제
    confirmResponse = true;
    deleteCourse(addedCourse.id);
    const deleteSuccess = !activeUserCourses.some(c => c.id === addedCourse.id);
    recordResult('2-4. 과목 삭제', deleteSuccess);
  } catch (err) {
    recordResult('2. 과목 CRUD', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 3 & 4: 성적증명서 PDF 추출, OCR 인식, 텍스트 파싱, 테이블 확인 & 저장
  // -------------------------------------------------------------------
  console.log('\n--- 3 & 4. 성적증명서 PDF / OCR / 파싱 / 테이블 UI / 저장 ---');
  try {
    const rawTranscript = `
[ 2024학년도 제 1학기 ]
010001 경영학원론 전필 3 A+
010002 회계원리 전필 3 A0
010003 컴퓨팅사고 교양 2 A+
010004 오디세이세미나1 교양 1 P

[ 2024학년도 제 2학기 ]
020001 창의코딩 교양 3 A+
020002 오디세이세미나2 교양 1 P
020003 마케팅원론 전선 3 B+
020004 대학영어1 교양 3 A0
`;

    // 4-1. 텍스트 파싱
    const parseResult = parseTranscriptText(rawTranscript, '경영학과');
    const parseSuccess = parseResult.success && parseResult.count === 8;
    recordResult('4-1. 한림대 성적증명서 텍스트 파싱 (8과목)', parseSuccess, `Parsed count: ${parseResult.count}`);

    // 4-2. 확인 테이블 초기화
    initParsedCourseItems(parseResult.courses);
    const tableInitPass = parsedCourseItems.length === 8;
    recordResult('4-2. 파싱 결과 확인 테이블 초기화', tableInitPass);

    // 4-3. 테이블에서 인라인 수정 (마케팅원론 B+ -> A+)
    const mktItem = parsedCourseItems.find(i => i.title === '마케팅원론');
    updateParsedCourseItem(mktItem.id, 'grade', 'A+');
    const inlineEditPass = parsedCourseItems.find(i => i.title === '마케팅원론').grade === 'A+';
    recordResult('4-3. 파싱 테이블 인라인 수정 (성적 A+)', inlineEditPass);

    // 4-4. 내 과목 목록으로 저장
    saveParsedCoursesToUser();
    const saveToUserPass = activeUserCourses.length === 8 &&
      activeUserCourses.some(c => c.title === '경영학원론' && c.grade === 'A+') &&
      activeUserCourses.some(c => c.title === '컴퓨팅사고' && c.grade === 'A+');
    recordResult('4-4. 내 과목 목록 저장 및 localStorage 반영', saveToUserPass);
  } catch (err) {
    recordResult('3 & 4. PDF 파싱 및 저장', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 5: 중복 과목 처리 (Duplicate Prevention & Strategies)
  // -------------------------------------------------------------------
  console.log('\n--- 5. 중복 과목 처리 (Duplicate Handling) ---');
  try {
    // 5-1. 재업로드 시 동일 과목 감지
    const dupTranscript = `
[ 2025학년도 제 1학기 ]
010001 경영학원론 전필 3 B0
099999 신규과목 전선 3 A+
`;
    const dupParseResult = parseTranscriptText(dupTranscript, '경영학과');
    initParsedCourseItems(dupParseResult.courses);

    const dupItem = parsedCourseItems.find(i => i.title === '경영학원론');
    const newItem = parsedCourseItems.find(i => i.title === '신규과목');
    const dupDetectedPass = dupItem && dupItem.isDuplicate && newItem && !newItem.isDuplicate;
    recordResult('5-1. 기존 과목과 중복 과목 정확한 식별', dupDetectedPass);

    // 5-2. 'skip' 전략 토글
    handleDupStrategyChange('skip');
    const skipPass = !dupItem.selected && newItem.selected;
    recordResult('5-2. 중복 처리 건너뛰기(skip) 전략 반영', skipPass);

    // 5-3. 'overwrite' 전략 토글 후 저장
    handleDupStrategyChange('overwrite');
    dupItem.selected = true;
    saveParsedCoursesToUser();

    const bizFinal = activeUserCourses.find(c => c.title === '경영학원론');
    const overwritePass = bizFinal && bizFinal.grade === 'B0';
    recordResult('5-3. 중복 처리 덮어쓰기(overwrite) 저장 반영 (A+ -> B0)', overwritePass);
  } catch (err) {
    recordResult('5. 중복 과목 처리', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 6: 학점 자동 집계 (Graduation Metrics Engine)
  // -------------------------------------------------------------------
  console.log('\n--- 6. 학점 자동 집계 (Graduation Metrics Engine) ---');
  try {
    // Current active courses:
    // 경영학원론(3, B0), 회계원리(3, A0), 컴퓨팅사고(2, A+), 오디세이1(1, P), 창의코딩(3, A+),
    // 오디세이2(1, P), 마케팅원론(3, A+), 대학영어1(3, A0), 신규과목(3, A+)
    const m = calculateMetrics(activeUserCourses);

    // Total: 3+3+2+1+3+1+3+3+3 = 22
    const totalCreditsPass = m.confTotal === 22;
    recordResult('6-1. 취득 총학점 집계 (22학점)', totalCreditsPass, `Expected 22, got: ${m.confTotal}`);

    // Major: 경영학원론(3) + 회계원리(3) + 마케팅원론(3) + 신규과목(3) = 12
    const majorCreditsPass = m.confMajor === 12;
    recordResult('6-2. 전공 취득학점 집계 (12학점)', majorCreditsPass, `Expected 12, got: ${m.confMajor}`);

    // GE: 컴퓨팅사고(2) + 오디세이1(1) + 창의코딩(3) + 오디세이2(1) + 대학영어1(3) = 10
    const geCreditsPass = m.confGE === 10;
    recordResult('6-3. 교양 취득학점 집계 (10학점)', geCreditsPass, `Expected 10, got: ${m.confGE}`);

    // Remaining total credits: 130 - 22 = 108
    const remainPass = m.remainTotal === 108;
    recordResult('6-4. 잔여 졸업학점 집계 (108학점)', remainPass, `Expected 108, got: ${m.remainTotal}`);
  } catch (err) {
    recordResult('6. 학점 자동 집계', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 7: 교양 6대 영역 세부 진단 (Gyoyang 6 Areas & Substitutions)
  // -------------------------------------------------------------------
  console.log('\n--- 7. 교양 6대 영역 진단 및 대체과목 ---');
  try {
    const m = calculateMetrics(activeUserCourses);
    const geDiag = m.geDiagnosis;

    // 7-1. 정보소통 (컴퓨팅사고 2 + 창의코딩 3 = 5학점) -> PASSED
    const infoCat = geDiag.find(c => c.area === '정보소통');
    const infoPass = infoCat && infoCat.status === 'PASSED' && infoCat.confirmed_credits === 5;
    recordResult('7-1. 교양 정보소통 영역 진단 (5/5 PASSED)', infoPass, `Got: ${infoCat?.confirmed_credits} (${infoCat?.status})`);

    // 7-2. 생애설계 (오디세이세미나1 1 + 오디세이세미나2 1 = 2학점) -> PASSED
    const lifeCat = geDiag.find(c => c.area === '생애설계');
    const lifePass = lifeCat && lifeCat.status === 'PASSED' && lifeCat.confirmed_credits === 2;
    recordResult('7-2. 교양 생애설계 영역 진단 (2/2 PASSED)', lifePass, `Got: ${lifeCat?.confirmed_credits} (${lifeCat?.status})`);

    // 7-3. 글로벌소통 (대학영어1 3학점 이수 / 9학점 기준) -> MISSING
    const globalCat = geDiag.find(c => c.area === '글로벌소통');
    const globalPass = globalCat && globalCat.status === 'MISSING' && globalCat.confirmed_credits === 3;
    recordResult('7-3. 교양 글로벌소통 영역 진단 (3/9 MISSING)', globalPass, `Got: ${globalCat?.confirmed_credits} (${globalCat?.status})`);

    // 7-4. 대체과목 테스트: 공식 대체과목인 'Technical Writing' 및 '읽기와쓰기' 수강 시 인정되는지 검증
    const testSubCourses = [
      { id: 'sub1', title: 'Technical Writing in a Technological Era', cat: '교양_글로벌소통', credits: 3, grade: 'A+' },
      { id: 'sub2', title: 'Essential English 1', cat: '교양_글로벌소통', credits: 3, grade: 'A+' },
      { id: 'sub3', title: 'Essential English 2', cat: '교양_글로벌소통', credits: 3, grade: 'A+' },
      { id: 'sub4', title: '읽기와쓰기', cat: '교양_의사소통', credits: 3, grade: 'A+' }
    ];
    const subDiag = diagnoseGyoyang(testSubCourses, 2024);
    const subGlobal = subDiag.find(c => c.area === '글로벌소통');
    const subComm = subDiag.find(c => c.area === '의사소통');
    const subPass = subGlobal && subGlobal.status === 'PASSED' && subGlobal.confirmed_credits === 9 &&
                    subComm && subComm.status === 'PASSED' && subComm.confirmed_credits === 3;
    recordResult('7-4. 교양 대체과목 인식 (Technical Writing -> 진로영어, 읽기와쓰기 -> 의사소통 PASSED)', subPass);
  } catch (err) {
    recordResult('7. 교양 6대 영역 진단', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 8: 전공필수 진단 (Major Mandatory Status)
  // -------------------------------------------------------------------
  console.log('\n--- 8. 전공필수 진단 (Major Mandatory) ---');
  try {
    // 8-1. 2024학번 경영학과 전필 진단 (since_2021 기준: 오디세이세미나3 1학점)
    currentUser.admissionYear = 2024;
    currentUser.major = '경영학과';
    const m2024 = calculateMetrics(activeUserCourses);
    const mand2024 = m2024.mandatoryStatus;
    const ody3Item = mand2024.find(s => s.title === '오디세이세미나3');
    const mand2024Pass = mand2024.length === 1 && ody3Item && ody3Item.status === 'MISSING';
    recordResult('8-1. 2024학번 경영학과 전필 규칙 진단 (since_2021: 오디세이세미나3 1과목 필수)', mand2024Pass);

    // 8-2. 2020학번 이전 경영학과 전필 규칙 진단 (before_2021: 회계입문, 마케팅원론 등 6과목 필수)
    currentUser.admissionYear = 2020;
    const m2020 = calculateMetrics(activeUserCourses);
    const mand2020 = m2020.mandatoryStatus;
    const mktIn2020 = mand2020.find(s => s.title === '마케팅원론');
    const acctIn2020 = mand2020.find(s => s.title.includes('회계'));
    const mand2020Pass = mand2020.length >= 5 && mktIn2020 && mktIn2020.status === 'PASSED' && acctIn2020 && acctIn2020.status === 'PASSED';
    recordResult('8-2. 2020 이전 학번 경영학과 전필 규칙 진단 (before_2021: 마케팅원론/회계입문 PASSED)', mand2020Pass);

    // Restore user to 2024
    currentUser.admissionYear = 2024;
  } catch (err) {
    recordResult('8. 전공필수 진단', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 9: 장바구니 + 졸업 시뮬레이터 (Basket & Graduation Simulator)
  // -------------------------------------------------------------------
  console.log('\n--- 9. 장바구니 + 졸업 시뮬레이터 ---');
  try {
    // 9-1. 장바구니에 새 과목 추가 (경영통계학 3학점)
    document.getElementById('bask-title-input').value = '경영통계학';
    document.getElementById('bask-cat-input').value = '경영_전필';
    document.getElementById('bask-cred-input').value = '3';
    addCourseToBasket();

    const baskItem = basketCourses.find(b => b.title === '경영통계학');
    const baskAddPass = baskItem && baskItem.credits === 3 && !baskItem.isDuplicate;
    recordResult('9-1. 장바구니 과목 추가', baskAddPass);

    // 9-2. 이미 이수한 과목 장바구니 추가 시 중복 경고 (재이수 제한)
    document.getElementById('bask-title-input').value = '회계원리';
    document.getElementById('bask-cat-input').value = '경영_전필';
    document.getElementById('bask-cred-input').value = '3';
    addCourseToBasket();

    const dupBaskItem = basketCourses.find(b => b.title === '회계원리');
    const dupBaskPass = dupBaskItem && dupBaskItem.isDuplicate === true;
    recordResult('9-2. 장바구니 중복(재이수) 과목 식별 및 학점 제외 플래그', dupBaskPass);

    // 9-3. 18학점 초과 경고 검증
    for (let i = 1; i <= 5; i++) {
      document.getElementById('bask-title-input').value = `더미과목${i}`;
      document.getElementById('bask-cat-input').value = '일반선택';
      document.getElementById('bask-cred-input').value = '3';
      addCourseToBasket();
    }
    const warnContainer = document.getElementById('sim-warnings-container');
    const limitWarnPass = warnContainer.innerHTML.includes('18학점');
    recordResult('9-3. 한 학기 수강 한도(18학점) 초과 경고 표시', limitWarnPass);

    // 9-4. 장바구니 비우기
    clearBasket();
    const clearPass = basketCourses.length === 0;
    recordResult('9-4. 장바구니 비우기(초기화)', clearPass);
  } catch (err) {
    recordResult('9. 장바구니 & 시뮬레이터', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 10: 검색 기능 (한글 + 영문)
  // -------------------------------------------------------------------
  console.log('\n--- 10. 검색 기능 (한글 + 영문) ---');
  try {
    const all = getAllSearchableCourses();

    // 10-1. 한글 검색 ('마케팅', '회계')
    const koMktMatches = all.filter(c => c.title && norm(c.title).includes(norm('마케팅')));
    const koMktPass = koMktMatches.length > 0 && koMktMatches.some(c => c.title === '마케팅원론');
    recordResult('10-1. 한글 교과목명 검색 (마케팅 -> 마케팅원론 매칭)', koMktPass);

    // 10-2. 영문 검색 ('English', 'Accounting', 'Financial')
    const engMatches = all.filter(c => c.title && norm(c.title).includes(norm('English')));
    const engPass = engMatches.length > 0 && engMatches.some(c => norm(c.title).includes('english'));
    recordResult('10-2. 영문 교과목명 검색 (English -> ESSENTIAL ENGLISH 등 매칭)', engPass);

    // 10-3. 과목 코드 검색
    const codeMatches = all.filter(c => c.code && norm(c.code).includes(norm('205303')));
    const codePass = codeMatches.length > 0 && codeMatches.some(c => c.code === '205303');
    recordResult('10-3. 학수번호(과목코드) 검색', codePass);
  } catch (err) {
    recordResult('10. 검색 기능', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST 11: 학과/학번 변경 시 규칙 적용 (Dynamic Settings & Cohort Rules)
  // -------------------------------------------------------------------
  console.log('\n--- 11. 학과/학번 변경 시 규칙 적용 ---');
  try {
    // 11-1. 2024학번 -> 2021학번 변경 (교양 기준 2023+ -> 2022- 전환)
    currentUser.admissionYear = 2021;
    const rule2021 = getGyoyangRule(getUserAdmissionYear(currentUser));
    const isOldRule = rule2021 && rule2021.total_credits === 26 &&
                      rule2021.areas && rule2021.areas['자율선택'] && rule2021.areas['자율선택'].required_credits === 9 &&
                      rule2021.areas['글로벌소통'].career_english_required === false;
    recordResult('11-1. 2022 이전 학번 변경 시 before_2023 교양 규칙 적용 (자율선택 9학점, Career English 의무 없음)', isOldRule);

    // 11-2. 2024학번 변경 시 since_2023 교양 규칙 적용
    currentUser.admissionYear = 2024;
    const rule2024 = getGyoyangRule(getUserAdmissionYear(currentUser));
    const isNewRule = rule2024 && rule2024.total_credits === 26 &&
                      rule2024.areas && rule2024.areas['정보소통'] && rule2024.areas['정보소통'].required_credits === 5 &&
                      rule2024.areas['글로벌소통'].career_english_required === true;
    recordResult('11-2. 2023 이후 학번 변경 시 since_2023 교양 규칙 적용 (정보소통 5학점, Career English 의무 있음)', isNewRule);

    // 11-3. 학과 변경: 경영학과 -> 빅데이터학과
    currentUser.major = '빅데이터학과';
    const bigDataRule = getDepartmentGradRule('빅데이터학과');
    const bigDataPass = bigDataRule && bigDataRule.department === '빅데이터학과' && bigDataRule.total_credits === 130;
    recordResult('11-3. 전공 변경 시 학과별 졸업 규정(빅데이터학과) 자동 반영', bigDataPass);

    // Restore to 경영학과
    currentUser.major = '경영학과';
  } catch (err) {
    recordResult('11. 학과/학번 변경 시 규칙 적용', false, err.message);
  }

  console.log('\n======================================================');
  const total = testResults.length;
  const passedCount = testResults.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  console.log(`TEST SUITE FINISHED: ${passedCount}/${total} PASSED (${((passedCount/total)*100).toFixed(1)}%)`);
  if (failedCount > 0) {
    console.error(`FAILED TESTS (${failedCount}):`);
    testResults.filter(r => !r.passed).forEach(r => console.error(` - ${r.testName}: ${r.details}`));
  }
  console.log('======================================================\n');
}

runTestSuite();
