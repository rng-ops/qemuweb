# QEMU Wasm Builder
# Deterministic build environment for QEMU → WebAssembly

FROM emscripten/emsdk:latest

ARG QEMU_VERSION=8.2.0

ENV DEBIAN_FRONTEND=noninteractive
ENV EMSDK=/emsdk
ENV PATH="${EMSDK}:${EMSDK}/upstream/emscripten:${PATH}"

# Download and extract QEMU source
WORKDIR /build
RUN wget -q https://download.qemu.org/qemu-${QEMU_VERSION}.tar.xz \
    && tar xf qemu-${QEMU_VERSION}.tar.xz \
    && rm qemu-${QEMU_VERSION}.tar.xz \
    && mv qemu-${QEMU_VERSION} qemu-src

# Copy build scripts and patches
COPY scripts/ /build/scripts/
COPY patches/ /build/patches/

# Make scripts executable
RUN chmod +x /build/scripts/*.sh

# Build QEMU for Wasm
WORKDIR /build/qemu-src

# Apply patches
RUN if [ -d /build/patches ] && [ "$(ls -A /build/patches 2>/dev/null)" ]; then \
        for patch in /build/patches/*.patch; do \
            patch -p1 < "$patch" || true; \
        done; \
    fi

# Configure and build
RUN . ${EMSDK}/emsdk_env.sh && /build/scripts/configure-qemu.sh
RUN . ${EMSDK}/emsdk_env.sh && /build/scripts/compile-qemu.sh

# Output directory
VOLUME /output

# Copy artifacts on run
CMD cp -r /build/qemu-src/build/dist/* /output/ && \
    echo "Build artifacts copied to /output"
