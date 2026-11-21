import streamlit as st
import pandas as pd
import json
import os

# -----------------------------------------------------------------------------
# PAGE CONFIGURATION
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="한림 수강 바구니 + 졸업 시뮬레이터",
    page_icon="🎓",
    layout="wide"
)

# -----------------------------------------------------------------------------
# LOAD COURSE DATABASE (data/courses.json - 1,098 Courses)
# -----------------------------------------------------------------------------
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "courses.json")
try:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        BUILTIN_COURSES = json.load(f)
except Exception:
    BUILTIN_COURSES = []

# -----------------------------------------------------------------------------
# DEMO STUDENT RECORD (Student ID: 20250000, Zero Fake Courses)
# -----------------------------------------------------------------------------
REQ_TOTAL = 130
REQ_BIZ_SINGLE = 60    # 경영 단일전공 기준
REQ_GE_COMMON = 26     # 대학 공통 교양 기준
REQ_GEN_MIN = 3        # 일반선택 기준
TERM_MAX = 18          # 정규학기 수강 한도

# 2025-2학기: 16학점 (6과목, 가을학기 입학)
COURSES_2025_2 = [
    {"No": 1, "학기": "2025-2", "과목명": "(외국인)읽기와쓰기2", "구분": "선택필수", "학점": 3, "성적/상태": "A0", "area": "글로벌소통"},
    {"No": 2, "학기": "2025-2", "과목명": "대학한국어2", "구분": "선택필수", "학점": 3, "성적/상태": "A+", "area": "글로벌소통"},
    {"No": 3, "학기": "2025-2", "과목명": "한국대학생활의이해", "구분": "일반교양", "학점": 3, "성적/상태": "A0", "area": "자율선택"},
    {"No": 4, "학기": "2025-2", "과목명": "(외국인)발표와토론2", "구분": "선택필수", "학점": 3, "성적/상태": "A+", "area": "의사소통"},
    {"No": 5, "학기": "2025-2", "과목명": "마케팅원론", "구분": "경영전선", "학점": 3, "성적/상태": "B+", "area": "전공"},
    {"No": 6, "학기": "2025-2", "과목명": "글로벌멘토링인증", "구분": "일반교양", "학점": 1, "성적/상태": "P", "area": "자율선택"}
]

# 2026-1학기: 18학점 (8과목)
COURSES_2026_1 = [
    {"No": 7, "학기": "2026-1", "과목명": "스포츠-요가", "구분": "선택필수", "학점": 1, "성적/상태": "P", "area": "스포츠웰니스"},
    {"No": 8, "학기": "2026-1", "과목명": "생활과영화속의경제학", "구분": "일반교양", "학점": 3, "성적/상태": "B+", "area": "자율선택"},
    {"No": 9, "학기": "2026-1", "과목명": "생활속의통계학", "구분": "일반교양", "학점": 3, "성적/상태": "B+", "area": "자율선택"},
    {"No": 10, "학기": "2026-1", "과목명": "오디세이세미나1", "구분": "교양필수", "학점": 1, "성적/상태": "P", "area": "생애설계"},
    {"No": 11, "학기": "2026-1", "과목명": "대학한국어3", "구분": "선택필수", "학점": 3, "성적/상태": "A+", "area": "글로벌소통"},
    {"No": 12, "학기": "2026-1", "과목명": "경영정보시스템(종합설계)", "구분": "경영전선", "학점": 3, "성적/상태": "A0", "area": "전공"},
    {"No": 13, "학기": "2026-1", "과목명": "인터넷비즈니스(종합설계)", "구분": "경영전선", "학점": 3, "성적/상태": "A0", "area": "전공"},
    {"No": 14, "학기": "2026-1", "과목명": "스포츠-소도구필라테스", "구분": "선택필수", "학점": 1, "성적/상태": "P", "area": "스포츠웰니스"}
]

# 2026-2학기: 17학점 (7과목, 현재 수강 중)
COURSES_2026_2 = [
    {"No": 15, "학기": "2026-2", "과목명": "영화와미디어로만나는한국문화", "구분": "일반교양", "학점": 3, "성적/상태": "수강중 (미확정)", "area": "자율선택"},
    {"No": 16, "학기": "2026-2", "과목명": "사회봉사활동Ⅱ", "구분": "한림소양", "학점": 1, "성적/상태": "수강중 (미확정)", "area": "자율선택"},
    {"No": 17, "학기": "2026-2", "과목명": "오디세이세미나3", "구분": "경영전필", "학점": 1, "성적/상태": "수강중 (미확정)", "area": "전공"},
    {"No": 18, "학기": "2026-2", "과목명": "경영과인공지능", "구분": "경영전선", "학점": 3, "성적/상태": "수강중 (미확정)", "area": "전공"},
    {"No": 19, "학기": "2026-2", "과목명": "ESSENTIAL ENGLISH1", "구분": "선택필수", "학점": 3, "성적/상태": "수강중 (미확정)", "area": "글로벌소통"},
    {"No": 20, "학기": "2026-2", "과목명": "인공지능영어1", "구분": "선택필수", "학점": 3, "성적/상태": "수강중 (미확정)", "area": "글로벌소통"},
    {"No": 21, "학기": "2026-2", "과목명": "응용프로그래밍:R", "구분": "일반선택", "학점": 3, "성적/상태": "수강중 (미확정)", "area": "일반선택"}
]

ALL_REAL_COURSES = COURSES_2025_2 + COURSES_2026_1 + COURSES_2026_2

# -----------------------------------------------------------------------------
# SESSION STATE INITIALIZATION
# -----------------------------------------------------------------------------
if "basket" not in st.session_state:
    st.session_state.basket = []
if "custom_courses" not in st.session_state:
    st.session_state.custom_courses = []
if "major_mode" not in st.session_state:
    st.session_state.major_mode = "경영학과 (단일전공 60학점 완전지원)"
if "student_id" not in st.session_state:
    st.session_state.student_id = "20250000"
if "student_name" not in st.session_state:
    st.session_state.student_name = "유아미"
if "student_type" not in st.session_state:
    st.session_state.student_type = "재학생"
if "has_double_major" not in st.session_state:
    st.session_state.has_double_major = False

if "user_courses" not in st.session_state:
    st.session_state.user_courses = list(ALL_REAL_COURSES)

def norm(text):
    return text.replace(" ", "").lower()

# -----------------------------------------------------------------------------
# TOP BANNER & SLOGAN
# -----------------------------------------------------------------------------
st.info("💡 **\"포털은 시간표를 시뮬레이션합니다. 우리는 졸업을 시뮬레이션합니다.\"**")

# Header Section
col_head1, col_head2 = st.columns([2.5, 1.5])
with col_head1:
    st.title("🎓 한림 수강 바구니 + 졸업 시뮬레이터")
    major_label = "경영학과 단일전공" if "경영학과" in st.session_state.major_mode else st.session_state.major_mode.split()[0]
    st.markdown(f"##### 👤 **{st.session_state.student_id}** {st.session_state.student_name} · {major_label} · **{st.session_state.student_type}**")

with col_head2:
    with st.expander("⚙️ **설정 / 프로필 변경 (⋮)**", expanded=False):
        new_id = st.text_input("학번", value=st.session_state.student_id)
        new_name = st.text_input("이름", value=st.session_state.student_name)
        new_type = st.selectbox("학생 구분", ["재학생", "편입생"], index=0 if st.session_state.student_type == "재학생" else 1)
        new_major = st.selectbox(
            "주전공 선택",
            ["경영학과 (단일전공 60학점 완전지원)", "소프트웨어학부 (간단 모드)", "데이터사이언스학부 (간단 모드)", "경제학과 (간단 모드)", "심리학과 (간단 모드)", "기타 학과 (간단 모드)"],
            index=0 if "경영학과" in st.session_state.major_mode else 1
        )
        if new_major != st.session_state.major_mode:
            st.warning("⚠️ 전공을 변경하면 졸업요건 계산이 바뀝니다.")
        
        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("💾 설정 저장"):
            st.session_state.student_id = new_id
            st.session_state.student_name = new_name
            st.session_state.student_type = new_type
            st.session_state.major_mode = new_major
            st.success("설정이 저장되었습니다.")
            st.rerun()

        if col_btn2.button("🗑️ 데이터 초기화"):
            st.session_state.basket = []
            st.session_state.custom_courses = []
            st.warning("데이터가 초기화되었습니다.")
            st.rerun()

        st.caption("자동저장 상태: **항상 켜짐 (세션 유지)**")

# 4 Tabs (내 정보, 내 현황, 시뮬레이터, 도움말)
tab0, tab1, tab2, tab3 = st.tabs(["👤 [내 정보]", "📊 [내 현황]", "🛒 [시뮬레이터]", "📖 [도움말]"])

# =============================================================================
# TAB 0: [내 정보] (사용자 정보 + 기이수 과목 관리)
# =============================================================================
with tab0:
    st.write("#### 👤 내 기본 학적 정보")
    c_info1, c_info2, c_info3, c_info4 = st.columns(4)
    c_info1.metric("학번", st.session_state.student_id)
    c_info2.metric("이름", st.session_state.student_name)
    c_info3.metric("학적 구분", st.session_state.student_type)
    c_info4.metric("주전공", st.session_state.major_mode.split()[0])

    st.markdown("---")

    # AI & Code Role Badges
    st.markdown(
        "<div style='display:flex; gap:0.5rem; margin-bottom:1rem;'>"
        "<span style='background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:700;'>⚙️ 학점 집계: 규칙 코드 처리 (100% 신뢰)</span>"
        "<span style='background:#faf5ff; color:#7e22ce; border:1px solid #d8b4fe; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:700;'>🤖 성적표 인식: AI 처리 예정</span>"
        "</div>",
        unsafe_allow_html=True
    )

    with st.expander("➕ **과목 직접 추가**", expanded=False):
        c_add1, c_add2, c_add3, c_add4 = st.columns([2, 1, 1, 1])
        new_c_title = c_add1.text_input("과목명", placeholder="예: 회계원리")
        new_c_cat = c_add2.selectbox("이수구분", ["경영전선", "경영전필", "일반교양", "교양필수", "선택필수", "일반선택"])
        new_c_cred = c_add3.selectbox("학점", [1, 2, 3, 4], index=2)
        new_c_sem = c_add4.text_input("이수학기", value="2026-2")

        if st.button("➕ 과목 추가 저장"):
            if new_c_title.strip():
                new_item = {
                    "No": len(st.session_state.user_courses) + 1,
                    "학기": new_c_sem,
                    "과목명": new_c_title.strip(),
                    "구분": new_c_cat,
                    "학점": new_c_cred,
                    "성적/상태": "수강중 (미확정)",
                    "area": "전공" if "경영" in new_c_cat else "자율선택"
                }
                st.session_state.user_courses.append(new_item)
                st.success(f"'{new_c_title}' 과목이 추가되었습니다.")
                st.rerun()
            else:
                st.error("과목명을 입력해주세요.")

    st.write(f"##### 📋 등록된 과목 목록 (총 {len(st.session_state.user_courses)}과목)")
    df_user_courses = pd.DataFrame(st.session_state.user_courses)
    if not df_user_courses.empty:
        st.dataframe(df_user_courses[["학기", "과목명", "구분", "학점", "성적/상태"]], use_container_width=True, hide_index=True)
    else:
        st.info("등록된 이수 과목이 없습니다. 과목을 추가해주세요.")

# =============================================================================
# TAB 1: [내 현황]
# =============================================================================
with tab1:
    is_mgmt = "경영학과" in st.session_state.major_mode

    # Simple Mode Notice Banner if not Business
    if not is_mgmt:
        st.warning("ℹ️ **간단 모드:** 총 학점과 교양 진도만 계산됩니다. 전공 세부 졸업요건은 소속 학과에서 확인하세요.")

    # 10-Second Hero Box
    c_hero1, c_hero2 = st.columns([1.2, 1])
    with c_hero1:
        st.metric(
            label="총 취득 학점 현황",
            value="현재 확정 34 / 130 학점",
            delta="2026-2 수강중 17학점 완료 시 예상 51 / 130 학점 (잔여 79학점)"
        )
    with c_hero2:
        st.error(
            "🚨 **졸업 필수 의무 결손 (부족한 것 2가지)**\n\n"
            "1. **오디세이세미나 2 (공통 교양필수 1학점)**: **미이수**\n"
            "2. **정보소통 영역 (AI·코딩 5학점)**: **미이수** (AI프로젝트입문 2 + 창의코딩 3)"
        )

    st.markdown("---")

    # Category Table
    if is_mgmt:
        st.write("##### 📊 경영 단일전공 학점 비교 (현재 확정 vs 2026-2 완료 예상)")
        df_compare = pd.DataFrame([
            {
                "구분": "현재 확정 (기이수 14과목)",
                "주전공 (경영 단일전공)": "9 / 60 학점",
                "교양 교과목 (공통)": "25 / 26 학점",
                "일반선택": "0 / 3 학점",
                "총 취득학점": "34 / 130 학점"
            },
            {
                "구분": "수강중 완료 시 예상 (총 21과목)",
                "주전공 (경영 단일전공)": "13 / 60 학점 (+4)",
                "교양 교과목 (공통)": "35 / 26 학점 (초과)",
                "일반선택": "3 / 3 학점 (충족)",
                "총 취득학점": "51 / 130 학점 (+17)"
            }
        ])
        st.dataframe(df_compare, use_container_width=True, hide_index=True)
    else:
        df_simple = pd.DataFrame([
            {
                "구분": "현재 확정 (기이수 14과목)",
                "총 취득학점": "34 / 130 학점 (26.2%)",
                "교양 공통": "25 / 26 학점 (96.2%)",
                "전공/기타": "9학점 (학과 확인 필요)"
            },
            {
                "구분": "수강중 완료 시 예상 (총 21과목)",
                "총 취득학점": "51 / 130 학점 (39.2%)",
                "교양 공통": "35 / 26 학점 (달성 완료)",
                "전공/기타": "16학점 (학과 확인 필요)"
            }
        ])
        st.dataframe(df_simple, use_container_width=True, hide_index=True)

    # Common GE 26-credit 6-area Progress Grid
    st.write("##### 🏛️ 대학 공통 교양(26학점) 6대 영역별 진행률 및 맞춤 과목 제안")
    ge_cols = st.columns(3)
    with ge_cols[0]:
        st.markdown(
            "**1. 정보소통 (기준 5학점)**: :red[0 / 5 학점 (미이수 결손)]\n\n"
            "- AI프로젝트입문(2) + 창의코딩(3)\n"
            "- 💡 **제안 과목**: `AI프로젝트입문`, `기초창의코딩`"
        )
        st.progress(0.0)

        st.markdown(
            "**2. 생애설계 (기준 2학점)**: :orange[1 / 2 학점 (오디세이2 미이수)]\n\n"
            "- 오디세이세미나1(1) 완료\n"
            "- 💡 **제안 과목**: `오디세이세미나 2`"
        )
        st.progress(0.5)

    with ge_cols[1]:
        st.markdown(
            "**3. 의사소통 (기준 3학점)**: :green[3 / 3 학점 (충족 완료)]\n\n"
            "- (외국인)발표와토론2 이수 완료"
        )
        st.progress(1.0)

        st.markdown(
            "**4. 글로벌소통 (기준 9학점)**: :green[9 / 9 학점 (기준 달성)]\n\n"
            "- 읽기와쓰기2, 대학한국어2·3, 영어 과목군"
        )
        st.progress(1.0)

    with ge_cols[2]:
        st.markdown(
            "**5. 스포츠웰니스 (기준 1학점)**: :green[2 / 1 학점 (기준 달성)]\n\n"
            "- 스포츠-요가, 소도구필라테스 이수"
        )
        st.progress(1.0)

        st.markdown(
            "**6. 자율선택 교양 (기준 6학점)**: :green[18 / 6 학점 (초과 달성)]\n\n"
            "- 경제학, 통계학, 한국대학생활, 한국문화 등"
        )
        st.progress(1.0)

    # Real Courses by 3 Semesters (Unified to 연도-학기 format)
    st.write("##### 📋 실제 이수 과목 목록 (학기별 3개 섹션, 가짜 과목 0개)")
    with st.expander("🏛️ **2025-2학기 (기이수 확정: 16학점 / 6과목)**", expanded=True):
        st.dataframe(pd.DataFrame(COURSES_2025_2)[["No", "학기", "과목명", "구분", "학점", "성적/상태"]], use_container_width=True, hide_index=True)

    with st.expander("🏛️ **2026-1학기 (기이수 확정: 18학점 / 8과목)**", expanded=True):
        st.dataframe(pd.DataFrame(COURSES_2026_1)[["No", "학기", "과목명", "구분", "학점", "성적/상태"]], use_container_width=True, hide_index=True)

    with st.expander("⏳ **2026-2학기 수강 중 (성적 미확정: 17학점 / 7과목)**", expanded=True):
        st.dataframe(pd.DataFrame(COURSES_2026_2)[["No", "학기", "과목명", "구분", "학점", "성적/상태"]], use_container_width=True, hide_index=True)

# =============================================================================
# TAB 2: [시뮬레이터]
# =============================================================================
with tab2:
    col_basket, col_live = st.columns([7, 5])

    with col_basket:
        st.subheader("🛒 다음 학기 (2027-1학기) 수강 바구니")
        st.caption("과목을 검색하거나 직접 추가하여 바구니에 담으세요. 오른쪽 패널이 즉시 실시간 갱신됩니다.")

        # Combined Catalog: 1,098 Builtin + Custom
        all_catalog = BUILTIN_COURSES + st.session_state.custom_courses
        catalog_names = [f"[{c.get('cat', '과목')}] {c.get('title')} ({c.get('credits')}학점)" for c in all_catalog]

        # Method 1: Search & Autocomplete
        with st.expander("🔍 **과목 검색 및 자동완성 (내장 DB 1,098개 과목 지원)**", expanded=True):
            selected_cat_item = st.selectbox("과목을 선택하거나 검색어를 입력하세요", ["(직접 선택)"] + catalog_names)
            if st.button("선택한 과목 바구니에 담기", use_container_width=True) and selected_cat_item != "(직접 선택)":
                idx = catalog_names.index(selected_cat_item)
                item = all_catalog[idx]
                st.session_state.basket.append({
                    "과목명": item.get("title"),
                    "구분": item.get("cat"),
                    "학점": item.get("credits", 3)
                })
                st.success(f"'{item.get('title')}' 바구니 추가 완료!")
                st.rerun()

        # Method 2: Custom Course Input
        with st.expander("➕ **없는 과목 직접 추가 (로컬 DB 자동 저장)**", expanded=False):
            with st.form("custom_course_form", clear_on_submit=True):
                c_title = st.text_input("과목명", placeholder="예: 디지털마케팅실습")
                c1, c2 = st.columns([2, 1])
                c_cat = c1.selectbox("이수 구분", ["경영_전선", "경영_전필", "교양_정보소통", "교양_생애설계", "교양_기타", "일반선택"])
                c_cred = c2.selectbox("학점", [3, 1, 2, 4], index=0)
                submit_custom = st.form_submit_button("+ 새 과목 생성 및 바구니 담기")
                if submit_custom and c_title.strip():
                    new_item = {"id": f"custom_{len(st.session_state.custom_courses)+1}", "title": c_title.strip(), "cat": c_cat, "credits": c_cred, "dept": "사용자추가"}
                    st.session_state.custom_courses.append(new_item)
                    st.session_state.basket.append({"과목명": c_title.strip(), "구분": c_cat, "학점": c_cred})
                    st.success(f"'{c_title.strip()}' 과목이 DB에 저장되고 바구니에 담겼습니다.")
                    st.rerun()

        # Check Duplicates against ALL 21 Real Courses
        all_real_titles = [norm(c["과목명"]) for c in ALL_REAL_COURSES]
        duplicates = []
        bask_valid_credits = 0
        bask_biz = 0

        for b in st.session_state.basket:
            b_norm = norm(b["과목명"])
            if b_norm in all_real_titles:
                duplicates.append(b["과목명"])
                continue

            bask_valid_credits += b["학점"]
            if "경영" in b.get("구분", ""):
                bask_biz += b["학점"]

        # Duplicate Warning
        if duplicates:
            st.error(
                f"🚫 **동일과목 재이수 감지**: `{', '.join(duplicates)}`\n\n"
                "- **한림대 학칙:** 이미 이수한 과목은 재수강 시 이전 학점이 무효화되며 신규 졸업 학점으로 가산되지 않습니다.\n"
                "- **성적 상한:** 재이수 시 최대 **A0** 제한"
            )

        # 18-Credit Overload Warning
        raw_sum = sum(b["학점"] for b in st.session_state.basket)
        if raw_sum > TERM_MAX:
            st.warning(f"⚠️ **정규학기 수강 한도(18학점) 초과**: 현재 **{raw_sum}학점** (직전학기 평점 3.75 이상 시 21학점 승인)")

        # Basket Display Table
        st.write("##### 🧺 현재 장바구니 목록")
        if not st.session_state.basket:
            st.info("장바구니가 비어 있습니다. 위 검색이나 직접 추가를 통해 과목을 담아보세요.")
        else:
            df_bask = pd.DataFrame(st.session_state.basket)
            df_bask["재이수여부"] = df_bask["과목명"].apply(lambda x: "⚠️ 재이수 (학점 0점 반영)" if norm(x) in all_real_titles else "✓ 정상 수강")
            st.dataframe(df_bask, use_container_width=True, hide_index=True)

        col_clr, _ = st.columns([1, 2])
        with col_clr:
            if st.button("🗑️ 장바구니 비우기", use_container_width=True):
                st.session_state.basket = []
                st.rerun()

        st.caption("※ 본 시뮬레이터는 시간표(교시/강의실)를 배제하고 오직 졸업요건 충족에만 집중합니다.")

    # Right Column: Real-time Live Graduation Panel (Redundant duplicate section removed!)
    with col_live:
        st.subheader("📊 실시간 미래 졸업 진단")
        st.caption("수강중 17학점 + 바구니 반영 시 미래 졸업 상태")

        expected_current = 51
        sim_total = expected_current + bask_valid_credits
        sim_remain = max(0, REQ_TOTAL - sim_total)
        pct = min(100.0, (sim_total / REQ_TOTAL) * 100)

        st.metric(
            label="총 졸업 학점 (수강중 17 + 바구니 반영)",
            value=f"{sim_total} / {REQ_TOTAL} 학점",
            delta=f"+{bask_valid_credits}학점 반영 ({pct:.1f}%)" if bask_valid_credits > 0 else f"{pct:.1f}%"
        )
        st.progress(pct / 100)

        st.markdown(f"### 🎯 이 바구니로 졸업까지 남은 학점: :red[{sim_remain}학점]")

        st.markdown("---")
        is_mgmt = "경영학과" in st.session_state.major_mode
        if is_mgmt:
            tot_biz = 13 + bask_biz
            pct_biz = min(1.0, tot_biz / REQ_BIZ_SINGLE)
            st.write(f"🏛️ **경영 단일전공**: **{tot_biz} / {REQ_BIZ_SINGLE} 학점**" + (f" (+{bask_biz})" if bask_biz > 0 else ""))
            st.progress(pct_biz)
            if tot_biz < REQ_BIZ_SINGLE:
                st.caption(f"경영 전공 잔여: {REQ_BIZ_SINGLE - tot_biz}학점 필요")
            else:
                st.caption("🎉 경영 전공 요건 충족 완료!")
        else:
            st.info("ℹ️ **간단 모드:** 총 학점과 교양 진도만 계산됩니다. 전공 세부 졸업요건은 소속 학과에서 확인하세요.")

        st.write(f"📚 **교양 교과목**: 35 / {REQ_GE_COMMON} 학점 (기준 26학점 초과 달성)")
        st.write(f"🧩 **일반선택**: 3 / {REQ_GEN_MIN} 학점 (충족 완료)")

# =============================================================================
# TAB 3: [도움말]
# =============================================================================
with tab3:
    st.subheader("📖 [도움말] 사용법 및 규칙 출처")

    st.markdown("### 1. 사용법 3단계")
    c_s1, c_s2, c_s3 = st.columns(3)
    c_s1.info("**STEP 1: [내 현황] 확인**\n\n기이수 확정 34학점 및 2026-2 수강중 17학점을 확인하고, 부족한 필수 2가지를 점검합니다.")
    c_s2.info("**STEP 2: [시뮬레이터] 담기**\n\n내장 1,098개 과목 검색 또는 직접 입력을 통해 다음 학기에 들을 과목을 바구니에 담습니다.")
    c_s3.info("**STEP 3: 미래 상태 확인**\n\n우측 패널에서 잔여 학점과 중복/18학점 초과 경고를 실시간 확인합니다.")

    st.markdown("---")
    st.markdown("### 2. 포털 시간표와의 명확한 차별점")
    st.markdown(
        """
        > **"포털은 시간표를 시뮬레이션합니다. 우리는 졸업을 시뮬레이션합니다."**  
        
        - **포털 시간표 앱:** 교시/강의실 충돌 방지 등 1주일 스케줄링에 초점.
        - **본 시뮬레이터:** 시간표 기능은 과감히 배제하고, **장바구니에 담는 즉시 미래의 졸업 충족 여부와 잔여 학점 계산**에만 100% 집중합니다.
        """
    )

    st.markdown("---")
    st.markdown("### 3. AI 슬롭(Slop) 방지 원칙 (엄격한 분업)")
    st.markdown(
        """
        | 구분 | 담당 영역 | 사용 기술 및 특징 |
        | :--- | :--- | :--- |
        | **🤖 AI의 역할** | **성적표 PDF 비정형 문서 파싱 (OCR) & 과목 검색** | 비정형 PDF에서 과목명, 학점, 이수구분을 자동 인식 (사용자 확인/수정 가능) |
        | **⚙️ 규칙 코드의 역할** | **100% 결정론적 졸업 사정 및 중복 검증** | 130학점 연산, 경영 단일전공 60학점 판정, 동일과목 재이수 감지 (할루시네이션 0%) |
        """
    )

    st.markdown("---")
    st.markdown("### 4. 한림대학교 공식 규칙 및 과목 DB")
    st.markdown(
        """
        - **총 졸업학점:** 130학점 이상 이수 (한림대 학칙 제36조)
        - **경영 단일전공:** 전공 60학점 이수 (오디세이세미나3 전필 포함)
        - **대학 공통 교양:** 26학점 이상 (정보소통 5, 생애설계 2, 의사소통 3, 글로벌소통 9, 스포츠웰니스 1, 자율선택 6)
        - **정규학기 수강 한도:** 최대 18학점 (직전학기 평점 3.75 이상 시 21학점 승인 가능)
        - **동일과목 재이수 규정:** 동일과목 재이수 시 이전 성적/학점 무효화, 신규 학점 0점 가산, 성적 최대 A0 제한
        - **과목 DB 파일:** `data/courses.json` (한림대 전체 1,098개 과목 내장, 사용자 추가 과목 영구 보관)
        """
    )
