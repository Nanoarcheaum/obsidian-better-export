"""Optional PDF QA after test:browser; requires pypdf. No Vault access."""
import json
import re
from pathlib import Path
from pypdf import PdfReader

base = Path(__file__).resolve().parent.parent / 'test-results'
expected = json.loads((base / 'long-document-expected.json').read_text(encoding='utf-8'))
pdf = PdfReader(base / 'long-document.pdf')
assert len(pdf.pages) == expected['pageCount'], (len(pdf.pages), expected['pageCount'])
parts = []
for index, page in enumerate(pdf.pages, 1):
    assert abs(float(page.mediabox.width) - 595.28) < 1
    assert abs(float(page.mediabox.height) - 841.89) < 1
    text = re.sub(r'\s+', '', page.extract_text())
    assert text.endswith(str(index)), f'Missing footer on page {index}'
    parts.append(text[:-len(str(index))])
actual = ''.join(parts)
target = re.sub(r'\s+', '', expected['text'])
assert actual == target, f'PDF text mismatch: actual={len(actual)}, expected={len(target)}'
print(f'PASS: {len(pdf.pages)} A4 pages match preview; {len(target)} non-whitespace characters preserved exactly.')
