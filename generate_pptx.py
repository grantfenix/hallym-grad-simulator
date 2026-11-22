#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Hallym Graduation Simulator 12-Slide Presentation (.pptx)
Complies strictly with:
- 16:9 widescreen layout
- 8 high-res screenshots from scrins/ (image (1).png ~ image (8).png)
- Clean typography, professional styling (navy/sky blue/slate)
- No overclaiming words ('100%', '완벽', '보장')
- Demo password completely masked/excluded
- Slide structure: Title, Key message (<= 3 lines), Image(s), Short caption
"""

import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SCRINS_DIR = os.path.join(BASE_DIR, "scrins")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
PPTX_ROOT_PATH = os.path.join(BASE_DIR, "hallym_grad_simulator_presentation.pptx")
PPTX_DOCS_PATH = os.path.join(DOCS_DIR, "hallym_grad_simulator_presentation.pptx")

# Color Palette
COLOR_NAVY = RGBColor(15, 23, 42)       # #0f172a Deep Navy
COLOR_SKY = RGBColor(2, 132, 199)       # #0284c7 Sky/Brand Blue
COLOR_ACCENT = RGBColor(14, 165, 233)   # #0ea5e9 Cyan/Sky Accent
COLOR_SLATE_DARK = RGBColor(51, 65, 85) # #334155 Body Text
COLOR_MUTED = RGBColor(100, 116, 139)   # #64748b Caption & Muted
COLOR_CARD_BG = RGBColor(248, 250, 252) # #f8fafc Card Background
COLOR_BORDER = RGBColor(226, 232, 240)  # #e2e8f0 Border
COLOR_GREEN = RGBColor(16, 185, 129)    # #10b981 Success
COLOR_WHITE = RGBColor(255, 255, 255)

FONT_HEADING = "Malgun Gothic"
FONT_BODY = "Malgun Gothic"

def create_presentation():
    prs = Presentation()
    # 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # Blank slide layout

    def add_header(slide, title_text, category_tag, slide_num):
        # Top accent bar
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.1))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = COLOR_SKY
        top_bar.line.fill.background()

        # Category tag
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(8.0), Inches(0.3))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = category_tag.upper()
        p_tag.font.name = FONT_HEADING
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_SKY

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.65), Inches(10.0), Inches(0.6))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = FONT_HEADING
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_NAVY

        # Slide Number
        num_box = slide.shapes.add_textbox(Inches(11.5), Inches(0.4), Inches(1.2), Inches(0.4))
        tf_num = num_box.text_frame
        p_num = tf_num.paragraphs[0]
        p_num.text = f"{slide_num:02d} / 12"
        p_num.alignment = PP_ALIGN.RIGHT
        p_num.font.name = FONT_HEADING
        p_num.font.size = Pt(11)
        p_num.font.color.rgb = COLOR_MUTED

        # Subtle divider
        divider = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.015))
        divider.fill.solid()
        divider.fill.fore_color.rgb = COLOR_BORDER
        divider.line.fill.background()

    def add_key_points_box(slide, left, top, width, height, points):
        """Adds a card container with key message points (up to 3 items)."""
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD_BG
        card.line.color.rgb = COLOR_BORDER
        card.line.width = Pt(1)

        tx_box = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.15), width - Inches(0.4), height - Inches(0.3))
        tf = tx_box.text_frame
        tf.word_wrap = True

        for i, (tag, text) in enumerate(points):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(12)
            p.line_spacing = 1.25

            # Tag
            run_tag = p.add_run()
            run_tag.text = f"• [{tag}] "
            run_tag.font.name = FONT_HEADING
            run_tag.font.bold = True
            run_tag.font.size = Pt(13)
            run_tag.font.color.rgb = COLOR_NAVY

            # Text
            run_text = p.add_run()
            run_text.text = text
            run_text.font.name = FONT_BODY
            run_text.font.size = Pt(13)
            run_text.font.color.rgb = COLOR_SLATE_DARK

    def add_image_with_caption(slide, img_name, left, top, width, height, caption_text):
        img_path = os.path.join(SCRINS_DIR, img_name)
        if os.path.exists(img_path):
            img_shape = slide.shapes.add_picture(img_path, left, top, width, height)
            img_shape.line.color.rgb = COLOR_BORDER
            img_shape.line.width = Pt(1)
        else:
            print(f"[WARN] Image not found: {img_path}")

        # Caption
        if caption_text:
            cap_box = slide.shapes.add_textbox(left, top + height + Inches(0.08), width, Inches(0.35))
            tf_cap = cap_box.text_frame
            tf_cap.word_wrap = True
            p_cap = tf_cap.paragraphs[0]
            p_cap.text = caption_text
            p_cap.alignment = PP_ALIGN.CENTER
            p_cap.font.name = FONT_BODY
            p_cap.font.size = Pt(10)
            p_cap.font.color.rgb = COLOR_MUTED

    print("Building 12 slides for Hallym Graduation Simulator...")

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide (표지)
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_layout)
    top_bar1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.15))
    top_bar1.fill.solid()
    top_bar1.fill.fore_color.rgb = COLOR_SKY
    top_bar1.line.fill.background()

    # Left content
    title_box1 = slide1.shapes.add_textbox(Inches(0.8), Inches(1.0), Inches(6.8), Inches(3.5))
    tf1 = title_box1.text_frame
    tf1.word_wrap = True

    p0 = tf1.paragraphs[0]
    p0.text = "HALLYM GRADUATION SIMULATOR"
    p0.font.name = FONT_HEADING
    p0.font.size = Pt(13)
    p0.font.bold = True
    p0.font.color.rgb = COLOR_SKY
    p0.space_after = Pt(8)

    p1 = tf1.add_paragraph()
    p1.text = "한림 수강 바구니 +\n졸업 시뮬레이터"
    p1.font.name = FONT_HEADING
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_NAVY
    p1.space_after = Pt(16)
    p1.line_spacing = 1.15

    points_cover = [
        ("슬로건", "포털은 시간표를 시뮬레이션합니다. 우리는 졸업을 시뮬레이션합니다."),
        ("사전 예측", "과목을 바구니에 담는 즉시 130학점 달성도와 이수 요건을 실시간 판정"),
        ("프로젝트", "2026학년도 2학기 경영과 인공지능 (발표자: 유아미)")
    ]
    for tag, txt in points_cover:
        p_pt = tf1.add_paragraph()
        p_pt.space_after = Pt(8)
        r_tag = p_pt.add_run()
        r_tag.text = f"• [{tag}] "
        r_tag.font.bold = True
        r_tag.font.size = Pt(13)
        r_tag.font.color.rgb = COLOR_SKY
        r_txt = p_pt.add_run()
        r_txt.text = txt
        r_txt.font.size = Pt(13)
        r_txt.font.color.rgb = COLOR_SLATE_DARK

    p_url = tf1.add_paragraph()
    p_url.space_before = Pt(12)
    r_url = p_url.add_run()
    r_url.text = "🌐 배포 주소: https://grantfenix.github.io/hallym-grad-simulator/"
    r_url.font.size = Pt(11)
    r_url.font.color.rgb = COLOR_MUTED

    # Right: Desktop (image 3) + Mobile mockup (image 6)
    add_image_with_caption(
        slide1, "image (3).png",
        Inches(7.8), Inches(1.3), Inches(4.8), Inches(3.4),
        "데스크톱 실시간 수강 바구니 및 졸업 진단 뷰"
    )
    add_image_with_caption(
        slide1, "image (6).png",
        Inches(6.8), Inches(3.2), Inches(1.8), Inches(3.6),
        "모바일 최적화 뷰"
    )

    # -------------------------------------------------------------
    # SLIDE 2: 프로젝트 개요 (Executive Summary)
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "프로젝트 개요: 기획 배경 및 핵심 가치", "01. Executive Summary", 2)
    add_key_points_box(
        slide2, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("문제 배경", "매 학기 시간표만 맞추다 졸업 직전 필수 학점 누락으로 고통받는 학생들의 고질적 문제 해결"),
            ("사전 예측", "수강 바구니에 과목을 담는 즉시 130학점 달성도와 졸업 가능 여부를 사전에 정밀하게 검증"),
            ("핵심 엔진", "1,098개 최신 교과목 DB와 학적별 규칙 기반 실시간 진단 엔진 탑재 (무설치 웹 환경)")
        ]
    )
    add_image_with_caption(
        slide2, "image (3).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "1,098개 교과목 실시간 검색 및 수강 바구니 시뮬레이터 인터페이스"
    )

    # -------------------------------------------------------------
    # SLIDE 3: 문제 정의 (Problem Statement)
    # -------------------------------------------------------------
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "문제 정의: 포털 수강신청과 졸업 사정의 간극", "02. Problem Statement", 3)
    add_key_points_box(
        slide3, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("사후 확인 한계", "기존 한림대 포털은 수강 신청 후 사후 조회만 제공하여 계획 단계의 사전 검증 불가"),
            ("복잡한 학칙 요건", "교양 1~7영역, 전공 트랙 등 복잡한 요건으로 학생 스스로 졸업 가능 여부를 확신하기 어려움"),
            ("사전 시뮬레이션 부재", "과목을 수강했을 때 졸업에 미치는 영향을 즉각 알려주는 직관적인 도구의 부재")
        ]
    )
    add_image_with_caption(
        slide3, "image (4).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "한림대 종합정보시스템(사후 확인) vs 본 시뮬레이터(사전 예측) 핵심 차별점 비교표"
    )

    # -------------------------------------------------------------
    # SLIDE 4: 해결 방안 (Solution & System Concept)
    # -------------------------------------------------------------
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(slide4, "해결 방안: 사후 점검에서 사전 예측으로의 패러다임 전환", "03. Solution Concept", 4)
    add_key_points_box(
        slide4, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("담기 (Pick)", "1,098개 최신 교과목 검색 후 원클릭으로 가상 수강 바구니에 추가"),
            ("판정 (Rule)", "전공/교양 1~7영역 자동 분류 및 규칙 기반 학칙 기준 실시간 계산"),
            ("진단 (Action)", "130학점 달성도, 잔여 학점, Top 3 부족 요건을 1페이지로 시각화하여 행동 지침 제공")
        ]
    )
    add_image_with_caption(
        slide4, "image (3).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "과목 선택 즉시 130학점 달성률과 부족 요건이 갱신되는 실시간 피드백 루프"
    )

    # -------------------------------------------------------------
    # SLIDE 5: 핵심 기능 ①: 학생 맞춤형 학적 관리
    # -------------------------------------------------------------
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(slide5, "핵심 기능 ①: 학생 맞춤형 학적 프로필 관리", "04. Core Features", 5)
    add_key_points_box(
        slide5, Inches(0.8), Inches(1.65), Inches(4.3), Inches(5.1),
        [
            ("학적 유형 지원", "일반재학생, 편입생(전적대 학점 인정), 외국인 유학생(한국어 요건) 학적별 맞춤 요건 지원"),
            ("차등 요건 매핑", "입학년도(2021~2026), 이수 학기(1~8학기), 전공 트랙별 차등 졸업 기준 자동 분기"),
            ("개인정보 보호", "브라우저 로컬 암호화 저장소 활용 및 공용 PC 보안 세션 옵션 기본 탑재")
        ]
    )
    add_image_with_caption(
        slide5, "image (1).png",
        Inches(5.3), Inches(1.65), Inches(5.1), Inches(4.8),
        "[내 정보] 탭: 학적 정보 및 기이수 과목 현황"
    )
    add_image_with_caption(
        slide5, "image (5).png",
        Inches(10.6), Inches(1.65), Inches(2.0), Inches(4.8),
        "학적 선택 모달 팝업"
    )

    # -------------------------------------------------------------
    # SLIDE 6: 핵심 기능 ②: 과목 검색 및 예측형 장바구니
    # -------------------------------------------------------------
    slide6 = prs.slides.add_slide(blank_layout)
    add_header(slide6, "핵심 기능 ②: 과목 검색 및 예측형 장바구니", "04. Core Features", 6)
    add_key_points_box(
        slide6, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("실시간 검색", "1,098개 교과목 즉시 검색 (과목명, 코드, 이수구분, 학점 실시간 필터링)"),
            ("플로팅 바", "화면 하단 고정 바를 통해 현재 선택 학점(예: 3학점)을 스크롤 중에도 상시 확인"),
            ("중복 방지", "이미 이수한 과목과의 중복 수강을 사전에 감지하여 수강 계획 오류 원천 방지")
        ]
    )
    add_image_with_caption(
        slide6, "image (3).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "1,098개 과목 라이브 검색 및 화면 하단 플로팅 장바구니 바 연동 뷰"
    )

    # -------------------------------------------------------------
    # SLIDE 7: 핵심 기능 ③: 교양 영역별 자동 매핑 및 결손 감지
    # -------------------------------------------------------------
    slide7 = prs.slides.add_slide(blank_layout)
    add_header(slide7, "핵심 기능 ③: 교양 영역별 자동 매핑 및 결손 감지", "04. Core Features", 7)
    add_key_points_box(
        slide7, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("자동 영역 매핑", "교양 1~7영역(글로벌, 인문, 사회, 자연 등) 이수 과목을 규칙 기반으로 자동 분류"),
            ("Top 3 결손 진단", "복잡한 교양 이수 규칙 중 가장 시급히 보완해야 할 결손 영역 3가지를 우선 도출"),
            ("실시간 동적 해소", "바구니에 과목을 담거나 뺄 때마다 결손 알림이 즉각 해소되는 시각적 반응성")
        ]
    )
    add_image_with_caption(
        slide7, "image (2).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "교양 1~7영역 이수 현황 분석 및 긴급 보완 과제 우선 권고 시스템"
    )

    # -------------------------------------------------------------
    # SLIDE 8: 핵심 기능 ④: 1페이지 졸업 진단서 (Executive Summary)
    # -------------------------------------------------------------
    slide8 = prs.slides.add_slide(blank_layout)
    add_header(slide8, "핵심 기능 ④: 1페이지 졸업 진단 요약서", "04. Core Features", 8)
    add_key_points_box(
        slide8, Inches(0.8), Inches(1.65), Inches(5.0), Inches(5.1),
        [
            ("단일 화면 요약", "총 취득 학점(130학점 기준), 전공 학점, 교양 영역 이수 상태를 1화면에 명확히 집약"),
            ("직관적 상태 판정", "정상, 주의, 위험 등급 판정과 시각적 프로그레스 바로 달성도를 한눈에 파악"),
            ("이수 로드맵 지원", "다음 학기에 우선적으로 수강해야 할 영역을 명시하여 학생 주도적 계획 수립 지원")
        ]
    )
    add_image_with_caption(
        slide8, "image (2).png",
        Inches(6.1), Inches(1.65), Inches(6.4), Inches(4.8),
        "졸업 판정 상태, 총 취득 학점(51/130), 잔여 학점을 집약한 Executive Summary 리포트"
    )

    # -------------------------------------------------------------
    # SLIDE 9: 모바일 최적화 쇼케이스 (Mobile Usability)
    # -------------------------------------------------------------
    slide9 = prs.slides.add_slide(blank_layout)
    add_header(slide9, "모바일 최적화: 언제 어디서나 스마트폰으로 진단", "05. Mobile Usability", 9)
    add_key_points_box(
        slide9, Inches(0.8), Inches(1.65), Inches(4.4), Inches(5.1),
        [
            ("모바일 전용 UI", "56px 초슬림 Sticky Header 및 44px 이상 터치 타깃으로 작은 화면에서도 쾌적한 조작"),
            ("수평 스크롤 방지", "360px 모바일 화면에서도 모든 테이블과 카드가 화면 폭을 넘지 않는 반응형 레이아웃"),
            ("현장 활용성", "수강신청 당일 PC 앞이 아니더라도 스마트폰을 통해 즉시 졸업 시뮬레이션 가능")
        ]
    )
    # 3 mobile mockups side by side: 6, 8, 7
    m_w = Inches(2.3)
    m_h = Inches(4.8)
    add_image_with_caption(
        slide9, "image (6).png",
        Inches(5.5), Inches(1.65), m_w, m_h,
        "① 56px 슬림 헤더"
    )
    add_image_with_caption(
        slide9, "image (8).png",
        Inches(8.1), Inches(1.65), m_w, m_h,
        "② 실시간 진단 게이지"
    )
    add_image_with_caption(
        slide9, "image (7).png",
        Inches(10.7), Inches(1.65), m_w, m_h,
        "③ 시스템 안내 카드"
    )

    # -------------------------------------------------------------
    # SLIDE 10: 시스템 아키텍처 (Technical Architecture)
    # -------------------------------------------------------------
    slide10 = prs.slides.add_slide(blank_layout)
    add_header(slide10, "시스템 구조: 가볍고 안전한 클라이언트 기반 아키텍처", "06. Architecture", 10)
    add_key_points_box(
        slide10, Inches(0.8), Inches(1.65), Inches(6.0), Inches(5.1),
        [
            ("무설치 경량 구조", "HTML5, CSS3, Vanilla JS 기반으로 별도 앱 설치나 플러그인 없이 즉시 브라우저 실행"),
            ("로컬 고속 연산", "별도 백엔드 서버 없이 브라우저 내부에서 1,098개 과목을 처리하여 지연 없는 반응성 제공"),
            ("명확한 역할 분담", "비정형 데이터 인식은 AI가 보조하고, 최종 졸업 판정은 결정론적 규칙 엔진이 전담하여 결과의 일관성 유지")
        ]
    )
    add_image_with_caption(
        slide10, "image (7).png",
        Inches(7.2), Inches(1.65), Inches(2.4), Inches(4.8),
        "AI OCR vs 규칙 엔진 역할 분담 체계"
    )
    # Right text note
    note_box10 = slide10.shapes.add_textbox(Inches(9.9), Inches(1.65), Inches(2.6), Inches(4.8))
    tf_n10 = note_box10.text_frame
    tf_n10.word_wrap = True
    pn1 = tf_n10.paragraphs[0]
    pn1.text = "💡 아키텍처 설계 원칙"
    pn1.font.bold = True
    pn1.font.size = Pt(13)
    pn1.font.color.rgb = COLOR_NAVY
    pn1.space_after = Pt(10)

    pn2 = tf_n10.add_paragraph()
    pn2.text = "1. 결정론적 규칙 엔진\n- 학칙 기반 130학점 및 전공/교양 판정의 일관된 결과 보장\n\n2. 데이터 안전성\n- 로컬 저장소 용량 초과 방지 및 손상 데이터 자동 복구 핸들러 탑재\n\n3. 공용 환경 보호\n- 관리자 인증 후 데모 모드 체험 가능 및 브라우저 종료 시 세션 보호"
    pn2.font.size = Pt(11)
    pn2.font.color.rgb = COLOR_SLATE_DARK
    pn2.line_spacing = 1.2

    # -------------------------------------------------------------
    # SLIDE 11: 품질 검증 및 신뢰도 (15개 전체 테스트 통과)
    # -------------------------------------------------------------
    slide11 = prs.slides.add_slide(blank_layout)
    add_header(slide11, "품질 검증: 15개 테스트 스위트 전체 통과", "07. Quality Assurance", 11)
    add_key_points_box(
        slide11, Inches(0.8), Inches(1.65), Inches(4.8), Inches(5.1),
        [
            ("15개 전 테스트 통과", "학점 계산, 편입생/유학생 특수 규칙, 모바일 반응형 터치 규격 등 15개 스위트 전체 통과 (15/15 PASS)"),
            ("예외 및 안정성 검증", "스토리지 초과(QuotaExceededError) 방어 및 손상 데이터 자동 초기화 가드레일 입증"),
            ("상시 회귀 테스트", "기능 추가 및 작은 개선 후에도 회귀 테스트를 상시 수행하여 지속적인 신뢰성 유지")
        ]
    )

    # 15 Test Suite Table on the right
    rows = 16
    cols = 3
    table_shape = slide11.shapes.add_table(rows, cols, Inches(5.9), Inches(1.65), Inches(6.6), Inches(5.1))
    table = table_shape.table
    table.columns[0].width = Inches(1.5)
    table.columns[1].width = Inches(4.1)
    table.columns[2].width = Inches(1.0)

    headers = ["테스트 범주", "검증 스위트 명칭", "결과"]
    for c_idx, h_text in enumerate(headers):
        cell = table.cell(0, c_idx)
        cell.text = h_text
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_NAVY
        p = cell.text_frame.paragraphs[0]
        p.font.name = FONT_HEADING
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = COLOR_WHITE
        p.alignment = PP_ALIGN.CENTER

    test_data = [
        ("계산 엔진", "test_full_suite.js (학점/판정 기본 통합)", "PASS"),
        ("계산 엔진", "test_basket_plan_summary.js (바구니 요약)", "PASS"),
        ("계산 엔진", "test_diagnosis_tiers.js (정상/주의/위험 등급)", "PASS"),
        ("학적 요건", "test_special_student_types.js (편입/유학생)", "PASS"),
        ("학적 요건", "test_quick_fill_sample.js (샘플 로드)", "PASS"),
        ("보안/안정성", "test_storage_guardrail.js (스토리지 가드)", "PASS"),
        ("보안/안정성", "test_mobile_and_demo_protection.js (세션)", "PASS"),
        ("보안/안정성", "test_demo_name.js (데모 프로필 안전)", "PASS"),
        ("인터페이스", "test_floating_basket_bar.js (플로팅 바)", "PASS"),
        ("인터페이스", "test_filter_split.js (과목 필터)", "PASS"),
        ("인터페이스", "test_ge_accordion.js (교양 아코디언)", "PASS"),
        ("인터페이스", "test_help_tab_dynamic.js (도움말 연동)", "PASS"),
        ("인터페이스", "test_print_export.js (출력 최적화)", "PASS"),
        ("인터페이스", "test_footer.js (푸터 및 정보)", "PASS"),
        ("사용자경험", "test_ux_features.js (터치/가독성 5대 개선)", "PASS"),
    ]

    for r_idx, (cat, name, res) in enumerate(test_data):
        row_idx = r_idx + 1
        c0 = table.cell(row_idx, 0)
        c0.text = cat
        c0.text_frame.paragraphs[0].font.size = Pt(9)
        c0.text_frame.paragraphs[0].font.name = FONT_BODY

        c1 = table.cell(row_idx, 1)
        c1.text = name
        c1.text_frame.paragraphs[0].font.size = Pt(9)
        c1.text_frame.paragraphs[0].font.name = FONT_BODY

        c2 = table.cell(row_idx, 2)
        c2.text = res
        p_res = c2.text_frame.paragraphs[0]
        p_res.font.size = Pt(9)
        p_res.font.bold = True
        p_res.font.color.rgb = COLOR_GREEN
        p_res.alignment = PP_ALIGN.CENTER

    # -------------------------------------------------------------
    # SLIDE 12: 배포 성과, 향후 로드맵 & 핵심 결론
    # -------------------------------------------------------------
    slide12 = prs.slides.add_slide(blank_layout)
    add_header(slide12, "배포 성과, 로드맵 & 핵심 결론", "08. Roadmap & Conclusion", 12)

    # Left: 3 Core Message Sentences for presentation
    msg_box = slide12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.65), Inches(6.0), Inches(5.1))
    msg_box.fill.solid()
    msg_box.fill.fore_color.rgb = COLOR_CARD_BG
    msg_box.line.color.rgb = COLOR_BORDER
    msg_box.line.width = Pt(1)

    tf_msg = slide12.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.6), Inches(4.8)).text_frame
    tf_msg.word_wrap = True

    p_h = tf_msg.paragraphs[0]
    p_h.text = "📢 발표용 핵심 메시지 3문장"
    p_h.font.name = FONT_HEADING
    p_h.font.size = Pt(15)
    p_h.font.bold = True
    p_h.font.color.rgb = COLOR_NAVY
    p_h.space_after = Pt(14)

    msg_items = [
        ("문제", "학생들은 수강신청 때마다 포털의 복잡한 기준 때문에 졸업 요건을 스스로 확신하지 못했습니다."),
        ("해결", "과목을 담는 즉시 130학점과 영역별 이수 여부를 검증하는 클라이언트 기반 시뮬레이터를 개발했습니다."),
        ("결과", "15개 테스트 스위트로 신뢰성을 검증하고, 스마트폰에서도 확인 가능한 실용적 솔루션을 완성했습니다.")
    ]
    for tag, text in msg_items:
        p_item = tf_msg.add_paragraph()
        p_item.space_after = Pt(12)
        p_item.line_spacing = 1.25
        r_t = p_item.add_run()
        r_t.text = f"[{tag}] "
        r_t.font.bold = True
        r_t.font.size = Pt(12)
        r_t.font.color.rgb = COLOR_SKY
        r_m = p_item.add_run()
        r_m.text = text
        r_m.font.size = Pt(12)
        r_m.font.color.rgb = COLOR_SLATE_DARK

    # Right: Roadmap & Deployment
    road_box = slide12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.1), Inches(1.65), Inches(5.4), Inches(5.1))
    road_box.fill.solid()
    road_box.fill.fore_color.rgb = COLOR_WHITE
    road_box.line.color.rgb = COLOR_BORDER
    road_box.line.width = Pt(1)

    tf_road = slide12.shapes.add_textbox(Inches(7.3), Inches(1.8), Inches(5.0), Inches(4.8)).text_frame
    tf_road.word_wrap = True

    pr_h = tf_road.paragraphs[0]
    pr_h.text = "🚀 배포 성과 및 단계별 발전 계획"
    pr_h.font.name = FONT_HEADING
    pr_h.font.size = Pt(15)
    pr_h.font.bold = True
    pr_h.font.color.rgb = COLOR_NAVY
    pr_h.space_after = Pt(12)

    roadmap_items = [
        ("현재 배포", "GitHub Pages 무중단 실서비스 운영 중\nURL: https://grantfenix.github.io/hallym-grad-simulator/\n- 주요 5대 모바일 사용성 개선 반영 완료"),
        ("1단계 계획", "경영대학 세부 전공 트랙 심화 규칙 반영\n- 트랙별 차등 이수 과목 및 필수 지정 과목 판정\n- 트랙 1개씩 단계적 추가 및 15개 테스트 회귀 검증"),
        ("2단계 계획", "AI 챗봇 FAQ 및 RAG 학칙 질의응답 확장\n- 복잡한 예외 학칙을 자연어로 질의하고 답변받는 스마트 안내 어시스턴트 도입")
    ]
    for tag, desc in roadmap_items:
        p_r = tf_road.add_paragraph()
        p_r.space_after = Pt(10)
        p_r.line_spacing = 1.2
        r_tag = p_r.add_run()
        r_tag.text = f"📍 {tag}\n"
        r_tag.font.bold = True
        r_tag.font.size = Pt(12)
        r_tag.font.color.rgb = COLOR_NAVY
        r_desc = p_r.add_run()
        r_desc.text = desc
        r_desc.font.size = Pt(11)
        r_desc.font.color.rgb = COLOR_SLATE_DARK

    # Save to both paths
    prs.save(PPTX_ROOT_PATH)
    prs.save(PPTX_DOCS_PATH)
    print("SUCCESS: Presentation successfully generated!")
    print(f"  Root: {PPTX_ROOT_PATH} ({os.path.getsize(PPTX_ROOT_PATH)} bytes)")
    print(f"  Docs: {PPTX_DOCS_PATH} ({os.path.getsize(PPTX_DOCS_PATH)} bytes)")

if __name__ == "__main__":
    create_presentation()
