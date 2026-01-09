#!/bin/bash
# Compile QEMU to WebAssembly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="${PACKAGE_DIR}/dist"

source "${SCRIPT_DIR}/config.sh"

cd "$(dirname "$SCRIPT_DIR")/../qemu-src/build"

echo "Building QEMU..."

# Determine number of parallel jobs
JOBS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
echo "Using ${JOBS} parallel jobs"

# Build
make -j"${JOBS}" || {
    echo "Parallel build failed, retrying with single job..."
    make -j1
}

# Create dist directory
mkdir -p "${DIST_DIR}"

# Copy and rename artifacts
for target in "${TARGETS[@]}"; do
    ARCH="${target%-softmmu}"
    BINARY="qemu-system-${ARCH}"
    
    if [ -f "${BINARY}" ]; then
        echo "Processing ${BINARY}..."
        
        # Copy main JS and Wasm files
        cp "${BINARY}" "${DIST_DIR}/${BINARY}.js" 2>/dev/null || true
        cp "${BINARY}.js" "${DIST_DIR}/${BINARY}.js" 2>/dev/null || true
        cp "${BINARY}.wasm" "${DIST_DIR}/${BINARY}.wasm" 2>/dev/null || true
        
        # Copy worker if pthreads enabled
        if [ "${ENABLE_PTHREADS}" = "true" ]; then
            cp "${BINARY}.worker.js" "${DIST_DIR}/${BINARY}.worker.js" 2>/dev/null || true
        fi
        
        echo "  ${BINARY} artifacts copied"
    else
        echo "Warning: ${BINARY} not found"
    fi
done

# Create a simple loader module
cat > "${DIST_DIR}/index.js" << 'EOF'
// QEMU Wasm Loader
// Auto-generated - do not edit

export const QemuArch = {
  X86_64: 'x86_64',
  AARCH64: 'aarch64'
};

export async function loadQemu(arch, options = {}) {
  const modulePath = `./qemu-system-${arch}.js`;
  
  try {
    const QemuModule = await import(modulePath);
    return QemuModule.default(options);
  } catch (err) {
    throw new Error(`Failed to load QEMU for ${arch}: ${err.message}`);
  }
}

export function getAvailableArchitectures() {
  return Object.values(QemuArch);
}
EOF

echo "Compilation complete"
ls -la "${DIST_DIR}"
