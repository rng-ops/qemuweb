#!/bin/bash
# Configure QEMU for Emscripten/Wasm build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# Build target list for configure
TARGET_LIST=$(IFS=,; echo "${TARGETS[*]}")

echo "Configuring QEMU for targets: ${TARGET_LIST}"

# Base configure options
CONFIGURE_OPTS=(
    "--cross-prefix=em"
    "--target-list=${TARGET_LIST}"
    "--static"
    "--disable-system"
    "--enable-softmmu"
    "--disable-user"
    "--disable-linux-user"
    "--disable-bsd-user"
    "--disable-tools"
    "--disable-guest-agent"
    
    # Disable hardware acceleration (not available in browser)
    "--disable-kvm"
    "--disable-hvf"
    "--disable-whpx"
    "--disable-hax"
    "--disable-tcg-interpreter"
    
    # Disable UI/graphics backends we can't use
    "--disable-sdl"
    "--disable-gtk"
    "--disable-vnc"
    "--disable-cocoa"
    "--disable-curses"
    "--disable-opengl"
    "--disable-virglrenderer"
    "--disable-spice"
    
    # Disable audio (for now)
    "--disable-coreaudio"
    "--disable-alsa"
    "--disable-pa"
    "--disable-oss"
    
    # Disable network backends we can't use
    "--disable-nettle"
    "--disable-gnutls"
    "--disable-gcrypt"
    "--disable-auth-pam"
    "--disable-libssh"
    
    # Disable features not needed
    "--disable-docs"
    "--disable-vhost-user"
    "--disable-vhost-kernel"
    "--disable-vhost-net"
    "--disable-vhost-crypto"
    "--disable-vhost-vdpa"
    "--disable-libusb"
    "--disable-usb-redir"
    "--disable-smartcard"
    "--disable-cap-ng"
    "--disable-seccomp"
    "--disable-glusterfs"
    "--disable-libiscsi"
    "--disable-libnfs"
    "--disable-rbd"
    "--disable-brlapi"
    "--disable-rdma"
    "--disable-pvrdma"
    "--disable-numa"
    "--disable-fdt"
    "--disable-membarrier"
    "--disable-live-block-migration"
    "--disable-vde"
    "--disable-netmap"
    "--disable-l2tpv3"
    "--disable-xen"
    "--disable-capstone"
    "--disable-slirp"
    "--disable-libdw"
    
    # Enable what we need
    "--enable-tcg"
    "--enable-virtio-blk"
    
    # Optimization
    "--disable-debug-info"
    "--disable-debug-tcg"
    "--disable-qom-cast-debug"
)

# Add cross-compilation settings via environment
export CC="emcc"
export CXX="em++"
export AR="emar"
export NM="emnm"
export RANLIB="emranlib"
export CFLAGS="${EMCC_CFLAGS}"
export CXXFLAGS="${EMCC_CFLAGS}"
export LDFLAGS="${EMCC_LDFLAGS}"

# Create build directory
mkdir -p build
cd build

# Run configure
../configure "${CONFIGURE_OPTS[@]}" || {
    echo "Configure failed. Trying minimal configuration..."
    
    # Fallback: minimal config
    ../configure \
        --target-list="${TARGET_LIST}" \
        --static \
        --disable-system \
        --enable-softmmu \
        --disable-user \
        --without-default-features \
        --enable-tcg
}

echo "Configuration complete"
