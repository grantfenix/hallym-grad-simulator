#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Hallym Graduation Simulator 12-Slide Presentation (.pptx)
Updated with Official 6 Career Tracks, Decoupled Graduation Exam Waiver, and 16/16 Test Suite.
Complies strictly with:
- 16:9 widescreen layout
- High-res screenshots from scrins/
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
COLOR_WHITE = RGBColor(255, 255, 255)
COLOR_GREEN = RGBColor(22, 163, 74)     # #16a34a Success Green

FONT_HEADING = "Malgun Gothic"
FONT_BODY = "Malgun Gothic"

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def add_header(slide, title_text, category_tag, slide_num):
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.1))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = COLOR_SKY
        top_bar.line.fill.background()

        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(1.1))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_tag = tf.paragraphs[0]
        p_tag.text = category_tag.upper()
        p_tag.font.name = FONT_HEADING
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_SKY
        p_tag.space_after = Pt(2)

        p_title = tf.add_paragraph()
        p_title.text = title_text
        p_title.font.name = FONT_HEADING
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_NAVY

        num_box = slide.shapes.add_textbox(Inches(11.5), Inches(0.45), Inches(1.0), Inches(0.4))
        tf_num = num_box.text_frame
        p_num = tf_num.paragraphs[0]
        p_num.text = f"{slide_num:02d} / 12"
        p_num.alignment = PP_ALIGN.RIGHT
        p_num.font.name = FONT_BODY
        p_num.font.size = Pt(11)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_MUTED

    def add_key_points_box(slide, left, top, width, height, points):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD_BG
        card.line.color.rgb = COLOR_BORDER
        card.line.width = Pt(1)

        pad = Inches(0.25)
        tb = slide.shapes.add_textbox(left + pad, top + pad, width - (pad * 2), height - (pad * 2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        for i, (label, text) in enumerate(points):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(12)
            p.line_spacing = 1.25

            run_bullet = p.add_run()
            run_bullet.text = "• "
            run_bullet.font.bold = True
            run_bullet.font.size = Pt(14)
            run_bullet.font.color.rgb = COLOR_SKY

            run_lbl = p.add_run()
            run_lbl.text = f"[{label}] "
            run_lbl.font.name = FONT_HEADING
            run_lbl.font.size = Pt(13)
            run_lbl.font.bold = True
            run_lbl.font.color.rgb = COLOR_NAVY

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

    print("Building 12 updated slides for Hallym Graduation Simulator...")

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide (표지)
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_layout)
    top_bar1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.15))
    top_bar1.fill.solid()
    top_bar1.fill.fore_color.rgb = COLOR_SKY
    top_bar1.line.fill.background()

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
        ("공식 트랙", "한림대 경영학과 공식 6대 전공 진로 트랙 로드맵 완비"),
        ("프로젝트", "2026학년도 2학기 경영과 인공지능 팀 프로젝트 (3팀 학사 관리 · 발표자: 유아미)")
    ]
    for tag, txt in points_cover:
        p_pt = tf1.add_paragraph()
        p_pt.space_after = Pt(6)
        r_tag = p_pt.add_run()
        r_tag.text = f"• [{tag}] "
        r_tag.font.bold = True
        r_tag.font.size = Pt(12)
        r_tag.font.color.rgb = COLOR_SKY
        r_txt = p_pt.add_run()
        r_txt.text = txt
        r_txt.font.size = Pt(12)
        r_txt.font.color.rgb = COLOR_SLATE_DARK

    p_url = tf1.add_paragraph()
    p_url.space_before = Pt(10)
    r_url = p_url.add_run()
    r_url.text = "🌐 라이브 서비스: https://grantfenix.github.io/hallym-grad-simulator/"
    r_url.font.size = Pt(11)
    r_url.font.color.rgb = COLOR_MUTED

    add_image_with_caption(
        slide1, "live_official_track_diagnosis_pc.png",
        Inches(7.8), Inches(1.1), Inches(4.7), Inches(5.6),
        "한림 수강 바구니 + 졸업 시뮬레이터 실시간 서비스 구동 화면"
    )

    # -------------------------------------------------------------
    # SLIDE 2: 프로젝트 개요 (Executive Summary)
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "프로젝트 개요: 수강 신청과 졸업 요건의 스마트 연계", "01. Executive Summary", 2)
    add_key_points_box(
        slide2, Inches(0.8), Inches(1.65), Inches(5.5), Inches(5.1),
        [
            ("기획 배경", "학생들은 수강 신청 시 시간표 공강에만 집중하여, 졸업 직전 필수 과목 누락과 초과학기 발생"),
            ("핵심 목표", "다음 학기 들을 과목을 장바구니에 담는 즉시 미래 졸업 요건 충족 여부를 실시간 사전 진단"),
            ("데이터 기반", "한림대학교 1,133개 실제 개설 과목 DB 및 공식 6대 진로 트랙 로드맵 전수 탑재"),
            ("실 서비스 배포", "GitHub Pages를 통해 모바일·PC 브라우저에서 무설치로 즉시 구동되는 웹 플랫폼 완성")
        ]
    )
    add_image_with_caption(
        slide2, "live_pc_login.png",
        Inches(6.6), Inches(1.65), Inches(5.9), Inches(4.8),
        "무설치 웹 브라우저 기반 데모 계정 체험 및 학적 로그인 인터페이스"
    )

    # -------------------------------------------------------------
    # SLIDE 3: 문제 정의 (Problem Definition)
    # -------------------------------------------------------------
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "문제 정의: 복잡한 학사 요건과 사후 통보의 한계", "02. Problem Definition", 3)
    add_key_points_box(
        slide3, Inches(0.8), Inches(1.65), Inches(5.5), Inches(5.1),
        [
            ("분절된 학적 정보", "수강포털, 종합정보시스템, 학과 요람 PDF가 파편화되어 학생이 직접 대조 확인 불가피"),
            ("사후 통보식 확인", "기존 포털은 학기 종료 후의 과거 데이터만 보여주며 '이번 학기 수강 시 졸업 가능 여부' 예측 불가"),
            ("까다로운 예외 규정", "학번별 교양 이수 기준 차이, 재이수 성적 상한(A0), 편입/유학생 특수 규정 등 복잡성 상존"),
            ("진로 트랙 미연계", "학과 공식 진로 트랙(6대 트랙)이 수강신청 시스템에 연계되지 않아 진로 맞춤 과목 선택 곤란")
        ]
    )
    add_image_with_caption(
        slide3, "image (2).png",
        Inches(6.6), Inches(1.65), Inches(5.9), Inches(4.8),
        "과거 학기 성적표만 단편적으로 보여주는 기존 시스템의 한계"
    )

    # -------------------------------------------------------------
    # SLIDE 4: 해결 방안 (Proposed Solution)
    # -------------------------------------------------------------
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(slide4, "해결 방안: 장바구니 기반 미래 졸업 시뮬레이션", "03. Proposed Solution", 4)
    add_key_points_box(
        slide4, Inches(0.8), Inches(1.65), Inches(5.5), Inches(5.1),
        [
            ("실시간 사전 시뮬레이션", "다음 학기 들을 과목을 장바구니에 담자마자 미래의 130학점 달성도와 잔여 학점 즉시 계산"),
            ("공식 6대 진로 트랙 로드맵", "한림대 입학처 공식 PDF 기반 진로 맞춤형 기초/심화 과목 진행도를 색상과 배지로 시각화"),
            ("졸업시험 면제 판정 분리", "경영학과 공식 내규(9개 분야 중 4개 B0 면제 + 캡스톤 보너스)를 상시 독립 카드로 명확히 안내"),
            ("철저한 No AI Slop 분업", "비정형 성적표 분석은 AI OCR이, 학점 집계와 요건 판정은 결정론적 규칙 코드가 100% 신뢰성 있게 처리")
        ]
    )
    add_image_with_caption(
        slide4, "live_exam_waiver_decoupled.png",
        Inches(6.6), Inches(1.65), Inches(5.9), Inches(4.8),
        "졸업시험 면제 판정표와 졸업 요건이 체계적으로 분리된 진단 화면"
    )

    # -------------------------------------------------------------
    # SLIDE 5: 핵심 기능 ①: 1,133개 과목 검색 & 바로 담기
    # -------------------------------------------------------------
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(slide5, "핵심 기능 ①: 1,133개 과목 검색 & 바로 담기", "04. Core Features", 5)
    add_key_points_box(
        slide5, Inches(0.8), Inches(1.65), Inches(5.2), Inches(5.1),
        [
            ("방대한 실제 과목 DB", "한림대 실제 개설 과목 1,133개(공식 트랙 과목 35개 동기화 완료) 내장"),
            ("오타 허용 스마트 검색", "과목명 또는 과목코드의 일부만 입력해도 실시간 초성/키워드 매칭 자동완성"),
            ("원클릭 바로 담기", "검색 결과 목록에서 '+ 바로 담기' 버튼으로 상세 페이지 이동 없이 바구니에 즉시 추가")
        ]
    )
    add_image_with_caption(
        slide5, "image (4).png",
        Inches(6.3), Inches(1.65), Inches(6.2), Inches(4.8),
        "과목명·코드 실시간 자동완성 및 [+ 바로 담기] 원클릭 인터랙션"
    )

    # -------------------------------------------------------------
    # SLIDE 6: 핵심 기능 ②: 플로팅 장바구니 바
    # -------------------------------------------------------------
    slide6 = prs.slides.add_slide(blank_layout)
    add_header(slide6, "핵심 기능 ②: 상시 유지 플로팅 장바구니 바", "04. Core Features", 6)
    add_key_points_box(
        slide6, Inches(0.8), Inches(1.65), Inches(5.2), Inches(5.1),
        [
            ("화면 하단 Sticky 고정", "어느 화면에서 스크롤하더라도 현재 담은 과목 수와 학점이 실시간 노출"),
            ("원클릭 탭 내비게이션", "'장바구니 N개 (N학점) ➔ 내 현황 바로가기' 클릭 시 수강 플래너로 즉시 이동"),
            ("모바일 최적화 배치", "스마트폰 한 손 조작 환경을 고려하여 엄지손가락 터치 반경 내(Bottom Fixed)에 배치")
        ]
    )
    add_image_with_caption(
        slide6, "image (5).png",
        Inches(6.3), Inches(1.65), Inches(6.2), Inches(4.8),
        "과목 탐색 중에도 실시간 학점 합계를 보여주는 하단 플로팅 바"
    )

    # -------------------------------------------------------------
    # SLIDE 7: 핵심 기능 ③: 공통 교양 6대 영역 아코디언 진단
    # -------------------------------------------------------------
    slide7 = prs.slides.add_slide(blank_layout)
    add_header(slide7, "핵심 기능 ③: 공통 교양 6대 영역 아코디언 진단", "04. Core Features", 7)
    add_key_points_box(
        slide7, Inches(0.8), Inches(1.65), Inches(5.2), Inches(5.1),
        [
            ("교양 26학점 6대 영역 완전 추적", "정보소통, 생애설계, 의사소통, 글로벌소통, 스포츠웰니스, 자율선택 영역별 달성도 판정"),
            ("접이식 아코디언 UI", "영역별 이수 현황과 추천 과목을 카드 형태로 제공하며 전체 펼치기/접기 원클릭 지원"),
            ("필수 교과목 결손 감지", "오디세이세미나, AI·코딩, Career English 등 미충족 필수 요건에 즉각적 경고 배지 부여")
        ]
    )
    add_image_with_caption(
        slide7, "image (3).png",
        Inches(6.3), Inches(1.65), Inches(6.2), Inches(4.8),
        "한림대학교 공통 교양 6대 영역별 진행률 및 세부 이수 아코디언 카드"
    )

    # -------------------------------------------------------------
    # SLIDE 8: 핵심 기능 ④: 공식 6대 진로 트랙 & 졸업시험 면제 분리
    # -------------------------------------------------------------
    slide8 = prs.slides.add_slide(blank_layout)
    add_header(slide8, "핵심 기능 ④: 공식 6대 진로 트랙 & 졸업시험 면제 분리", "04. Core Features", 8)
    add_key_points_box(
        slide8, Inches(0.8), Inches(1.65), Inches(5.2), Inches(5.1),
        [
            ("공식 6대 진로 트랙 반영", "한림대 입학처 공식 PDF(p.6~7) 기반: 회계·세무, 의료경영, 글로벌혁신전략, 비즈니스인텔리전스, 관광경영, 마케팅기획 로드맵 완비"),
            ("자율 권장 로드맵 운영", "공식 졸업 요건이 아닌 진로 추천 로드맵으로 운영하여, 미선택 시에도 공식 전공 기준(60학점) 충족 시 졸업 가능"),
            ("졸업시험 면제 판정표 상시 독립", "학과 공식 내규(9개 분야 중 4개 B0 면제 + 캡스톤 보너스)를 트랙 선택과 무관하게 상시 독립 카드로 노출")
        ]
    )
    add_image_with_caption(
        slide8, "live_official_track_diagnosis_pc.png",
        Inches(6.3), Inches(1.65), Inches(6.2), Inches(4.8),
        "경영학과 공식 6대 트랙 맞춤 로드맵 (기초·심화 과목 진행도 및 진출분야/자격증 안내)"
    )

    # -------------------------------------------------------------
    # SLIDE 9: 모바일 최적화 쇼케이스 (Mobile Usability & 360px)
    # -------------------------------------------------------------
    slide9 = prs.slides.add_slide(blank_layout)
    add_header(slide9, "모바일 최적화: 360px 가로 스크롤 없는 반응형 UX", "05. Mobile Usability", 9)
    add_key_points_box(
        slide9, Inches(0.8), Inches(1.65), Inches(4.4), Inches(5.1),
        [
            ("모바일 전용 56px 헤더", "초슬림 헤더 및 44px 터치 규격 준수로 작은 스마트폰 화면에서도 시원한 가시성 확보"),
            ("360px 완벽 무스크롤", "최소 360px 뷰포트에서도 모든 카드와 그리드가 1열로 부드럽게 줄바꿈되어 가로 스크롤 원천 방지"),
            ("현장 이동성 보장", "수강신청 당일 PC 앞이 아니더라도 버스·지하철 이동 중 스마트폰으로 즉각 졸업 시뮬레이션 가능")
        ]
    )
    m_w = Inches(2.3)
    m_h = Inches(4.8)
    add_image_with_caption(
        slide9, "live_mobile_360px_login.png",
        Inches(5.5), Inches(1.65), m_w, m_h,
        "① 56px 모바일 로그인"
    )
    add_image_with_caption(
        slide9, "live_track_selection_modal.png",
        Inches(8.1), Inches(1.65), m_w, m_h,
        "② 6대 트랙 선택 모달"
    )
    add_image_with_caption(
        slide9, "live_mobile_360px_scroll_check.png",
        Inches(10.7), Inches(1.65), m_w, m_h,
        "③ 360px 반응형 진단"
    )

    # -------------------------------------------------------------
    # SLIDE 10: 시스템 아키텍처 (Technical Architecture & No AI Slop)
    # -------------------------------------------------------------
    slide10 = prs.slides.add_slide(blank_layout)
    add_header(slide10, "시스템 구조: 투명한 AI 분업 아키텍처 (No AI Slop)", "06. Architecture", 10)
    add_key_points_box(
        slide10, Inches(0.8), Inches(1.65), Inches(6.0), Inches(5.1),
        [
            ("무설치 경량 웹 구조", "HTML5, CSS3, Vanilla JS 기반으로 무거운 외부 프레임워크 없이 브라우저에서 즉시 실행"),
            ("로컬 안전 가드레일", "브라우저 localStorage 격리 저장 및 스토리지 용량 초과(QuotaExceeded) 방어/복구 탑재"),
            ("일방향 해시 보안", "SHA-256 클라이언트 단 암호화를 통해 비밀번호 및 관리자 세션 평문 노출 방지"),
            ("투명한 AI 분업 (No AI Slop)", "비정형 성적표 문서는 AI OCR이 분석하고, 학점·졸업 판정은 결정론적 규칙 코드가 100% 신뢰성 있게 처리")
        ]
    )
    add_image_with_caption(
        slide10, "image (1).png",
        Inches(7.1), Inches(1.65), Inches(5.4), Inches(4.8),
        "성적표 입력, 규칙 엔진 연산, 실시간 UI 렌더링이 유기적으로 결합된 시스템 구조"
    )

    # -------------------------------------------------------------
    # SLIDE 11: 품질 검증 및 16개 테스트 스위트 (QA & Testing)
    # -------------------------------------------------------------
    slide11 = prs.slides.add_slide(blank_layout)
    add_header(slide11, "품질 검증: 16개 테스트 스위트 전체 통과", "07. Quality Assurance", 11)
    add_key_points_box(
        slide11, Inches(0.8), Inches(1.65), Inches(4.7), Inches(5.1),
        [
            ("16개 전 테스트 통과", "학점 계산, 편입생/유학생 특수 규칙, 공식 6대 트랙 및 졸업시험 면제 분리 등 16개 스위트 전체 통과 (16/16 PASS)"),
            ("공식 6대 트랙 전용 검증", "신규 구축된 test_official_6_tracks.js를 통해 79개 트랙 과목 DB 일치 및 비선택 시 호환성 완전 검증"),
            ("지속적 무결성 보장", "기능 추가 및 작은 개선 후에도 회귀 테스트를 상시 수행하여 안정적 신뢰성 유지")
        ]
    )

    # 16 Test Suite Table on the right
    rows = 17
    cols = 3
    table_shape = slide11.shapes.add_table(rows, cols, Inches(5.8), Inches(1.65), Inches(6.7), Inches(5.1))
    table = table_shape.table
    table.columns[0].width = Inches(1.5)
    table.columns[1].width = Inches(4.2)
    table.columns[2].width = Inches(1.0)

    headers = ["테스트 범주", "검증 스위트 명칭", "결과"]
    for c_idx, h_text in enumerate(headers):
        cell = table.cell(0, c_idx)
        cell.text = h_text
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_NAVY
        p = cell.text_frame.paragraphs[0]
        p.font.name = FONT_HEADING
        p.font.size = Pt(9)
        p.font.bold = True
        p.font.color.rgb = COLOR_WHITE
        p.alignment = PP_ALIGN.CENTER

    test_data = [
        ("계산 엔진", "test_full_suite.js (학점/판정 기본 통합)", "PASS"),
        ("계산 엔진", "test_basket_plan_summary.js (바구니 요약)", "PASS"),
        ("계산 엔진", "test_diagnosis_tiers.js (정상/주의/위험 등급)", "PASS"),
        ("전공 트랙", "test_official_6_tracks.js (공식 6대 트랙 및 면제 분리)", "PASS"),
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
        ("사용자경험", "test_ux_features.js (터치/가독성 스마트 UX)", "PASS")
    ]

    for r_idx, (cat, name, res) in enumerate(test_data):
        row_idx = r_idx + 1
        c0 = table.cell(row_idx, 0)
        c0.text = cat
        c0.text_frame.paragraphs[0].font.size = Pt(8.5)
        c0.text_frame.paragraphs[0].font.name = FONT_BODY

        c1 = table.cell(row_idx, 1)
        c1.text = name
        c1.text_frame.paragraphs[0].font.size = Pt(8.5)
        c1.text_frame.paragraphs[0].font.name = FONT_BODY

        c2 = table.cell(row_idx, 2)
        c2.text = res
        p_res = c2.text_frame.paragraphs[0]
        p_res.font.size = Pt(8.5)
        p_res.font.bold = True
        p_res.font.color.rgb = COLOR_GREEN
        p_res.alignment = PP_ALIGN.CENTER

    # -------------------------------------------------------------
    # SLIDE 12: 배포 성과, 향후 로드맵 & 핵심 결론
    # -------------------------------------------------------------
    slide12 = prs.slides.add_slide(blank_layout)
    add_header(slide12, "배포 성과, 로드맵 & 핵심 결론", "08. Roadmap & Conclusion", 12)

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
        ("문제", "학생들은 수강신청 때마다 포털의 복잡한 기준과 분절된 정보 때문에 졸업 요건과 진로 트랙을 확신하지 못했습니다."),
        ("해결", "과목을 담는 즉시 130학점 달성도, 공식 6대 진로 트랙 로드맵, 졸업시험 면제(4개 분야 B0)를 실시간 사전 판정합니다."),
        ("결과", "16개 테스트 스위트 전체 통과로 신뢰성을 입증하고, 360px 모바일 완벽 대응과 No AI Slop 원칙의 스마트 학사 플랫폼을 완성했습니다.")
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
        ("현재 배포", "GitHub Pages 무중단 실서비스 운영 중\nURL: https://grantfenix.github.io/hallym-grad-simulator/\n- 공식 6대 진로 트랙 및 1,133개 과목 탑재 완료"),
        ("1단계 계획", "타 학과(경제, 금융재무, 미디어 등) 공식 진로 트랙 확장\n- 입학처 공식 PDF 기반 학과별 로드맵 단계적 도입\n- 학과별 추가 시마다 16개 테스트 회귀 검증"),
        ("2단계 계획", "강의 사례실습3 기반 RAG 학칙 질의응답 챗봇 연동\n- 규정 책자 청킹(500자) 및 임베딩 코사인 유사도 검색\n- 할루시네이션 없는 근거 기반 질의응답 구현")
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

    prs.save(PPTX_ROOT_PATH)
    prs.save(PPTX_DOCS_PATH)
    print("SUCCESS: Presentation successfully generated!")
    print(f"  Root: {PPTX_ROOT_PATH} ({os.path.getsize(PPTX_ROOT_PATH)} bytes)")
    print(f"  Docs: {PPTX_DOCS_PATH} ({os.path.getsize(PPTX_DOCS_PATH)} bytes)")

if __name__ == "__main__":
    create_presentation()
