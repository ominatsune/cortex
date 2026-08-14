#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/assets/cortex-logo-source.png}"

if [[ ! -f "$SRC" ]]; then
  echo "Source logo not found: $SRC" >&2
  exit 1
fi

mkdir -p "$ROOT/public" "$ROOT/build" "$ROOT/mobile/assets"

# Strip the black backdrop and write a true RGBA PNG.
ffmpeg -y -i "$SRC" -update 1 -frames:v 1 \
  -vf "format=rgba,colorkey=0x000000:0.12:0.08" \
  "$ROOT/public/cortex-logo.png"

ffmpeg -y -i "$ROOT/public/cortex-logo.png" -update 1 -frames:v 1 \
  -vf "crop=720:720:(iw-720)/2:50" \
  "$ROOT/public/cortex-icon.png"

ffmpeg -y -i "$ROOT/public/cortex-icon.png" -update 1 -frames:v 1 -vf scale=512:512 "$ROOT/build/icon.png"
ffmpeg -y -i "$ROOT/public/cortex-icon.png" -update 1 -frames:v 1 -vf scale=32:32 "$ROOT/public/favicon-32.png"
ffmpeg -y -i "$ROOT/public/cortex-icon.png" -update 1 -frames:v 1 -vf scale=180:180 "$ROOT/public/apple-touch-icon.png"
ffmpeg -y -i "$ROOT/public/cortex-icon.png" -update 1 -frames:v 1 -vf scale=192:192 "$ROOT/mobile/assets/icon.png"
ffmpeg -y -i "$ROOT/public/cortex-icon.png" -update 1 -frames:v 1 -vf scale=1024:1024 "$ROOT/mobile/assets/adaptive-icon.png"

echo "Generated transparent logo assets in public/, build/, and mobile/assets/"
