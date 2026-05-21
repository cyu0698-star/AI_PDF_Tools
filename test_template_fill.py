"""Test template-fill conversion for 3 PDF files using 报价单模板.xlsx."""

import base64
import os
import sys
import json

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

# Load env vars from backend/.env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))

from app.services.template_filler import serialize_template, fill_template
from app.services.claude_service import extract_with_ai
from app.core.prompts import TEMPLATE_FILL_PROMPT


TEMPLATE_PATH = "报价单模板.xlsx"
PDF_FILES = [
    "副本保利高（齿轮）3-3.pdf",
    "副本副本报价单（精丰）10-30.pdf",
    "副本副本罗丰对账单保利文2025年3月份(2).pdf",
]
OUTPUT_DIR = "test_output"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Read & serialize template
with open(TEMPLATE_PATH, "rb") as f:
    template_bytes = f.read()

template_desc = serialize_template(template_bytes)
print("=" * 60)
print("TEMPLATE STRUCTURE:")
print("=" * 60)
print(template_desc)
print()

prompt = TEMPLATE_FILL_PROMPT.replace("{template_structure}", template_desc)

# 2. Test each PDF
for pdf_path in PDF_FILES:
    print("=" * 60)
    print(f"TESTING: {pdf_path}")
    print("=" * 60)

    if not os.path.exists(pdf_path):
        print(f"  [SKIP] File not found: {pdf_path}")
        continue

    with open(pdf_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode()

    mime = "application/pdf"

    try:
        print("  Calling AI...")
        mapping = extract_with_ai(pdf_b64, mime, prompt)
        print("  AI response (mapping):")
        mapping_str = json.dumps(mapping, ensure_ascii=False, indent=2)
        print(mapping_str[:3000])
        # Save full mapping to file
        mapping_out = os.path.join(OUTPUT_DIR, os.path.splitext(os.path.basename(pdf_path))[0] + "_mapping.json")
        with open(mapping_out, "w", encoding="utf-8") as mf:
            mf.write(mapping_str)

        print("  Filling template...")
        result_bytes = fill_template(template_bytes, mapping)

        out_name = os.path.splitext(os.path.basename(pdf_path))[0] + "_filled.xlsx"
        out_path = os.path.join(OUTPUT_DIR, out_name)
        with open(out_path, "wb") as f:
            f.write(result_bytes)
        print(f"  SUCCESS -> {out_path} ({len(result_bytes)} bytes)")
    except Exception as exc:
        print(f"  ERROR: {exc}")

    print()

print("Done.")
