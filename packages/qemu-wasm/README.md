# @qemuweb/qemu-wasm

QEMU compiled to WebAssembly using Emscripten.

## Overview

This package provides QEMU binaries compiled to WebAssembly, enabling x86_64 and aarch64 emulation directly in the browser.

## Build Requirements

- Docker (recommended) OR:
  - Emscripten SDK 3.1.50+
  - Python 3.8+
  - Ninja build system
  - pkg-config

## Building

### Option 1: Docker (Recommended)

```bash
pnpm build:docker
```

This uses a reproducible Docker container with all dependencies.

### Option 2: Local Build

Ensure you have Emscripten SDK installed and activated:

```bash
# Install emsdk if not present
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
cd ..

# Build QEMU
./scripts/build.sh
```

## Build Outputs

After building, the `dist/` directory contains:

- `qemu-system-x86_64.js` - Emscripten JS loader for x86_64
- `qemu-system-x86_64.wasm` - QEMU x86_64 WebAssembly binary
- `qemu-system-aarch64.js` - Emscripten JS loader for aarch64
- `qemu-system-aarch64.wasm` - QEMU aarch64 WebAssembly binary
- `qemu-build.json` - Build metadata

## Usage

```typescript
import { loadQemu, QemuArch } from '@qemuweb/qemu-wasm';

// Load QEMU for x86_64
const qemu = await loadQemu(QemuArch.X86_64);

// Configure and start
qemu.setArguments(['-m', '256', '-nographic']);
await qemu.start();
```

## Architecture Notes

The Wasm build has several limitations compared to native QEMU:

1. **No KVM/WHPF acceleration** - Pure software emulation only
2. **Memory limits** - Browser Wasm memory limits apply
3. **Threading** - Requires SharedArrayBuffer (COOP/COEP headers)
4. **Block devices** - Use virtio-blk for best performance

## Patches Applied

The build applies several patches to QEMU for Wasm compatibility:

1. Disable unsupported backends (SDL2, GTK, etc.)
2. Stub out certain POSIX features
3. Configure for single-threaded or pthreads mode
4. Optimize for code size where possible

## Configuration Options

Edit `scripts/config.sh` to customize:

- `QEMU_VERSION` - QEMU version to build
- `ENABLE_PTHREADS` - Enable multi-threading (requires SharedArrayBuffer)
- `MEMORY_SIZE` - Initial Wasm memory allocation
- `TARGETS` - Which system targets to build

## Troubleshooting

### Build fails with memory errors

Increase Node.js memory:

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

### SharedArrayBuffer not available

Ensure your server sends these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## License

QEMU is licensed under GPL-2.0. This package includes build scripts and TypeScript wrappers.
