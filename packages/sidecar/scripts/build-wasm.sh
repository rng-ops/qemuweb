#!/bin/bash
# Build WASM sidecar using wasm-pack

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Building WASM sidecar..."

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found, installing..."
    cargo install wasm-pack
fi

# Build WASM package
wasm-pack build \
    --target web \
    --out-dir dist/wasm \
    --features wasm \
    --no-default-features \
    -- --profile release-wasm

echo "Built WASM package in dist/wasm/"

# Generate TypeScript declarations
cat > dist/wasm/sidecar.d.ts << 'EOF'
/**
 * QemuWeb Sidecar WASM bindings
 */

export class WasmSidecar {
  constructor();
  
  /** Connect to a remote sidecar server */
  connect(url: string): void;
  
  /** Disconnect from the server */
  disconnect(): void;
  
  /** Send a ping message */
  ping(): void;
  
  /** Set the frame format */
  set_format(format: 'rgba' | 'rgb565' | 'yuv420' | 'compressed', width: number, height: number): void;
  
  /** Send frame data */
  send_frame(data: Uint8Array, width: number, height: number, keyframe: boolean): void;
  
  /** Get connection state */
  get_state(): 'disconnected' | 'connecting' | 'connected' | 'error';
  
  /** Get current FPS */
  get_fps(): number;
  
  /** Get frames received count */
  get_frames_received(): bigint;
  
  /** Get bytes transferred */
  get_bytes_transferred(): bigint;
  
  /** Set callback for frame events */
  on_frame(callback: (data: ArrayBuffer) => void): void;
  
  /** Set callback for state changes */
  on_state_change(callback: (state: string) => void): void;
  
  /** Set callback for errors */
  on_error(callback: (error: unknown) => void): void;
}

/** Get the sidecar version */
export function version(): string;

/** Check if WebGPU is available */
export function check_webgpu(): Promise<boolean>;

/** Initialize the WASM module */
export default function init(): Promise<void>;
EOF

echo "Generated TypeScript declarations"
