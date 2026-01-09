# QemuWeb

[![CI](https://github.com/example/qemuweb/actions/workflows/ci.yml/badge.svg)](https://github.com/example/qemuweb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Run **standard QEMU disk images** (qcow2/raw) inside the browser using **QEMU compiled to WebAssembly** (Emscripten).

![QemuWeb Screenshot](docs/screenshot.png)

## ✨ Features

- 🖥️ **Full QEMU Emulation** - x86_64 and aarch64 architecture support
- 📂 **Multiple Input Methods** - File picker, drag-and-drop, URL loading
- 💾 **Persistent Storage** - IndexedDB overlay for copy-on-write disk modifications
- 🔧 **Pluggable Profiles** - Pre-configured machine profiles for common use cases
- 🌐 **Static Deployment** - Deploy as a static site (GitHub Pages, Cloudflare Pages, etc.)
- 🧩 **Chrome Extension** - DevTools panel for running VMs

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for building QEMU WASM)

### Installation

```bash
# Clone the repository
git clone https://github.com/example/qemuweb.git
cd qemuweb

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
pnpm dev
```

Open http://localhost:5173 in your browser.

### Using a Pre-built QEMU WASM

Download pre-built QEMU WASM binaries from the [releases page](https://github.com/example/qemuweb/releases) and place them in `packages/qemu-wasm/dist/`.

## 📦 Project Structure

```
qemuweb/
├── apps/
│   └── web/                    # Vite + React web application
├── extensions/
│   └── chrome/                 # Chrome DevTools extension
├── packages/
│   ├── qemu-wasm/              # QEMU → WebAssembly build scripts
│   ├── vm-config/              # Machine profile definitions
│   ├── storage/                # IndexedDB overlay & block devices
│   ├── runtime/                # Web Worker runtime for QEMU
│   └── sidecar-proto/          # WebGPU sidecar protocol (future)
└── .github/
    └── workflows/              # CI/CD pipelines
```

## 🎮 VM Profiles

| Profile | Architecture | Machine | Use Case |
|---------|-------------|---------|----------|
| `linux-x86_64-pc-nographic` | x86_64 | pc | Serial console only |
| `linux-x86_64-pc-graphics` | x86_64 | pc | VGA display |
| `linux-aarch64-virt-nographic` | aarch64 | virt | ARM64 serial console |
| `linux-aarch64-virt-graphics` | aarch64 | virt | ARM64 VGA display |
| `minimal-x86_64` | x86_64 | microvm | Minimal footprint |

### Creating Custom Profiles

```typescript
import { VmProfile, buildQemuArgs } from '@qemuweb/vm-config';

const myProfile: VmProfile = {
  id: 'my-custom-profile',
  name: 'My Custom VM',
  arch: 'x86_64',
  machine: 'pc',
  cpu: 'qemu64',
  memoryMiB: 1024,
  smp: 2,
  display: 'none',
  serial: 'stdio',
  drives: [{ type: 'virtio-blk', slot: 0, format: 'qcow2', bootindex: 0 }],
  netdevs: [{ type: 'user', id: 'net0' }],
  extraArgs: ['-enable-kvm'], // ignored in browser
};

const args = buildQemuArgs(myProfile, { disk: diskFile }, { memoryMiB: 2048 });
```

## 🔧 Building QEMU WASM

The QEMU WebAssembly build uses Docker for reproducibility:

```bash
cd packages/qemu-wasm

# Build the Docker image and compile QEMU
./scripts/build.sh

# Output files:
# - dist/qemu-system-x86_64.wasm
# - dist/qemu-system-x86_64.js
# - dist/qemu-system-aarch64.wasm
# - dist/qemu-system-aarch64.js
```

**Build time:** ~30-60 minutes depending on hardware.

## 🗄️ Storage Layer

QemuWeb uses a copy-on-write (COW) storage layer:

1. **Base Image** - Original disk image (read-only)
2. **Overlay** - Modified blocks stored in IndexedDB
3. **COW Device** - Merges reads from base + overlay

```typescript
import { FileBlockDevice, IndexedDBOverlay, CowBlockDevice } from '@qemuweb/storage';

// Create base device from file
const base = new FileBlockDevice(diskFile);
await base.open();

// Create IndexedDB overlay
const overlay = new IndexedDBOverlay('my-vm-overlay');
await overlay.open();

// Create COW device
const cow = new CowBlockDevice(base, overlay);

// All writes go to overlay, reads merge both
await cow.write(0, data);
const block = await cow.read(0);

// Export modified disk
const modifiedDisk = await overlay.exportAsBlob();
```

## 🌐 Deployment

### Static Hosting

```bash
# Build for production
pnpm build

# Output in apps/web/dist/
```

**Important:** The server must set these headers for SharedArrayBuffer support:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### GitHub Pages

The CI workflow automatically deploys to GitHub Pages on push to `main`.

### Cloudflare Pages

1. Connect your repository to Cloudflare Pages
2. Set build command: `pnpm build`
3. Set output directory: `apps/web/dist`
4. Add headers in `_headers` file:
   ```
   /*
     Cross-Origin-Opener-Policy: same-origin
     Cross-Origin-Embedder-Policy: require-corp
   ```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific package tests
pnpm --filter @qemuweb/storage test

# Run E2E tests
pnpm --filter @qemuweb/web test:e2e
```

## 🛠️ Development

```bash
# Start dev server with hot reload
pnpm dev

# Lint and format
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

## 🔮 Roadmap

- [ ] **WebGPU Sidecar** - GPU-accelerated display via WebGPU
- [ ] **Networking** - WebSocket-based network stack
- [ ] **Snapshots** - Save/restore VM state
- [ ] **Multi-VM** - Run multiple VMs simultaneously
- [ ] **ARM64 Native** - Native ARM64 emulation on ARM devices
- [ ] **File Sharing** - virtio-9p for host ↔ guest file sharing

## ⚠️ Known Limitations

1. **Performance** - JavaScript/WASM emulation is slower than native QEMU
2. **Memory** - Limited by browser memory (typically 2-4GB max)
3. **No KVM** - Hardware virtualization not available in browsers
4. **SharedArrayBuffer** - Requires COOP/COEP headers (no cross-origin resources)
5. **Storage** - IndexedDB has browser-specific size limits
6. **Graphics** - VGA emulation is slow; WebGPU sidecar planned

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [QEMU](https://www.qemu.org/) - The amazing emulator that makes this possible
- [Emscripten](https://emscripten.org/) - C/C++ to WebAssembly compiler
- [xterm.js](https://xtermjs.org/) - Terminal emulator for the web
- [copy/v86](https://github.com/copy/v86) - Inspiration for browser-based emulation
