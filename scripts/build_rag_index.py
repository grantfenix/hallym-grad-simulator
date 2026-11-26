#!/usr/bin/env python3
"""
Hallym University Graduation Simulator - Stage 1 RAG Index Builder

Extracts text and structured metadata strictly from local official sources:
- information/**/*.txt (29 files)
- information/**/*.pdf (46 text-extractable PDFs; 5 scanned PDFs recorded as OCR-required)
- data/graduation_rules.json, data/gyoyang_rules.json, data/courses.json

Outputs:
- data/rag_index.json (compact UTF-8 JSON)
- data/rag_index.js   (browser + CommonJS wrapper)
"""

import glob
import gzip
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone

logging.getLogger("pypdf").setLevel(logging.ERROR)
from pypdf import PdfReader

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INFO_DIR = os.path.join(ROOT_DIR, "information")
DATA_DIR = os.path.join(ROOT_DIR, "data")
OUT_JSON = os.path.join(DATA_DIR, "rag_index.json")
OUT_JS = os.path.join(DATA_DIR, "rag_index.js")

# Exact boilerplate lines scraped from web navigation headers/footers
WEB_NOISE_EXACT = {
    "본문 바로가기메뉴 바로가기하단 바로가기",
    "오늘 하루 보지 않기",
    "이전슬라이드다음슬라이드",
    "HALLYM Service",
    "KR",
    "EN",
    "CN",
    "로그인",
    "언어선택",
    "모바일 메뉴 열기",
    "모바일 메뉴 닫기",
    "검색",
    "입학안내",
    "에브리한림",
    "공지, 동아리, 강의실 검색",
    "홈",
    "게시판",
    "소식",
    "캘린더",
    "학식",
    "동아리",
    "지도",
    "가이드",
    "TOP",
    "맨위로",
    "인쇄",
    "공유",
    "닫기",
    "열기",
    "메뉴",
    "전체메뉴",
    "사이트맵",
}

KNOWN_DEPARTMENTS = [
    "경영학과",
    "소프트웨어학부",
    "빅데이터전공",
    "스마트IoT전공",
    "콘텐츠IT전공",
    "데이터사이언스학부",
    "디지털금융정보전공",
    "임상의학통계전공",
    "인공지능융합학부",
    "인공지능컴퓨팅학부",
    "AI기술경영융합전공",
    "AI로봇융합전공",
    "AI의료융합전공",
    "경제학과",
    "금융재무학과",
    "글로벌비즈니스전공",
    "글로컬MICE학과",
    "광고홍보학과",
    "미디어스쿨",
    "심리학과",
    "사회복지학부",
    "법학과",
    "사회학과",
    "정치행정학과",
    "영어영문학과",
    "국어국문학전공",
    "일본어학과",
    "러시아어학과",
    "중국학과",
    "인문학부",
    "인문콘텐츠융합전공",
    "반도체·디스플레이스쿨",
    "융합과학수사학과",
    "정보법과학전공",
    "체육학과",
    "화학과",
    "생명과학과",
    "바이오메디컬학과",
    "식품영양학과",
    "환경생명공학과",
    "간호학과",
    "의학과",
    "언어병리학전공",
    "청각학전공",
    "미래융합스쿨",
    "자유전공",
    "일송자유교양대학 자유교양전공",
]

OCR_FALLBACK_MAP = {
    "인문_러시아_1천_0717.pdf": [
        "information/학과별_졸업기준/졸업기준_러시아어학과.txt",
        "information/[한림대학교] 2026학년도 대학안내책자.pdf",
        "information/한림대학교_2027학과소개서_단면(최종).pdf",
    ],
    "인문_영어영문_1천_0717.pdf": [
        "information/학과별_졸업기준/졸업기준_영어영문학과.txt",
        "information/[한림대학교] 2026학년도 대학안내책자.pdf",
        "information/한림대학교_2027학과소개서_단면(최종).pdf",
    ],
    "인문_인문학부_2천_0717.pdf": [
        "information/학과별_졸업기준/졸업기준_국어국문학전공.txt",
        "information/학과별_졸업기준/졸업기준_인문콘텐츠융합전공.txt",
        "information/[한림대학교] 2026학년도 대학안내책자.pdf",
        "information/한림대학교_2027학과소개서_단면(최종).pdf",
    ],
    "인문_일본_1천_0717.pdf": [
        "information/학과별_졸업기준/졸업기준_일본어학과.txt",
        "information/[한림대학교] 2026학년도 대학안내책자.pdf",
        "information/한림대학교_2027학과소개서_단면(최종).pdf",
    ],
    "인문_중국_1천_0717.pdf": [
        "information/[한림대학교] 2026학년도 대학안내책자.pdf",
        "information/한림대학교_2027학과소개서_단면(최종).pdf",
    ],
}


def rel_posix(path: str) -> str:
    return os.path.relpath(path, ROOT_DIR).replace("\\", "/")


def infer_dept_from_filename(rel_path: str) -> str:
    base = os.path.basename(rel_path)
    if base.startswith("졸업기준_"):
        name = re.sub(r"\.(txt|pdf)$", "", base[len("졸업기준_"):])
        return name
    if "간호대학" in base or "간호학과" in base:
        return "간호학과"
    if "언어병리학" in base:
        return "언어병리학전공"
    if "청각학" in base:
        return "청각학전공"
    if "경영대학" in base or "경영학과" in base:
        return "경영학과"
    if "소프트웨어학부" in base:
        return "소프트웨어학부"
    if "데이터사이언스학부" in base:
        return "데이터사이언스학부"
    if "인공지능융합학부" in base:
        return "인공지능융합학부"
    if "인공지능컴퓨팅학부" in base:
        return "인공지능컴퓨팅학부"
    if "미래융합스쿨" in base:
        return "미래융합스쿨"
    if "반도체·디스플레이스쿨" in base:
        return "반도체·디스플레이스쿨"
    if "의학과" in base:
        return "의학과"
    for d in KNOWN_DEPARTMENTS:
        if d in base or d.replace("학과", "").replace("학부", "").replace("전공", "") in base and len(d) >= 4:
            if d in base:
                return d
    return "공통"


def infer_dept_from_text(text: str, default_dept: str) -> str:
    if default_dept != "공통":
        return default_dept
    # Check first 180 chars for explicit department heading
    head = text[:180]
    for d in KNOWN_DEPARTMENTS:
        if d in head:
            return d
    return "공통"


def infer_topics(text: str, rel_path: str) -> list:
    topics = []
    combined = f"{rel_path} {text}"
    rules = [
        ("졸업요건", ["졸업", "이수학점", "총 학점", "130학점", "졸업사정", "졸업기준", "졸업논문", "졸업시험", "면제"]),
        ("교양", ["교양", "정보소통", "생애설계", "의사소통", "글로벌소통", "스포츠웰니스", "오디세이", "컴퓨팅사고", "창의코딩", "자율선택", "융복합학문"]),
        ("전공", ["전공", "전필", "전선", "전공필수", "전공선택", "복수전공", "부전공", "캡스톤"]),
        ("트랙", ["트랙", "로드맵", "진로", "비즈니스인텔리전스", "비즈니스인텔리젼스", "글로벌 혁신전략", "의료경영", "마케팅기획", "관광경영", "회계/세무"]),
        ("과목", ["교과목", "학수번호", "개설강좌", "이수구분", "대체교과목", "학점"]),
        ("외국인", ["외국인", "유학생", "TOPIK", "대학한국어", "한국어트랙"]),
        ("편입생", ["편입", "편입생", "편입학", "인정학점"]),
        ("복수전공", ["복수전공", "부전공", "전과", "다전공"]),
        ("연락처", ["연락처", "행정실", "교학팀", "전화", "248-"]),
    ]
    for tag, kws in rules:
        if any(kw in combined for kw in kws):
            topics.append(tag)
    return topics or ["일반"]


def infer_student_types(text: str) -> list:
    has_foreign = any(k in text for k in ["외국인", "유학생", "TOPIK", "대학한국어"])
    has_transfer = any(k in text for k in ["편입생", "편입학"])
    types = []
    if has_foreign:
        types.append("외국인 유학생")
    if has_transfer:
        types.append("편입생")
    if not types or any(k in text for k in ["재학생", "신입생", "학번", "전공", "교양", "졸업"]):
        if "재학생" not in types:
            types.insert(0, "재학생")
    return types


def get_source_priority(rel_path: str, source_type: str) -> int:
    if source_type == "json":
        if rel_path.endswith("courses.json"):
            return 2
        return 3
    if "학과별_졸업기준/" in rel_path:
        return 3
    base = os.path.basename(rel_path)
    if base in {
        "졸업사정 기준.txt",
        "학번별 교양 졸업 기준.txt",
        "졸업요건과 복수전공·전과.txt",
        "학번별 전공필수 과목.pdf",
        "각 행정실 연락처.txt",
    }:
        return 3
    if base in {
        "[한림대학교] 2026학년도 대학안내책자.pdf",
        "한림대학교_2027학과소개서_단면(최종).pdf",
        "개설강좌조회.txt",
    }:
        return 1
    return 2


def clean_pdf_page_text(raw: str) -> str:
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    # Remove isolated page number lines like "- 7 -" or "12"
    lines = []
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            lines.append("")
            continue
        if re.fullmatch(r"[-–—]?\s*\d{1,3}\s*[-–—]?", s):
            continue
        lines.append(s)

    # Collapse vertical single-Hangul-character runs (common in Korean PDF table headers)
    merged = []
    i = 0
    while i < len(lines):
        if len(lines[i]) == 1 and "\uac00" <= lines[i] <= "\ud7a3":
            run = [lines[i]]
            j = i + 1
            while j < len(lines) and len(lines[j]) == 1 and "\uac00" <= lines[j] <= "\ud7a3":
                run.append(lines[j])
                j += 1
            if len(run) >= 2:
                merged.append("".join(run))
                i = j
                continue
        merged.append(lines[i])
        i += 1

    out = "\n".join(merged)
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def split_text_chunks(text: str, target_chars: int = 520, overlap_chars: int = 70) -> list:
    if len(text) <= target_chars + 120:
        return [text]
    chunks = []
    lines = [l for l in text.split("\n") if l.strip()]
    buf = []
    buf_len = 0
    for line in lines:
        if buf_len + len(line) + 1 > target_chars and buf:
            chunk_str = "\n".join(buf).strip()
            if chunk_str:
                chunks.append(chunk_str)
            # Keep tail lines up to overlap_chars
            tail = []
            tail_len = 0
            for prev in reversed(buf):
                if tail_len + len(prev) > overlap_chars and tail:
                    break
                tail.insert(0, prev)
                tail_len += len(prev) + 1
            buf = tail
            buf_len = tail_len
        buf.append(line)
        buf_len += len(line) + 1
    if buf:
        chunk_str = "\n".join(buf).strip()
        if chunk_str and (not chunks or chunk_str != chunks[-1]):
            chunks.append(chunk_str)
    return chunks


def is_web_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if s in WEB_NOISE_EXACT:
        return True
    if re.fullmatch(r"팝업\d*", s):
        return True
    if s.startswith("Copyright") or s.startswith("COPYRIGHT"):
        return True
    return False


def process_txt_file(filepath: str, chunk_counter: list) -> tuple:
    rel = rel_posix(filepath)
    base = os.path.basename(filepath)
    default_dept = infer_dept_from_filename(rel)
    priority = get_source_priority(rel, "txt")

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        raw_lines = f.readlines()

    # Special compact handling for 개설강좌조회.txt (29,536 single-field lines)
    if base == "개설강좌조회.txt":
        chunks = process_course_listing_txt(raw_lines, rel, priority, chunk_counter)
        return chunks, {
            "file": rel,
            "type": "txt",
            "status": "indexed",
            "lines": len(raw_lines),
            "chunks": len(chunks),
            "dept": "공통",
        }

    # Filter obvious web chrome while preserving exact 1-based line numbers
    kept = []  # list of (line_no, text)
    for idx, raw in enumerate(raw_lines, 1):
        s = re.sub(r"[ \t]+", " ", raw.strip())
        if is_web_noise(s):
            continue
        kept.append((idx, s))

    chunks = []
    if not kept:
        return chunks, {
            "file": rel,
            "type": "txt",
            "status": "indexed",
            "lines": len(raw_lines),
            "chunks": 0,
            "dept": default_dept,
        }

    # Group kept lines into chunks of ~480 chars with line_start / line_end
    target_chars = 480
    buf = []  # (line_no, text)
    buf_len = 0

    def flush_buf(items):
        if not items:
            return
        text = "\n".join(t for _, t in items).strip()
        if len(text) < 20:
            return
        l_start = items[0][0]
        l_end = items[-1][0]
        chunk_counter[0] += 1
        dept = infer_dept_from_text(text, default_dept)
        chunks.append({
            "id": f"txt_{chunk_counter[0]:04d}",
            "source": rel,
            "source_type": "txt",
            "loc": f"L{l_start}-L{l_end}" if l_start != l_end else f"L{l_start}",
            "page": None,
            "line_start": l_start,
            "line_end": l_end,
            "dept": dept,
            "topics": infer_topics(text, rel),
            "student_types": infer_student_types(text),
            "priority": priority,
            "text": text,
        })

    for item in kept:
        ln_no, ln_txt = item
        if buf_len + len(ln_txt) + 1 > target_chars and buf:
            flush_buf(buf)
            # Small 1-line overlap for context continuity
            buf = [buf[-1]] if len(buf[-1][1]) < 120 else []
            buf_len = sum(len(t) + 1 for _, t in buf)
        buf.append(item)
        buf_len += len(ln_txt) + 1
    flush_buf(buf)

    return chunks, {
        "file": rel,
        "type": "txt",
        "status": "indexed",
        "lines": len(raw_lines),
        "chunks": len(chunks),
        "dept": default_dept,
    }


def process_course_listing_txt(raw_lines: list, rel: str, priority: int, chunk_counter: list) -> list:
    """Compactly index 개설강좌조회.txt by extracting header + course-code entries grouped into chunks."""
    chunks = []
    # First chunk: document header & area/department overview (lines 1-60)
    header_items = []
    for idx in range(1, min(65, len(raw_lines) + 1)):
        s = raw_lines[idx - 1].strip()
        if s:
            header_items.append((idx, s))
    if header_items:
        chunk_counter[0] += 1
        text = "개설강좌조회 영역 및 학과 목록: " + ", ".join(t for _, t in header_items[:55])
        chunks.append({
            "id": f"txt_{chunk_counter[0]:04d}",
            "source": rel,
            "source_type": "txt",
            "loc": f"L{header_items[0][0]}-L{header_items[-1][0]}",
            "page": None,
            "line_start": header_items[0][0],
            "line_end": header_items[-1][0],
            "dept": "공통",
            "topics": ["과목", "교양", "전공"],
            "student_types": ["재학생", "편입생", "외국인 유학생"],
            "priority": priority,
            "text": text[:600],
        })

    # Extract concise course records anchored by 6-digit course codes (e.g., 904608)
    records = []  # (line_no, summary_str)
    n = len(raw_lines)
    i = 60
    seen_codes = set()
    while i < n:
        s = raw_lines[i].strip()
        if re.fullmatch(r"\d{6}", s) and s not in seen_codes:
            seen_codes.add(s)
            # Gather nearby non-empty tokens (typically course title, cat, credits)
            ctx = [s]
            for j in range(i + 1, min(i + 7, n)):
                t = raw_lines[j].strip()
                if re.fullmatch(r"\d{6}", t):
                    break
                if t and len(t) <= 45:
                    ctx.append(t)
                if len(ctx) >= 4:
                    break
            records.append((i + 1, " ".join(ctx)))
        i += 1

    # Pack ~14 unique course records per chunk (~520 chars) so full file is indexed compactly
    buf = []
    buf_len = 0
    for rec in records:
        if buf_len + len(rec[1]) + 3 > 520 and buf:
            chunk_counter[0] += 1
            l_start, l_end = buf[0][0], buf[-1][0]
            text = "2027-1 개설강좌 목록: " + " | ".join(r[1] for r in buf)
            chunks.append({
                "id": f"txt_{chunk_counter[0]:04d}",
                "source": rel,
                "source_type": "txt",
                "loc": f"L{l_start}-L{l_end}",
                "page": None,
                "line_start": l_start,
                "line_end": l_end,
                "dept": "공통",
                "topics": ["과목"],
                "student_types": ["재학생", "편입생", "외국인 유학생"],
                "priority": priority,
                "text": text,
            })
            buf = []
            buf_len = 0
        buf.append(rec)
        buf_len += len(rec[1]) + 3
    if buf:
        chunk_counter[0] += 1
        l_start, l_end = buf[0][0], buf[-1][0]
        text = "2027-1 개설강좌 목록: " + " | ".join(r[1] for r in buf)
        chunks.append({
            "id": f"txt_{chunk_counter[0]:04d}",
            "source": rel,
            "source_type": "txt",
            "loc": f"L{l_start}-L{l_end}",
            "page": None,
            "line_start": l_start,
            "line_end": l_end,
            "dept": "공통",
            "topics": ["과목"],
            "student_types": ["재학생", "편입생", "외국인 유학생"],
            "priority": priority,
            "text": text,
        })

    return chunks


def process_pdf_file(filepath: str, chunk_counter: list) -> tuple:
    rel = rel_posix(filepath)
    base = os.path.basename(filepath)
    size_mb = round(os.path.getsize(filepath) / 1e6, 2)
    default_dept = infer_dept_from_filename(rel)
    priority = get_source_priority(rel, "pdf")

    reader = PdfReader(filepath)
    num_pages = len(reader.pages)
    page_texts = []
    total_chars = 0
    for p_idx in range(num_pages):
        try:
            raw = reader.pages[p_idx].extract_text() or ""
        except Exception:
            raw = ""
        cleaned = clean_pdf_page_text(raw)
        total_chars += len(cleaned)
        page_texts.append((p_idx + 1, cleaned))

    avg_chars = total_chars / max(1, num_pages)
    if avg_chars < 20:
        # Scanned image PDF (OCR required) -> record as excluded per Stage 1 spec
        excluded_entry = {
            "file": rel,
            "pages": num_pages,
            "size_mb": size_mb,
            "status": "이미지 기반 자료(OCR 미적용)",
            "fallback_sources": OCR_FALLBACK_MAP.get(base, [
                "information/[한림대학교] 2026학년도 대학안내책자.pdf",
                "information/한림대학교_2027학과소개서_단면(최종).pdf",
            ]),
        }
        return [], None, excluded_entry

    chunks = []
    # Use slightly larger chunks for massive 100+ page brochures to keep index lean
    target_chars = 650 if num_pages >= 100 else 520
    overlap_chars = 60 if num_pages >= 100 else 75

    for page_no, text in page_texts:
        if len(text) < 25:
            continue
        pieces = split_text_chunks(text, target_chars=target_chars, overlap_chars=overlap_chars)
        for piece in pieces:
            if len(piece) < 25:
                continue
            chunk_counter[0] += 1
            dept = infer_dept_from_text(piece, default_dept)
            chunks.append({
                "id": f"pdf_{chunk_counter[0]:04d}",
                "source": rel,
                "source_type": "pdf",
                "loc": f"p.{page_no}",
                "page": page_no,
                "line_start": None,
                "line_end": None,
                "dept": dept,
                "topics": infer_topics(piece, rel),
                "student_types": infer_student_types(piece),
                "priority": priority,
                "text": piece,
            })

    source_meta = {
        "file": rel,
        "type": "pdf",
        "status": "indexed",
        "pages": num_pages,
        "chunks": len(chunks),
        "dept": default_dept,
    }
    return chunks, source_meta, None


def process_json_files(chunk_counter: list) -> tuple:
    chunks = []
    sources_meta = []

    # 1. data/graduation_rules.json
    grad_path = os.path.join(DATA_DIR, "graduation_rules.json")
    with open(grad_path, "r", encoding="utf-8") as f:
        grad_data = json.load(f)
    grad_chunks = 0
    for dept_name, rule in grad_data.items():
        if not isinstance(rule, dict):
            continue
        mc = rule.get("major_credits", {})
        parts = [
            f"[{dept_name} 졸업 요건 요약]",
            f"소속: {rule.get('college', '')} {dept_name}",
            f"총 졸업 이수학점: {rule.get('total_credits', 130)}학점",
            f"전공 학점: 단일전공(심화) {mc.get('single', 60)}학점 / 복수전공 {mc.get('double', 33)}학점 / 부전공 {mc.get('minor', 21)}학점",
            f"교양 최소 학점: {rule.get('ge_credits', 26)}학점",
        ]
        mand = rule.get("mandatory_courses", {})
        if isinstance(mand, dict):
            for cohort_key, clist in mand.items():
                if isinstance(clist, list) and clist:
                    c_desc = ", ".join(
                        f"{c.get('title', '')}({c.get('credits', '')}학점{': ' + c.get('note', '') if c.get('note') else ''})"
                        for c in clist
                    )
                    label = "2021학번 이후 전공필수" if cohort_key == "since_2021" else (
                        "2020학번 이전 전공필수" if cohort_key == "before_2021" else cohort_key
                    )
                    parts.append(f"{label}: {c_desc}")
        if rule.get("graduation_exam") or rule.get("graduation_thesis"):
            parts.append(f"졸업시험/논문: {rule.get('graduation_exam') or rule.get('graduation_thesis')}")
        spec = rule.get("special_conditions")
        if isinstance(spec, dict):
            for sk, sv in spec.items():
                if isinstance(sv, str) and sv.strip():
                    parts.append(f"세부기준({sk}): {sv}")
                elif isinstance(sv, dict) and sk == "sub_majors":
                    for sm_name, sm_list in sv.items():
                        if isinstance(sm_list, list):
                            parts.append(f"세부전공({sm_name}) 인정과목: {', '.join(str(x) for x in sm_list)}")
        if rule.get("official_name"):
            parts.append(f"공식학과명: {rule['official_name']}")
        if rule.get("notes"):
            notes = rule["notes"] if isinstance(rule["notes"], str) else " / ".join(str(x) for x in rule["notes"])
            parts.append(f"비고: {notes}")
        if rule.get("tracks"):
            t_names = [t.get("name", str(t)) if isinstance(t, dict) else str(t) for t in rule["tracks"]]
            parts.append(f"트랙: {', '.join(t_names)}")
        text = "\n".join(parts)
        chunk_counter[0] += 1
        grad_chunks += 1
        chunks.append({
            "id": f"json_{chunk_counter[0]:04d}",
            "source": "data/graduation_rules.json",
            "source_type": "json",
            "loc": f"학과:{dept_name}",
            "page": None,
            "line_start": None,
            "line_end": None,
            "dept": dept_name,
            "topics": ["졸업요건", "전공", "교양", "복수전공"],
            "student_types": ["재학생", "편입생", "외국인 유학생"],
            "priority": 3,
            "text": text,
        })
    sources_meta.append({
        "file": "data/graduation_rules.json",
        "type": "json",
        "status": "indexed",
        "chunks": grad_chunks,
        "dept": "공통",
    })

    # 2. data/gyoyang_rules.json
    gy_path = os.path.join(DATA_DIR, "gyoyang_rules.json")
    with open(gy_path, "r", encoding="utf-8") as f:
        gy_data = json.load(f)
    gy_chunks = 0

    for cohort_key in ["since_2023", "before_2023"]:
        cobj = gy_data.get(cohort_key)
        if not isinstance(cobj, dict):
            continue
        cohort_name = cobj.get("cohort_name", cohort_key)
        overview_parts = [
            f"[교양 이수 기준 - {cohort_name}]",
            f"적용 학번: {cobj.get('cohort_range', cohort_key)}",
            f"교양 총 최소 학점: {cobj.get('total_credits', 26)}학점",
            cobj.get("description", ""),
        ]
        areas = cobj.get("areas", {})
        area_summary = []
        for a_key, a_val in areas.items():
            req = a_val.get("required_credits", "")
            area_summary.append(f"{a_val.get('name', a_key)}({req}학점)")
        if area_summary:
            overview_parts.append("영역별 기준: " + ", ".join(area_summary))
        chunk_counter[0] += 1
        gy_chunks += 1
        chunks.append({
            "id": f"json_{chunk_counter[0]:04d}",
            "source": "data/gyoyang_rules.json",
            "source_type": "json",
            "loc": cohort_key,
            "page": None,
            "line_start": None,
            "line_end": None,
            "dept": "공통",
            "topics": ["교양", "졸업요건"],
            "student_types": ["재학생"],
            "priority": 3,
            "text": "\n".join(p for p in overview_parts if p),
        })

        # Individual area chunks
        for a_key, a_val in areas.items():
            a_parts = [
                f"[교양 영역 상세 - {cohort_name} / {a_val.get('name', a_key)}]",
                f"필수 학점: {a_val.get('required_credits', 0)}학점",
                a_val.get("description", ""),
            ]
            for mc_item in a_val.get("mandatory_courses", []):
                cat_label = mc_item.get("category", "")
                cr = mc_item.get("credits", "")
                clist = ", ".join(mc_item.get("courses", []))
                a_parts.append(f"- {cat_label} ({cr}학점): {clist}")
            if a_val.get("note"):
                a_parts.append(f"참고: {a_val['note']}")
            chunk_counter[0] += 1
            gy_chunks += 1
            chunks.append({
                "id": f"json_{chunk_counter[0]:04d}",
                "source": "data/gyoyang_rules.json",
                "source_type": "json",
                "loc": f"{cohort_key}.areas.{a_key}",
                "page": None,
                "line_start": None,
                "line_end": None,
                "dept": "공통",
                "topics": ["교양", "과목", "졸업요건"],
                "student_types": ["재학생"],
                "priority": 3,
                "text": "\n".join(p for p in a_parts if p),
            })

    # Substitution table
    subs = gy_data.get("course_substitution_table", [])
    if subs:
        sub_lines = ["[교양 구교과목-신교과목 대체 인정표]"]
        for s in subs:
            sub_lines.append(
                f"- {s.get('old_title','')}({s.get('old_code','')}) -> {s.get('new_title','')}({s.get('new_code','')}) "
                f"[{s.get('area','')}, {s.get('credits','')}학점] {s.get('note','')}"
            )
        chunk_counter[0] += 1
        gy_chunks += 1
        chunks.append({
            "id": f"json_{chunk_counter[0]:04d}",
            "source": "data/gyoyang_rules.json",
            "source_type": "json",
            "loc": "course_substitution_table",
            "page": None,
            "line_start": None,
            "line_end": None,
            "dept": "공통",
            "topics": ["교양", "과목"],
            "student_types": ["재학생"],
            "priority": 3,
            "text": "\n".join(sub_lines),
        })

    # Foreign student rules
    f_rules = gy_data.get("foreign_student_rules")
    if isinstance(f_rules, dict):
        f_parts = [f"[{f_rules.get('title', '외국인 유학생 교양 이수 기준')}]"]
        for k, v in f_rules.items():
            if k == "title":
                continue
            if isinstance(v, list):
                f_parts.append(f"{k}: {', '.join(str(x) for x in v)}")
            else:
                f_parts.append(f"{k}: {v}")
        chunk_counter[0] += 1
        gy_chunks += 1
        chunks.append({
            "id": f"json_{chunk_counter[0]:04d}",
            "source": "data/gyoyang_rules.json",
            "source_type": "json",
            "loc": "foreign_student_rules",
            "page": None,
            "line_start": None,
            "line_end": None,
            "dept": "공통",
            "topics": ["외국인", "교양", "졸업요건"],
            "student_types": ["외국인 유학생"],
            "priority": 3,
            "text": "\n".join(f_parts),
        })

    sources_meta.append({
        "file": "data/gyoyang_rules.json",
        "type": "json",
        "status": "indexed",
        "chunks": gy_chunks,
        "dept": "공통",
    })

    # 3. data/courses.json (group by department into clean chunks)
    courses_path = os.path.join(DATA_DIR, "courses.json")
    with open(courses_path, "r", encoding="utf-8") as f:
        courses_raw = json.load(f)
    courses_list = courses_raw if isinstance(courses_raw, list) else courses_raw.get("courses", [])
    by_dept = {}
    for c in courses_list:
        d = c.get("dept") or "공통"
        by_dept.setdefault(d, []).append(c)

    course_chunks = 0
    for d, clist in sorted(by_dept.items()):
        # Pack ~15 courses per chunk
        for start in range(0, len(clist), 15):
            batch = clist[start:start + 15]
            lines = [f"[{d} 개설 과목 및 이수구분 목록 ({start + 1}~{start + len(batch)}/{len(clist)})]"]
            for c in batch:
                code = c.get("code", "")
                title = c.get("title", "")
                cat = c.get("cat", "")
                cr = c.get("credits", "")
                sem = c.get("semester", "")
                lines.append(f"- {title} (코드:{code}, 이수구분:{cat}, {cr}학점{', ' + sem if sem else ''})")
            chunk_counter[0] += 1
            course_chunks += 1
            chunks.append({
                "id": f"json_{chunk_counter[0]:04d}",
                "source": "data/courses.json",
                "source_type": "json",
                "loc": f"dept:{d}#{start + 1}-{start + len(batch)}",
                "page": None,
                "line_start": None,
                "line_end": None,
                "dept": d if d in KNOWN_DEPARTMENTS else "공통",
                "topics": ["과목", "전공", "교양"],
                "student_types": ["재학생", "편입생", "외국인 유학생"],
                "priority": 2,
                "text": "\n".join(lines),
            })

    sources_meta.append({
        "file": "data/courses.json",
        "type": "json",
        "status": "indexed",
        "courses_count": len(courses_list),
        "chunks": course_chunks,
        "dept": "공통",
    })

    return chunks, sources_meta


def main():
    t0 = time.perf_counter()
    json_only = "--json-only" in sys.argv
    if json_only and os.path.exists(OUT_JSON):
        print("[--json-only] Reusing existing TXT/PDF chunks and refreshing 3 data JSON files...")
        with open(OUT_JSON, "r", encoding="utf-8") as f:
            prev = json.load(f)
        prev_chunks = [c for c in prev.get("chunks", []) if c.get("source_type") != "json"]
        prev_sources = [s for s in prev.get("meta", {}).get("sources", []) if s.get("type") != "json"]
        excluded_ocr_pdfs = prev.get("meta", {}).get("excluded_ocr_pdfs", [])
        prev_stats = prev.get("meta", {}).get("stats", {})
        json_counter = [0]
        j_chunks, j_meta = process_json_files(json_counter)
        all_chunks = prev_chunks + j_chunks
        sources_meta = prev_sources + j_meta
        elapsed = round(time.perf_counter() - t0, 2)
        index_obj = {
            "meta": {
                "version": "1.0.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "build_time_sec": elapsed,
                "stats": {
                    "txt_files_processed": prev_stats.get("txt_files_processed", 0),
                    "pdf_files_processed": prev_stats.get("pdf_files_processed", 0),
                    "pdf_files_ocr_required": len(excluded_ocr_pdfs),
                    "json_files_processed": 3,
                    "total_sources_indexed": len(sources_meta),
                    "txt_chunks": prev_stats.get("txt_chunks", 0),
                    "pdf_chunks": prev_stats.get("pdf_chunks", 0),
                    "json_chunks": json_counter[0],
                    "total_chunks": len(all_chunks),
                },
                "sources": sources_meta,
                "excluded_ocr_pdfs": excluded_ocr_pdfs,
            },
            "chunks": all_chunks,
        }
        json_str = json.dumps(index_obj, ensure_ascii=False, separators=(",", ":"))
        with open(OUT_JSON, "w", encoding="utf-8") as f:
            f.write(json_str)
        js_str = (
            "/* Auto-generated by scripts/build_rag_index.py - DO NOT EDIT MANUALLY */\n"
            "(function(root){\n"
            "  var idx = " + json_str + ";\n"
            "  if (typeof window !== 'undefined') window.HALLYM_RAG_INDEX = idx;\n"
            "  if (typeof globalThis !== 'undefined') globalThis.HALLYM_RAG_INDEX = idx;\n"
            "  if (typeof module !== 'undefined' && module.exports) module.exports = idx;\n"
            "})(typeof window !== 'undefined' ? window : globalThis);\n"
        )
        with open(OUT_JS, "w", encoding="utf-8") as f:
            f.write(js_str)
        print(f"JSON-only refresh complete in {elapsed:.2f}s (total chunks: {len(all_chunks)})")
        return

    all_chunks = []
    sources_meta = []
    excluded_ocr_pdfs = []
    txt_counter = [0]
    pdf_counter = [0]
    json_counter = [0]

    # 1. Process all TXT files in information/
    txt_files = sorted(glob.glob(os.path.join(INFO_DIR, "**", "*.txt"), recursive=True))
    print(f"[1/3] Processing {len(txt_files)} TXT files...")
    for tf in txt_files:
        ch, sm = process_txt_file(tf, txt_counter)
        all_chunks.extend(ch)
        sources_meta.append(sm)

    # 2. Process all PDF files in information/
    pdf_files = sorted(glob.glob(os.path.join(INFO_DIR, "**", "*.pdf"), recursive=True))
    print(f"[2/3] Processing {len(pdf_files)} PDF files...")
    for idx, pf in enumerate(pdf_files, 1):
        ch, sm, excl = process_pdf_file(pf, pdf_counter)
        if excl:
            excluded_ocr_pdfs.append(excl)
        else:
            all_chunks.extend(ch)
            sources_meta.append(sm)
        if idx % 15 == 0 or idx == len(pdf_files):
            print(f"      PDF progress: {idx}/{len(pdf_files)} (chunks so far: {pdf_counter[0]})")

    # 3. Process data/*.json files
    print("[3/3] Processing 3 structured data JSON files...")
    j_chunks, j_meta = process_json_files(json_counter)
    all_chunks.extend(j_chunks)
    sources_meta.extend(j_meta)

    elapsed = round(time.perf_counter() - t0, 2)

    index_obj = {
        "meta": {
            "version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "build_time_sec": elapsed,
            "stats": {
                "txt_files_processed": len(txt_files),
                "pdf_files_processed": len(pdf_files) - len(excluded_ocr_pdfs),
                "pdf_files_ocr_required": len(excluded_ocr_pdfs),
                "json_files_processed": 3,
                "total_sources_indexed": len(sources_meta),
                "txt_chunks": txt_counter[0],
                "pdf_chunks": pdf_counter[0],
                "json_chunks": json_counter[0],
                "total_chunks": len(all_chunks),
            },
            "sources": sources_meta,
            "excluded_ocr_pdfs": excluded_ocr_pdfs,
        },
        "chunks": all_chunks,
    }

    # Write data/rag_index.json (compact UTF-8)
    json_str = json.dumps(index_obj, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        f.write(json_str)

    # Write data/rag_index.js (static browser + Node CommonJS compatible)
    js_str = (
        "/* Auto-generated by scripts/build_rag_index.py - DO NOT EDIT MANUALLY */\n"
        "(function(root){\n"
        "  var idx = " + json_str + ";\n"
        "  if (typeof window !== 'undefined') window.HALLYM_RAG_INDEX = idx;\n"
        "  if (typeof globalThis !== 'undefined') globalThis.HALLYM_RAG_INDEX = idx;\n"
        "  if (typeof module !== 'undefined' && module.exports) module.exports = idx;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    )
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write(js_str)

    json_bytes = os.path.getsize(OUT_JSON)
    js_bytes = os.path.getsize(OUT_JS)
    gz_bytes = len(gzip.compress(json_str.encode("utf-8"), compresslevel=6))

    print("\n=== RAG Index Build Complete ===")
    print(f"Build time         : {elapsed:.2f}s")
    print(f"TXT indexed        : {len(txt_files)} files -> {txt_counter[0]} chunks")
    print(f"PDF indexed        : {len(pdf_files) - len(excluded_ocr_pdfs)} files -> {pdf_counter[0]} chunks")
    print(f"PDF OCR-excluded   : {len(excluded_ocr_pdfs)} files (이미지 기반 자료(OCR 미적용))")
    print(f"JSON indexed       : 3 files -> {json_counter[0]} chunks")
    print(f"Total chunks       : {len(all_chunks)}")
    print(f"data/rag_index.json: {json_bytes:,} bytes ({json_bytes / 1024 / 1024:.2f} MB)")
    print(f"data/rag_index.js  : {js_bytes:,} bytes ({js_bytes / 1024 / 1024:.2f} MB)")
    print(f"Gzip transfer est. : {gz_bytes:,} bytes ({gz_bytes / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
