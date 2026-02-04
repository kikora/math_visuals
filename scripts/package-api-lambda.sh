#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$ROOT_DIR/infra/api/lambda"
BUILD_DIR="$ROOT_DIR/infra/api/build"
PALETTE_BUILD_DIR="$BUILD_DIR/palette"
RUNTIME_DIR="$ROOT_DIR/infra/api/runtime"
API_SRC_DIR="$ROOT_DIR/api"
PALETTE_SRC_DIR="$ROOT_DIR/palette"
ARTIFACT_PATH="$ROOT_DIR/infra/api/api-lambda.zip"

ensure_rsync() {
  if command -v rsync >/dev/null 2>&1; then
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    echo "rsync is not installed. Attempting to install it with 'sudo yum install -y rsync'..." >&2
    if sudo yum install -y rsync; then
      return
    fi
    echo "Automatic installation of rsync failed. Please install rsync manually and re-run this script." >&2
    exit 1
  fi

  echo "rsync is required but was not found on PATH. Please install it (for example, 'sudo yum install -y rsync' on Amazon Linux) and re-run this script." >&2
  exit 1
}

ensure_rsync

# Install production dependencies for the Lambda runtime
npm ci --omit=dev --prefix "$LAMBDA_DIR"

# Prepare build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/api" "$PALETTE_BUILD_DIR"

cp "$RUNTIME_DIR/index.js" "$BUILD_DIR/index.js"
cp "$LAMBDA_DIR/package.json" "$BUILD_DIR/package.json"
if [ -f "$LAMBDA_DIR/package-lock.json" ]; then
  cp "$LAMBDA_DIR/package-lock.json" "$BUILD_DIR/package-lock.json"
fi
cp -R "$LAMBDA_DIR/node_modules" "$BUILD_DIR/node_modules"

rsync -a --exclude 'node_modules' "$API_SRC_DIR/" "$BUILD_DIR/api/"
rsync -a "$PALETTE_SRC_DIR/" "$PALETTE_BUILD_DIR/"

if [ ! -f "$PALETTE_BUILD_DIR/palette-config.js" ]; then
  echo "palette-config.js was not bundled into the Lambda artefact" >&2
  exit 1
fi

(
  cd "$BUILD_DIR"
  zip -qr "$ARTIFACT_PATH" .
)

echo "Packaged Lambda artefact at: $ARTIFACT_PATH"
