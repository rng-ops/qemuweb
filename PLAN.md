# QemuWeb - Comprehensive Project Documentation

> **Purpose**: This document provides a complete understanding of the QemuWeb project for AI assistants and developers. It covers architecture, implementation details, current status, and future development plans.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Vision & Goals](#2-project-vision--goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Package Deep Dives](#5-package-deep-dives)
   - [5.1 @qemuweb/qemu-wasm](#51-qemuwebqemu-wasm)
   - [5.2 @qemuweb/runtime](#52-qemuwebruntime)
   - [5.3 @qemuweb/vm-config](#53-qemuwebvm-config)
   - [5.4 @qemuweb/storage](#54-qemuwebstorage)
   - [5.5 @qemuweb/sidecar-proto](#55-qemuwebsidecar-proto)
6. [Web Application](#6-web-application)
7. [Chrome Extension](#7-chrome-extension)
8. [Key Subsystems](#8-key-subsystems)
   - [8.1 Copy-on-Write Storage](#81-copy-on-write-storage)
   - [8.2 Atlas Store (Content-Addressed Storage)](#82-atlas-store-content-addressed-storage)
   - [8.3 Virtual Networking (SDN)](#83-virtual-networking-sdn)
   - [8.4 Container System](#84-container-system)
   - [8.5 AI Agent Integration](#85-ai-agent-integration)
9. [Current Implementation Status](#9-current-implementation-status)
10. [What's Missing & Needs Building](#10-whats-missing--needs-building)
11. [Technical Challenges](#11-technical-challenges)
12. [Development Workflow](#12-development-workflow)
13. [Deployment](#13-deployment)
14. [API Reference](#14-api-reference)
15. [Appendix: Type Definitions](#15-appendix-type-definitions)

---

## 🤖 AI Assistant Instructions

This document is authoritative.

When assisting with QemuWeb:
- Treat sections marked ✅ as implemented
- Treat 🔶 as partially implemented (do not assume completeness)
- Treat ❌ as not implemented
- Do not invent features outside this plan
- Preserve browser security invariants (COOP/COEP, SAB, no KVM)

## 1. Executive Summary

**QemuWeb** is an ambitious project to run **QEMU virtual machines entirely in the browser** using WebAssembly. The core idea is compiling QEMU to WASM via Emscripten, allowing users to:

- Boot Linux distributions directly in a web page
- Persist VM disk changes using IndexedDB (copy-on-write overlay)
- Run x86_64 and aarch64 emulated systems
- Deploy as a static website (GitHub Pages, Cloudflare Pages, etc.)

The project has evolved beyond basic VM execution into a sophisticated platform with:
- **AI agent integration** (Ollama, LangChain)
- **Software-defined networking** (virtual switches, routers, firewalls)
- **Container management** with MCP (Model Context Protocol) servers
- **Terraform-like infrastructure-as-code** capabilities
- **Content-addressed storage** with provenance tracking (Atlas Store)

---

## 2. Project Vision & Goals

### Primary Goals
1. **Browser-native VM execution**: No plugins, no native code, just WebAssembly
2. **Standard QEMU compatibility**: Run real qcow2/raw disk images
3. **Persistent storage**: Changes survive page reloads via IndexedDB
4. **Static deployment**: Works on any static hosting platform

### Extended Goals (Partially Implemented)
1. **AI-powered infrastructure**: Agents that can provision and manage VMs
2. **Virtual networking**: Multiple VMs communicating over virtual networks
3. **Container orchestration**: Docker-like container management in-browser
4. **WebGPU acceleration**: Offload graphics rendering to GPU (planned)

### Target Use Cases
- Development environments in browser
- Security research sandboxing
- Education and training
- CI/CD testing without cloud costs
- Edge computing scenarios

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WEB APPLICATION                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ React UI    │  │ AI Agent     │  │ Dashboard              │  │
│  │ - Terminal  │  │ - Atlas      │  │ - VM Launcher          │  │
│  │ - Canvas    │  │ - Ollama     │  │ - Network Topology     │  │
│  │ - Controls  │  │ - LangChain  │  │ - Container Manager    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬────────────┘  │
│         │                │                       │               │
│  ┌──────▼────────────────▼───────────────────────▼──────────┐   │
│  │                    QemuClient                             │   │
│  │  - Worker management                                      │   │
│  │  - Command/event protocol                                 │   │
│  │  - State management                                       │   │
│  └─────────────────────────┬─────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │ postMessage
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        WEB WORKER                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    QEMU Runtime                            │  │
│  │  - Message handler                                         │  │
│  │  - VM instance management                                  │  │
│  │  - File mounting                                           │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │           QEMU WebAssembly Module                          │  │
│  │  - qemu-system-x86_64.wasm                                 │  │
│  │  - qemu-system-aarch64.wasm                                │  │
│  │  - Emscripten filesystem                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ FileBlockDevice │  │ HttpBlockDevice │  │ CowBlockDevice  │  │
│  │ (local files)   │  │ (remote URLs)   │  │ (overlay)       │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬─────────┘  │
│           │                    │                    │            │
│  ┌────────▼────────────────────▼────────────────────▼─────────┐ │
│  │                    IndexedDBOverlay                         │ │
│  │  - Sparse block storage                                     │ │
│  │  - VM isolation                                             │ │
│  │  - Export/import                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Atlas Store (CAS)                         ││
│  │  - Content-addressed blobs                                   ││
│  │  - File manifests                                            ││
│  │  - Provenance tracking                                       ││
│  │  - Bundle import/export                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Monorepo Structure

The project uses **pnpm workspaces** with **Turborepo** for build orchestration.

```
qemuweb/
├── package.json              # Root package with workspace scripts
├── pnpm-workspace.yaml       # Workspace definition
├── turbo.json                # Turborepo pipeline configuration
├── tsconfig.json             # Base TypeScript configuration
│
├── apps/
│   └── web/                  # React web application (Vite)
│       ├── src/
│       │   ├── App.tsx       # Main application component
│       │   ├── components/   # UI components
│       │   ├── hooks/        # React hooks
│       │   ├── services/     # Business logic services
│       │   └── workers/      # Web Workers
│       └── public/           # Static assets
│
├── packages/
│   ├── qemu-wasm/            # QEMU → WebAssembly build system
│   │   ├── Dockerfile        # Reproducible build environment
│   │   ├── scripts/          # Build scripts
│   │   ├── patches/          # QEMU patches for Emscripten
│   │   └── src/              # TypeScript type definitions
│   │
│   ├── runtime/              # QEMU worker runtime
│   │   └── src/
│   │       ├── client.ts     # UI-side client API
│   │       ├── worker.ts     # Worker-side runtime
│   │       ├── protocol.ts   # Message protocol types
│   │       └── capabilities.ts # Browser capability detection
│   │
│   ├── vm-config/            # VM profile configuration
│   │   └── src/
│   │       ├── types.ts      # Core type definitions
│   │       ├── profiles.ts   # Default VM profiles
│   │       ├── builder.ts    # QEMU argument builder
│   │       ├── networking.ts # Virtual network definitions
│   │       ├── containers.ts # Container image definitions
│   │       └── infrastructure.ts # Router/Vault profiles
│   │
│   ├── storage/              # Block device abstraction
│   │   └── src/
│   │       ├── types.ts      # Block device interfaces
│   │       ├── fileBlockDevice.ts
│   │       ├── httpBlockDevice.ts
│   │       ├── cowBlockDevice.ts
│   │       ├── indexeddbOverlay.ts
│   │       └── atlasStore/   # Content-addressed storage
│   │
│   └── sidecar-proto/        # WebGPU sidecar protocol
│       └── src/
│           ├── types.ts      # Frame/transport types
│           ├── transport.ts  # Abstract transport interface
│           ├── localTransport.ts
│           └── remoteTransport.ts
│
├── extensions/
│   └── chrome/               # Chrome DevTools extension
│       ├── manifest.json
│       ├── background/
│       ├── devtools/
│       ├── panel/
│       └── popup/
│
└── docker/                   # Docker configuration
    └── nginx.conf            # Production nginx config
```

---

## 5. Package Deep Dives

### 5.1 @qemuweb/qemu-wasm

**Purpose**: Compile QEMU to WebAssembly using Emscripten

**Build Process**:
1. Docker container with Emscripten SDK
2. Download QEMU source (version 8.2.0)
3. Apply WebAssembly compatibility patches
4. Configure for minimal build (no SDL, GTK, etc.)
5. Compile to .wasm and .js loader files

**Output Files** (in `dist/`):
- `qemu-system-x86_64.wasm` - x86_64 emulator (~30-50MB)
- `qemu-system-x86_64.js` - Emscripten JS glue
- `qemu-system-aarch64.wasm` - ARM64 emulator
- `qemu-system-aarch64.js` - Emscripten JS glue
- `qemu-build.json` - Build metadata

**Key Types**:
```typescript
interface QemuModule {
  FS: EmscriptenFS;           // Virtual filesystem
  callMain(args: string[]): number;
  HEAP8/HEAP16/HEAP32: TypedArray;
  _malloc(size: number): number;
  _free(ptr: number): void;
  ready: Promise<QemuModule>;
}
```

**Current Status**: Build scripts exist but WASM binaries must be generated via Docker build.

---

### 5.2 @qemuweb/runtime

**Purpose**: Manages QEMU execution in Web Workers

**Components**:

#### Client (UI Thread)
```typescript
class QemuClient {
  init(): Promise<RuntimeCapabilities>;
  startVm(vmId, profile, inputs, overrides?): Promise<void>;
  stopVm(vmId, force?): Promise<void>;
  resetVm(vmId): Promise<void>;
  sendSerialIn(vmId, data): void;
  syncOverlay(vmId): Promise<void>;
  exportOverlay(vmId, diskId): Promise<ArrayBuffer>;
}
```

#### Worker (Worker Thread)
- Loads QEMU WASM module
- Handles file mounting to Emscripten FS
- Routes serial I/O to/from main thread
- Manages VM lifecycle

#### Protocol Messages
```typescript
// UI → Worker
type WorkerCommand = 
  | StartVmCommand
  | StopVmCommand
  | SerialInCommand
  | SyncOverlayCommand
  | ExportOverlayCommand;

// Worker → UI
type WorkerEvent =
  | VmStartedEvent
  | VmStoppedEvent
  | SerialOutEvent
  | ProgressEvent
  | LogEvent
  | CapabilitiesEvent;
```

#### Capability Detection
```typescript
interface RuntimeCapabilities {
  sharedArrayBuffer: boolean;  // Required for pthreads
  webAssembly: boolean;
  wasmSimd: boolean;
  wasmThreads: boolean;
  bigInt: boolean;
  indexedDb: boolean;
  fileSystemAccess: boolean;
  webGpu: boolean;
  maxMemory: number;           // Browser memory limit
}
```

---

### 5.3 @qemuweb/vm-config

**Purpose**: Define and configure virtual machines

**Core Types**:
```typescript
interface VmProfile {
  id: string;
  name: string;
  arch: 'x86_64' | 'aarch64';
  machine: string;           // e.g., 'q35', 'virt'
  cpu?: string;              // e.g., 'qemu64', 'cortex-a57'
  memoryMiB: number;
  smp: number;
  supportsGraphics: boolean;
  defaultArgs: string[];
  requiresKernel: boolean;
  devices: VmDeviceConfig;
}

interface VmInputs {
  disk?: { file?: File | Blob; url?: string; readonly?: boolean };
  kernel?: { file?: File | Blob; url?: string };
  initrd?: { file?: File | Blob; url?: string };
  kernelCmdline?: string;
  additionalDisks?: Array<{...}>;
}
```

**Default Profiles**:
| Profile ID | Architecture | Machine | Graphics | Memory |
|------------|-------------|---------|----------|--------|
| `linux-x86_64-pc-nographic` | x86_64 | q35 | No | 512 MiB |
| `linux-x86_64-pc-graphics` | x86_64 | q35 | Yes | 512 MiB |
| `linux-aarch64-virt-nographic` | aarch64 | virt | No | 512 MiB |
| `linux-aarch64-virt-graphics` | aarch64 | virt | Yes | 512 MiB |
| `minimal-x86_64` | x86_64 | q35 | No | 128 MiB |

**Infrastructure Profiles** (Special VMs):
| Profile | Purpose |
|---------|---------|
| `busybox-router` | NAT/DHCP router for SDN |
| `hashicorp-vault` | Secrets management |
| `alpine-linux` | Lightweight base image |

**Argument Builder**:
```typescript
function buildQemuArgs(
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): QemuArgsResult {
  // Returns: { args: string[], filesToMount: [...], warnings: [...], errors: [...] }
}
```

---

### 5.4 @qemuweb/storage

**Purpose**: Block device abstraction and persistent storage

**Block Device Interface**:
```typescript
interface BlockDevice {
  readonly id: string;
  readonly size: number;
  readonly blockSize: number;
  readonly readonly: boolean;
  
  readBlocks(blockIndex: number, count: number): Promise<Uint8Array>;
  writeBlocks(blockIndex: number, data: Uint8Array): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}
```

**Implementations**:

| Class | Description |
|-------|-------------|
| `FileBlockDevice` | Reads from File/Blob objects |
| `HttpBlockDevice` | Reads from HTTP URLs with range requests |
| `CowBlockDevice` | Copy-on-write merger (base + overlay) |
| `IndexedDBOverlay` | Sparse block storage in IndexedDB |

**COW Architecture**:
```
┌─────────────────────────────────────────┐
│           CowBlockDevice                 │
│  ┌─────────────────┐  ┌───────────────┐ │
│  │ BaseDevice      │  │ Overlay       │ │
│  │ (read-only)     │  │ (IndexedDB)   │ │
│  │                 │  │               │ │
│  │ Original disk   │  │ Modified      │ │
│  │ image           │  │ blocks only   │ │
│  └────────┬────────┘  └───────┬───────┘ │
│           │                   │          │
│           └─────────┬─────────┘          │
│                     ▼                    │
│              Read: Check overlay first   │
│              Write: Always to overlay    │
└─────────────────────────────────────────┘
```

**IndexedDB Schema**:
- Database: `qemuweb-storage`
- Object Store: `blocks`
  - Key: `vmId:diskId:blockIndex`
  - Indexes: `by-vmId`, `by-vmDisk`

---

### 5.4.1 Atlas Store (Content-Addressed Storage)

**Purpose**: Git-like content storage with provenance tracking

**Features**:
- SHA-256 content hashing
- Chunked file storage (4 MiB chunks)
- File manifests
- Provenance chain tracking
- Bundle import/export

**Core Types**:
```typescript
type ContentHash = `sha256:${string}`;

interface FileManifest {
  version: 1;
  type: ManifestType;  // 'qcow2' | 'wasm' | 'kernel' | etc.
  totalSize: number;
  chunks: BlobChunk[];
  mimeType?: string;
}

interface FileMetadata {
  id: string;
  name: string;
  manifestHash: ContentHash;
  type: ManifestType;
  size: number;
  origin: FileOrigin;  // 'uploaded' | 'built' | 'generated' | etc.
  tags: string[];
  sharedWithAssistant: boolean;
  provenanceId?: string;
}

interface ProvenanceRecord {
  id: string;
  manifestHash: ContentHash;
  type: ProvenanceType;  // 'create' | 'derive' | 'import' | etc.
  actor: 'user' | 'assistant' | 'build' | 'system';
  buildInfo?: BuildInfo;
  derivation?: DerivationRecord;
  signatures?: SignatureRecord[];
}
```

**Store API**:
```typescript
interface AtlasStore {
  // Blob operations
  putBlob(data: ArrayBuffer): Promise<ContentHash>;
  getBlob(hash: ContentHash): Promise<ArrayBuffer | null>;
  
  // File operations
  registerFile(name, manifestHash, metadata): Promise<FileMetadata>;
  listFiles(filter?): Promise<FileMetadata[]>;
  
  // Provenance
  addProvenance(record): Promise<ProvenanceRecord>;
  getProvenanceChain(id): Promise<ProvenanceRecord[]>;
  
  // Bundles
  exportBundle(fileNames): Promise<Blob>;
  importBundle(bundle): Promise<ImportResult>;
}
```

---

### 5.5 @qemuweb/sidecar-proto

**Purpose**: Protocol for GPU-accelerated rendering (planned)

**Concept**: Instead of rendering VGA in the worker, stream frames to main thread or WebGPU sidecar for acceleration.

**Frame Transport**:
```typescript
interface Frame {
  metadata: FrameMetadata;
  data: ArrayBuffer | SharedArrayBuffer;
}

interface FrameMetadata {
  sequence: number;
  timestamp: number;
  width: number;
  height: number;
  format: 'rgba' | 'rgb565' | 'yuv420' | 'compressed';
  keyframe: boolean;
}

interface FrameTransport {
  connect(): Promise<void>;
  sendFrame(frame: Frame): Promise<void>;
  receiveFrame(): Promise<Frame | null>;
}
```

**Implementations**:
- `LocalTransport`: SharedArrayBuffer ring buffer
- `RemoteTransport`: WebSocket/WebRTC (for remote display)

---

## 6. Web Application

**Technology Stack**:
- React 18
- Vite 5
- TypeScript 5.4
- Tailwind CSS 3.4
- xterm.js (terminal emulator)
- LangChain (AI integration)

**Application Modes**:
| Mode | Description |
|------|-------------|
| `dashboard` | Main control panel with widgets |
| `ide` | Code editor layout |
| `vm` | Classic VM launcher/terminal view |
| `network` | Network topology visualization |
| `browser` | Internal browser for testing |
| `ollama` | Ollama model management |

**Key Components**:
```
components/
├── VmLauncher.tsx        # VM configuration and launch
├── TerminalView.tsx      # xterm.js serial console
├── StatusBar.tsx         # VM status display
├── CapabilityWarnings.tsx # Browser compatibility alerts
├── IDELayout.tsx         # Full IDE interface
├── dashboard/            # Dashboard widgets
├── agent/                # AI agent interface
│   └── AtlasFrame.tsx    # Floating agent panel
├── network/              # Network topology
├── containers/           # Container management
└── ollama/               # Ollama integration
```

**Key Hooks**:
```typescript
// VM management
useQemuClient({ onSerialOut, onLog, onProgress })

// Storage
useAtlasStore()

// AI
useAgent()
useDOMAgent()

// Networking
useSDN()
useContainers()
```

**Services** (in `services/`):
| Service | Purpose |
|---------|---------|
| `atlasAgent.ts` | Main AI agent orchestration |
| `atlasToolSystem.ts` | Agent tool definitions |
| `atlasPolicyEngine.ts` | Security policy engine |
| `ollamaService.ts` | Ollama API integration |
| `vectorMemory.ts` | Vector embeddings for RAG |
| `eventTracker.ts` | User action tracking |
| `auditLog.ts` | Security audit logging |
| `credentialService.ts` | Credential management |
| `taskStore.ts` | Background task management |

---

## 7. Chrome Extension

**Purpose**: Run VMs in Chrome DevTools panel

**Manifest (v3)**:
```json
{
  "manifest_version": 3,
  "permissions": ["storage", "unlimitedStorage"],
  "devtools_page": "devtools/devtools.html",
  "background": { "service_worker": "background/service-worker.js" },
  "cross_origin_embedder_policy": { "value": "require-corp" },
  "cross_origin_opener_policy": { "value": "same-origin" }
}
```

**Components**:
- `devtools/` - DevTools page injection
- `panel/` - VM control panel
- `popup/` - Extension popup
- `background/` - Service worker

---

## 8. Key Subsystems

### 8.1 Copy-on-Write Storage

The COW system enables running from read-only disk images while persisting changes.

**Flow**:
1. User provides disk image (file or URL)
2. Create `FileBlockDevice` or `HttpBlockDevice` as base
3. Create `IndexedDBOverlay` for the VM
4. Wrap in `CowBlockDevice`
5. All reads check overlay first, fall back to base
6. All writes go to overlay
7. Changes persist in IndexedDB

**Export/Import**:
```typescript
// Export modified blocks only
const overlayData = await cowDevice.exportOverlay();
// Creates compact export of just changed blocks

// Import on another browser
await cowDevice.importOverlay(overlayData);
```

---

### 8.2 Atlas Store (Content-Addressed Storage)

**Purpose**: Git-like storage for VM images, builds, and artifacts

**Key Features**:
1. **Deduplication**: Same content = same hash = stored once
2. **Chunking**: Large files split into 4 MiB chunks
3. **Provenance**: Track where files came from
4. **Verification**: Verify integrity at any time
5. **Bundles**: Export/import for sharing

**Use Cases**:
- Store built QEMU WASM files
- Store disk images
- Track agent-generated files
- Share VM configurations

---

### 8.3 Virtual Networking (SDN)

**Types** (in `vm-config/networking.ts`):

```typescript
interface VirtualNetwork {
  id: string;
  type: 'bridge' | 'nat' | 'isolated' | 'routed';
  cidr: string;
  gateway?: string;
  dhcp?: DhcpConfig;
  dns?: DnsConfig;
  interfaces: VirtualInterface[];
}

interface VirtualRouter {
  interfaces: RouterInterface[];
  routes: Route[];
  nat?: NatConfig;
  firewall?: FirewallConfig;
}
```

**Default Networks**:
- `management` - 10.0.0.0/24 (NAT)
- `internal` - 192.168.100.0/24 (isolated)
- `dmz` - 172.16.0.0/24 (routed)

---

### 8.4 Container System

**Purpose**: Docker-like container definitions for infrastructure

**Container Types**:
| Type | Description |
|------|-------------|
| `base` | Minimal Alpine with SSH |
| `hypervisor` | Container orchestration |
| `agent` | Autonomous AI agent container |
| `busybox-router` | SDN gateway/router |

**MCP Server Integration**:
Containers can expose MCP (Model Context Protocol) servers:
```typescript
interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'websocket';
  endpoint?: string;
  capabilities: MCPServerCapability[];
  enabled: boolean;
  autoStart: boolean;
}
```

**Example Container** (BusyBox Router):
- 64 MiB memory
- SSH, DNS, DHCP services
- MCP servers for:
  - SDN control plane
  - Firewall management
  - Policy engine

---

### 8.5 AI Agent Integration

**Components**:
1. **Atlas Agent** - Main orchestration
2. **Tool System** - MCP-compatible tools
3. **Policy Engine** - Security controls
4. **Vector Memory** - RAG capabilities
5. **Ollama Service** - Local LLM integration

**Agent Capabilities** (from containers.ts):
```typescript
type AgentCapability = 
  | 'fs_read' | 'fs_write'      // Filesystem
  | 'process_exec'               // Command execution
  | 'mcp_connect' | 'mcp_manage' // MCP servers
  | 'terraform_plan' | 'terraform_apply'
  | 'container_manage';
```

---

## 9. Current Implementation Status

### ✅ Fully Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Monorepo structure | ✅ | pnpm + Turborepo working |
| TypeScript types | ✅ | All packages typed |
| VM profile system | ✅ | 5 default profiles |
| QEMU argument builder | ✅ | Tested and working |
| IndexedDB overlay | ✅ | With tests |
| COW block device | ✅ | With tests |
| Atlas Store types | ✅ | Full CAS design |
| Browser Atlas Store | ✅ | IndexedDB implementation |
| Runtime protocol | ✅ | Full message types |
| Runtime client | ✅ | UI-side API |
| Capability detection | ✅ | All browser checks |
| Virtual network types | ✅ | Full SDN model |
| Container definitions | ✅ | 4 container types |
| Infrastructure profiles | ✅ | Router, Vault, Alpine |
| React application shell | ✅ | Multi-mode UI |
| Chrome extension manifest | ✅ | Manifest V3 |

### 🔶 Partially Implemented

| Component | Status | Missing |
|-----------|--------|---------|
| Worker runtime | 🔶 | Mock QEMU module only |
| QEMU WASM build | 🔶 | Scripts exist, need Docker run |
| Sidecar protocol | 🔶 | Types done, no WebGPU impl |
| Web app services | 🔶 | Many stubs |
| Agent integration | 🔶 | Framework exists, limited tools |

### ❌ Not Implemented

| Component | Status | Required Work |
|-----------|--------|---------------|
| Actual QEMU execution | ❌ | Build WASM, test integration |
| Graphics rendering | ❌ | Canvas/WebGPU display |
| VM-to-VM networking | ❌ | WebSocket/SharedArrayBuffer |
| Network simulation | ❌ | Latency, packet loss |
| Real MCP servers | ❌ | Need container images |
| File sharing (9p) | ❌ | virtio-9p implementation |
| Snapshots | ❌ | Save/restore state |

---

## 10. What's Missing & Needs Building

### Priority 1: Core Functionality

#### 10.1 Build QEMU WASM Binaries
```bash
cd packages/qemu-wasm
docker build -t qemu-wasm-builder .
docker run --rm -v $(pwd)/dist:/output qemu-wasm-builder
```
**Estimated time**: 30-60 minutes build

#### 10.2 Worker Integration with Real QEMU
Current `worker.ts` has a mock QEMU module. Need to:
1. Import actual QEMU JS loader
2. Configure Emscripten properly
3. Set up stdin/stdout pipes
4. Handle disk mounting

```typescript
// Replace mock with real module loading
import createQemuModule from '@qemuweb/qemu-wasm/qemu.js';

async function loadQemuModule(arch: 'x86_64' | 'aarch64'): Promise<QemuModule> {
  const module = await createQemuModule({
    print: (text) => handleQemuOutput(text),
    printErr: (text) => handleQemuError(text),
    locateFile: (path) => `/qemu-wasm/${path}`,
  });
  return module;
}
```

#### 10.3 Graphics Display
Two approaches:
1. **Canvas rendering** (simpler): Port framebuffer to 2D canvas
2. **WebGPU sidecar** (faster): Use sidecar-proto

#### 10.4 HTTP Block Device Range Requests
`httpBlockDevice.ts` needs actual implementation:
```typescript
async readBlocks(blockIndex: number, count: number): Promise<Uint8Array> {
  const start = blockIndex * this.blockSize;
  const end = start + count * this.blockSize - 1;
  
  const response = await fetch(this.url, {
    headers: { Range: `bytes=${start}-${end}` }
  });
  
  return new Uint8Array(await response.arrayBuffer());
}
```

---

### Priority 2: Networking

#### 10.5 VM-to-VM Communication
Options:
1. **SharedArrayBuffer** - Fast, same-origin
2. **MessageChannel** - Slower, cross-origin
3. **WebSocket** - Server-mediated

#### 10.6 Virtual Switch Implementation
```typescript
class VirtualSwitch {
  private ports = new Map<string, MessagePort>();
  
  connect(interfaceId: string, port: MessagePort) {
    this.ports.set(interfaceId, port);
    port.onmessage = (e) => this.forward(interfaceId, e.data);
  }
  
  forward(source: string, frame: Uint8Array) {
    const destMac = frame.slice(0, 6);
    // MAC learning + forwarding
  }
}
```

---

### Priority 3: Agent & Automation

#### 10.7 Real MCP Tool Implementation
Current tools are stubs. Need actual implementations:
```typescript
// Example: File tool
const readFileTool = {
  name: 'read_file',
  async execute(params: { path: string }): Promise<string> {
    const atlasStore = await getAtlasStore();
    const data = await atlasStore.readFile(params.path);
    return new TextDecoder().decode(data);
  }
};
```

#### 10.8 Terraform State Management
Implement actual Terraform-like state:
```typescript
interface TerraformState {
  version: 4;
  serial: number;
  lineage: string;
  resources: ResourceState[];
}
```

---

### Priority 4: Polish & UX

#### 10.9 Network Topology Visualization
- D3.js or React Flow
- Show VMs, switches, routers
- Real-time traffic animation

#### 10.10 Disk Image Builder
UI for creating custom images:
- Base image selection
- Package installation
- Cloud-init configuration
- QCOW2 generation

---

## 11. Technical Challenges

### 11.1 SharedArrayBuffer Requirements
Modern browsers require COOP/COEP headers for SharedArrayBuffer:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

This limits:
- Cross-origin resources (images, fonts)
- Third-party scripts
- Some CDN usage

### 11.2 Memory Limits
Browser WASM memory limits:
- Chrome: ~4GB (64-bit)
- Firefox: ~4GB
- Safari: ~2GB

VMs must be configured within these limits.

### 11.3 Performance
QEMU in WASM is 10-50x slower than native:
- No hardware virtualization
- JavaScript/WASM interpretation overhead
- Single-threaded (unless pthreads enabled)

Mitigations:
- Minimal VM images
- Reduce memory access
- Use virtio for I/O
- Enable SIMD where supported

### 11.4 Storage Quotas
IndexedDB has browser-specific limits:
- Chrome: 60% of disk
- Firefox: 50% of disk
- Safari: 1GB (with prompts for more)

### 11.5 Graphics Performance
VGA emulation is slow. Solutions:
- Use nographic mode when possible
- Implement WebGPU acceleration
- Reduce framerate
- Use dirty rectangle tracking

---

## 12. Development Workflow

### Setup
```bash
# Clone and install
git clone https://github.com/example/qemuweb.git
cd qemuweb
pnpm install

# Build all packages
pnpm build

# Start dev server
pnpm dev
```

### Building QEMU WASM
```bash
cd packages/qemu-wasm
pnpm build:docker
# Wait 30-60 minutes
```

### Running Tests
```bash
# All tests
pnpm test

# Specific package
pnpm --filter @qemuweb/storage test

# Watch mode
pnpm test:watch
```

### Adding a New Package
1. Create directory in `packages/`
2. Add `package.json` with `@qemuweb/` prefix
3. Add to `pnpm-workspace.yaml` (automatic if in packages/)
4. Add build dependency in `turbo.json` if needed

---

## 13. Deployment

### Static Hosting

```bash
pnpm build
# Output in apps/web/dist/
```

**Required Headers** (for SharedArrayBuffer):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Cloudflare Pages
```
Build command: pnpm build
Output directory: apps/web/dist
```

Add `apps/web/public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Docker
```dockerfile
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/dist /usr/share/nginx/html
```

---

## 14. API Reference

### QemuClient
```typescript
class QemuClient {
  constructor(options?: QemuClientOptions);
  
  init(): Promise<RuntimeCapabilities>;
  startVm(vmId: string, profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides): Promise<void>;
  stopVm(vmId: string, force?: boolean): Promise<void>;
  resetVm(vmId: string): Promise<void>;
  sendSerialIn(vmId: string, data: string): void;
  getVmState(vmId: string): VmState | undefined;
  getCapabilities(): RuntimeCapabilities | null;
  terminate(): void;
}
```

### BrowserAtlasStore
```typescript
class BrowserAtlasStore implements AtlasStore {
  init(): Promise<void>;
  
  // Store file with chunking
  storeFile(name: string, data: ArrayBuffer, options: {...}): Promise<FileMetadata>;
  
  // Read file (reassembles chunks)
  readFile(name: string): Promise<ArrayBuffer | null>;
  
  // List with filters
  listFiles(filter?: FileFilter): Promise<FileMetadata[]>;
  
  // Export bundle
  exportBundle(fileNames: string[]): Promise<Blob>;
}
```

### Profile Builder
```typescript
function buildQemuArgs(
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): QemuArgsResult;

// Result
interface QemuArgsResult {
  args: string[];                    // QEMU command line
  arch: 'x86_64' | 'aarch64';
  filesToMount: FileMountInfo[];     // Files to mount in worker
  warnings: string[];
  errors: string[];
}
```

---

## 15. Appendix: Type Definitions

### VmProfile
```typescript
interface VmProfile {
  id: string;
  name: string;
  description: string;
  arch: 'x86_64' | 'aarch64';
  machine: string;
  cpu?: string;
  memoryMiB: number;
  smp: number;
  supportsGraphics: boolean;
  defaultArgs: string[];
  requiresKernel: boolean;
  kernelHelpText?: string;
  devices: {
    diskInterface: 'virtio-blk' | 'ide' | 'scsi';
    net: 'user' | 'none';
    rng?: boolean;
    serial: 'stdio' | 'ttyS0' | 'pty';
    usb?: boolean;
    keyboard?: boolean;
  };
  blockSizeBytes?: number;
  maxMemoryMiB?: number;
}
```

### ContainerImage
```typescript
interface ContainerImage {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'base' | 'hypervisor' | 'agent' | 'custom';
  arch: 'x86_64' | 'aarch64';
  profileId: string;
  memoryMiB: number;
  ssh: SSHConfig;
  ports: PortMapping[];
  mcpServers: MCPServerConfig[];
  terraform?: TerraformMetadata;
  tags: string[];
}
```

### VirtualNetwork
```typescript
interface VirtualNetwork {
  id: string;
  name: string;
  type: 'bridge' | 'nat' | 'isolated' | 'routed';
  cidr: string;
  gateway?: string;
  dhcp?: DhcpConfig;
  dns?: DnsConfig;
  interfaces: VirtualInterface[];
}
```

---

## Summary

QemuWeb is a technically ambitious project with a solid architectural foundation. The type system is comprehensive, the storage layer is well-designed, and the modular package structure allows for incremental development.

**To get a working MVP:**
1. Build QEMU WASM binaries (Docker)
2. Integrate real QEMU module in worker
3. Test with a minimal Linux kernel/initrd
4. Add serial console I/O

**For a polished product:**
5. Implement graphics display
6. Add network simulation
7. Build agent tools
8. Create disk image builder
9. Add monitoring and metrics

The foundation is there—it needs execution and testing to become a fully functional browser-based VM platform.
