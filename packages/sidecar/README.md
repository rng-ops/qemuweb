# @qemuweb/sidecar

Native sidecar for BrowserQEMU providing WebGPU-accelerated rendering and host integration.

## Features

- **Native Binary**: WebSocket server for local/remote connections
- **WASM Build**: Run in-browser with WebGPU acceleration
- **Unified Protocol**: Same message format across all targets
- **Cross-Platform**: Compiles for macOS (M1/M2/Intel), Linux, and WASM

## Building

### Prerequisites

- Rust 1.70+ with `cargo`
- For WASM: `wasm-pack` (will be installed automatically if missing)

### Native Build (M2 Mac)

```bash
./scripts/build-native.sh
```

Output: `dist/qemuweb-sidecar-darwin-arm64`

### WASM Build

```bash
./scripts/build-wasm.sh
```

Output: `dist/wasm/`

### Build All

```bash
./scripts/build-all.sh
```

## Running

### Native Server

```bash
# Default port 9876
./dist/qemuweb-sidecar-darwin-arm64

# Custom address
./dist/qemuweb-sidecar-darwin-arm64 127.0.0.1:8080
```

### WASM (in browser)

```javascript
import init, { WasmSidecar, check_webgpu } from '@qemuweb/sidecar';

await init();

if (await check_webgpu()) {
  const sidecar = new WasmSidecar();
  sidecar.connect('ws://localhost:9876');
  
  sidecar.on_frame((data) => {
    console.log('Frame received:', data.byteLength, 'bytes');
  });
}
```

## Protocol

The sidecar uses JSON messages over WebSocket with binary frame data.

### Messages (Emulator → Sidecar)

| Type | Description |
|------|-------------|
| `setMode` | Set operating mode (local/remote/disabled) |
| `setFormat` | Set frame format and dimensions |
| `frame` | Frame metadata (binary data follows) |
| `ping` | Latency check |

### Messages (Sidecar → Emulator)

| Type | Description |
|------|-------------|
| `modeAck` | Mode change acknowledgment |
| `formatAck` | Format change acknowledgment |
| `frameAck` | Frame received acknowledgment |
| `pong` | Ping response with timing |
| `error` | Error notification |

### Frame Formats

| Format | Description | BPP |
|--------|-------------|-----|
| `rgba` | 32-bit RGBA (default) | 4 |
| `rgb565` | 16-bit RGB | 2 |
| `yuv420` | YUV 4:2:0 planar | ~1.5 |
| `compressed` | LZ4/zstd compressed | variable |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (WASM)                         │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   QEMU      │───▶│ WasmSidecar  │───▶│   WebGPU     │   │
│  │  (Worker)   │    │   (Rust)     │    │  Renderer    │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│                             │                               │
│                             │ WebSocket                     │
│                             ▼                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Native Sidecar (Rust)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SidecarServer (WebSocket)              │   │
│  │                                                      │   │
│  │  • Frame buffer management                          │   │
│  │  • Format conversion                                │   │
│  │  • Network bridging                                 │   │
│  │  • File system access                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Run Tests

```bash
cargo test
```

### Check Formatting

```bash
cargo fmt --check
```

### Lint

```bash
cargo clippy
```

## Cross-Compilation

### For Intel Mac (from M2)

```bash
rustup target add x86_64-apple-darwin
cargo build --release --target x86_64-apple-darwin --features native
```

### For Linux (from Mac)

```bash
# Install cross-compilation toolchain
brew install filosottile/musl-cross/musl-cross

rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl --features native
```

## License

MIT
