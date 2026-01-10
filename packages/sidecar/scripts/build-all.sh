#!/bin/bash
# Build both native and WASM targets

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building all targets..."
echo

"$SCRIPT_DIR/build-native.sh"
echo

"$SCRIPT_DIR/build-wasm.sh"
echo

echo "All builds complete!"
echo
echo "Native binary: packages/sidecar/dist/qemuweb-sidecar-*"
echo "WASM package:  packages/sidecar/dist/wasm/"
