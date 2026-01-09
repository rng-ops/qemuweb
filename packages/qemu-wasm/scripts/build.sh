#!/bin/bash
# QEMU Wasm Build Script
# Builds QEMU to WebAssembly using Emscripten

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="${PACKAGE_DIR}/dist"

source "${SCRIPT_DIR}/config.sh"

echo "=== BrowserQEMU Build Script ==="
echo "QEMU Version: ${QEMU_VERSION}"
echo "Targets: ${TARGETS[*]}"
echo "Pthreads: ${ENABLE_PTHREADS}"

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install and activate emsdk."
    echo "See README.md for instructions."
    exit 1
fi

EMCC_VERSION=$(emcc --version | head -1)
echo "Emscripten: ${EMCC_VERSION}"

# Create dist directory
mkdir -p "${DIST_DIR}"

# Download QEMU if needed
QEMU_SRC="${PACKAGE_DIR}/qemu-src"
if [ ! -d "${QEMU_SRC}" ]; then
    echo "Downloading QEMU ${QEMU_VERSION}..."
    cd "${PACKAGE_DIR}"
    curl -L -o qemu.tar.xz "https://download.qemu.org/qemu-${QEMU_VERSION}.tar.xz"
    tar xf qemu.tar.xz
    mv "qemu-${QEMU_VERSION}" qemu-src
    rm qemu.tar.xz
fi

# Apply patches
PATCHES_DIR="${PACKAGE_DIR}/patches"
if [ -d "${PATCHES_DIR}" ] && [ "$(ls -A "${PATCHES_DIR}" 2>/dev/null)" ]; then
    echo "Applying patches..."
    cd "${QEMU_SRC}"
    for patch in "${PATCHES_DIR}"/*.patch; do
        if [ -f "$patch" ]; then
            echo "  Applying $(basename "$patch")..."
            patch -p1 < "$patch" || echo "  Warning: patch may have already been applied"
        fi
    done
fi

# Configure and build
cd "${QEMU_SRC}"

echo "Configuring QEMU for Wasm..."
"${SCRIPT_DIR}/configure-qemu.sh"

echo "Compiling QEMU..."
"${SCRIPT_DIR}/compile-qemu.sh"

# Generate build metadata
echo "Generating build metadata..."
cat > "${DIST_DIR}/qemu-build.json" << EOF
{
  "version": "${QEMU_VERSION}",
  "targets": $(printf '%s\n' "${TARGETS[@]}" | jq -R . | jq -s .),
  "pthreads": ${ENABLE_PTHREADS},
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "emscriptenVersion": "$(emcc --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
}
EOF

echo "=== Build Complete ==="
echo "Artifacts in: ${DIST_DIR}"
ls -la "${DIST_DIR}"
