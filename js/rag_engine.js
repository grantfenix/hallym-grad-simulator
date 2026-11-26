/**
 * Hallym University Graduation Simulator - Multilingual Conversational RAG Engine
 *
 * Supports Korean (ko), English (en), Russian (ru), and Chinese (zh).
 * - Replies in the user's detected language
 * - Personalizes using major, admissionYear, studentType, passed/in-progress/low-grade courses, basket & deficits
 * - Answers both official academic regulation queries (with exact citations) and site usage how-to questions
 * - Answers general conversational/study questions without fabricating official regulation numbers
 * - Keeps answers short, clean, and mobile-360px friendly with collapsible source quotes
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.HallymRagEngine = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const I18N = {
    ko: {
      notFound: '공식 자료에서 확인할 수 없습니다. (확인 불가)',
      outOfScope: '죄송하지만 이 질문은 학사 도우미의 서비스 범위를 벗어납니다.\n졸업 요건, 수강 과목, 성적표 업로드 또는 사이트 사용법에 대해 도와드릴 수 있습니다.',
      portalDisclaimer: '실제 개설 여부·시간표·담당 교수님은 학교 포털에서 확인해야 합니다.',
      labels: {
        headline: '핵심 답변',
        nextActions: '필요한 과목 / 다음 행동',
        remaining: '남은 학점',
        viewSources: '출처 보기',
        hideSources: '출처 숨기기',
        sourcesHeading: '참고 출처 및 원문 인용',
        ungroundedBadge: '확인 불가',
        outOfScopeBadge: '서비스 범위 안내'
      }
    },
    en: {
      notFound: 'Cannot verify from official university documents. (Unconfirmed)',
      outOfScope: 'Sorry, this question is outside the scope of the Academic Assistant.\nI can help with graduation requirements, courses, transcript uploads, or how to use this site.',
      portalDisclaimer: 'Check the university portal for actual course openings, schedules, and professors.',
      labels: {
        headline: 'Key Answer',
        nextActions: 'Recommended Courses / Next Steps',
        remaining: 'Remaining Credits',
        viewSources: 'View Sources',
        hideSources: 'Hide Sources',
        sourcesHeading: 'Official Sources & Quotes',
        ungroundedBadge: 'Unconfirmed',
        outOfScopeBadge: 'Service Scope'
      }
    },
    ru: {
      notFound: 'Не удалось подтвердить по официальным документам университета. (Нет данных)',
      outOfScope: 'Извините, этот вопрос выходит за рамки учебного помощника.\nЯ могу помочь с требованиями к выпуску, выбором предметов, загрузкой транскрипта или использованием сайта.',
      portalDisclaimer: 'Точное наличие курсов, расписание и преподавателей проверяйте на портале университета.',
      labels: {
        headline: 'Краткий ответ',
        nextActions: 'Что взять / следующие шаги',
        remaining: 'Осталось кредитов',
        viewSources: 'Показать источники',
        hideSources: 'Скрыть источники',
        sourcesHeading: 'Официальные источники и цитаты',
        ungroundedBadge: 'Нет данных',
        outOfScopeBadge: 'Область помощи'
      }
    },
    zh: {
      notFound: '无法在官方资料中确认。（无法确认）',
      outOfScope: '抱歉，这个问题超出了学业助手的服务范围。\n我可以为您解答毕业要求、选课建议、成绩单上传或网站使用方法。',
      portalDisclaimer: '实际开课情况、课表及授课教授信息请以学校门户系统为准。',
      labels: {
        headline: '核心回答',
        nextActions: '建议课程 / 下一步',
        remaining: '剩余学分',
        viewSources: '查看来源',
        hideSources: '隐藏来源',
        sourcesHeading: '官方来源与原文引用',
        ungroundedBadge: '无法确认',
        outOfScopeBadge: '服务范围提示'
      }
    }
  };

  const NOT_FOUND_MESSAGE = I18N.ko.notFound;
  const PORTAL_DISCLAIMER = I18N.ko.portalDisclaimer;

  const PASSING_GRADES = new Set([
    'A+', 'A0', 'A', 'B+', 'B0', 'B', 'C+', 'C0', 'C', 'D+', 'D0', 'D', 'P', 'S'
  ]);
  const NON_PASSING_GRADES = new Set(['F', 'NP', 'N/P', 'U', 'FA', 'W']);
  const IN_PROGRESS_GRADES = new Set(['수강중', '수강', 'ING', 'PROGRESS', '이수중']);
  const LOW_PASS_GRADES = new Set(['D0', 'D', 'D+', 'C0', 'C', 'C+']);

  const STOPWORDS = new Set([
    '무엇', '무엇인가요', '뭔가요', '뭐에요', '뭐예요', '인가요', '인가', '나요', '에요', '예요',
    '알려', '알려줘', '알려주세요', '알고', '싶어요', '싶습니다', '궁금', '궁금합니다',
    '어떻게', '어디', '언제', '누가', '얼마', '얼마나', '몇', '어떤', '어느', '무슨',
    '되나요', '됩니다', '있나요', '있습니다', '없나요', '하나요', '해야', '하면', '하는',
    '대해', '대한', '관련', '설명', '설명해', '해주세요', '해줘', '부탁', '질문',
    '그리고', '또는', '혹은', '하지만', '그런데', '정말', '매우', '가장', '우리', '학교',
    '한림', '한림대', '한림대학교', '학생', '필요', '필요한', '있는', '없는', '경우', '때문',
    '지금', '상황', '상황에서', '제가', '저는', '나의', '내게', '우선', '먼저'
  ]);

  const KO_SUFFIX_RE = /(인가요|인가|입니까|합니까|되나요|있나요|할까요|에서는|으로는|에서도|부터는|까지는|이라고|라고|에서|에게|으로|부터|까지|처럼|보다|하고|이나|이며|인데|이면|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;

  const DEFAULT_BIZ_TRACKS = [
    { id: '회계·세무', title: '회계·세무 트랙', en: 'Accounting & Tax', ru: 'Бухгалтерия и налоги', zh: '会计与税务', desc: '회계·세무 이론과 자격증(CPA/CTA) 준비', foundation: ['경제학원론(거시)', '재무학원론', '회계입문'], advanced: ['중급재무회계1', '원가관리회계', '세무원리', '회계세무실무'] },
    { id: '의료경영', title: '의료경영 트랙', en: 'Healthcare Management', ru: 'Медицинский менеджмент', zh: '医疗经营', desc: '헬스케어·병원·보건정책 경영 리더 양성', foundation: ['헬스케어산업과경영', '의학용어', '조직행동론'], advanced: ['의료경영론', '의료품질경영', '보건의료빅데이터관리', '의료정책과법'] },
    { id: '글로벌혁신전략', title: '글로벌혁신전략 트랙', en: 'Global Innovation Strategy', ru: 'Глобальная инновационная стратегия', zh: '全球创新战略', desc: '국제경영·기술혁신·벤처 전략', foundation: ['창의성과혁신', '경영학원론', '기업가정신과창업', '경영통계학'], advanced: ['경영전략', '국제경영론', '무역실무', '기술경영'] },
    { id: '비즈니스인텔리전스', title: '비즈니스인텔리전스 트랙', en: 'Business Intelligence', ru: 'Бизнес-аналитика (BI)', zh: '商业智能 (BI)', desc: '데이터·통계 기반 비즈니스 분석', foundation: ['경제학원론(거시)', '경영통계학', '경영정보시스템(종합설계)'], advanced: ['데이터사이언스입문', '비즈니스인텔리전스', '회계세무데이터분석', '경영자료분석'] },
    { id: '관광경영', title: '관광경영 트랙', en: 'Tourism Management', ru: 'Туристический менеджмент', zh: '观光经营', desc: '여행·호텔·MICE·관광 공기업 진로', foundation: ['관광경영론', '융합산업경영', '마케팅원론', '조직행동론'], advanced: ['레저산업론', '서비스마케팅', '컨벤션산업론', '호텔경영관리'] },
    { id: '마케팅기획', title: '마케팅기획 트랙', en: 'Marketing Planning', ru: 'Маркетинговое планирование', zh: '营销企划', desc: '마케팅 기획·시장조사·브랜드 전략', foundation: ['회계입문', '마케팅원론', '경영통계학', '조직행동론'], advanced: ['마케팅커뮤니케이션', '소비자행동론', '시장조사론(종합설계)', '국제마케팅'] }
  ];

  // Department alias map (Korean + English + Russian + Chinese)
  const DEPT_ALIASES = [
    ['경영학과', ['경영학과', '경영학', '경영대학', '경영전공', 'business administration', 'business', 'менеджмент', 'бизнес', '经营学', '商学院', '企业管理']],
    ['소프트웨어학부', ['소프트웨어학부', '소프트웨어', '소융대', '컴퓨터공학', '컴공', '빅데이터전공', '스마트iot', '콘텐츠it', 'software', 'computer science', 'софт', 'программир', 'компьютер', '软件学部', '计算机']],
    ['데이터사이언스학부', ['데이터사이언스학부', '데이터사이언스', '데사', '디지털금융정보', '임상의학통계', 'data science', 'анализ данных', '数据科学']],
    ['인공지능융합학부', ['인공지능융합학부', '인공지능융합', 'ai융합', 'ai기술경영', 'ai로봇', 'ai의료', 'artificial intelligence', 'искусственный интеллект', '人工智能']],
    ['인공지능컴퓨팅학부', ['인공지능컴퓨팅학부', '인공지능컴퓨팅']],
    ['경제학과', ['경제학과', '경제학', 'economics', 'экономик', '经济学']],
    ['금융재무학과', ['금융재무학과', '금융재무', '재무금융', 'finance', 'финанс', '金融财务']],
    ['글로벌비즈니스전공', ['글로벌비즈니스전공', '글로벌비즈니스', 'global business']],
    ['글로컬MICE학과', ['글로컬mice학과', '글로컬mice']],
    ['광고홍보학과', ['광고홍보학과', '광고홍보', '광홍', 'advertising', 'реклам', '广告宣传']],
    ['미디어스쿨', ['미디어스쿨', '미디어', '언론방송', '디지털미디어', 'media school', 'медиа', '传媒']],
    ['심리학과', ['심리학과', '심리학', 'psychology', 'психолог', '心理学']],
    ['사회복지학부', ['사회복지학부', '사회복지학과', '사회복지', 'social welfare', '사회복지']],
    ['법학과', ['법학과', '법학', 'law', 'право', '法学']],
    ['사회학과', ['사회학과', '사회학', 'sociology']],
    ['정치행정학과', ['정치행정학과', '정치행정', '정치외교']],
    ['영어영문학과', ['영어영문학과', '영어영문', '영문과', 'english literature']],
    ['국어국문학전공', ['국어국문학전공', '국어국문학과', '국어국문', '국문과']],
    ['일본어학과', ['일본어학과', '일본학과', '일본학', '일어과']],
    ['러시아어학과', ['러시아어학과', '러시아학과', '러시아학', 'russian']],
    ['중국학과', ['중국학과', '중국학', '중문과']],
    ['인문콘텐츠융합전공', ['인문콘텐츠융합전공', '인문콘텐츠']],
    ['반도체·디스플레이스쿨', ['반도체·디스플레이스쿨', '반도체디스플레이', '디스플레이전공', '반도체', 'semiconductor']],
    ['융합과학수사학과', ['융합과학수사학과', '과학수사', '정보법과학']],
    ['체육학과', ['체육학과', '체육학', 'physical education']],
    ['화학과', ['화학과', 'chemistry']],
    ['생명과학과', ['생명과학과', '생명과학', 'biology']],
    ['바이오메디컬학과', ['바이오메디컬학과', '바이오메디컬', 'biomedical']],
    ['식품영양학과', ['식품영양학과', '식품영양']],
    ['환경생명공학과', ['환경생명공학과', '환경생명공학']],
    ['간호학과', ['간호학과', '간호대학', '간호학', 'nursing', 'сестринск', '护理']],
    ['의학과', ['의학과', '의예과', '의과대학', 'medicine', 'медицин', '医学']],
    ['언어병리학전공', ['언어병리학전공', '언어병리학', '언어청각']],
    ['청각학전공', ['청각학전공', '청각학']],
    ['일송자유교양대학 자유교양전공', ['자유교양전공', '일송자유교양']]
  ];

  const ACADEMIC_DOMAIN_TERMS = [
    '졸업', '학점', '교양', '전공', '전필', '전선', '필수', '선택', '과목', '교과목', '수강',
    '트랙', '로드맵', '오디세이', '컴퓨팅', '코딩', '영어', '한국어', '토픽', 'topik', '토익', 'toeic',
    '외국인', '유학생', '편입', '복수전공', '부전공', '전과', '다전공', '캡스톤', '논문', '시험', '면제',
    '이수', '이수구분', '성적', '평점', '학번', '학기', '재이수', '재수강', '대체', '행정실', '연락처', '교학팀',
    '정보소통', '생애설계', '의사소통', '글로벌소통', '스포츠웰니스', '자율선택', '융복합', '한림소양',
    '잔여', '남은', '부족', '미이수', '취득', '진로', '자격증', '학과', '학부', '스쿨', '현장실습',
    'career', 'english', 'credit', 'graduat', 'major', 'course', 'track', 'gpa', 'retake', 'semester', 'foreign', 'international', 'transfer',
    'кредит', 'выпуск', 'семестр', 'предмет', 'курс', 'оценк', 'иностран', 'перевод', 'трек', 'обязательн',
    '毕业', '学分', '教养', '专业', '必修', '选修', '课程', '学期', '成绩', '留学生', '插班', '方向'
  ];

  function detectLanguage(query) {
    const q = String(query || '');
    if (/[\u0400-\u04FF]/.test(q)) return 'ru';
    const hasHangul = /[\uac00-\ud7a3]/.test(q);
    if (!hasHangul && /[\u4E00-\u9FFF]/.test(q)) return 'zh';
    if (!hasHangul && /[a-zA-Z]{2,}/.test(q)) return 'en';
    return 'ko';
  }

  function normStr(s) {
    return String(s || '').replace(/\s+/g, '').toLowerCase();
  }

  function isPassingGrade(grade) {
    if (!grade) return false;
    return PASSING_GRADES.has(String(grade).trim().toUpperCase());
  }

  function isInProgressGrade(grade) {
    if (!grade) return false;
    const g = String(grade).trim().toUpperCase();
    return IN_PROGRESS_GRADES.has(g) || g.includes('수강');
  }

  function getGradePoint(grade) {
    const map = {
      'A+': 4.5, 'A0': 4.0, 'A': 4.0,
      'B+': 3.5, 'B0': 3.0, 'B': 3.0,
      'C+': 2.5, 'C0': 2.0, 'C': 2.0,
      'D+': 1.5, 'D0': 1.0, 'D': 1.0,
      'F': 0.0
    };
    const g = String(grade || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(map, g) ? map[g] : null;
  }

  function tokenize(text) {
    if (!text) return { words: [], bigrams: [], all: [] };
    const cleaned = String(text)
      .toLowerCase()
      .replace(/[^\uac00-\ud7a3a-z0-9\u0400-\u04ff\u4e00-\u9fff.\-+]/g, ' ');

    const rawTokens = cleaned.split(/\s+/).filter(Boolean);
    const words = [];
    const bigrams = [];

    for (let i = 0; i < rawTokens.length; i++) {
      let tok = rawTokens[i].replace(/^[.\-+]+|[.\-+]+$/g, '');
      if (!tok) continue;

      let stem = tok;
      if (/^[\uac00-\ud7a3]{3,}$/.test(tok)) {
        const stripped = tok.replace(KO_SUFFIX_RE, '');
        if (stripped.length >= 2) stem = stripped;
      }

      if (stem.includes('인텔리젼스')) stem = stem.replace(/인텔리젼스/g, '인텔리전스');
      if (stem.includes('오딧세이')) stem = stem.replace(/오딧세이/g, '오디세이');
      if (stem.includes('리더쉽')) stem = stem.replace(/리더쉽/g, '리더십');

      if (stem.length >= 2 && !STOPWORDS.has(stem) && !STOPWORDS.has(tok)) {
        words.push(stem);
        if (stem !== tok && tok.length >= 2 && !STOPWORDS.has(tok)) {
          words.push(tok);
        }
      }

      const hangulParts = stem.match(/[\uac00-\ud7a3]{2,}/g);
      if (hangulParts) {
        for (let p = 0; p < hangulParts.length; p++) {
          const hp = hangulParts[p];
          if (STOPWORDS.has(hp)) continue;
          for (let j = 0; j < hp.length - 1; j++) {
            bigrams.push('bg:' + hp.slice(j, j + 2));
          }
        }
      }
    }

    const all = [];
    for (let i = 0; i < words.length; i++) all.push({ term: words[i], weight: 1.0 });
    for (let i = 0; i < bigrams.length; i++) all.push({ term: bigrams[i], weight: 0.32 });
    return { words, bigrams, all };
  }

  function extractVerbatimQuote(text, queryWords, maxLen) {
    const limit = maxLen || 190;
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    if (flat.length <= limit) return flat;

    const lower = flat.toLowerCase();
    let bestPos = -1;
    for (let i = 0; i < queryWords.length; i++) {
      const w = queryWords[i];
      if (w.length < 2) continue;
      const idx = lower.indexOf(w);
      if (idx !== -1) { bestPos = idx; break; }
    }

    if (bestPos <= 40) return flat.slice(0, limit).trim() + '…';
    const start = Math.max(0, bestPos - 40);
    const end = Math.min(flat.length, start + limit);
    return (start > 0 ? '…' : '') + flat.slice(start, end).trim() + (end < flat.length ? '…' : '');
  }

  const COLLEGE_DEFINITIONS = {
    '인문대학': {
      aliases: ['인문대학', '인문대', '인문학부'],
      depts: ['국어국문학전공', '철학전공', '사학전공', '영어영문학과', '중국학과', '일본학과', '러시아학과', '인문콘텐츠융합전공'],
      summaryKo: '**인문대학**은 공통 **총 130학점 이상**(단일전공 60 · 복수전공 33 · 교양 최소 26, 평점 2.00+)과 전공필수 **오디세이세미나3(1학점)**이 기본이며, 학과별로 졸업논문 또는 공인어학인증 요건이 달라요.',
      bulletsKo: [
        '인문학부(국어국문·철학·사학): **졸업논문** 필수 (사학전공은 강독 `역사학자료탐구Ⅰ·Ⅱ` 2과목 전필 추가)',
        '영어영문학과: 기본 3과목 모두 A0+ 또는 **TOEIC 700+**(650점 +6학점 / 600점 +9학점)',
        '중국학과: **新HSK 5급 195점+**(구간별 완화 대체) 및 **중국 연구 프레젠테이션**',
        '일본학과: **JLPT N2 140점+ / JPT 600점+** + 3단계 수업 2과목+ / 러시아학과: **토르플(TORFL) 1급+** 또는 지정 4과목 중 2과목 B+ 대체'
      ],
      sourceHints: [
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['인문학부 공통', '오디세이세미나3'] },
        { file: 'information/학과별_졸업기준/졸업기준_영어영문학과.txt', kws: ['졸업'] },
        { file: 'information/학과별_졸업기준/졸업기준_러시아어학과.txt', kws: ['TORFL'] }
      ],
      hasOcrWarning: true
    },
    '의생명과학대학': {
      aliases: ['의생명과학대학', '의생명과학대', '의생명대'],
      depts: ['생명과학과', '바이오메디컬학과', '식품영양학과', '의생명과학대학 자율전공'],
      summaryKo: '**의생명과학대학**(2026/2027 신설 개편: 생명과학과·바이오메디컬학과·식품영양학과·자율전공)은 공통 **총 130학점 이상**(단일 60 · 복수 33 · 교양 최소 26)과 **오디세이세미나3(1학점)**이 기본이에요.',
      bulletsKo: [
        '생명과학과: 전필 오디세이세미나3, **졸업시험·논문 없음**(19학번~), 오믹스·바이오헬스케어 7개 모듈형 트랙',
        '바이오메디컬학과: 전필 오디세이세미나3, **졸업시험·논문 없음**, 엘리트 생명과학자 / 현장실무 전문가 2트랙',
        '식품영양학과: 전필 오디세이세미나3 + **졸업시험**(또는 **TOEIC 700+ / 식품·영양사 자격증 / 대학원·외국인 논문** 택 1, 복수전공 33학점 이수 시 합격)'
      ],
      sourceHints: [
        { file: 'information/한림대학교_2027학과소개서_단면(최종).pdf', kws: ['의생명과학대학', '생명과학과'] },
        { file: 'information/26년 한림대학교_의생명과학대학_식품영양학과_리플릿_단면.pdf', kws: ['졸업기준', 'TOEIC'] },
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['생명과학과', '졸업기준'] }
      ]
    },
    '정보과학대학': {
      aliases: ['정보과학대학', '정보과학대', '소융대'],
      depts: ['소프트웨어학부', '데이터사이언스학부', '인공지능융합학부', '인공지능컴퓨팅학부'],
      summaryKo: '**정보과학대학**은 공통 **총 130학점 이상**(단일 60 · 복수 33 · 교양 최소 26)이 기본이며 학부별 캡스톤·자율역량 요건이 달라요.',
      bulletsKo: [
        '소프트웨어학부(빅데이터·콘텐츠IT·스마트IoT): **소프트웨어캡스톤디자인(3)**(취업연계SW실무 대체) + 전공인정 1과목(총 6학점) + 오디세이3',
        '데이터사이언스학부: 오디세이3 + **비교과 자율역량 5개 중 택 1**(공모전·프로젝트보고서·현장실습12cr·자격증2개·TOEIC 700+)',
        '인공지능융합학부: 오디세이3 + **인공지능융합캡스톤디자인Ⅰ(729001)** (24학번~ 필수) / 신설 **인공지능컴퓨팅학부(27학번~)**: 전공 33cr+ · **전공트랙 1개+** · 캡스톤 필수'
      ],
      sourceHints: [
        { file: 'information/학과별_졸업기준/졸업기준_소프트웨어학부.pdf', kws: ['소프트웨어캡스톤디자인'] },
        { file: 'information/26년 한림대학교_정보과학대학_인공지능컴퓨팅학부_리플릿_단면.pdf', kws: ['졸업요건', '전공트랙'] },
        { file: 'information/학과별_졸업기준/졸업기준_데이터사이언스학부.txt', kws: ['비교과'] }
      ]
    },
    '자연과학대학': {
      aliases: ['자연과학대학', '자연과학대', '자연대'],
      depts: ['화학과', '환경생명공학과', '언어병리학전공', '청각학전공', '체육학과', '자연과학대학 자율전공'],
      summaryKo: '**자연과학대학**(화학과·환경생명공학과·언어청각학부·체육학과·자율전공)은 공통 **총 130학점 이상**(교양 최소 26)과 **오디세이세미나3(1학점)**이 기본이며 학과별 추가 요건이 달라요.',
      bulletsKo: [
        '화학과: 전필 오디세이3만, **졸업논문·시험 없음** / 환경생명공학과: 캡스톤 논문·기사1차·TOEIC 750+·공모전 중 택 1(복수 면제)',
        '언어청각학부: 언어병리학(**졸업시험**, 언어재활사 2급 면제) / 청각학(**졸업시험**, 청능사·TOEIC 700+ 대체)',
        '체육학과: 24학번~ 실기 전필 5과목(축구·수영·골프·테니스·태권도) + 실기 6(자격증)/8(나노디그리)/12(미취득)학점'
      ],
      sourceHints: [
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['화학과', '졸업기준'] },
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['환경생명공학과', '기타 졸업기준'] },
        { file: 'information/학과별_졸업기준/졸업기준_체육학과.txt', kws: ['전공축구'] }
      ]
    },
    '사회과학대학': {
      aliases: ['사회과학대학', '사회과학대', '사회대'],
      depts: ['심리학과', '사회학과', '사회복지학부', '정치행정학과', '광고홍보학과', '법학과', '경제학과'],
      summaryKo: '**사회과학대학**은 공통 **총 130학점 이상**(단일 60 · 복수 33 · 교양 26)과 **오디세이세미나3(1학점)**이 기본이며 학과별 전필·졸업시험/논문 기준이 달라요.',
      bulletsKo: [
        '광고홍보학과: `광고홍보조사방법론` 전필(IAA 11과목 시 디플로마) / 경제학과: `미시·거시경제학Ⅰ` 전필(모두 B0+ 시 졸업시험 면제)',
        '심리학과: `심리통계` 등 전필 + 졸업시험 4과목 / 사회복지학부: 사회복지사 1급 기준 + 졸업시험(노인복지 면제)',
        '사회학과: 졸업논문(사조사2급·포트폴리오·공모전·TOEIC 750+ 대체) / 법학과(25.2~)·정치행정학과: 별도 논문·시험 폐지'
      ],
      sourceHints: [
        { file: 'data/graduation_rules.json', kws: ['광고홍보학과'] },
        { file: 'data/graduation_rules.json', kws: ['경제학과'] },
        { file: 'data/graduation_rules.json', kws: ['법학과'] }
      ]
    },
    '경영대학': {
      aliases: ['경영대학', '경영대'],
      depts: ['경영학과', '금융재무학과'],
      summaryKo: '**경영대학**(경영학과 · 금융재무학과)은 공통 **총 130학점 이상**(단일 60 · 복수 33 · 교양 최소 26)과 **오디세이세미나3(1학점)**, 그리고 **졸업시험**(과목 성적/어학 면제)이 적용돼요.',
      bulletsKo: [
        '경영학과: 9개 분야 중 4개 선택(각 분야 과목 B0+ 시 면제, 캡스톤디자인 추가 1분야 면제) · 공식 6대 진로 트랙',
        '금융재무학과: 대상 11과목 중 3과목 선택(B 이상 면제, **TOEIC 700+ / TOEFL 500+** 전면 면제) · 공식 5대 트랙'
      ],
      sourceHints: [
        { file: 'data/graduation_rules.json', kws: ['경영학과'] },
        { file: 'data/graduation_rules.json', kws: ['금융재무학과'] },
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['금융재무학과', '경영대학'] }
      ]
    },
    '글로벌융합대학': {
      aliases: ['글로벌융합대학', '글로벌융합대', '글로벌학부'],
      depts: ['글로벌비즈니스전공', '융합과학수사학과', '글로컬MICE학과', '한중통번역전공', '문화산업전공'],
      summaryKo: '**글로벌융합대학**(글로벌비즈니스·융합과학수사·글로컬MICE·한중통번역·문화산업)은 **총 130학점 이상**이 기본이며 전공별 어학·캡스톤 요건이 크게 달라요.',
      bulletsKo: [
        '글로벌비즈니스전공: 전공기초 6 + 전필 3(`MICRO/MACRO`, 오디세이3) + **캡스톤 2과목**(26졸업~) + **졸업시험**(B0+/TESAT 170+ 면제) + **TOEIC 850+**',
        '융합과학수사학과: 전필 오디세이3, **졸업논문·시험 없음** / 한중통번역·문화산업: 전필 없음, **TOPIK 4급+** 등 한국어 졸업인증',
        '글로컬MICE학과(신설): 경영학사 수여, 국내외 공모전 1회 이상 필수 참가'
      ],
      sourceHints: [
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['글로벌비즈니스전공', 'TOEIC 850'] },
        { file: 'information/[한림대학교] 2026학년도 대학안내책자.pdf', kws: ['융합과학수사학과', '졸업기준'] },
        { file: 'information/26년 한림대학교_글로벌융합대학_글로컬MICE학과_리플릿_단면.pdf', kws: ['글로컬MICE'] }
      ]
    }
  };

  function detectMentionedCollege(query) {
    const qLower = String(query || '').toLowerCase();
    const qNorm = normStr(query);
    const keys = Object.keys(COLLEGE_DEFINITIONS);
    for (let i = 0; i < keys.length; i++) {
      const col = keys[i];
      const aliases = COLLEGE_DEFINITIONS[col].aliases;
      for (let j = 0; j < aliases.length; j++) {
        const a = aliases[j].toLowerCase();
        if (qLower.includes(a) || qNorm.includes(a.replace(/\s+/g, ''))) {
          return col;
        }
      }
    }
    return null;
  }

  function detectSwSubMajor(query) {
    const qNorm = normStr(query);
    if (qNorm.includes('빅데이터전공') || (qNorm.includes('빅데이터') && !qNorm.includes('데이터사이언스'))) return '빅데이터전공';
    if (qNorm.includes('콘텐츠it')) return '콘텐츠IT전공';
    if (qNorm.includes('스마트iot')) return '스마트IoT전공';
    return null;
  }

  function detectMentionedDept(query) {
    const qLower = String(query || '').toLowerCase();
    const qNorm = normStr(query);
    // Avoid false substring matches when user explicitly names a college (e.g. '의생명과학대학' != '생명과학과', '경영대학' != '경영학과')
    const strippedForDept = qNorm
      .replace(/의생명과학대학|의생명과학대/g, '')
      .replace(/자연과학대학|자연과학대/g, '')
      .replace(/사회과학대학|사회과학대/g, '')
      .replace(/정보과학대학|정보과학대/g, '')
      .replace(/글로벌융합대학|글로벌융합대/g, '')
      .replace(/인문대학|인문대/g, '')
      .replace(/경영대학|경영대/g, '');
    for (let i = 0; i < DEPT_ALIASES.length; i++) {
      const [canon, aliases] = DEPT_ALIASES[i];
      for (let j = 0; j < aliases.length; j++) {
        const a = aliases[j].toLowerCase();
        const aNorm = a.replace(/\s+/g, '');
        if (aNorm === '경영대학' || aNorm === '소융대') continue;
        if (strippedForDept.includes(aNorm) || (!qNorm.includes('대학') && qLower.includes(a))) {
          return canon;
        }
      }
    }
    return null;
  }

  function detectMentionedAdmissionYear(query) {
    const m4 = String(query || '').match(/\b(201\d|202\d)\s*(?:학번|학년도|cohort|class|год|级)?/i);
    if (m4) return parseInt(m4[1], 10);
    const m2 = String(query || '').match(/(?:^|[^\d])(1[6-9]|2[0-6])\s*(?:학번|级)/);
    if (m2) return 2000 + parseInt(m2[1], 10);
    return null;
  }

  function detectMentionedStudentType(query) {
    const q = String(query || '');
    if (/외국인|유학생|한국어트랙|토픽|topik|foreign|international student|иностран|留学生/i.test(q)) {
      return '외국인 유학생';
    }
    if (/편입생|편입학|편입|transfer student|переводн|插班生|转学生/i.test(q)) {
      return '편입생';
    }
    return null;
  }

  function localizeStudentType(studentType, lang) {
    if (lang === 'ko') return studentType;
    if (studentType === '외국인 유학생') {
      return lang === 'en' ? 'International Student' : (lang === 'ru' ? 'Иностранный студент' : '外国留学生');
    }
    if (studentType === '편입생') {
      return lang === 'en' ? 'Transfer Student' : (lang === 'ru' ? 'Переводной студент' : '插班生');
    }
    return lang === 'en' ? 'Regular Student' : (lang === 'ru' ? 'Обычный студент' : '在校生');
  }

  function createEngine(config) {
    const cfg = config || {};
    let ragIndex = cfg.ragIndex || null;
    let graduationRules = cfg.graduationRules || null;
    let gyoyangRules = cfg.gyoyangRules || null;
    let coursesList = cfg.courses || null;

    if (!ragIndex) {
      if (typeof window !== 'undefined' && window.HALLYM_RAG_INDEX) ragIndex = window.HALLYM_RAG_INDEX;
      else if (typeof globalThis !== 'undefined' && globalThis.HALLYM_RAG_INDEX) ragIndex = globalThis.HALLYM_RAG_INDEX;
      else if (typeof require !== 'undefined') { try { ragIndex = require('../data/rag_index.js'); } catch (e) {} }
    }
    if (!graduationRules) {
      if (typeof window !== 'undefined' && (window.HALLYM_GRADUATION_RULES || window.GRADUATION_RULES)) graduationRules = window.HALLYM_GRADUATION_RULES || window.GRADUATION_RULES;
      else if (typeof require !== 'undefined') { try { graduationRules = require('../data/graduation_rules.json'); } catch (e) {} }
    }
    if (!gyoyangRules) {
      if (typeof window !== 'undefined' && (window.HALLYM_GYOYANG_RULES || window.GYOYANG_RULES)) gyoyangRules = window.HALLYM_GYOYANG_RULES || window.GYOYANG_RULES;
      else if (typeof require !== 'undefined') { try { gyoyangRules = require('../data/gyoyang_rules.json'); } catch (e) {} }
    }
    if (!coursesList) {
      if (typeof window !== 'undefined' && window.COURSE_DB) coursesList = window.COURSE_DB;
      else if (typeof require !== 'undefined') {
        try {
          const rawC = require('../data/courses.json');
          coursesList = Array.isArray(rawC) ? rawC : (rawC.courses || []);
        } catch (e) {}
      }
    }

    const chunks = (ragIndex && Array.isArray(ragIndex.chunks)) ? ragIndex.chunks : [];
    const excludedOcrPdfs = (ragIndex && ragIndex.meta && Array.isArray(ragIndex.meta.excluded_ocr_pdfs))
      ? ragIndex.meta.excluded_ocr_pdfs
      : [];
    const courses = Array.isArray(coursesList) ? coursesList : [];

    // BM25 inverted index
    let bm25Ready = false;
    let postings = null;
    let docLengths = null;
    let avgDocLen = 1;

    function ensureBm25Index() {
      if (bm25Ready) return;
      postings = new Map();
      const N = chunks.length;
      docLengths = new Float32Array(N);
      let totalLen = 0;

      for (let i = 0; i < N; i++) {
        const c = chunks[i];
        const fullText = `${c.dept || ''} ${(c.topics || []).join(' ')} ${c.text || ''}`;
        const tok = tokenize(fullText);
        const tfMap = new Map();
        for (let j = 0; j < tok.all.length; j++) {
          const t = tok.all[j].term;
          tfMap.set(t, (tfMap.get(t) || 0) + 1);
        }
        docLengths[i] = tok.all.length || 1;
        totalLen += docLengths[i];

        tfMap.forEach((tf, term) => {
          let list = postings.get(term);
          if (!list) { list = []; postings.set(term, list); }
          list.push([i, tf]);
        });
      }
      avgDocLen = N > 0 ? totalLen / N : 1;
      bm25Ready = true;
    }

    let courseIndexReady = false;
    let coursesByCode = null;
    function ensureCourseIndex() {
      if (courseIndexReady) return;
      coursesByCode = new Map();
      for (let i = 0; i < courses.length; i++) {
        const c = courses[i];
        if (c.code) coursesByCode.set(String(c.code).trim().toLowerCase(), c);
      }
      courseIndexReady = true;
    }

    const MAX_CACHE_SIZE = 100;
    const cache = new Map();
    const cacheStats = { hits: 0, misses: 0 };

    function clearCache() {
      cache.clear();
      cacheStats.hits = 0;
      cacheStats.misses = 0;
    }

    function getCacheStats() {
      return { size: cache.size, maxSize: MAX_CACHE_SIZE, hits: cacheStats.hits, misses: cacheStats.misses };
    }

    function search(query, options) {
      ensureBm25Index();
      const opts = options || {};
      const topK = opts.topK || 5;
      const targetDept = opts.dept || null;
      const targetStudentType = opts.studentType || null;
      const preferTopics = opts.topics || [];
      const N = chunks.length;
      if (N === 0) return [];

      const qTok = tokenize(query);
      if (qTok.words.length === 0 && qTok.bigrams.length === 0) return [];

      const qTerms = new Map();
      for (let i = 0; i < qTok.all.length; i++) {
        const item = qTok.all[i];
        if (!qTerms.has(item.term)) qTerms.set(item.term, item.weight);
      }

      const k1 = 1.5;
      const b = 0.75;
      const scores = new Map();
      const wordHits = new Map();

      qTerms.forEach((weight, term) => {
        const list = postings.get(term);
        if (!list) return;
        const df = list.length;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        const isWord = !term.startsWith('bg:');

        for (let i = 0; i < list.length; i++) {
          const docIdx = list[i][0];
          const tf = list[i][1];
          const dl = docLengths[docIdx];
          const num = tf * (k1 + 1);
          const den = tf + k1 * (1 - b + b * (dl / avgDocLen));
          scores.set(docIdx, (scores.get(docIdx) || 0) + idf * (num / den) * weight);
          if (isWord) wordHits.set(docIdx, (wordHits.get(docIdx) || 0) + 1);
        }
      });

      const results = [];
      const uniqueQueryWords = Array.from(new Set(qTok.words));

      scores.forEach((rawScore, docIdx) => {
        const chunk = chunks[docIdx];
        let score = rawScore;

        if (chunk.priority === 3) score *= 1.28;
        else if (chunk.priority === 2) score *= 1.06;
        else score *= 0.90;

        if (targetDept && targetDept !== '공통') {
          if (chunk.dept === targetDept) score *= 1.48;
          else if (chunk.dept && chunk.dept !== '공통') score *= 0.62;
        }

        if (targetStudentType === '외국인 유학생') {
          if ((chunk.student_types || []).includes('외국인 유학생') || (chunk.topics || []).includes('외국인')) score *= 1.42;
        } else if (targetStudentType === '편입생') {
          if ((chunk.student_types || []).includes('편입생') || (chunk.topics || []).includes('편입생')) score *= 1.42;
        }

        if (preferTopics.length > 0 && Array.isArray(chunk.topics)) {
          for (let t = 0; t < preferTopics.length; t++) {
            if (chunk.topics.includes(preferTopics[t])) { score *= 1.15; break; }
          }
        }

        const matchedWords = wordHits.get(docIdx) || 0;
        let substringHits = 0;
        const lowerText = chunk.text.toLowerCase();
        for (let w = 0; w < uniqueQueryWords.length; w++) {
          if (lowerText.includes(uniqueQueryWords[w])) substringHits++;
        }

        results.push({
          chunk,
          score,
          rawScore,
          matchedWords: Math.max(matchedWords, substringHits),
          coverage: uniqueQueryWords.length > 0 ? Math.max(matchedWords, substringHits) / uniqueQueryWords.length : 0
        });
      });

      results.sort((a, b) => b.score - a.score);

      const picked = [];
      const seenLoc = new Set();
      for (let i = 0; i < results.length && picked.length < topK; i++) {
        const key = `${results[i].chunk.source}::${results[i].chunk.loc}`;
        if (seenLoc.has(key)) continue;
        seenLoc.add(key);
        picked.push(results[i]);
      }
      return picked;
    }

    function evaluateUserProgress(user, userCourses, basketCourses) {
      const u = user || {};
      const major = u.major || '경영학과';
      const admYear = parseInt(
        u.admissionYear || (u.studentId ? String(u.studentId).slice(0, 4) : 2025),
        10
      ) || 2025;
      const studentType = u.studentType || '재학생';
      const isDoubleMajor = !!(u.hasDoubleMajor && u.doubleMajorName);
      const isForeigner = studentType === '외국인 유학생';
      const isTransfer = studentType === '편입생';
      const track = u.track || 'none';

      const deptRule = (graduationRules && graduationRules[major])
        ? graduationRules[major]
        : (graduationRules && graduationRules['경영학과']) || {
            total_credits: 130,
            major_credits: { single: 60, double: 33, minor: 21 },
            ge_credits: 26,
            mandatory_courses: { since_2021: [], before_2021: [] }
          };

      const geRule = gyoyangRules
        ? (admYear >= 2023 ? gyoyangRules.since_2023 : gyoyangRules.before_2023)
        : null;

      const reqTotal = deptRule.total_credits || 130;
      const reqMajor = deptRule.major_credits
        ? (isDoubleMajor ? deptRule.major_credits.double : deptRule.major_credits.single)
        : (isDoubleMajor ? 33 : 60);
      const reqGE = isTransfer ? 0 : (deptRule.ge_credits || (geRule ? geRule.total_credits : 26));
      const reqGen = Math.max(0, reqTotal - reqMajor - reqGE);

      const rawList = Array.isArray(userCourses) ? userCourses : [];
      const rawBasket = Array.isArray(basketCourses) ? basketCourses : [];

      const byKey = new Map();
      const failedCourses = [];
      for (let i = 0; i < rawList.length; i++) {
        const c = rawList[i];
        if (!c || !c.title) continue;
        const gUpper = String(c.grade || '').trim().toUpperCase();
        if (NON_PASSING_GRADES.has(gUpper)) failedCourses.push(c);
        const key = c.code ? `code:${normStr(c.code)}` : `title:${normStr(c.title)}`;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, c);
        } else {
          const prevPass = isPassingGrade(prev.grade);
          const currPass = isPassingGrade(c.grade);
          if (currPass && !prevPass) byKey.set(key, c);
          else if (currPass && prevPass) {
            if ((getGradePoint(c.grade) || 0) >= (getGradePoint(prev.grade) || 0)) byKey.set(key, c);
          } else if (!prevPass && isInProgressGrade(c.grade)) {
            byKey.set(key, c);
          }
        }
      }

      const deduped = Array.from(byKey.values());
      const deptPrefix = major.replace(/학부|학과|전공|스쿨/g, '');
      const isMajorCourse = (c) => {
        const cat = String(c.cat || '');
        if (cat.includes('전공') || cat.includes('전선') || cat.includes('전필')) return true;
        if (deptPrefix && (cat.includes(deptPrefix) || (c.dept && c.dept.includes(deptPrefix)))) {
          if (!cat.includes('교양') && cat !== '일반선택') return true;
        }
        return false;
      };
      const isGenCourse = (c) => String(c.cat || '') === '일반선택';

      let confTotal = 0, currTotal = 0;
      let confMajor = 0, currMajor = 0;
      let confGE = 0, currGE = 0;
      let confGen = 0, currGen = 0;
      let gpaSum = 0, gpaCredits = 0;

      const inProgressCourses = [];
      const lowGradeCourses = [];
      const passedNormTitles = new Set();
      const takenNormTitles = new Set();

      const geAreas = {
        정보소통: 0, 생애설계: 0, 의사소통: 0, 글로벌소통: 0, 스포츠웰니스: 0, 자율선택: 0
      };
      let hasOdyssey1 = false, hasOdyssey2 = false, hasCareerEnglish = false, hasKorean3 = false;

      for (let i = 0; i < deduped.length; i++) {
        const c = deduped[i];
        const cr = Number(c.credits) || 0;
        const gUpper = String(c.grade || '').trim().toUpperCase();
        const passed = isPassingGrade(c.grade);
        const inProg = isInProgressGrade(c.grade);
        const nt = normStr(c.title);

        if (NON_PASSING_GRADES.has(gUpper)) {
          lowGradeCourses.push({ title: c.title, grade: c.grade, credits: cr, semester: c.semester || '', severity: 1 });
        } else if (LOW_PASS_GRADES.has(gUpper)) {
          lowGradeCourses.push({ title: c.title, grade: c.grade, credits: cr, semester: c.semester || '', severity: gUpper.startsWith('D') ? 2 : 3 });
        }

        if (passed) {
          passedNormTitles.add(nt);
          takenNormTitles.add(nt);
          const gp = getGradePoint(c.grade);
          if (gp !== null) { gpaSum += gp * cr; gpaCredits += cr; }
        } else if (inProg) {
          takenNormTitles.add(nt);
          inProgressCourses.push(c);
        }

        if (!passed && !inProg) continue;

        if (passed) confTotal += cr; else currTotal += cr;

        if (isMajorCourse(c)) {
          if (passed) confMajor += cr; else currMajor += cr;
        } else if (isGenCourse(c)) {
          if (passed) confGen += cr; else currGen += cr;
        } else {
          if (passed) confGE += cr; else currGE += cr;
          const cat = String(c.cat || '');
          if (cat === '교양_정보소통' || nt.includes('컴퓨팅사고') || nt.includes('창의코딩') || nt.includes('ai프로젝트입문')) {
            geAreas.정보소통 += cr;
          } else if (cat === '교양_생애설계' || nt.includes('오디세이세미나1') || nt.includes('오디세이세미나2')) {
            geAreas.생애설계 += cr;
            if (nt.includes('오디세이세미나1')) hasOdyssey1 = true;
            if (nt.includes('오디세이세미나2')) hasOdyssey2 = true;
          } else if (cat === '교양_의사소통' || nt.includes('사고와표현') || nt.includes('글쓰기')) {
            if (isForeigner && (nt.includes('외국인') || nt.includes('한국어'))) geAreas.글로벌소통 += cr;
            else geAreas.의사소통 += cr;
          } else if (cat === '교양_글로벌소통' || nt.includes('english') || nt.includes('대학영어') || nt.includes('대학한국어')) {
            geAreas.글로벌소통 += cr;
            if (nt.includes('careerenglish')) hasCareerEnglish = true;
            if (nt.includes('대학한국어3')) hasKorean3 = true;
          } else if (cat === '교양_스포츠웰니스' || nt.includes('스포츠') || nt.includes('체육') || nt.includes('요가') || nt.includes('골프') || nt.includes('수영')) {
            geAreas.스포츠웰니스 += cr;
          } else {
            geAreas.자율선택 += cr;
          }
        }
      }

      lowGradeCourses.sort((a, b) => a.severity - b.severity);

      const expTotal = confTotal + currTotal;
      const expMajor = confMajor + currMajor;
      const expGE = confGE + currGE;
      const expGen = confGen + currGen;

      let basketValidCredits = 0, basketRawCredits = 0;
      const basketTitles = [];
      const basketDuplicateTitles = [];
      const basketNormTitles = new Set();
      for (let i = 0; i < rawBasket.length; i++) {
        const b = rawBasket[i];
        if (!b || !b.title) continue;
        const cr = Number(b.credits) || 0;
        const nt = normStr(b.title);
        basketRawCredits += cr;
        basketTitles.push(b.title);
        basketNormTitles.add(nt);
        if (b.isDuplicate || passedNormTitles.has(nt)) basketDuplicateTitles.push(b.title);
        else basketValidCredits += cr;
      }

      const remainTotal = Math.max(0, reqTotal - expTotal);
      const remainMajor = Math.max(0, reqMajor - expMajor);
      const remainGE = Math.max(0, reqGE - expGE);
      const remainGen = Math.max(0, reqGen - expGen);
      const remainAfterBasket = Math.max(0, reqTotal - (expTotal + basketValidCredits));

      const mandRules = (deptRule.mandatory_courses)
        ? (admYear >= 2021 ? (deptRule.mandatory_courses.since_2021 || []) : (deptRule.mandatory_courses.before_2021 || []))
        : [];
      const missingMajorCourses = [];
      const missingMajorDetails = [];
      for (let i = 0; i < mandRules.length; i++) {
        const reqC = mandRules[i];
        const cleanReq = normStr(reqC.title.replace(/\(.*?\)/g, ''));
        const found = deduped.find((c) => {
          if (!isPassingGrade(c.grade) && !isInProgressGrade(c.grade)) return false;
          if (reqC.code && c.code && normStr(reqC.code) === normStr(c.code)) return true;
          const nt = normStr(c.title);
          return nt.includes(cleanReq) || cleanReq.includes(nt);
        });
        if (!found) {
          missingMajorCourses.push(reqC.title);
          missingMajorDetails.push({
            title: reqC.title,
            credits: reqC.credits || 3,
            inBasket: basketNormTitles.has(cleanReq)
          });
        }
      }

      const missingGeItems = [];
      const missingGeStructured = [];
      if (!isTransfer) {
        if (isForeigner) {
          if (!hasKorean3) {
            missingGeItems.push('대학한국어3 필수');
            missingGeStructured.push({ key: 'korean3', need: 3 });
          }
          if (geAreas.글로벌소통 < 12) {
            missingGeItems.push(`글로벌소통 한국어 ${12 - geAreas.글로벌소통}학점`);
            missingGeStructured.push({ key: 'foreign_korean', need: 12 - geAreas.글로벌소통 });
          }
          if (geAreas.생애설계 < 2) {
            missingGeItems.push(`생애설계(오디세이1·2) ${2 - geAreas.생애설계}학점`);
            missingGeStructured.push({ key: 'life', need: 2 - geAreas.생애설계, miss1: !hasOdyssey1, miss2: !hasOdyssey2 });
          }
          if (geAreas.스포츠웰니스 < 1) {
            missingGeItems.push('스포츠웰니스 1학점');
            missingGeStructured.push({ key: 'sport', need: 1 });
          }
        } else {
          const reqGlobal = admYear >= 2023 ? 9 : 6;
          if (geAreas.정보소통 < 5) {
            missingGeItems.push(`정보소통 ${5 - geAreas.정보소통}학점`);
            missingGeStructured.push({ key: 'info', need: 5 - geAreas.정보소통 });
          }
          if (geAreas.생애설계 < 2) {
            missingGeItems.push(`생애설계(오디세이1·2) ${2 - geAreas.생애설계}학점`);
            missingGeStructured.push({ key: 'life', need: 2 - geAreas.생애설계, miss1: !hasOdyssey1, miss2: !hasOdyssey2 });
          }
          if (geAreas.의사소통 < 3) {
            missingGeItems.push(`의사소통 ${3 - geAreas.의사소통}학점`);
            missingGeStructured.push({ key: 'comm', need: 3 - geAreas.의사소통 });
          }
          if (geAreas.글로벌소통 < reqGlobal) {
            missingGeItems.push(`글로벌소통 ${reqGlobal - geAreas.글로벌소통}학점`);
            missingGeStructured.push({ key: 'global', need: reqGlobal - geAreas.글로벌소통, careerEng: admYear >= 2023 && !hasCareerEnglish });
          } else if (admYear >= 2023 && !hasCareerEnglish) {
            missingGeItems.push('Career English 3학점');
            missingGeStructured.push({ key: 'career_english', need: 3 });
          }
          if (geAreas.스포츠웰니스 < 1) {
            missingGeItems.push('스포츠웰니스 1학점');
            missingGeStructured.push({ key: 'sport', need: 1 });
          }
        }
      }

      // Next track recommended courses not yet taken/basketed
      let nextTrackCourses = [];
      let trackTitle = '';
      if (major === '경영학과' && track && track !== 'none') {
        const tObj = DEFAULT_BIZ_TRACKS.find((t) => t.id === track || track.includes(t.id));
        if (tObj) {
          trackTitle = tObj.title;
          nextTrackCourses = [...tObj.foundation, ...tObj.advanced]
            .filter((title) => !takenNormTitles.has(normStr(title)) && !basketNormTitles.has(normStr(title)))
            .slice(0, 2);
        }
      }

      return {
        major, admissionYear: admYear, studentType, isDoubleMajor, track, trackTitle, nextTrackCourses,
        hasCourses: rawList.length > 0, courseCount: deduped.length, inProgressCourses,
        failedCount: failedCourses.length, failedTitles: failedCourses.map((c) => c.title), lowGradeCourses,
        gpa: gpaCredits > 0 ? Number((gpaSum / gpaCredits).toFixed(2)) : null,
        reqTotal, confTotal, currTotal, expTotal, remainTotal,
        reqMajor, confMajor, currMajor, expMajor, remainMajor,
        reqGE, confGE, currGE, expGE, remainGE,
        reqGen, confGen, currGen, expGen, remainGen,
        basketCount: rawBasket.length, basketRawCredits, basketValidCredits,
        basketTitles, basketDuplicateTitles, basketOverLimit: basketRawCredits > 18,
        remainAfterBasket, estimatedSemesters: remainTotal > 0 ? Math.ceil(remainTotal / 18) : 0,
        geAreas, missingGeItems, missingGeStructured, missingMajorCourses, missingMajorDetails,
        passedNormTitles, takenNormTitles, basketNormTitles
      };
    }

    function formatUrgentItems(progress, lang) {
      const items = [];
      // 1. Missing mandatory major courses
      progress.missingMajorDetails.slice(0, 2).forEach((m) => {
        if (lang === 'en') {
          items.push(`[Mandatory Major] **${m.title}** (${m.credits} cr)${m.inBasket ? ' — already in basket ✓' : ''}`);
        } else if (lang === 'ru') {
          items.push(`[Обязательный по спец.] **${m.title}** (${m.credits} кр.)${m.inBasket ? ' — уже в корзине ✓' : ''}`);
        } else if (lang === 'zh') {
          items.push(`[专业必修] **${m.title}** (${m.credits}学分)${m.inBasket ? ' — 已在选课篮 ✓' : ''}`);
        } else {
          items.push(`[전공필수] **${m.title}** (${m.credits}학점)${m.inBasket ? ' — 바구니에 담김 ✓' : ''}`);
        }
      });

      // 2. Top 2 missing GE items
      progress.missingGeStructured.slice(0, 2).forEach((g) => {
        if (g.key === 'korean3') {
          items.push(
            lang === 'en' ? '[Foreigner Mandatory] **대학한국어3** (3 cr)' :
            lang === 'ru' ? '[Обязательно для иностранцев] **대학한국어3** (3 кр.)' :
            lang === 'zh' ? '[留学生必修] **대학한국어3** (3学分)' :
            '[외국인 필수] **대학한국어3** (3학점)'
          );
        } else if (g.key === 'foreign_korean') {
          items.push(
            lang === 'en' ? `[Foreigner Korean GE] **${g.need} cr** needed (12 cr total)` :
            lang === 'ru' ? `[Корейский для иностранцев] нужно ещё **${g.need} кр.** (из 12)` :
            lang === 'zh' ? `[留学生韩语] 还需 **${g.need}学分** (共12学分)` :
            `[외국인 한국어] 글로벌소통 **${g.need}학점** 부족`
          );
        } else if (g.key === 'info') {
          items.push(
            lang === 'en' ? `[Mandatory GE] **Information & Coding (정보소통)** — ${g.need} cr left (컴퓨팅사고 + 창의코딩)` :
            lang === 'ru' ? `[Обязат. общ.] **Информатика/кодинг (정보소통)** — осталось ${g.need} кр.` :
            lang === 'zh' ? `[教养必修] **信息沟通 (정보소통)** 还差 ${g.need}学分` :
            `[교양필수] **정보소통** ${g.need}학점 부족 (컴퓨팅사고·창의코딩)`
          );
        } else if (g.key === 'life') {
          const od = [g.miss1 ? '오디세이세미나1' : '', g.miss2 ? '오디세이세미나2' : ''].filter(Boolean).join('·') || '오디세이세미나1·2';
          items.push(
            lang === 'en' ? `[Mandatory GE] **${od}** (${g.need} cr left)` :
            lang === 'ru' ? `[Обязат. общ.] **${od}** (осталось ${g.need} кр.)` :
            lang === 'zh' ? `[教养必修] **${od}** (还差 ${g.need}学分)` :
            `[교양필수] **${od}** (${g.need}학점 부족)`
          );
        } else if (g.key === 'comm') {
          items.push(
            lang === 'en' ? '[Selective GE] **Communication (의사소통)** — 1 course (3 cr)' :
            lang === 'ru' ? '[Общ. по выбору] **Коммуникация (의사소통)** — 1 предмет (3 кр.)' :
            lang === 'zh' ? '[教养选必] **沟通写作 (의사소통)** 1门 (3学分)' :
            '[교양선택필수] **의사소통** 1과목 (사고와표현/글쓰기, 3학점)'
          );
        } else if (g.key === 'global' || g.key === 'career_english') {
          items.push(
            lang === 'en' ? `[Selective GE] **Global English (글로벌소통)** — ${g.need} cr left${g.careerEng || g.key === 'career_english' ? ' (incl. Career English)' : ''}` :
            lang === 'ru' ? `[Общ. по выбору] **Английский (글로벌소통)** — осталось ${g.need} кр.${g.careerEng || g.key === 'career_english' ? ' (вкл. Career English)' : ''}` :
            lang === 'zh' ? `[教养选必] **全球沟通英语 (글로벌소통)** 还差 ${g.need}学分${g.careerEng || g.key === 'career_english' ? ' (含 Career English)' : ''}` :
            `[교양선택필수] **글로벌소통** ${g.need}학점 부족${g.careerEng || g.key === 'career_english' ? ' (Career English 필수)' : ''}`
          );
        } else if (g.key === 'sport') {
          items.push(
            lang === 'en' ? '[Selective GE] **Sports & Wellness (체육)** — 1 cr' :
            lang === 'ru' ? '[Общ. по выбору] **Спорт (스포츠웰니스)** — 1 кр.' :
            lang === 'zh' ? '[教养选必] **体育 (스포츠웰니스)** 1学分' :
            '[교양선택필수] **스포츠웰니스(체육)** 1학점'
          );
        }
      });

      // 3. Failed F/NP retake
      if (progress.failedCount > 0 && items.length < 4) {
        const fNames = progress.failedTitles.slice(0, 2).join(', ');
        items.push(
          lang === 'en' ? `[Retake] Failed course(s): **${fNames}**` :
          lang === 'ru' ? `[Пересдача] Незачёт (F/NP): **${fNames}**` :
          lang === 'zh' ? `[重修建议] 未通过(F/NP)课程：**${fNames}**` :
          `[성적 보완] F/NP 미취득 **${fNames}** 재이수 검토`
        );
      }

      // 4. Track or major elective
      if (progress.nextTrackCourses.length > 0 && items.length < 4) {
        const tc = progress.nextTrackCourses.join(', ');
        items.push(
          lang === 'en' ? `[${progress.trackTitle}] Recommended: **${tc}**` :
          lang === 'ru' ? `[Трек ${progress.trackTitle}] Рекомендуется: **${tc}**` :
          lang === 'zh' ? `[${progress.trackTitle}方向] 推荐课程：**${tc}**` :
          `[${progress.trackTitle} 권장] **${tc}**`
        );
      } else if (progress.remainMajor > 0 && items.length < 4) {
        items.push(
          lang === 'en' ? `[Major Elective] **${progress.major}** electives (${progress.remainMajor} cr left)` :
          lang === 'ru' ? `[Спец. по выбору] Предметы **${progress.major}** (осталось ${progress.remainMajor} кр.)` :
          lang === 'zh' ? `[专业选修] **${progress.major}** 选修课（还差 ${progress.remainMajor}学分）` :
          `[전공선택] **${progress.major}** 전선 (${progress.remainMajor}학점 부족)`
        );
      }

      // 5. Basket status (always preserve 1 slot when basket has items, keeping max 4 total bullets)
      if (progress.basketCount > 0) {
        const warn = progress.basketOverLimit ? ' ⚠️ >18' : '';
        const basketLine =
          lang === 'en' ? `Basket: ${progress.basketCount} courses (${progress.basketValidCredits} valid cr)${warn}` :
          lang === 'ru' ? `В корзине: ${progress.basketCount} предм. (${progress.basketValidCredits} кр.)${warn}` :
          lang === 'zh' ? `选课篮已加 ${progress.basketCount}门 (${progress.basketValidCredits}学分)${warn}` :
          `수강바구니: ${progress.basketCount}과목(${progress.basketValidCredits}학점 인정)${progress.basketOverLimit ? ' ⚠️ 18학점 초과' : ''}`;
        return [...items.slice(0, 3), basketLine];
      }

      return items.slice(0, 4);
    }

    function buildRemainingSummary(progress, lang) {
      if (!progress.hasCourses && progress.basketCount === 0) {
        if (lang === 'en') return `Target: ${progress.reqTotal} cr (Major ${progress.reqMajor} · GE ${progress.reqGE}). Add courses for live tracking.`;
        if (lang === 'ru') return `Норма: ${progress.reqTotal} кр. (Спец. ${progress.reqMajor} · Общ. ${progress.reqGE}). Добавьте предметы для точного расчёта.`;
        if (lang === 'zh') return `目标：总${progress.reqTotal}学分（专业${progress.reqMajor} · 教养${progress.reqGE}），录入课程后自动计算。`;
        return `기준 총 ${progress.reqTotal}학점 (전공 ${progress.reqMajor} · 교양 ${progress.reqGE}) — 과목 등록 시 자동 계산`;
      }
      if (lang === 'en') {
        const b = progress.basketCount > 0 ? ` · After basket: **${progress.remainAfterBasket} cr**` : '';
        return `**${progress.remainTotal} cr left** (${progress.expTotal}/${progress.reqTotal}) · Major ${progress.remainMajor} left · GE ${progress.remainGE} left${b}`;
      }
      if (lang === 'ru') {
        const b = progress.basketCount > 0 ? ` · С корзиной: **${progress.remainAfterBasket} кр.**` : '';
        return `Осталось **${progress.remainTotal} кр.** (${progress.expTotal}/${progress.reqTotal}) · Спец. ${progress.remainMajor} · Общ. ${progress.remainGE}${b}`;
      }
      if (lang === 'zh') {
        const b = progress.basketCount > 0 ? ` · 含选课篮剩 **${progress.remainAfterBasket}学分**` : '';
        return `共剩 **${progress.remainTotal}学分** (${progress.expTotal}/${progress.reqTotal}) · 专业剩${progress.remainMajor} · 教养剩${progress.remainGE}${b}`;
      }
      const b = progress.basketCount > 0 ? ` · 바구니 반영 시 **${progress.remainAfterBasket}학점**` : '';
      return `총 **잔여 ${progress.remainTotal}학점** (${progress.expTotal}/${progress.reqTotal}) · 전공 ${progress.remainMajor} · ${progress.studentType === '편입생' ? '교양 면제' : `교양 ${progress.remainGE}`}${b}`;
    }

    function buildCitations(searchResults, queryWords, maxCitations) {
      const limit = maxCitations || 3;
      const citations = [];
      const seen = new Set();
      for (let i = 0; i < searchResults.length && citations.length < limit; i++) {
        const c = searchResults[i].chunk;
        const key = `${c.source}::${c.loc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        citations.push({
          id: c.id,
          source: c.source,
          loc: c.loc,
          page: c.page,
          lineStart: c.line_start,
          lineEnd: c.line_end,
          dept: c.dept,
          score: Number((searchResults[i].score || 0).toFixed(2)),
          quote: extractVerbatimQuote(c.text, queryWords, 190)
        });
      }
      return citations;
    }

    function findDirectChunks(sourceSubstr, mustKeywords, limit) {
      const out = [];
      for (let i = 0; i < chunks.length && out.length < (limit || 2); i++) {
        const c = chunks[i];
        if (sourceSubstr && !c.source.includes(sourceSubstr)) continue;
        if (mustKeywords && mustKeywords.length > 0) {
          if (!mustKeywords.every((kw) => c.text.includes(kw))) continue;
        }
        out.push({ chunk: c, score: 10.0, matchedWords: mustKeywords ? mustKeywords.length : 1, coverage: 1 });
      }
      return out;
    }

    function findCourseInQuery(query) {
      ensureCourseIndex();
      const codeMatch = String(query || '').match(/\b(\d{6})\b/);
      if (codeMatch && coursesByCode.has(codeMatch[1])) return [coursesByCode.get(codeMatch[1])];

      const qNorm = normStr(query);
      if (qNorm.length < 3) return [];

      const hits = [];
      for (let i = 0; i < courses.length; i++) {
        const c = courses[i];
        if (!c.title) continue;
        const nt = normStr(c.title);
        const cleanNt = normStr(c.title.replace(/\(.*?\)/g, ''));
        if (nt.length >= 3 && qNorm.includes(nt)) hits.push({ course: c, len: nt.length });
        else if (cleanNt.length >= 3 && qNorm.includes(cleanNt)) hits.push({ course: c, len: cleanNt.length });
      }
      if (hits.length === 0) return [];
      hits.sort((a, b) => b.len - a.len);
      const maxLen = hits[0].len;
      const top = [];
      const seen = new Set();
      for (let i = 0; i < hits.length && top.length < 4; i++) {
        if (hits[i].len < maxLen - 2 && top.length >= 1) break;
        const key = `${hits[i].course.code}::${hits[i].course.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        top.push(hits[i].course);
      }
      return top;
    }

    /**
     * Multilingual intent classifier (ko / en / ru / zh)
     */
    function classifyIntent(query, matchedCourses) {
      const q = String(query || '');
      const qLower = q.toLowerCase();
      const qNorm = normStr(q);

      // 0. Clear external out-of-scope topics (weather, current time, restaurants, news, dating, games, stocks, travel)
      const hasExplicitAcademic =
        matchedCourses.length > 0 ||
        /졸업|학점|교양|전공|전필|전선|수강|성적표|트랙|로드맵|이수구분|재이수|과목|유학생|편입|graduation|credit|transcript|semester|course|кредит|семестр|предмет|транскрипт|выпуск|毕业|学分|选课|成绩单|课程/i.test(q);
      if (!hasExplicitAcademic &&
          /날씨|기온|비\s*오|눈\s*오|미세먼지|지금\s*몇\s*시|현재\s*시간|몇\s*시야|몇\s*시인가|맛집|닭갈비|음식점|카페\s*추천|뉴스|속보|주식|코인|비트코인|연애|소개팅|데이트|남자친구|여자친구|결혼|게임|롤\s*추천|발로란트|배그|영화\s*추천|로켓|화성\s*여행|weather|temperature|forecast|what\s+time\s+is\s+it|current\s+time|restaurant|food\s+recommend|latest\s+news|stock\s+price|bitcoin|dating|girlfriend|boyfriend|video\s+game|play\s+game|good\s+game|погод|который.*час|сколько\s+времен|ресторан|кафе|новост|акции|биткоин|отношени|любов|девушк|парен|игр(а|ы|у|ать)|фильм|天气|气温|几点|时间|美食|餐厅|新闻|股票|比特币|恋爱|约会|游戏|电影/i.test(q) &&
          !/통금|학식|기숙사/.test(q)) {
        return 'OUT_OF_SCOPE';
      }

      // 1. Site usage / how-to intents
      if (/성적표.*(업로드|올리|등록|불러|넣)|pdf.*(업로드|올리)|upload.*(transcript|pdf|grade)|загруз.*(транскрипт|выписк|оценк|pdf)|上传.*(成绩单|pdf)/i.test(q)) {
        return 'SITE_UPLOAD_TRANSCRIPT';
      }
      if (/(과목|수업).*(어떻게\s*추가|추가하는|등록하는|넣는|입력)|how.*add.*course|как\s+добавить\s+(предмет|курс)|怎么(添加|录入)课程/i.test(q)) {
        return 'SITE_ADD_COURSE';
      }
      if (/(수강\s*바구니|장바구니).*(어떻게|사용|쓰는|기능)|how.*(use|add).*basket|как\s+пользоваться\s+корзин|选课篮.*怎么/i.test(q)) {
        return 'SITE_BASKET';
      }
      if (/(졸업\s*요건|졸업\s*진단).*(어디서|어떻게\s*확인|보는\s*법)|where.*check.*grad|где\s+посмотреть.*выпуск|在哪.*看.*毕业/i.test(q)) {
        return 'SITE_GRAD_CHECK';
      }
      if (/이\s*기능은\s*무엇|이\s*사이트.*무엇|사이트\s*사용|사용\s*방법|사용법|도우미.*어떻게|what\s+is\s+this\s+(site|app|feature)|how\s+to\s+use|что\s+это\s+за\s+(сайт|функци)|как\s+пользоваться|这个(网站|功能).*什么|怎么用/i.test(q)) {
        return 'SITE_OVERVIEW';
      }

      // 2. Pure greetings / thanks / general study tips (non-regulation friendly chat)
      if (/^(안녕|안녕하세요|하이|반가워|hello|hi|hey|привет|здравствуй|你好|您好|고마워|감사|thanks|thank you|спасибо|谢谢)[!?.~\s]*$/i.test(q.trim())) {
        return 'GENERAL_CHAT';
      }
      if (/수강신청\s*팁|학점\s*관리\s*팁|공부\s*팁|study\s+tips?|gpa\s+tips?|советы\s+по\s+учеб|学习建议|选课技巧/i.test(q)) {
        return 'GENERAL_TIPS';
      }

      // 3. Portal-only live data (professor, timetable, room, actual opening)
      if (/교수님|담당\s*교수|시간표|강의실|몇\s*교시|요일|개설\s*여부|열리나요|폐강|professor|timetable|schedule|classroom|преподавател|расписани|аудитори|教授|课表|教室/i.test(q) &&
          !/졸업\s*요건|총\s*학점|교양\s*필수|트랙/.test(q)) {
        return 'PORTAL_CHECK_ONLY';
      }

      // 4. Low grades / retake
      if (/성적.*낮|낮은\s*성적|재이수|재수강|F\s*과목|F\s*학점|F\s*받|D\s*학점|low\s+grade|retake|failed\s+course|низк.*оценк|пересда|плох.*оценк|低分|挂科|重修/i.test(q)) {
        return 'LOW_GRADES_CHECK';
      }

      // 5. Next semester / urgent courses / what to take first
      if (/다음\s*학기|뭐부터|무엇을\s*들어야|뭘\s*들어야|뭐\s*들어야|어떤\s*과목.*급|급한\s*과목|급한가요|먼저\s*들어야|우선.*들어야|수강\s*추천|next\s+semester|what\s+should\s+i\s+take|urgent\s+course|следующ.*семестр|что\s+(мне\s+)?(послушать|взять|выбрать)|срочн.*предмет|какие\s+предметы\s+взять|下学期|选什么课|急需.*课|先上什么/i.test(q)) {
        return 'NEXT_SEMESTER_PLAN';
      }

      // 6. Should I take this course?
      if (matchedCourses.length > 0 && /들어야|꼭\s*들어|필수인가|수강해야|들어도|should\s+i\s+take|need\s+to\s+take|нужно\s+ли\s+брать|要上|必修吗/i.test(q)) {
        return 'SHOULD_TAKE_COURSE';
      }

      // 7. Remaining credits / how far from graduation
      if (/얼마나\s*남|남은\s*학점|잔여\s*학점|부족\s*요건|부족한|몇\s*학점\s*남|내\s*성적|내\s*취득|내\s*이수|내\s*졸업|졸업\s*가능|졸업까지|how\s+many\s+credits\s+left|remaining\s+credits|left\s+to\s+graduat|сколько\s+кредитов\s+осталось|до\s+выпуск|оставш.*кредит|还差多少学分|剩余学分|离毕业/i.test(q)) {
        return 'PROGRESS_REMAINING';
      }

      // 8. Tracks / roadmaps
      if (/트랙|로드맵|진로\s*트랙|\btracks?\b|roadmap|трек|дорожн.*карт|方向|路线图/i.test(q)) {
        return 'TRACK_ROADMAP';
      }

      // 9. Specific course category lookup
      if (matchedCourses.length > 0 && /이수구분|무슨\s*영역|어떤\s*영역|교양인지|전공인지|전선|전필|몇\s*학점|학점|category|категор|类别|学分/i.test(q)) {
        return 'COURSE_LOOKUP';
      }

      // 10. Foreigner / Transfer rules
      if (/외국인|유학생|토픽|topik|대학한국어|foreign\s+student|international\s+student|иностран.*студент|для\s+иностранц|留学生/i.test(q)) {
        return 'FOREIGNER_RULES';
      }
      if (/편입생|편입학|편입|transfer\s+student|переводн|插班生|转学生/i.test(q)) {
        return 'TRANSFER_RULES';
      }

      // 11. GE requirements
      if ((/교양|general\s+education|\bge\b|mandatory\s+ge|общ.*предмет|обязательн.*общ|教养/i.test(q)) && !/총\s*학점|총학점|total\s+credits/i.test(q)) {
        return 'GYOYANG_REQ';
      }

      // 12. Major req / Graduation req
      if (/전공\s*필수|전필|전공\s*선택|전선|major\s+req|обязательн.*по\s+спец|专业必修|专业选修/i.test(q)) {
        return 'MAJOR_REQ';
      }
      if (/총\s*학점|총학점|졸업.*학점|졸업\s*요건|졸업\s*기준|졸업\s*조건|졸업사정|graduation\s+req|total\s+credits|credits\s+to\s+graduat|требовани.*выпуск|сколько\s+кредитов\s+нужно|毕业要求|毕业.*学分|总学分/i.test(q)) {
        return 'GRADUATION_REQ';
      }

      if (matchedCourses.length > 0 && qNorm.length <= 28) {
        return 'COURSE_LOOKUP';
      }

      return 'GENERAL_SEARCH';
    }

    function getSiteHelpAnswer(intent, lang, progress) {
      const guides = {
        SITE_ADD_COURSE: {
          ko: {
            headline: '이수한 과목은 **[내 정보]** 탭에서 바로 추가할 수 있어요.',
            steps: [
              '1. 상단 **[내 정보]** 탭으로 이동하세요.',
              '2. **[➕ 과목 직접 추가]** 버튼을 누르세요.',
              '3. 과목명(자동완성 지원), 이수구분, 학점, 학기, 성적을 입력하고 **[저장]**을 누르면 졸업 진단이 즉시 반영돼요.'
            ]
          },
          en: {
            headline: 'You can add completed or current courses in the **[My Info]** tab.',
            steps: [
              '1. Open the **[My Info (내 정보)]** tab.',
              '2. Click **[➕ Add Course (과목 직접 추가)]**.',
              '3. Enter course title (autocomplete supported), category, credits, semester, and grade, then click **Save**.'
            ]
          },
          ru: {
            headline: 'Добавить пройденный предмет можно во вкладке **[Мои данные (내 정보)]**.',
            steps: [
              '1. Перейдите во вкладку **[내 정보]**.',
              '2. Нажмите кнопку **[➕ 과목 직접 추가]**.',
              '3. Введите название (есть автоподсказка), категорию, кредиты, семестр и оценку, затем нажмите **Сохранить**.'
            ]
          },
          zh: {
            headline: '您可以在 **[我的信息 (내 정보)]** 标签页中直接添加课程。',
            steps: [
              '1. 点击顶部 **[내 정보]** 标签页。',
              '2. 点击 **[➕ 과목 직접 추가]** 按钮。',
              '3. 输入课程名（支持自动补全）、修读类别、学分、学期和成绩后点击保存即可实时更新。'
            ]
          }
        },
        SITE_UPLOAD_TRANSCRIPT: {
          ko: {
            headline: '성적표 PDF·이미지·CSV 파일을 올리면 과목이 자동으로 입력돼요.',
            steps: [
              '1. **[내 정보]** 탭에서 **[📄 성적표 PDF 업로드]** 버튼을 누르세요.',
              '2. 한림대 포털에서 받은 성적표 PDF(또는 사진·CSV)를 선택하세요.',
              '3. 자동 인식 결과 표에서 과목·학점·이수구분을 확인/수정한 뒤 **[내 과목으로 일괄 저장]**을 누르세요.'
            ]
          },
          en: {
            headline: 'Upload your transcript PDF, image, or CSV to auto-import all courses.',
            steps: [
              '1. In **[My Info (내 정보)]**, click **[📄 Upload Transcript PDF]**.',
              '2. Select your Hallym Portal transcript PDF (or photo/CSV).',
              '3. Review/edit the parsed table and click **Save All**.'
            ]
          },
          ru: {
            headline: 'Загрузите транскрипт (PDF, фото или CSV), чтобы предметы добавились автоматически.',
            steps: [
              '1. Во вкладке **[내 정보]** нажмите **[📄 성적표 PDF 업로드]**.',
              '2. Выберите файл транскрипта из портала Халлим (PDF, изображение или CSV).',
              '3. Проверьте распознанную таблицу, при необходимости поправьте и нажмите **Сохранить**.'
            ]
          },
          zh: {
            headline: '上传成绩单 PDF、图片或 CSV 文件即可自动识别并导入课程。',
            steps: [
              '1. 在 **[내 정보]** 标签页点击 **[📄 성적표 PDF 업로드]**。',
              '2. 选择从学校门户下载的成绩单 PDF（或图片/CSV）。',
              '3. 在识别结果表中核对或修改后点击批量保存即可。'
            ]
          }
        },
        SITE_BASKET: {
          ko: {
            headline: '**[수강 바구니]** 탭에서 다음 학기 과목을 미리 담아 졸업 시뮬레이션을 할 수 있어요.',
            steps: [
              '1. 상단 **[수강 바구니]** 탭으로 이동하세요.',
              '2. 과목명(한글 초성 검색 지원, 예: `ㄱㅇㅎ`)을 검색해 **[바구니 담기]**를 누르세요.',
              '3. 바구니 학점 합계(18학점 한도 경고)와 졸업 진행률 변화를 실시간으로 확인하세요.'
            ]
          },
          en: {
            headline: 'Use the **[Course Basket]** tab to simulate your next semester before registration.',
            steps: [
              '1. Open the **[Course Basket (수강 바구니)]** tab.',
              '2. Search for courses and click **Add to Basket**.',
              '3. Check the live 18-credit cap warning and updated graduation progress.'
            ]
          },
          ru: {
            headline: 'Во вкладке **[Корзина курсов (수강 바구니)]** можно спланировать следующий семестр.',
            steps: [
              '1. Откройте вкладку **[수강 바구니]**.',
              '2. Найдите нужный предмет через поиск и добавьте в корзину.',
              '3. Сразу проверьте лимит 18 кредитов и обновлённый прогресс до выпуска.'
            ]
          },
          zh: {
            headline: '在 **[选课篮 (수강 바구니)]** 标签页可提前模拟下学期选课。',
            steps: [
              '1. 切换到 **[수강 바구니]** 标签页。',
              '2. 搜索课程（支持韩语首字母）并加入选课篮。',
              '3. 实时查看 18 学分上限提醒和毕业进度变化。'
            ]
          }
        },
        SITE_GRAD_CHECK: {
          ko: {
            headline: '**[졸업 진단]** 탭에서 총 학점, 전공, 교양 6대 영역과 부족 과목을 한눈에 볼 수 있어요.',
            steps: [
              '1. 상단 **[졸업 진단]** 탭을 클릭하세요.',
              '2. 총 학점·전공·교양 달성률과 미이수 필수 과목을 확인하세요.',
              '3. 경영학과 학생은 공식 6대 진로 트랙 이수 현황도 함께 확인할 수 있어요.'
            ]
          },
          en: {
            headline: 'Check total credits, major, 6 GE areas, and missing courses in the **[Graduation Check]** tab.',
            steps: [
              '1. Open the **[Graduation Check (졸업 진단)]** tab.',
              '2. Review your earned/remaining credits and missing mandatory areas.',
              '3. Business students can also track the 6 official career tracks.'
            ]
          },
          ru: {
            headline: 'Проверьте требования к выпуску во вкладке **[Диагностика выпуска (졸업 진단)]**.',
            steps: [
              '1. Откройте вкладку **[졸업 진단]**.',
              '2. Посмотрите прогресс по общим, профильным и базовым (교양) кредитам.',
              '3. Для факультета менеджмента также доступен прогресс по 6 трекам.'
            ]
          },
          zh: {
            headline: '在 **[毕业诊断 (졸업 진단)]** 标签页可一键查看所有毕业条件完成情况。',
            steps: [
              '1. 点击 **[졸업 진단]** 标签页。',
              '2. 查看总学分、专业、6大教养领域及未修必修课。',
              '3. 经营学专业还可查看官方6大职业方向进度。'
            ]
          }
        },
        SITE_OVERVIEW: {
          ko: {
            headline: '이 사이트는 **한림대학교 수강 바구니 + 졸업 시뮬레이터**로, 졸업까지 남은 학점과 다음 학기 수강 계획을 도와줘요.',
            steps: [
              '**[내 정보]**: 성적표 PDF 업로드 또는 과목 직접 등록',
              '**[졸업 진단]**: 총 학점·전공·교양 6대 영역·트랙 부족 요건 자동 분석',
              '**[수강 바구니]**: 다음 학기 과목을 담아 18학점 한도 및 졸업 변화 미리 확인',
              '**[🤖 AI 학사 도우미]**: 공식 자료와 내 이수 현황을 바탕으로 자유 질문 답변'
            ]
          },
          en: {
            headline: 'This is the **Hallym Graduation Simulator & AI Advisor** for tracking credits and planning semesters.',
            steps: [
              '**[My Info]**: Upload transcript PDF/photo or add courses manually',
              '**[Graduation Check]**: Auto-check total, major, 6 GE areas & tracks',
              '**[Course Basket]**: Simulate next semester with 18-credit cap alerts',
              '**[🤖 AI Advisor]**: Ask freely in KO/EN/RU/ZH backed by official Hallym docs'
            ]
          },
          ru: {
            headline: 'Это **Симулятор выпуска Халлим и ИИ-помощник** для контроля кредитов и планирования семестров.',
            steps: [
              '**[내 정보]**: загрузка транскрипта PDF/фото или ручной ввод предметов',
              '**[졸업 진단]**: проверка всех требований к выпуску и недостающих курсов',
              '**[수강 바구니]**: планирование следующего семестра (лимит 18 кредитов)',
              '**[🤖 ИИ-помощник]**: ответы на вопросы на KO/EN/RU/ZH по официальным документам'
            ]
          },
          zh: {
            headline: '这是**翰林大学选课篮与毕业模拟器**，帮您跟踪学分并规划下学期选课。',
            steps: [
              '**[내 정보]**：上传成绩单 PDF/图片或手动添加课程',
              '**[졸업 진단]**：自动诊断总学分、专业、6大教养领域及缺修项',
              '**[수강 바구니]**：模拟下学期选课并提醒 18 学分上限',
              '**[🤖 AI 助手]**：支持中/韩/英/俄提问，基于官方资料精准解答'
            ]
          }
        }
      };

      const g = (guides[intent] || guides.SITE_OVERVIEW)[lang] || guides.SITE_OVERVIEW.ko;
      return {
        sections: {
          headline: g.headline,
          nextActions: g.steps,
          remainingSummary: progress.hasCourses ? buildRemainingSummary(progress, lang) : null,
          disclaimer: null
        },
        sources: [{
          id: 'site_guide',
          source: 'index.html',
          loc: '사용 가이드',
          page: null,
          lineStart: null,
          lineEnd: null,
          dept: '공통',
          score: 10,
          quote: '내 정보(과목 추가·성적표 PDF 업로드) → 졸업 진단(잔여 학점·부족 요건 확인) → 수강 바구니(다음 학기 시뮬레이션) → AI 학사 도우미'
        }]
      };
    }

    function getOcrNoticeForDept(dept, lang) {
      if (!dept || dept === '공통') return null;
      const map = {
        '러시아어학과': '인문_러시아_1천_0717.pdf',
        '영어영문학과': '인문_영어영문_1천_0717.pdf',
        '국어국문학전공': '인문_인문학부_2천_0717.pdf',
        '인문콘텐츠융합전공': '인문_인문학부_2천_0717.pdf',
        '일본어학과': '인문_일본_1천_0717.pdf',
        '중국학과': '인문_중국_1천_0717.pdf'
      };
      const fname = map[dept];
      if (!fname) return null;
      const found = excludedOcrPdfs.find((x) => x.file.includes(fname));
      if (!found) return null;
      if (lang === 'en') return `Note: '${found.file}' is a scanned PDF (OCR not applied), so text official sources were used.`;
      if (lang === 'ru') return `Примечание: '${found.file}' — скан-PDF (без OCR), ответ основан на текстовых официальных файлах.`;
      if (lang === 'zh') return `注：'${found.file}' 为扫描版 PDF（未做 OCR），已参考文字版官方资料。`;
      return `참고: '${found.file}'은(는) ${found.status}이므로 공식 텍스트 자료를 참조했어요.`;
    }

    function composeFlatAnswer(sections, ocrNotice) {
      const parts = [];
      if (sections.headline) parts.push(sections.headline);
      if (sections.nextActions && sections.nextActions.length > 0) {
        parts.push(sections.nextActions.map((a) => `• ${a}`).join('\n'));
      }
      if (sections.remainingSummary) parts.push(sections.remainingSummary);
      if (sections.disclaimer) parts.push(`※ ${sections.disclaimer}`);
      if (ocrNotice) parts.push(`※ ${ocrNotice}`);
      return parts.join('\n\n');
    }

    function ask(query, context, options) {
      const t0 = Date.now();
      const opts = options || {};
      const ctx = context || {};
      const user = ctx.user || {};
      const userCourses = Array.isArray(ctx.courses) ? ctx.courses : [];
      const basketCourses = Array.isArray(ctx.basket) ? ctx.basket : [];

      const trimmedQuery = String(query || '').trim();
      const lang = opts.lang || detectLanguage(trimmedQuery);
      const t = I18N[lang] || I18N.ko;

      if (!trimmedQuery) {
        return {
          answer: t.notFound, sections: null, grounded: false, intent: 'EMPTY', lang,
          labels: t.labels, targetDept: user.major || '경영학과', targetStudentType: user.studentType || '재학생',
          targetAdmissionYear: user.admissionYear || 2025, sources: [], userProgress: null,
          fromCache: false, latencyMs: Date.now() - t0
        };
      }

      const courseSig = userCourses
        .map((c) => `${c.code || c.title}:${c.grade || ''}:${c.credits || 0}:${c.cat || ''}`)
        .sort().join('|');
      const basketSig = basketCourses
        .map((b) => `${b.code || b.title}:${b.credits || 0}:${b.cat || ''}`)
        .sort().join('|');
      const cacheKey = [
        lang, normStr(trimmedQuery), user.major || '경영학과', user.admissionYear || 2025,
        user.studentType || '재학생', user.hasDoubleMajor ? (user.doubleMajorName || 'double') : 'single',
        user.track || 'none', courseSig, basketSig
      ].join('##');

      if (!opts.bypassCache && cache.has(cacheKey)) {
        cacheStats.hits++;
        const cached = cache.get(cacheKey);
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return Object.assign({}, cached, { fromCache: true, latencyMs: Date.now() - t0 });
      }
      cacheStats.misses++;

      const mentionedDept = detectMentionedDept(trimmedQuery);
      const mentionedCollege = mentionedDept ? null : detectMentionedCollege(trimmedQuery);
      const swSubMajor = detectSwSubMajor(trimmedQuery);
      const mentionedYear = detectMentionedAdmissionYear(trimmedQuery);
      const mentionedType = detectMentionedStudentType(trimmedQuery);

      const userMajor = user.major || '경영학과';
      const userYear = parseInt(user.admissionYear || (user.studentId ? String(user.studentId).slice(0, 4) : 2025), 10) || 2025;
      const userType = user.studentType || '재학생';

      const targetDept = mentionedDept || mentionedCollege || userMajor;
      const targetYear = mentionedYear || userYear;
      const targetStudentType = mentionedType || userType;

      const matchedCourses = findCourseInQuery(trimmedQuery);
      const intent = classifyIntent(trimmedQuery, matchedCourses);
      const qTok = tokenize(trimmedQuery);
      const progress = evaluateUserProgress(
        { major: userMajor, admissionYear: userYear, studentType: userType, hasDoubleMajor: user.hasDoubleMajor, doubleMajorName: user.doubleMajorName, track: user.track },
        userCourses,
        basketCourses
      );

      let sections = null;
      let grounded = false;
      let sources = [];
      let ocrNotice = getOcrNoticeForDept(targetDept, lang);
      if (!ocrNotice && mentionedCollege && COLLEGE_DEFINITIONS[mentionedCollege] && COLLEGE_DEFINITIONS[mentionedCollege].hasOcrWarning && excludedOcrPdfs.length > 0) {
        ocrNotice = lang === 'en'
          ? 'Note: 5 Humanities scanned PDFs (OCR not applied) are excluded; 2026 University Guidebook & text rules were used.'
          : (lang === 'ru'
            ? 'Примечание: 5 скан-PDF гуманитарного факультета (без OCR) исключены; использованы справочник 2026 и текстовые правила.'
            : (lang === 'zh'
              ? '注：5份人文学院扫描版 PDF（未做 OCR）未纳入，已依据 2026 大学指南及文字版规定作答。'
              : '참고: 인문대학 스캔 PDF 5개는 이미지 기반 자료(OCR 미적용)이므로 2026학년도 대학안내책자 및 학과별 텍스트 기준을 참조했어요.'));
      }
      const remSummary = buildRemainingSummary(progress, lang);
      const locType = localizeStudentType(targetStudentType, lang);

      // ------------------------------------------------------------------
      // 0. OUT_OF_SCOPE (날씨·현재시간·맛집·뉴스·연애·게임 등 외부 정보 -> 정중한 범위 안내)
      // ------------------------------------------------------------------
      if (intent === 'OUT_OF_SCOPE') {
        const result = {
          answer: t.outOfScope,
          sections: { headline: t.outOfScope, nextActions: [], remainingSummary: null, disclaimer: null },
          grounded: false,
          outOfScope: true,
          intent: 'OUT_OF_SCOPE',
          lang,
          labels: t.labels,
          targetDept,
          targetStudentType,
          targetAdmissionYear: targetYear,
          sources: [],
          userProgress: progress,
          excludedOcrNotice: null,
          fromCache: false,
          latencyMs: Date.now() - t0
        };
        if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, result);
        return result;
      }

      // ------------------------------------------------------------------
      // 0A. SITE USAGE HOW-TO GUIDES
      // ------------------------------------------------------------------
      else if (intent.startsWith('SITE_')) {
        const resHelp = getSiteHelpAnswer(intent, lang, progress);
        sections = resHelp.sections;
        sources = resHelp.sources;
        grounded = true;
      }

      // ------------------------------------------------------------------
      // 0B. FRIENDLY GENERAL CHAT / STUDY TIPS (no fabricated regulation numbers)
      // ------------------------------------------------------------------
      else if (intent === 'GENERAL_CHAT') {
        const isThanks = /고마워|감사|thanks|thank you|спасибо|谢谢/i.test(trimmedQuery);
        const headlines = isThanks ? {
          ko: '도움이 되어 기뻐요! 궁금한 과목이나 졸업 요건이 있으면 언제든 물어보세요.',
          en: 'You’re welcome! Feel free to ask anytime about courses, credits, or graduation plans.',
          ru: 'Пожалуйста! Если будут вопросы по предметам, кредитам или выпуску — спрашивайте в любое время.',
          zh: '不客气！随时可以继续问我关于选课、学分或毕业的问题。'
        } : {
          ko: `안녕하세요! **${progress.major} ${progress.admissionYear}학번** 기준으로 수강 계획, 남은 학점, 졸업 요건, 사이트 사용법을 도와드릴 수 있어요.`,
          en: `Hello! I can help you plan courses, check remaining credits, and navigate graduation rules for **${progress.major} (${progress.admissionYear})**.`,
          ru: `Привет! Я помогу спланировать предметы, проверить оставшиеся кредиты и требования для **${progress.major} (${progress.admissionYear})**.`,
          zh: `你好！我可以按 **${progress.major} (${progress.admissionYear}级)** 帮你规划选课、查询剩余学分和毕业要求。`
        };
        sections = {
          headline: headlines[lang],
          nextActions: [],
          remainingSummary: progress.hasCourses ? remSummary : null,
          disclaimer: null
        };
        sources = [];
        grounded = true;
      } else if (intent === 'GENERAL_TIPS') {
        const tips = {
          ko: {
            headline: '일반적인 수강·학점 관리 팁이에요. (구체적인 학점·졸업 수치는 학과별 공식 기준을 확인하세요.)',
            actions: [
              '전공필수와 교양필수(오디세이·정보소통 등)를 저학년에 먼저 끝내두면 졸업 학기 부담이 줄어들어요.',
              '수강신청 전 [수강 바구니]에 후보 과목을 담아두고 잔여 학점 변화를 미리 점검해 보세요.',
              'F/NP 과목이 생기면 학점에 포함되지 않으므로 재이수 시기를 미리 계획하는 것이 좋아요.'
            ]
          },
          en: {
            headline: 'Here are general course planning tips (check official rules for exact credit numbers).',
            actions: [
              'Finish mandatory GE and major courses early to keep your final year flexible.',
              'Use the Course Basket tab to preview credit progress before registration.',
              'Plan retakes early for any failed (F/NP) courses since they earn 0 credits.'
            ]
          },
          ru: {
            headline: 'Общие советы по планированию учёбы (точные цифры всегда проверяйте по официальным правилам).',
            actions: [
              'Закрывайте обязательные предметы (전필/교필) на младших курсах, чтобы разгрузить выпускной год.',
              'Заранее добавляйте предметы в «Корзину» (수강 바구니), чтобы видеть прогресс до выпуска.',
              'Предметы с оценкой F/NP не дают кредитов — лучше запланировать их пересдачу заранее.'
            ]
          },
          zh: {
            headline: '以下是一些通用的选课与学分管理建议（具体毕业数值请以官方规定为准）：',
            actions: [
              '尽量在低年级先修完专业必修和教养必修，减轻毕业学期压力。',
              '选课前先在「选课篮」里模拟，提前确认剩余学分变化。',
              'F/NP 课程不计入已修学分，建议尽早规划重修。'
            ]
          }
        };
        sections = {
          headline: tips[lang].headline,
          nextActions: tips[lang].actions,
          remainingSummary: progress.hasCourses ? remSummary : null,
          disclaimer: null
        };
        sources = [];
        grounded = true;
      }

      // ------------------------------------------------------------------
      // 0C. PORTAL_CHECK_ONLY (professor / timetable / live opening)
      // ------------------------------------------------------------------
      else if (intent === 'PORTAL_CHECK_ONLY') {
        const msg = `${t.notFound.split('\n')[0]}\n${t.portalDisclaimer}`;
        const result = {
          answer: msg,
          sections: { headline: t.portalDisclaimer, nextActions: [], remainingSummary: null, disclaimer: t.portalDisclaimer },
          grounded: false, intent, lang, labels: t.labels,
          targetDept, targetStudentType, targetAdmissionYear: targetYear,
          sources: [], userProgress: progress, excludedOcrNotice: null, fromCache: false, latencyMs: Date.now() - t0
        };
        if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, result);
        return result;
      }

      // ------------------------------------------------------------------
      // 1. NEXT_SEMESTER_PLAN (다음 학기 수강 추천 / 급한 과목)
      // ------------------------------------------------------------------
      else if (intent === 'NEXT_SEMESTER_PLAN') {
        const nextActions = formatUrgentItems(progress, lang);
        const topNeed = progress.missingMajorCourses.length > 0
          ? progress.missingMajorCourses[0]
          : (progress.missingGeItems.length > 0 ? progress.missingGeItems[0] : (lang === 'ko' ? '잔여 전공·총 학점' : 'remaining credits'));

        let headline = '';
        if (lang === 'en') {
          headline = progress.hasCourses
            ? `Based on your **${progress.major} (${progress.admissionYear}, ${locType})** record, your top priority next semester is **${topNeed}**.`
            : `For **${progress.major} (${progress.admissionYear}, ${locType})**, start with mandatory major & GE requirements first. Add your completed courses for tailored picks.`;
        } else if (lang === 'ru') {
          headline = progress.hasCourses
            ? `Для вашего профиля **${progress.major} (${progress.admissionYear}, ${locType})** в следующем семестре приоритет — **${topNeed}**.`
            : `Для **${progress.major} (${progress.admissionYear}, ${locType})** сначала лучше закрыть обязательные предметы. Добавьте пройденные курсы для точной рекомендации.`;
        } else if (lang === 'zh') {
          headline = progress.hasCourses
            ? `结合您 **${progress.major}（${progress.admissionYear}级，${locType}）** 的当前进度，下学期最优先建议先修 **${topNeed}**。`
            : `按 **${progress.major}（${progress.admissionYear}级，${locType}）** 标准，建议先修必修课；录入已修课程后可获得更精准推荐。`;
        } else {
          headline = progress.hasCourses
            ? `현재 **${progress.major} ${progress.admissionYear}학번(${progress.studentType})** 상황에서는 **${topNeed}**부터 챙기는 게 가장 급해요.`
            : `**${progress.major} ${progress.admissionYear}학번** 기준 우선 이수 과목이에요. 이수 과목을 입력하면 내 상황에 딱 맞게 짚어드릴게요.`;
        }

        sections = {
          headline,
          nextActions,
          remainingSummary: remSummary,
          disclaimer: t.portalDisclaimer
        };

        const direct = [
          ...findDirectChunks('data/graduation_rules.json', [progress.major], 1),
          ...findDirectChunks('information/학번별 교양 졸업 기준.txt', ['정보소통', '생애설계'], 1),
          ...findDirectChunks('information/졸업사정 기준.txt', ['130학점'], 1)
        ];
        sources = buildCitations(direct, ['졸업', '필수', progress.major, ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 2. LOW_GRADES_CHECK (낮은 성적 / 재이수 확인)
      // ------------------------------------------------------------------
      else if (intent === 'LOW_GRADES_CHECK') {
        const nextActions = [];
        let headline = '';

        if (!progress.hasCourses) {
          headline =
            lang === 'en' ? 'No courses registered yet. Add courses or upload your transcript PDF in [My Info] first.' :
            lang === 'ru' ? 'Предметы ещё не добавлены. Сначала загрузите транскрипт или введите курсы во вкладке [내 정보].' :
            lang === 'zh' ? '尚未录入课程。请先在 [내 정보] 上传成绩单或添加课程。' :
            '등록된 과목이 아직 없어요. [내 정보]에서 성적표를 올리거나 과목을 먼저 입력해 주세요.';
        } else if (progress.lowGradeCourses.length === 0) {
          headline =
            lang === 'en' ? `Great news! None of your ${progress.courseCount} courses have F/NP or low (C+/D) grades.${progress.gpa !== null ? ` Current GPA: **${progress.gpa}/4.5**.` : ''}` :
            lang === 'ru' ? `Отличные новости! Среди ${progress.courseCount} предметов нет F/NP или низких оценок (C+/D).${progress.gpa !== null ? ` Текущий GPA: **${progress.gpa}/4.5**.` : ''}` :
            lang === 'zh' ? `目前 ${progress.courseCount} 门课程中没有 F/NP 或低分（C+/D）课程！${progress.gpa !== null ? ` 当前绩点：**${progress.gpa}/4.5**。` : ''}` :
            `현재 ${progress.courseCount}개 과목 중 F/NP나 C+/D 이하의 낮은 성적 과목은 없어요!${progress.gpa !== null ? ` (평점 **${progress.gpa}/4.5**)` : ''}`;
        } else {
          const fList = progress.lowGradeCourses.filter((x) => x.severity === 1);
          const lowPassList = progress.lowGradeCourses.filter((x) => x.severity > 1);
          headline =
            lang === 'en' ? `You have **${progress.lowGradeCourses.length} low-grade course(s)**${fList.length > 0 ? ` (including **${fList.length} failed F/NP**)` : ''}.${progress.gpa !== null ? ` GPA: **${progress.gpa}/4.5**.` : ''}` :
            lang === 'ru' ? `Найдено **${progress.lowGradeCourses.length} предм. с низкой оценкой**${fList.length > 0 ? ` (включая **${fList.length} F/NP**)` : ''}.${progress.gpa !== null ? ` GPA: **${progress.gpa}/4.5**.` : ''}` :
            lang === 'zh' ? `发现 **${progress.lowGradeCourses.length} 门低分课程**${fList.length > 0 ? `（含 **${fList.length} 门 F/NP 未通过**）` : ''}。${progress.gpa !== null ? ` 当前 GPA：**${progress.gpa}/4.5**。` : ''}` :
            `성적 보완이 필요한 과목이 **${progress.lowGradeCourses.length}개** 있어요.${fList.length > 0 ? ` 특히 **F/NP ${fList.length}과목**은 학점이 인정되지 않아요.` : ''}${progress.gpa !== null ? ` (평점 **${progress.gpa}/4.5**)` : ''}`;

          fList.slice(0, 2).forEach((c) => nextActions.push(`**${c.title}** (${c.grade}, ${c.credits}cr) — ${lang === 'ko' ? '미취득 · 재이수 권장' : (lang === 'ru' ? 'незачёт · нужна пересдача' : (lang === 'zh' ? '未通过 · 建议重修' : 'Failed · Retake advised'))}`));
          lowPassList.slice(0, 2).forEach((c) => nextActions.push(`**${c.title}** (${c.grade}, ${c.credits}cr)`));
          nextActions.push(
            lang === 'en' ? 'Retake rule: Previous grade voided, 0 new credits added, max grade capped at A0.' :
            lang === 'ru' ? 'Правило пересдачи: старая оценка аннулируется, новые кредиты не добавляются, максимум A0.' :
            lang === 'zh' ? '重修规定：原成绩作废，不新增毕业学分，最高成绩限 A0。' :
            '재이수 규정: 기존 성적 무효, 신규 학점 0, 성적은 최대 A0로 제한돼요.'
          );
        }

        sections = { headline, nextActions, remainingSummary: remSummary, disclaimer: progress.lowGradeCourses.length > 0 ? t.portalDisclaimer : null };
        const direct = [...findDirectChunks('information/졸업사정 기준.txt', ['평점평균'], 1), ...findDirectChunks('data/graduation_rules.json', [progress.major], 1)];
        sources = buildCitations(direct, ['성적', '평점', ...qTok.words], 2);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 3. SHOULD_TAKE_COURSE ("이 과목을 들어야 하나요?")
      // ------------------------------------------------------------------
      else if (intent === 'SHOULD_TAKE_COURSE' && matchedCourses.length > 0) {
        const c = matchedCourses[0];
        const nt = normStr(c.title);
        const alreadyPassed = progress.passedNormTitles.has(nt);
        const alreadyInProg = progress.inProgressCourses.some((ic) => normStr(ic.title) === nt);
        const alreadyInBasket = progress.basketNormTitles.has(nt);
        const isMandMajor = progress.missingMajorCourses.some((mt) => normStr(mt).includes(nt) || nt.includes(normStr(mt.replace(/\(.*?\)/g, ''))));
        const isMandGe = /컴퓨팅사고|창의코딩|오디세이세미나1|오디세이세미나2|careerenglish|대학한국어3/i.test(nt);
        const deptPrefix = targetDept.replace(/학부|학과|전공|스쿨/g, '');
        const isMyMajor = !!(deptPrefix && c.dept && c.dept.includes(deptPrefix));

        let headline = '';
        const nextActions = [];

        if (alreadyPassed) {
          headline =
            lang === 'en' ? `You already passed **${c.title}** (${c.credits} cr), so you don't need to take it again unless retaking for a higher grade.` :
            lang === 'ru' ? `Вы уже сдали **${c.title}** (${c.credits} кр.) — повторно брать его не нужно.` :
            lang === 'zh' ? `您已修过 **${c.title}**（${c.credits}学分），无需重复选修。` :
            `**${c.title}**(${c.credits}학점)은 이미 이수 완료하신 과목이에요. 재이수가 아니라면 다시 들을 필요는 없어요.`;
        } else if (alreadyInProg) {
          headline =
            lang === 'en' ? `You are currently taking **${c.title}** (${c.credits} cr).` :
            lang === 'ru' ? `Вы уже изучаете **${c.title}** (${c.credits} кр.) в этом семестре.` :
            lang === 'zh' ? `您本学期正在修读 **${c.title}**（${c.credits}学分）。` :
            `**${c.title}**(${c.credits}학점)은 현재 수강 중인 과목이에요.`;
        } else if (isMandMajor) {
          headline =
            lang === 'en' ? `Yes! **${c.title}** (${c.credits} cr) is a **mandatory major course** for ${targetDept}.` :
            lang === 'ru' ? `Да! **${c.title}** (${c.credits} кр.) — **обязательный профильный предмет** для ${targetDept}.` :
            lang === 'zh' ? `是的！**${c.title}**（${c.credits}学分）是 ${targetDept} 的**专业必修课**，毕业前必须修读。` :
            `네, **${c.title}**(${c.credits}학점)은 ${targetDept} **전공필수**이므로 졸업 전 꼭 들어야 해요.`;
          if (alreadyInBasket) nextActions.push(lang === 'ko' ? '이미 수강바구니에 담겨 있어요 ✓' : (lang === 'ru' ? 'Уже добавлен в корзину ✓' : (lang === 'zh' ? '已在选课篮中 ✓' : 'Already in your basket ✓')));
        } else if (isMandGe) {
          headline =
            lang === 'en' ? `**${c.title}** (${c.credits} cr) counts toward mandatory General Education.` :
            lang === 'ru' ? `**${c.title}** (${c.credits} кр.) относится к обязательным общеобразовательным предметам (교양).` :
            lang === 'zh' ? `**${c.title}**（${c.credits}学分）属于教养必修/选必重点课程。` :
            `**${c.title}**(${c.credits}학점)은 교양 필수·선택필수 영역에 해당하는 과목이에요.`;
        } else if (isMyMajor) {
          headline =
            lang === 'en' ? `**${c.title}** (${c.credits} cr) is not mandatory, but counts toward your ${targetDept} major electives (${progress.remainMajor} cr left).` :
            lang === 'ru' ? `**${c.title}** (${c.credits} кр.) не обязателен, но засчитается в профильные кредиты ${targetDept} (осталось ${progress.remainMajor} кр.).` :
            lang === 'zh' ? `**${c.title}**（${c.credits}学分）非必修，但可计入 ${targetDept} 专业选修学分（还差 ${progress.remainMajor}学分）。` :
            `**${c.title}**(${c.credits}학점)은 필수는 아니지만, ${targetDept} 전공선택 학점(잔여 ${progress.remainMajor}학점)으로 인정돼요.`;
        } else {
          headline =
            lang === 'en' ? `**${c.title}** (${c.credits} cr, \`${c.cat}\`) is optional for ${targetDept}.` :
            lang === 'ru' ? `**${c.title}** (${c.credits} кр., \`${c.cat}\`) — необязательный предмет для ${targetDept}.` :
            lang === 'zh' ? `**${c.title}**（${c.credits}学分，\`${c.cat}\`）对 ${targetDept} 属于选修类课程。` :
            `**${c.title}**(${c.credits}학점, \`${c.cat}\`)은 ${targetDept} 필수 과목은 아니며 선택 학점으로 인정돼요.`;
        }

        sections = { headline, nextActions, remainingSummary: remSummary, disclaimer: t.portalDisclaimer };
        const direct = [...findDirectChunks('data/courses.json', [c.title], 1), ...findDirectChunks('data/graduation_rules.json', [targetDept], 1)];
        sources = buildCitations(direct, [c.title, targetDept, ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 4. PROGRESS_REMAINING ("제 졸업까지 얼마나 남았나요?")
      // ------------------------------------------------------------------
      else if (intent === 'PROGRESS_REMAINING') {
        const nextActions = [];
        let headline = '';

        if (!progress.hasCourses) {
          headline =
            lang === 'en' ? `Graduation for **${progress.major}** requires **${progress.reqTotal} credits** (Major ${progress.reqMajor}, GE ${progress.reqGE}). Add your courses to see remaining credits.` :
            lang === 'ru' ? `Для выпуска по **${progress.major}** нужно **${progress.reqTotal} кредитов** (Спец. ${progress.reqMajor}, Общ. ${progress.reqGE}). Добавьте пройденные предметы для точного расчёта.` :
            lang === 'zh' ? `**${progress.major}** 毕业需 **${progress.reqTotal}学分**（专业 ${progress.reqMajor}，教养 ${progress.reqGE}）。请先录入已修课程以计算剩余学分。` :
            `**${progress.major}** 졸업 기준은 **총 ${progress.reqTotal}학점**(전공 ${progress.reqMajor}, 교양 ${progress.reqGE})이에요. 과목을 입력하면 남은 학점을 계산해 드려요.`;
        } else {
          headline =
            lang === 'en' ? `You have **${progress.remainTotal} credits left** to graduate (${progress.expTotal}/${progress.reqTotal} cr, ~**${progress.estimatedSemesters} semesters** at 18 cr/term).` :
            lang === 'ru' ? `До выпуска осталось **${progress.remainTotal} кредитов** (${progress.expTotal}/${progress.reqTotal} кр., примерно **${progress.estimatedSemesters} сем.** по 18 кр.).` :
            lang === 'zh' ? `离毕业还差 **${progress.remainTotal}学分**（已修及在修 ${progress.expTotal}/${progress.reqTotal}，按每学期 18 学分约需 **${progress.estimatedSemesters} 学期**）。` :
            `졸업까지 **총 ${progress.remainTotal}학점** 남았어요! (현재 ${progress.expTotal}/${progress.reqTotal}학점, 18학점 기준 약 **${progress.estimatedSemesters}학기**)`;

          if (progress.gpa !== null) {
            const fNote = progress.failedCount > 0 ? ` (${lang === 'ko' ? 'F/NP 제외: ' : 'F/NP excl.: '}${progress.failedTitles.join(', ')})` : '';
            nextActions.push(`GPA: **${progress.gpa} / 4.5**${fNote}`);
          }
          if (progress.missingMajorCourses.length > 0) {
            nextActions.push(`${lang === 'ko' ? '미이수 전공필수' : (lang === 'ru' ? 'Несданные обязательные' : (lang === 'zh' ? '未修专业必修' : 'Missing mandatory major'))}: **${progress.missingMajorCourses.join(', ')}**`);
          }
          if (progress.missingGeItems.length > 0) {
            nextActions.push(`${lang === 'ko' ? '부족 교양' : (lang === 'ru' ? 'Не хватает 교양' : (lang === 'zh' ? '缺修教养' : 'Missing GE'))}: ${progress.missingGeItems.slice(0, 3).join(', ')}`);
          }
          if (progress.basketCount > 0) {
            nextActions.push(
              lang === 'en' ? `After current basket (${progress.basketValidCredits} cr): **${progress.remainAfterBasket} cr left**` :
              lang === 'ru' ? `С учётом корзины (${progress.basketValidCredits} кр.): останется **${progress.remainAfterBasket} кр.**` :
              lang === 'zh' ? `计入选课篮（${progress.basketValidCredits}学分）后还剩 **${progress.remainAfterBasket}学分**` :
              `수강바구니(${progress.basketValidCredits}학점) 반영 시 잔여 **${progress.remainAfterBasket}학점**`
            );
          }
        }

        sections = { headline, nextActions, remainingSummary: remSummary, disclaimer: null };
        const direct = [...findDirectChunks('data/graduation_rules.json', [progress.major], 1), ...findDirectChunks('information/졸업사정 기준.txt', ['130학점'], 1)];
        sources = buildCitations(direct, ['졸업', '130', progress.major, ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 5. FOREIGNER_RULES
      // ------------------------------------------------------------------
      else if (intent === 'FOREIGNER_RULES') {
        const headline =
          lang === 'en' ? 'International students must complete **12 cr of Korean GE (대학한국어3 mandatory)**, **Odyssey Seminar 1–2 (2 cr)**, **Sports (1 cr)**, and **TOPIK Level 4+**.' :
          lang === 'ru' ? 'Иностранные студенты обязаны пройти **12 кр. корейского языка (대학한국어3 обязателен)**, **Odyssey 1–2 (2 кр.)**, **Спорт (1 кр.)** и получить **TOPIK 4+**.' :
          lang === 'zh' ? '外国留学生需修满 **12学分韩语教养（대학한국어3 必修）**、**Odyssey 1·2（2学分）**、**体育（1学分）**，并取得 **TOPIK 4级以上**。' :
          '외국인 유학생은 **글로벌소통 한국어 12학점(대학한국어3 필수)**, **생애설계(오디세이1·2, 2학점)**, **스포츠웰니스(1학점)**와 **TOPIK 4급 이상**이 필요해요.';

        const nextActions =
          lang === 'en' ? ['Korean GE (12 cr): 대학한국어1~4, (외국인)읽기와쓰기/발표와토론 — 대학한국어3 required from Aug 2025 grads.', 'Coding (정보소통) & Writing (의사소통) are optional; double major is exempt.'] :
          lang === 'ru' ? ['Корейский (12 кр.): 대학한국어1~4, (외국인)읽기와쓰기/발표와토론 — 대학한국어3 обязателен с вып. авг. 2025.', 'Информатика/письмо (정보소통·의사소통) по выбору; двойная специальность необязательна.'] :
          lang === 'zh' ? ['韩语 12学分：대학한국어1~4、留学生读写/发表讨论（2025年8月起 대학한국어3 必修）。', '信息沟通/写作可自选，且免除双专业必修要求。'] :
          ['한국어(12학점): 대학한국어1~4, 외국인 읽기와쓰기·발표와토론 등 (**대학한국어3** 2025년 8월 졸업부터 필수)', '정보소통·의사소통은 자율이수, 복수전공 필수 예외 대상이에요.'];

        sections = { headline, nextActions, remainingSummary: userType === '외국인 유학생' ? remSummary : null, disclaimer: null };
        const direct = [...findDirectChunks('information/졸업사정 기준.txt', ['외국인', '대학한국어3'], 2), ...findDirectChunks('data/gyoyang_rules.json', ['외국인 유학생', 'TOPIK'], 1)];
        sources = buildCitations(direct, ['외국인', '대학한국어3', 'TOPIK', ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 6. TRANSFER_RULES
      // ------------------------------------------------------------------
      else if (intent === 'TRANSFER_RULES') {
        const headline =
          lang === 'en' ? 'Transfer students are **exempt from GE requirements** (optional) and need **130 total cr** (incl. recognized credits), **60 major cr**, and **오디세이세미나3 (1 cr)**.' :
          lang === 'ru' ? 'Переводные студенты **освобождены от обязательных общих предметов (교양)**; нужно **130 кр.** (включая зачтённые), **60 кр. по специальности** и **오디세이세미나3 (1 кр.)**.' :
          lang === 'zh' ? '插班生**免除教养必修**（自选），含认定学分共需 **130学分**、专业 **60学分** 及 **오디세이세미나3（1学分）**。' :
          '편입생은 **교양 이수 의무가 면제(선택)**되며, 인정학점 포함 **총 130학점**, **전공 60학점**, **오디세이세미나3(전필 1학점)**을 이수하면 돼요.';

        const nextActions = [
          lang === 'en' ? 'Double major is optional; minimum Hallym GPA 2.00 required.' :
          lang === 'ru' ? 'Двойная специальность по выбору; минимальный GPA в Халлим — 2.00.' :
          lang === 'zh' ? '免除双专业必修要求；本校平均绩点需 2.00 以上。' :
          '복수전공 필수 예외(선택)이며, 본교 평점평균 2.00 이상이 필요해요.'
        ];
        sections = { headline, nextActions, remainingSummary: userType === '편입생' ? remSummary : null, disclaimer: null };
        const direct = [...findDirectChunks('information/학번별 교양 졸업 기준.txt', ['편입생'], 1), ...findDirectChunks('information/졸업사정 기준.txt', ['편입생'], 1)];
        sources = buildCitations(direct, ['편입생', ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 7. TRACK_ROADMAP
      // ------------------------------------------------------------------
      else if (intent === 'TRACK_ROADMAP') {
        if (targetDept === '경영학과') {
          const specific = DEFAULT_BIZ_TRACKS.find((tr) =>
            normStr(trimmedQuery).includes(normStr(tr.id.replace(/·/g, ''))) ||
            (tr.id === '회계·세무' && /회계|세무|account|tax|бухгалт|会计/i.test(trimmedQuery))
          );

          let headline = '';
          const nextActions = [];
          if (specific) {
            headline =
              lang === 'en' ? `**${specific.title} (${specific.en})** — ${specific.desc}` :
              lang === 'ru' ? `**${specific.title} (${specific.ru})** — ${specific.desc}` :
              lang === 'zh' ? `**${specific.title}（${specific.zh}）** — ${specific.desc}` :
              `경영학과 **${specific.title}**은 ${specific.desc} 트랙이에요.`;
            nextActions.push(`${lang === 'ko' ? '기초' : (lang === 'ru' ? 'База' : (lang === 'zh' ? '基础' : 'Foundation'))}: ${specific.foundation.join(', ')}`);
            nextActions.push(`${lang === 'ko' ? '심화' : (lang === 'ru' ? 'Углублённые' : (lang === 'zh' ? '进阶' : 'Advanced'))}: ${specific.advanced.join(', ')}`);
          } else {
            headline =
              lang === 'en' ? 'Business Administration operates **6 official career tracks** (회계·세무, 의료경영, 글로벌혁신전략, 비즈니스인텔리전스, 관광경영, 마케팅기획).' :
              lang === 'ru' ? 'На факультете менеджмента (경영학과) действует **6 официальных карьерных треков**:' :
              lang === 'zh' ? '经营学科共设有 **6 大官方职业发展方向**：' :
              '경영학과는 공식 로드맵 기준 **6개 전공 진로 트랙**을 운영해요.';
            DEFAULT_BIZ_TRACKS.forEach((tr) => {
              const label = lang === 'en' ? `**${tr.title}** (${tr.en})` : (lang === 'ru' ? `**${tr.title}** (${tr.ru})` : (lang === 'zh' ? `**${tr.title}**（${tr.zh}）` : `**${tr.title}**: ${tr.desc}`));
              nextActions.push(label);
            });
          }

          sections = { headline, nextActions, remainingSummary: userMajor === '경영학과' ? remSummary : null, disclaimer: t.portalDisclaimer };
          const direct = [...findDirectChunks('information/경영학과.pdf', ['비즈니스인텔리젼스', '의료경영'], 2), ...findDirectChunks('information/경영대학.txt', ['비즈니스인텔리젼스', '의료경영'], 1)];
          sources = buildCitations(direct, ['트랙', '비즈니스인텔리젼스', '의료경영', ...qTok.words], 3);
          grounded = sources.length > 0;
        } else {
          const ragHits = search(`${targetDept} 트랙 로드맵 진로 교육과정`, { dept: targetDept, topics: ['트랙', '전공'], topK: 3 });
          const relevant = ragHits.filter((r) => r.score >= 3.0 && r.matchedWords >= 1);
          if (relevant.length > 0) {
            sections = {
              headline: `${targetDept} 공식 교육과정·진로 로드맵 요약이에요.`,
              nextActions: relevant.slice(0, 3).map((r) => extractVerbatimQuote(r.chunk.text, qTok.words, 140)),
              remainingSummary: targetDept === userMajor ? remSummary : null,
              disclaimer: t.portalDisclaimer
            };
            sources = buildCitations(relevant, qTok.words, 3);
            grounded = true;
          }
        }
      }

      // ------------------------------------------------------------------
      // 8. COURSE_LOOKUP
      // ------------------------------------------------------------------
      else if (intent === 'COURSE_LOOKUP' && matchedCourses.length > 0) {
        const deptPrefix = targetDept.replace(/학부|학과|전공|스쿨/g, '');
        const first = matchedCourses[0];
        const nextActions = [];

        matchedCourses.slice(0, 3).forEach((c) => {
          let appliedCat = c.cat || '일반선택';
          const cDept = c.dept || '';
          if (targetStudentType === '외국인 유학생' && /대학한국어|한국어|외국인/.test(c.title)) {
            appliedCat = '교양_글로벌소통';
          } else if (appliedCat.includes('전선') || appliedCat.includes('전필')) {
            if (deptPrefix && cDept.includes(deptPrefix)) appliedCat = `${deptPrefix}_${appliedCat.includes('전필') ? '전필' : '전선'}`;
            else if (cDept && !cDept.includes(deptPrefix)) appliedCat = `${c.cat} (${cDept})`;
          }
          nextActions.push(`**${c.title}** (${c.code || '-'}, ${c.credits}cr) → **${appliedCat}**`);
        });

        const headline =
          lang === 'en' ? `Category info for **${first.title}** (${targetDept}):` :
          lang === 'ru' ? `Категория предмета **${first.title}** (для ${targetDept}):` :
          lang === 'zh' ? `**${first.title}**（${targetDept}）的课程类别信息：` :
          `${targetDept} 기준 **${first.title}**의 이수구분이에요.`;

        sections = { headline, nextActions, remainingSummary: remSummary, disclaimer: t.portalDisclaimer };
        const direct = findDirectChunks('data/courses.json', [first.title], 2);
        sources = buildCitations(direct, [first.title, ...qTok.words], 2);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 9. GYOYANG_REQ
      // ------------------------------------------------------------------
      else if (intent === 'GYOYANG_REQ') {
        let headline = '';
        const nextActions = [];

        if (targetStudentType === '외국인 유학생') {
          headline =
            lang === 'en' ? 'International student GE: **Korean 12 cr (대학한국어3 mandatory)** + **Odyssey 1–2 (2 cr)** + **Sports (1 cr)**.' :
            lang === 'ru' ? 'Общие предметы (교양) для иностранцев: **Корейский 12 кр. (대학한국어3 обязателен)** + **Odyssey 1–2 (2 кр.)** + **Спорт (1 кр.)**.' :
            lang === 'zh' ? '留学生教养：**韩语 12学分（대학한국어3 必修）** + **Odyssey 1·2（2学分）** + **体育（1学分）**。' :
            '외국인 유학생 교양은 **글로벌소통 한국어 12학점(대학한국어3 필수)**, **생애설계(오디세이1·2, 2학점)**, **스포츠웰니스(1학점)**가 필수예요.';
          nextActions.push(lang === 'ko' ? '정보소통·의사소통은 유학생 자율이수 영역이에요.' : (lang === 'ru' ? 'Информатика и письмо (정보소통·의사소통) — по выбору.' : (lang === 'zh' ? '信息沟通与写作领域可自选。' : 'Coding & Writing areas are optional.')));
        } else if (targetStudentType === '편입생') {
          headline =
            lang === 'en' ? 'Transfer students have **no mandatory GE requirements** (optional).' :
            lang === 'ru' ? 'Для переводных студентов **обязательных предметов 교양 нет** (по выбору).' :
            lang === 'zh' ? '插班生**无教养必修义务**（可自选）。' :
            '편입생은 기초·교양 과목 **이수 의무가 없습니다(선택사항)**.';
        } else {
          const is2023Plus = targetYear >= 2023;
          headline =
            lang === 'en' ? `For **${targetYear}** cohort, General Education requires **26 credits total**: Mandatory GE (**7 cr**) + Selective GE (**${is2023Plus ? '13' : '10'} cr**) + Free GE (**${is2023Plus ? '6' : '9'} cr**).` :
            lang === 'ru' ? `Для набора **${targetYear}** нужно минимум **26 кр. 교양**: обязательные (**7 кр.**) + выборно-обязательные (**${is2023Plus ? '13' : '10'} кр.**) + свободные (**${is2023Plus ? '6' : '9'} кр.**).` :
            lang === 'zh' ? `**${targetYear}级**教养至少需 **26学分**：教养必修（**7学分**）+ 选必（**${is2023Plus ? '13' : '10'}学分**）+ 自选（**${is2023Plus ? '6' : '9'}学分**）。` :
            `${targetYear}학번 교양은 **최소 26학점**이며, **교양필수(정보소통 5 + 생애설계 2 = 7학점)**와 **선택필수(${is2023Plus ? '13' : '10'}학점)**를 반드시 이수해야 해요.`;

          nextActions.push(
            lang === 'en' ? '**Mandatory (7 cr)**: 정보소통 (컴퓨팅사고 2 + 창의코딩 3), 생애설계 (오디세이세미나1·2, 2 cr)' :
            lang === 'ru' ? '**Обязательные (7 кр.)**: 정보소통 (컴퓨팅사고 2 + 창의코딩 3), 생애설계 (오디세이세미나1·2, 2 кр.)' :
            lang === 'zh' ? '**教养必修 (7学分)**：정보소통（컴퓨팅사고 2 + 창의코딩 3）、생애설계（오디세이세미나1·2，2学分）' :
            '**교양필수(7학점)**: 정보소통(컴퓨팅사고 2 + 창의코딩 3) / 생애설계(오디세이세미나1·2)'
          );
          nextActions.push(
            lang === 'en' ? `**Selective (${is2023Plus ? '13' : '10'} cr)**: 의사소통 (3 cr), 글로벌소통 (**${is2023Plus ? '9 cr, Career English required' : '6 cr, no Career English'}**), 스포츠웰니스 (1 cr)` :
            lang === 'ru' ? `**Выборно-обязат. (${is2023Plus ? '13' : '10'} кр.)**: 의사소통 (3 кр.), 글로벌소통 (**${is2023Plus ? '9 кр., Career English обяз.' : '6 кр., без Career English'}**), 스포츠웰니스 (1 кр.)` :
            lang === 'zh' ? `**教养选必 (${is2023Plus ? '13' : '10'}学分)**：의사소통 (3学分)、글로벌소통（**${is2023Plus ? '9学分，含 Career English' : '6学分，无 Career English 义务'}**）、스포츠웰니스 (1学分)` :
            `**선택필수(${is2023Plus ? '13' : '10'}학점)**: 의사소통(3) · 글로벌소통(**${is2023Plus ? '9학점, Career English 필수' : '6학점, Career English 의무 없음'}**) · 스포츠웰니스(1)`
          );
        }

        sections = { headline, nextActions, remainingSummary: targetStudentType === userType ? remSummary : null, disclaimer: null };
        const direct = [...findDirectChunks('information/학번별 교양 졸업 기준.txt', ['정보소통', '생애설계'], 2), ...findDirectChunks('data/gyoyang_rules.json', [targetYear >= 2023 ? '2023학번 이후' : '2022학번 이전'], 1)];
        sources = buildCitations(direct, ['정보소통', '생애설계', '교양', ...qTok.words], 3);
        grounded = sources.length > 0;
      }

      // ------------------------------------------------------------------
      // 10. GRADUATION_REQ / MAJOR_REQ
      // ------------------------------------------------------------------
      else if (intent === 'GRADUATION_REQ' || intent === 'MAJOR_REQ') {
        const collegeDef = mentionedCollege ? COLLEGE_DEFINITIONS[mentionedCollege] : null;
        const rule = !collegeDef && graduationRules && graduationRules[targetDept];
        if (collegeDef) {
          sections = {
            headline: collegeDef.summaryKo,
            nextActions: collegeDef.bulletsKo.slice(0, 4),
            remainingSummary: null,
            disclaimer: null
          };
          const direct = [];
          (collegeDef.sourceHints || []).forEach((h) => {
            direct.push(...findDirectChunks(h.file, h.kws, 1));
          });
          if (direct.length === 0) {
            direct.push(...findDirectChunks('information/졸업사정 기준.txt', ['130학점'], 1));
          }
          sources = buildCitations(direct, [mentionedCollege, ...collegeDef.depts.slice(0, 3), '졸업', ...qTok.words], 3);
          grounded = sources.length > 0;
        } else if (rule) {
          const mc = rule.major_credits || { single: 60, double: 33, minor: 21 };
          const totalCr = rule.total_credits || 130;
          const geCr = rule.ge_credits || 26;
          const mandList = rule.mandatory_courses
            ? (targetYear >= 2021 ? (rule.mandatory_courses.since_2021 || []) : (rule.mandatory_courses.before_2021 || []))
            : [];
          const displayDept = swSubMajor ? `소프트웨어학부 ${swSubMajor}` : targetDept;

          const headline =
            lang === 'en' ? `**${displayDept}** graduation requires **${totalCr} credits** (GPA 2.00+): Single major **${mc.single} cr** (Double ${mc.double} cr) and GE **${targetStudentType === '편입생' ? 'exempt' : geCr + ' cr'}**.` :
            lang === 'ru' ? `Для выпуска по **${displayDept}** нужно **${totalCr} кредитов** (GPA 2.00+): спец. **${mc.single} кр.** (двойная ${mc.double} кр.) и 교양 **${targetStudentType === '편입생' ? 'необязат.' : geCr + ' кр.'}**.` :
            lang === 'zh' ? `**${displayDept}** 毕业需 **${totalCr}学分**（GPA 2.00以上）：单专业 **${mc.single}学分**（双专业 ${mc.double}学分）、教养 **${targetStudentType === '편입생' ? '免除' : geCr + '学分'}**。` :
            `**${displayDept}**(${targetYear}학번) 졸업에는 **총 ${totalCr}학점 이상**(평점 2.00+)이 필요해요. 단일전공 **${mc.single}학점**(복수 ${mc.double}학점)과 ${targetStudentType === '편입생' ? '교양 의무 면제 기준이 적용돼요.' : `교양 최소 **${geCr}학점**을 채워야 해요.`}`;

          const nextActions = [];
          if (mandList.length > 0) {
            nextActions.push(`${lang === 'ko' ? '전공필수' : (lang === 'ru' ? 'Обязат. по спец.' : (lang === 'zh' ? '专业必修' : 'Mandatory Major'))}: ${mandList.map((m) => `${m.title}(${m.credits}cr)`).join(', ')}`);
          }
          if (targetDept === '소프트웨어학부') {
            nextActions.push(
              lang === 'en' ? 'Major requirement (Single/Double/Minor): **소프트웨어캡스톤디자인 (3 cr)** (or **취업연계SW실무 9 cr**) + 1 designated major course (6 cr total) & **오디세이세미나3**.' :
              lang === 'ru' ? 'Требование факультета (осн./двойн.): **소프트웨어캡스톤디자인 (3 кр.)** (или **취업연계SW실무 9 кр.**) + 1 профильный курс (6 кр.) и **오디세이세미나3**.' :
              lang === 'zh' ? '学部要求（单/双专业相同）：**소프트웨어캡스톤디자인（3学分）**（可用 **취업연계SW실무 9学分** 替代）+ 1门认定专业课（共6学分）及 **오디세이세미나3**。' :
              '필수 이수(단일·복수·부전공 동일): **소프트웨어캡스톤디자인(3학점)**(또는 **취업연계SW실무 9학점** 대체) + 세부전공 인정과목 1과목(총 6학점) 및 **오디세이세미나3**'
            );
            const subMap = rule.special_conditions && rule.special_conditions.sub_majors;
            if (swSubMajor && subMap && Array.isArray(subMap[swSubMajor])) {
              nextActions.push(`**${swSubMajor}** 인정교과목(9종 중 1과목+): ${subMap[swSubMajor].slice(0, 6).join(', ')} 등`);
            }
          } else if (rule.special_conditions) {
            const sp = rule.special_conditions;
            const priorityKeys = ['basic_ge_since_2025', 'graduation_cert', 'language_cert', 'graduation_exam', 'graduation_project', 'sports_cert', 'graduation_thesis'];
            for (let k = 0; k < priorityKeys.length && nextActions.length < 3; k++) {
              const val = sp[priorityKeys[k]];
              if (typeof val === 'string' && val.trim()) {
                nextActions.push(val.trim());
              }
            }
          }

          sections = { headline, nextActions, remainingSummary: targetDept === userMajor ? remSummary : null, disclaimer: null };
          const direct = [
            ...findDirectChunks('data/graduation_rules.json', [targetDept], 1),
            ...findDirectChunks(`학과별_졸업기준/졸업기준_${targetDept}`, [], 2)
          ];
          if (swSubMajor) {
            direct.push(...findDirectChunks(`information/소프트웨어학부_${swSubMajor}.pdf`, [swSubMajor.replace('전공', '')], 1));
          }
          direct.push(...findDirectChunks('information/졸업사정 기준.txt', ['130학점'], 1));
          sources = buildCitations(direct, [swSubMajor || targetDept, targetDept, '130', '졸업', '필수', ...qTok.words], 3);
          grounded = sources.length > 0;
        } else if (targetDept === '간호학과') {
          sections = {
            headline: lang === 'en'
              ? '**Nursing (간호학과)** requires **130+ total credits**, **81 mandatory major credits**, separate **26 GE credits** (exempt from Career English & Odyssey 2/3), and **2+ mock national nursing exams**.'
              : lang === 'ru'
              ? '**Сестринское дело (간호학과)**: **130+ кредитов**, **81 кр. обязательных по специальности**, отдельные **26 кр. 교양** (без Career English и Odyssey 2/3) и **≥2 пробных госэкзамена**.'
              : lang === 'zh'
              ? '**护理学科（간호학과）**毕业需 **130学分以上**、**专业必修 81学分**、单独 **教养 26学分**（免 Career English 及 Odyssey 2·3），并参加 **2次以上护士国考模拟考**。'
              : '**간호학과**(간호대학) 졸업에는 **총 130학점 이상**, **전공필수 81학점**, **별도 교양 26학점**과 **간호사 국가시험 모의고사 2회 이상 응시**가 필요해요.',
            nextActions: [
              '전공필수(81학점): 기초간호학I~III, 기본간호학I·II및실습, 성인·아동·여성·정신·지역사회·노인간호학 이론 및 임상실습, 간호관리학, 간호연구, 통합실습I·II',
              '별도 교양(26학점): 정보소통 5 · 생애설계 1 · 의사소통 3 · 글로벌소통 6 · 스포츠웰니스 1 (**Career English 및 오디세이세미나2·3 예외**)',
              '공식 모듈형 트랙 4개(선택): 임상간호 · 지역돌봄 · 글로벌헬스리더 · AI임상데이터리더'
            ],
            remainingSummary: null,
            disclaimer: null
          };
          const direct = [
            ...findDirectChunks('information/[한림대학교] 2026학년도 대학안내책자.pdf', ['전공필수 : 81학점', '모의고사 2회'], 1),
            ...findDirectChunks('information/[한림대학교] 2026학년도 대학안내책자.pdf', ['임상간호트랙', '지역돌봄트랙'], 1),
            ...findDirectChunks('information/[한림대학교] 2026학년도 대학안내책자.pdf', ['간호대학', '26'], 1)
          ];
          sources = buildCitations(direct, ['간호학과', '81학점', '모의고사', '졸업시험', ...qTok.words], 3);
          grounded = sources.length > 0;
        } else {
          const deptHits = search(`${targetDept} 졸업 학점 필수 교과목`, { dept: targetDept, topics: ['졸업요건', '전공'], topK: 3 });
          const valid = deptHits.filter((r) => r.score >= 3.5 && r.matchedWords >= 1);
          if (valid.length > 0) {
            sections = {
              headline: `${targetDept} 공식 자료 기반 졸업·전공 기준이에요.`,
              nextActions: valid.slice(0, 2).map((r) => extractVerbatimQuote(r.chunk.text, qTok.words, 150)),
              remainingSummary: null,
              disclaimer: null
            };
            sources = buildCitations(valid, qTok.words, 3);
            grounded = true;
          }
        }
      }

      // ------------------------------------------------------------------
      // 11. GENERAL_SEARCH (strict out-of-scope rejection)
      // ------------------------------------------------------------------
      else {
        const lowerQ = trimmedQuery.toLowerCase();
        const hasAcademicDomainSignal =
          mentionedDept !== null ||
          mentionedType !== null ||
          mentionedYear !== null ||
          matchedCourses.length > 0 ||
          ACADEMIC_DOMAIN_TERMS.some((term) => lowerQ.includes(term));

        const ragHits = search(trimmedQuery, {
          dept: mentionedDept || (hasAcademicDomainSignal ? targetDept : null),
          studentType: targetStudentType,
          topK: opts.topK || 4
        });

        const top = ragHits[0];
        const strongMatch =
          top &&
          top.score >= 4.8 &&
          top.matchedWords >= 1 &&
          (hasAcademicDomainSignal
            ? (top.coverage >= 0.35 || top.matchedWords >= 2)
            : (top.score >= 12.0 && top.coverage >= 0.75 && top.matchedWords >= 2));

        if (strongMatch) {
          const filtered = ragHits.filter((r) => r.score >= Math.max(3.5, top.score * 0.55) && r.matchedWords >= 1);
          sections = {
            headline:
              lang === 'en' ? `Here is what Hallym official documents state (${targetDept}):` :
              lang === 'ru' ? `Вот что указано в официальных документах Халлим (${targetDept}):` :
              lang === 'zh' ? `以下是翰林大学官方资料中的相关说明（${targetDept}）：` :
              `한림대학교 공식 자료(${targetDept} 기준)에서 확인한 내용이에요.`,
            nextActions: filtered.slice(0, 2).map((r) => extractVerbatimQuote(r.chunk.text, qTok.words, 150)),
            remainingSummary: null,
            disclaimer: null
          };
          sources = buildCitations(filtered, qTok.words, 3);
          grounded = sources.length > 0;
        }
      }

      let answer = '';
      if (!grounded || !sections) {
        answer = t.notFound;
        sections = null;
        grounded = false;
        sources = [];
      } else {
        answer = composeFlatAnswer(sections, ocrNotice);
      }

      const result = {
        answer,
        sections,
        grounded,
        intent,
        lang,
        labels: t.labels,
        targetDept,
        targetStudentType,
        targetAdmissionYear: targetYear,
        sources,
        userProgress: progress,
        excludedOcrNotice: ocrNotice,
        fromCache: false,
        latencyMs: Date.now() - t0
      };

      if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, result);
      return result;
    }

    function getFaqSuggestions(user) {
      const studentType = (user && user.studentType) ? user.studentType : '재학생';
      const list = [
        '다음 학기에 뭐 들어야 해?',
        '제 졸업까지 얼마나 남았나요?',
        '제 성적이 낮은 과목이 있나요?',
        '성적표는 어떻게 업로드하나요?'
      ];
      if (studentType === '외국인 유학생') {
        list.push('외국인 유학생 교양 요건은 무엇인가요?');
      }
      return list;
    }

    return {
      ask,
      search,
      tokenize,
      detectLanguage,
      evaluateUserProgress,
      getFaqSuggestions,
      getCacheStats,
      clearCache,
      getIndexMeta: () => (ragIndex ? ragIndex.meta : null),
      NOT_FOUND_MESSAGE,
      PORTAL_DISCLAIMER,
      I18N
    };
  }

  return {
    createEngine,
    tokenize,
    detectLanguage,
    NOT_FOUND_MESSAGE,
    PORTAL_DISCLAIMER,
    I18N
  };
});
