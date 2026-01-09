#!/bin/bash
# QEMU Wasm Build Configuration

# QEMU version to build
export QEMU_VERSION="${QEMU_VERSION:-8.2.0}"

# Target architectures to build
export TARGETS=(
    "x86_64-softmmu"
    "aarch64-softmmu"
)

# Enable pthreads (requires SharedArrayBuffer)
# Set to false for maximum compatibility
export ENABLE_PTHREADS="${ENABLE_PTHREADS:-false}"

# Memory configuration (in bytes)
export INITIAL_MEMORY=$((256 * 1024 * 1024))  # 256 MB
export MAXIMUM_MEMORY=$((2048 * 1024 * 1024)) # 2 GB
export STACK_SIZE=$((2 * 1024 * 1024))        # 2 MB

# Optimization level
export OPT_LEVEL="${OPT_LEVEL:-O2}"

# Enable debug symbols (increases size significantly)
export DEBUG="${DEBUG:-false}"

# Emscripten flags
export EMCC_CFLAGS="-${OPT_LEVEL}"
if [ "${DEBUG}" = "true" ]; then
    EMCC_CFLAGS="${EMCC_CFLAGS} -g"
fi

# Linker flags
export EMCC_LDFLAGS="-${OPT_LEVEL}"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s INITIAL_MEMORY=${INITIAL_MEMORY}"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s MAXIMUM_MEMORY=${MAXIMUM_MEMORY}"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s ALLOW_MEMORY_GROWTH=1"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s STACK_SIZE=${STACK_SIZE}"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s MODULARIZE=1"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s EXPORT_ES6=1"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s FILESYSTEM=1"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s FORCE_FILESYSTEM=1"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s EXIT_RUNTIME=0"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s INVOKE_RUN=0"
EMCC_LDFLAGS="${EMCC_LDFLAGS} -s EXPORTED_RUNTIME_METHODS=['FS','callMain','ccall','cwrap','UTF8ToString','stringToUTF8']"

if [ "${ENABLE_PTHREADS}" = "true" ]; then
    EMCC_LDFLAGS="${EMCC_LDFLAGS} -s USE_PTHREADS=1"
    EMCC_LDFLAGS="${EMCC_LDFLAGS} -s PTHREAD_POOL_SIZE=4"
fi

export EMCC_LDFLAGS
