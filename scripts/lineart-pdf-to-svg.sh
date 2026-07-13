#!/usr/bin/env bash
#
# lineart-pdf-to-svg.sh — Convert a raster "coloring page" PDF into a clean,
# monocolor line-art SVG. Renders the PDF, drops the page border and the
# light-gray watermark/logo, crops tight to the artwork, and vector-traces it.
#
# Usage:
#   scripts/lineart-pdf-to-svg.sh INPUT.pdf [OUTPUT.svg] [options]
#
# If OUTPUT.svg is omitted, writes alongside INPUT with a .svg extension.
#
# Options:
#   --color HEX     Stroke/fill color        (default: #333)
#   --dpi N         Render resolution         (default: 300)
#   --threshold PCT B/W cutoff; higher keeps  (default: 55%)
#                   more, lower drops more. Light-gray logos drop here.
#   --shave PX      Border frame to strip      (default: 140)
#                   before finding the art. Raise if a border survives.
#   --pad PX        Padding around artwork     (default: 40)
#   --turdsize N    Speckle removal threshold  (default: 8)
#   --keep-pdf      Do not delete the source PDF (default: source is kept;
#                   this flag is a no-op kept for clarity)
#   --rm-pdf        Delete the source PDF after a successful conversion
#
# Requires: pdftoppm (poppler), magick (ImageMagick 7), potrace, python3.
#
set -euo pipefail

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- defaults ---------------------------------------------------------------
COLOR="#333"
DPI=300
THRESHOLD="55%"
SHAVE=140
PAD=40
TURDSIZE=8
RM_PDF=0
INPUT=""
OUTPUT=""

# --- arg parsing ------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --color)     COLOR="$2"; shift 2 ;;
    --dpi)       DPI="$2"; shift 2 ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
    --shave)     SHAVE="$2"; shift 2 ;;
    --pad)       PAD="$2"; shift 2 ;;
    --turdsize)  TURDSIZE="$2"; shift 2 ;;
    --rm-pdf)    RM_PDF=1; shift ;;
    --keep-pdf)  RM_PDF=0; shift ;;
    -h|--help)   sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)          die "unknown option: $1" ;;
    *)
      if [ -z "$INPUT" ]; then INPUT="$1"
      elif [ -z "$OUTPUT" ]; then OUTPUT="$1"
      else die "unexpected argument: $1"; fi
      shift ;;
  esac
done

[ -n "$INPUT" ] || die "no input PDF given (see --help)"
[ -f "$INPUT" ] || die "input not found: $INPUT"
[ -z "$OUTPUT" ] && OUTPUT="${INPUT%.*}.svg"

for bin in pdftoppm magick potrace python3; do
  command -v "$bin" >/dev/null 2>&1 || die "missing required tool: $bin"
done

# --- work in a temp dir -----------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Render PDF -> grayscale PNG at DPI.
pdftoppm -r "$DPI" -gray -png -singlefile "$INPUT" "$TMP/page" >/dev/null 2>&1 \
  || die "failed to render PDF (is it a valid 1-page PDF?)"
PNG="$TMP/page.png"

# 2. Find the artwork bbox: shave off the border frame, threshold to isolate
#    the dark linework, and read its trim box (relative to the shaved image).
BBOX="$(magick "$PNG" -shave "${SHAVE}x${SHAVE}" -threshold "$THRESHOLD" \
        -negate -format "%@" info: 2>/dev/null)" || die "bbox detection failed"
# BBOX looks like WxH+X+Y
CW="${BBOX%%x*}"; rest="${BBOX#*x}"
CH="${rest%%+*}"; rest="${rest#*+}"
CX="${rest%%+*}"; CY="${rest##*+}"
[ -n "$CW" ] && [ -n "$CH" ] || die "could not locate artwork in page"

# Translate back to original coordinates (undo the shave) and pad, clamping >=0.
OX=$(( CX + SHAVE - PAD )); [ "$OX" -lt 0 ] && OX=0
OY=$(( CY + SHAVE - PAD )); [ "$OY" -lt 0 ] && OY=0
OW=$(( CW + 2*PAD ))
OH=$(( CH + 2*PAD ))

# 3. Crop to artwork and threshold to a bilevel bitmap for tracing.
magick "$PNG" -crop "${OW}x${OH}+${OX}+${OY}" +repage \
  -threshold "$THRESHOLD" "$TMP/art.pbm" 2>/dev/null || die "crop/threshold failed"

# 4. Vector-trace.
potrace "$TMP/art.pbm" --svg -o "$TMP/trace.svg" \
  --turdsize "$TURDSIZE" --alphamax 1.0 --opttolerance 0.3 \
  || die "potrace failed"

# 5. Strip potrace boilerplate, set a single fill color, tidy the viewBox.
python3 - "$TMP/trace.svg" "$OUTPUT" "$COLOR" <<'PY'
import re, sys
src_path, out_path, color = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(src_path).read()
m = re.search(r'viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"', src)
vb = " ".join(str(int(float(x))) for x in m.groups()) if m else "0 0 0 0"
g = re.search(r'<g transform.*?</g>', src, re.S).group(0)
g = g.replace('fill="#000000"', f'fill="{color}"')
out = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
    f'fill="{color}" role="img" aria-label="line art">\n'
    f'{g}\n</svg>\n'
)
open(out_path, "w").write(out)
PY

printf 'wrote %s\n' "$OUTPUT"

# 6. Optionally remove the source PDF.
if [ "$RM_PDF" -eq 1 ]; then
  rm -f "$INPUT"
  printf 'removed %s\n' "$INPUT"
fi
