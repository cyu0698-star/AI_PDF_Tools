"""Quick smoke-test for POST /api/convert with each project PDF."""

import base64, sys, pathlib, requests

API = "http://127.0.0.1:8000/api/convert"
OUT_DIR = pathlib.Path("D:/I-Love-Financial-Forms/test_output")
OUT_DIR.mkdir(exist_ok=True)

pdfs = [
    pathlib.Path(r"D:\I-Love-Financial-Forms\副本副本罗丰对账单保利文2025年3月份(2).pdf"),
    pathlib.Path(r"D:\I-Love-Financial-Forms\副本副本报价单（精丰）10-30.pdf"),
    pathlib.Path(r"D:\I-Love-Financial-Forms\副本保利高（齿轮）3-3.pdf"),
]

for pdf in pdfs:
    print(f"\n{'='*60}")
    print(f"Testing: {pdf.name}")
    b64 = base64.b64encode(pdf.read_bytes()).decode()
    resp = requests.post(API, json={"fileBase64": b64, "mimeType": "application/pdf"}, timeout=120)
    print(f"  Status: {resp.status_code}")
    if resp.status_code == 200:
        ct = resp.headers.get("Content-Type", "")
        print(f"  Content-Type: {ct}")
        out_file = OUT_DIR / f"{pdf.stem}.xlsx"
        out_file.write_bytes(resp.content)
        print(f"  Saved: {out_file}  ({len(resp.content)} bytes)")
    else:
        print(f"  Error: {resp.text[:500]}")
