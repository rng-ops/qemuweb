#!/bin/bash
# Build native sidecar for the current platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Building native sidecar..."

# Detect architecture
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$ARCH" in
    x86_64)
        TARGET="x86_64-unknown-linux-gnu"
        if [ "$OS" = "darwin" ]; then
            TARGET="x86_64-apple-darwin"
        fi
        ;;
    arm64|aarch64)
        TARGET="aarch64-unknown-linux-gnu"
        if [ "$OS" = "darwin" ]; then
            TARGET="aarch64-apple-darwin"
        fi
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Target: $TARGET"

# Build release binary
cargo build --release --target "$TARGET" --features native

# Copy to dist
mkdir -p dist
cp "target/$TARGET/release/qemuweb-sidecar" "dist/qemuweb-sidecar-$OS-$ARCH"

echo "Built: dist/qemuweb-sidecar-$OS-$ARCH"
