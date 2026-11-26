"""Write the ribbon's lettering as plain SVG paths: web/brand/ribbon-lettering.svg.

The crest's ribbon (web/brand/orca-crest-source.svg) is artwork with no
text of its own. This lays the words along the ribbon's curve, letter by
letter, and turns each letter into an outline, so the logo looks the same
on every machine with no font installed. build-logos.mjs puts it on the
ribbon. Run it only to change the words or the font:

    py -3 web/scripts/ribbon_lettering.py

Needs fontTools and Barlow Condensed Bold (SIL Open Font License,
https://fonts.google.com/specimen/Barlow+Condensed). Coordinates are the
source artwork's 930 x 930 space.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

WORDS = "GEDCOMTools.com"
FONT = Path(r"C:\Windows\Fonts\BarlowCondensed-Bold.ttf")
SIZE = 74  # font size; capitals come out about 52 units tall
TRACKING = 3  # extra space between letters
GAP_AFTER = "GEDCOM"  # a hint of a space here, so it reads GEDCOM Tools
GAP = 7
FILL = "#f8f2de"  # the cream of the original lettering

# The baseline: a parabola parallel to the ribbon's middle. The middle of
# the teal band (between its gold edges) was measured on the artwork at
# y 771.7 at x 465, falling about 0.00102 * dx^2 to each side. The baseline
# sits half a capital's height (26) below it, so the capitals are centred
# in the band.
CENTRE_X, LOW_Y, CURVE = 465.0, 798.0, 0.00102


def baseline(x: float) -> float:
    return LOW_Y - CURVE * (x - CENTRE_X) ** 2


def arc_table(x0: float, x1: float, steps: int = 4000) -> list[tuple[float, float]]:
    """(distance along the curve, x) pairs from x0 to x1."""
    table, s, prev = [(0.0, x0)], 0.0, (x0, baseline(x0))
    for i in range(1, steps + 1):
        x = x0 + (x1 - x0) * i / steps
        p = (x, baseline(x))
        s += math.dist(prev, p)
        table.append((s, x))
        prev = p
    return table


def x_at(table: list[tuple[float, float]], s: float) -> float:
    lo, hi = 0, len(table) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if table[mid][0] < s:
            lo = mid
        else:
            hi = mid
    (s0, a), (s1, b) = table[lo], table[hi]
    return a + (b - a) * ((s - s0) / (s1 - s0) if s1 > s0 else 0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--words", default=WORDS)
    ap.add_argument("--font", type=Path, default=FONT)
    ap.add_argument("--size", type=float, default=SIZE)
    ap.add_argument(
        "--out", type=Path, default=Path(__file__).parent.parent / "brand" / "ribbon-lettering.svg"
    )
    args = ap.parse_args()

    font = TTFont(args.font)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = args.size / font["head"].unitsPerEm
    names = [cmap[ord(c)] for c in args.words]
    widths = [glyphs[n].width * scale for n in names]
    spacing = [TRACKING] * len(names)
    if GAP_AFTER and args.words.startswith(GAP_AFTER):
        spacing[len(GAP_AFTER) - 1] += GAP
    total = sum(widths) + sum(spacing[:-1])

    table = arc_table(60, 870)
    middle = table[-1][0] / 2
    s = middle - total / 2
    paths = []
    for name, width, space in zip(names, widths, spacing, strict=True):
        half = width / 2
        x = x_at(table, s + half)  # the letter's centre
        y = baseline(x)
        angle = math.atan(-2 * CURVE * (x - CENTRE_X))
        cos, sin = math.cos(angle), math.sin(angle)
        # Font units (y up) -> artwork: scale, flip, centre the letter, rotate to the curve, move onto it.
        pen = SVGPathPen(glyphs)
        a, b = scale * cos, scale * sin
        c, d = scale * sin, -scale * cos
        e = x - half * cos
        f = y - half * sin
        glyphs[name].draw(TransformPen(pen, (a, b, c, d, e, f)))
        if pen.getCommands():
            paths.append(pen.getCommands())
        s += width + space

    d = " ".join(paths)
    args.out.write_text(
        "<!-- Made by web/scripts/ribbon_lettering.py; edit that, not this. -->\n"
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 930 930"><path fill="{FILL}" d="{d}"/></svg>\n',
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {args.out} ({len(args.words)} letters, {total:.0f} units long)")


if __name__ == "__main__":
    main()
