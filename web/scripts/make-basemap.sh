#!/usr/bin/env bash
# Builds the self hosted base map for Placekeepers (no API keys, no third party tile service):
#
#   public/data/basemap/philly.pmtiles     Protomaps extract of the Philadelphia area
#   public/data/basemap/fonts/<font>/...   the label fonts it uses (Latin character ranges)
#   public/data/basemap/sprites/v4/light*  its map icons
#
# The extract comes from a recent daily planet build at build.protomaps.com (OpenStreetMap
# data, Open Database License), cut to a box around Philadelphia with go-pmtiles, which only
# downloads the parts it needs. go-pmtiles is fetched once from its official GitHub release
# into web/.tools/ and checked against the published SHA-256 checksum before it is run.
#
# Usage, from web/:   npm run basemap            (or: bash scripts/make-basemap.sh; needs bash 4 or later)
# Options (environment variables):
#   PK_BASEMAP_BUILD    a build date such as 20261003 (default: the newest of the last 10 days)
#   PK_BASEMAP_BBOX     min_lon,min_lat,max_lon,max_lat (default: Philadelphia with a margin)
#   PK_BASEMAP_MAXZOOM  default 15
#   PK_BASEMAP_OUT      output folder (default: public/data/basemap)
#   PK_BASEMAP_FORCE=1  rebuild even if the files already exist
#   PMTILES             path to an existing go-pmtiles binary, to skip the download

set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS="$WEB_DIR/.tools"
OUT="${PK_BASEMAP_OUT:-$WEB_DIR/public/data/basemap}"
BBOX="${PK_BASEMAP_BBOX:--75.32,39.84,-74.93,40.16}"
MAXZOOM="${PK_BASEMAP_MAXZOOM:-15}"
FORCE="${PK_BASEMAP_FORCE:-0}"
UA="Placekeepers/0.0.1 (+https://github.com/holdTheDoorHoid/placekeepers)"
BUILDS="https://build.protomaps.com"
ASSETS="https://protomaps.github.io/basemaps-assets"

PMTILES_VERSION="1.31.2"
declare -A PMTILES_SHA256=(
  [Linux_x86_64]="3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f"
  [Linux_arm64]="f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1"
  [Darwin_x86_64]="1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b"
  [Darwin_arm64]="40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d"
)

# Fonts used by the @protomaps/basemaps "light" style, and the Unicode ranges that cover
# Latin script names (basic, accented and extended letters, punctuation, symbols).
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")
RANGES=(0-255 256-511 512-767 768-1023 1024-1279 7680-7935 7936-8191 8192-8447 8448-8703)
SPRITES=(light.json light.png light@2x.json light@2x.png)

say() { printf '%s\n' "$*"; }
fail() { printf 'make-basemap: %s\n' "$*" >&2; exit 1; }

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

find_pmtiles() {
  if [[ -n "${PMTILES:-}" ]]; then printf '%s' "$PMTILES"; return; fi
  if [[ -x "$TOOLS/pmtiles" ]]; then printf '%s' "$TOOLS/pmtiles"; return; fi
  local os arch platform archive url
  os="$(uname -s)"
  arch="$(uname -m)"
  [[ "$arch" == "aarch64" ]] && arch="arm64"
  platform="${os}_${arch}"
  [[ -n "${PMTILES_SHA256[$platform]:-}" ]] || fail "no pinned go-pmtiles download for $platform; install it and set PMTILES=/path/to/pmtiles"
  if [[ "$os" == "Linux" ]]; then archive="go-pmtiles_${PMTILES_VERSION}_${platform}.tar.gz"; else archive="go-pmtiles-${PMTILES_VERSION}_${platform}.zip"; fi
  url="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${archive}"
  mkdir -p "$TOOLS"
  say "Downloading go-pmtiles ${PMTILES_VERSION} for ${platform} into web/.tools/ ..." >&2
  curl -fsSL -A "$UA" -o "$TOOLS/$archive" "$url"
  local got
  got="$(sha256 "$TOOLS/$archive")"
  if [[ "$got" != "${PMTILES_SHA256[$platform]}" ]]; then
    rm -f "$TOOLS/$archive"
    fail "checksum mismatch for $archive (got $got); not running it"
  fi
  if [[ "$archive" == *.tar.gz ]]; then tar -xzf "$TOOLS/$archive" -C "$TOOLS" pmtiles; else unzip -o -q "$TOOLS/$archive" pmtiles -d "$TOOLS"; fi
  rm -f "$TOOLS/$archive"
  chmod +x "$TOOLS/pmtiles"
  printf '%s' "$TOOLS/pmtiles"
}

latest_build() {
  if [[ -n "${PK_BASEMAP_BUILD:-}" ]]; then printf '%s' "$PK_BASEMAP_BUILD"; return; fi
  local i day
  for i in $(seq 0 10); do
    day="$(date -u -d "-$i day" +%Y%m%d 2>/dev/null || date -u -v-"$i"d +%Y%m%d)"
    if curl -fsS -A "$UA" -o /dev/null -r 0-6 "$BUILDS/$day.pmtiles" 2>/dev/null; then printf '%s' "$day"; return; fi
  done
  fail "no Protomaps build found in the last 10 days at $BUILDS; set PK_BASEMAP_BUILD=YYYYMMDD"
}

check_disk() {
  local free_kb
  free_kb="$(df -Pk "$OUT" | awk 'NR==2 {print $4}')"
  # The extract is tens of megabytes; insist on 2 GB of headroom anyway.
  (( free_kb > 2 * 1024 * 1024 )) || fail "less than 2 GB free on the disk holding $OUT"
}

mkdir -p "$OUT"
check_disk

if [[ -s "$OUT/philly.pmtiles" && "$FORCE" != "1" ]]; then
  say "Extract already present: $OUT/philly.pmtiles (set PK_BASEMAP_FORCE=1 to rebuild)"
else
  PMTILES_BIN="$(find_pmtiles)"
  BUILD="$(latest_build)"
  say "Extracting $BUILDS/$BUILD.pmtiles, box $BBOX, up to zoom $MAXZOOM ..."
  QUIET=()
  [[ -t 1 ]] || QUIET=(--quiet)  # progress bars only when someone is watching
  "$PMTILES_BIN" extract "$BUILDS/$BUILD.pmtiles" "$OUT/philly.pmtiles.part" --bbox="$BBOX" --maxzoom="$MAXZOOM" "${QUIET[@]}"
  mv "$OUT/philly.pmtiles.part" "$OUT/philly.pmtiles"
  printf '%s\n' "$BUILD" > "$OUT/BUILD"
fi

say "Fetching label fonts and map icons from $ASSETS ..."
for font in "${FONTS[@]}"; do
  mkdir -p "$OUT/fonts/$font"
  encoded="${font// /%20}"
  for range in "${RANGES[@]}"; do
    target="$OUT/fonts/$font/$range.pbf"
    [[ -s "$target" && "$FORCE" != "1" ]] && continue
    curl -fsS -A "$UA" -o "$target" "$ASSETS/fonts/$encoded/$range.pbf" || fail "could not fetch $font $range"
  done
done
mkdir -p "$OUT/sprites/v4"
for sprite in "${SPRITES[@]}"; do
  target="$OUT/sprites/v4/$sprite"
  [[ -s "$target" && "$FORCE" != "1" ]] && continue
  curl -fsS -A "$UA" -o "$target" "$ASSETS/sprites/v4/$sprite" || fail "could not fetch sprite $sprite"
done

size="$(du -h "$OUT/philly.pmtiles" | cut -f1)"
say "Done. Base map: $OUT/philly.pmtiles ($size, build $(cat "$OUT/BUILD" 2>/dev/null || echo unknown))."
say "Map data (c) OpenStreetMap contributors, Open Database License. Base map by Protomaps."
