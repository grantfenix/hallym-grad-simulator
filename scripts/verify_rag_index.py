#!/usr/bin/env python3
"""
Hallym University Graduation Simulator - Stage 1 RAG Index Quality Verification Script

Verifies:
1. data/rag_index.json and data/rag_index.js load cleanly
2. Exact source coverage (29 TXT + 46 PDF + 3 JSON indexed; 5 scanned PDFs marked OCR-excluded)
3. Schema integrity & citation metadata (filename, page / line_start-line_end, non-empty text)
4. Ground-truth evidence availability for the 5 core benchmark queries
"""

import json
import os
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_JSON = os.path.join(ROOT_DIR, "data", "rag_index.json")
INDEX_JS = os.path.join(ROOT_DIR, "data", "rag_index.js")


def fail(msg: str):
    print(f"[FAIL] {msg}")
    sys.exit(1)


def main():
    print("========================================")
    print("RAG Index Quality Verification (Stage 1)")
    print("========================================")

    # 1. File existence & JSON parsing
    if not os.path.exists(INDEX_JSON) or not os.path.exists(INDEX_JS):
        fail("data/rag_index.json or data/rag_index.js not found")

    with open(INDEX_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("meta", {})
    stats = meta.get("stats", {})
    chunks = data.get("chunks", [])
    excluded = meta.get("excluded_ocr_pdfs", [])

    print(f"[PASS] JSON parsed successfully (version={meta.get('version')}, build_time={meta.get('build_time_sec')}s)")

    # 2. Verify data/rag_index.js loads cleanly in Node.js
    node_check = subprocess.run(
        [
            "node",
            "-e",
            "const idx = require('./data/rag_index.js'); "
            "if (!idx || !idx.meta || !Array.isArray(idx.chunks)) process.exit(1); "
            "console.log('Node require OK: chunks=' + idx.chunks.length);",
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if node_check.returncode != 0:
        fail(f"data/rag_index.js failed Node load: {node_check.stderr}")
    print(f"[PASS] {node_check.stdout.strip()}")

    # 3. Verify exact source counts
    if stats.get("txt_files_processed") != 29:
        fail(f"Expected 29 TXT files processed, got {stats.get('txt_files_processed')}")
    if stats.get("pdf_files_processed") != 46:
        fail(f"Expected 46 PDF files processed, got {stats.get('pdf_files_processed')}")
    if stats.get("pdf_files_ocr_required") != 5 or len(excluded) != 5:
        fail(f"Expected 5 OCR-required PDFs, got {stats.get('pdf_files_ocr_required')} / {len(excluded)}")
    if stats.get("json_files_processed") != 3:
        fail(f"Expected 3 JSON files processed, got {stats.get('json_files_processed')}")

    for ex in excluded:
        if ex.get("status") != "이미지 기반 자료(OCR 미적용)":
            fail(f"Unexpected OCR status for {ex.get('file')}: {ex.get('status')}")
    print("[PASS] Source coverage verified: 29 TXT + 46 PDF + 3 JSON indexed, 5 OCR PDFs marked")

    # 4. Schema & citation metadata integrity across ALL chunks
    if not chunks:
        fail("Chunks list is empty")

    required_keys = {"id", "source", "source_type", "loc", "dept", "topics", "student_types", "priority", "text"}
    seen_ids = set()
    lengths = []
    for c in chunks:
        missing = required_keys - set(c.keys())
        if missing:
            fail(f"Chunk {c.get('id')} missing keys: {missing}")
        if c["id"] in seen_ids:
            fail(f"Duplicate chunk id: {c['id']}")
        seen_ids.add(c["id"])
        if not c["source"] or not c["loc"] or not c["text"].strip():
            fail(f"Empty source/loc/text in chunk {c['id']}")
        if c["source_type"] == "pdf":
            if not isinstance(c.get("page"), int) or c["page"] < 1:
                fail(f"Invalid page number in PDF chunk {c['id']}: {c.get('page')}")
        elif c["source_type"] == "txt":
            ls, le = c.get("line_start"), c.get("line_end")
            if not isinstance(ls, int) or not isinstance(le, int) or ls < 1 or le < ls:
                fail(f"Invalid line numbers in TXT chunk {c['id']}: {ls}-{le}")
        lengths.append(len(c["text"]))

    avg_len = sum(lengths) / len(lengths)
    print(
        f"[PASS] Schema & metadata verified for all {len(chunks):,} chunks "
        f"(len min={min(lengths)}, avg={avg_len:.0f}, max={max(lengths)} chars)"
    )

    # 5. Benchmark ground-truth evidence presence checks (5 required questions)
    benchmarks = [
        ("Q1: 졸업 총 학점(130학점)", ["130학점", "졸업"]),
        ("Q2: 교양 필수 과목(정보소통·생애설계)", ["컴퓨팅사고", "오디세이세미나"]),
        ("Q3: 소프트웨어학부 졸업 요건", ["소프트웨어학부", "소프트웨어캡스톤디자인"]),
        ("Q4: 외국인 유학생 교양 요건", ["외국인", "대학한국어3"]),
        ("Q5: 경영학과 트랙(6대 트랙)", ["경영학과", "글로벌 혁신전략", "의료경영"]),
    ]
    for label, must_terms in benchmarks:
        hits = [
            c for c in chunks
            if all(term in c["text"] for term in must_terms)
        ]
        if not hits:
            fail(f"Benchmark evidence missing for {label} (terms={must_terms})")
        sample = hits[0]
        print(f"[PASS] {label} -> {len(hits)} matching chunks (e.g. {sample['source']} [{sample['loc']}])")

    # 6. Print excluded OCR PDF summary
    print("\n--- Excluded Scanned PDFs (이미지 기반 자료(OCR 미적용)) ---")
    for ex in excluded:
        print(f"  - {ex['file']} ({ex['pages']}p, {ex['size_mb']}MB) -> {ex['status']}")

    print("\n>>> ALL STAGE 1 RAG INDEX QUALITY CHECKS PASSED! <<<")


if __name__ == "__main__":
    main()
