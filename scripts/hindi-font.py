"""Trim the Hindi font to the characters the site actually uses.

The full Anek Devanagari file is about 726 KB; the site uses a handful of Hindi
words, so the trimmed file is a small fraction of that. Run this again whenever
a new Hindi word is added to the page, or the new letters will fall back to a
system font:

    pnpm font

(which runs: uv run --with fonttools --with brotli scripts/hindi-font.py)
"""
import pathlib
import re
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules/@fontsource-variable/anek-devanagari/files/anek-devanagari-devanagari-wdth-normal.woff2"
OUT = ROOT / "src/fonts/anek-devanagari-subset.woff2"

files = [ROOT / "index.html", *(ROOT / "src").rglob("*.js"), *(ROOT / "src").rglob("*.css")]
chars = set()
for path in files:
    chars.update("".join(re.findall(r"[ऀ-ॿ]+", path.read_text(encoding="utf-8"))))
if not chars:
    sys.exit("No Hindi text found: nothing to do.")

OUT.parent.mkdir(parents=True, exist_ok=True)
# Joiners and the dotted circle are kept so conjuncts (like the त्त in तत्त्व) shape correctly.
unicodes = ",".join(f"U+{ord(c):04X}" for c in sorted(chars)) + ",U+200C,U+200D,U+25CC"
subset.main([
    str(SOURCE),
    f"--unicodes={unicodes}",
    "--layout-features=*",
    "--flavor=woff2",
    f"--output-file={OUT}",
])
print(f"{len(chars)} Hindi characters: {''.join(sorted(chars))}")
print(f"{SOURCE.stat().st_size // 1024} KB -> {OUT.stat().st_size // 1024} KB  ({OUT.relative_to(ROOT)})")
