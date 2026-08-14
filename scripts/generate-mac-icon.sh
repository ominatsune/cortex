#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="$ROOT/assets/appicon"
LIGHT_SOURCE="$ICON_DIR/Icon-macOS-Default-1024x1024@1x.png"
DARK_SOURCE="$ICON_DIR/Icon-macOS-Dark-1024x1024@1x.png"
BUILD_OUTPUT="$ROOT/build/macos-app-icon.png"
LIGHT_RUNTIME_OUTPUT="$ROOT/public/macos-app-icon.png"
DARK_RUNTIME_OUTPUT="$ROOT/public/macos-app-icon-dark.png"
CANVAS_SIZE=1024
# The Icon Composer export fills the macOS canvas more than the Dock's usual
# visual footprint. Keep the visible icon at ~83% of the canvas.
ARTWORK_SIZE=850
PADDING=87

if [[ ! -f "$LIGHT_SOURCE" || ! -f "$DARK_SOURCE" ]]; then
  echo "macOS app-icon sources not found in: $ICON_DIR" >&2
  exit 1
fi

mkdir -p "$ROOT/build" "$ROOT/public"

render_dock_icon() {
  local source="$1"
  local output="$2"
  ffmpeg -loglevel error -y -i "$source" -update 1 -frames:v 1 \
    -vf "format=rgba,scale=${ARTWORK_SIZE}:${ARTWORK_SIZE}:flags=lanczos,pad=${CANVAS_SIZE}:${CANVAS_SIZE}:${PADDING}:${PADDING}:color=0x00000000" \
    "$output"
}

render_dock_icon "$LIGHT_SOURCE" "$BUILD_OUTPUT"
render_dock_icon "$LIGHT_SOURCE" "$LIGHT_RUNTIME_OUTPUT"
render_dock_icon "$DARK_SOURCE" "$DARK_RUNTIME_OUTPUT"

echo "Generated macOS app icons: $BUILD_OUTPUT"
