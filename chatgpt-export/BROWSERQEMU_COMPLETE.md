# QemuWeb - Complete Codebase Documentation

This document contains the complete documentation and key source files for the QemuWeb project.
It is designed to be uploaded to ChatGPT or other AI assistants for context.

---

## PLAN.md - Project Documentation

```markdown
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
```

---
# KEY SOURCE FILES

## packages/runtime/src/index.ts
```typescript
/**
 * @qemuweb/runtime
 *
 * QEMU WebAssembly runtime for browser workers
 */

// Protocol types
export type {
  WorkerCommand,
  WorkerEvent,
  StartVmCommand,
  StopVmCommand,
  ResetVmCommand,
  SerialInCommand,
  MountDiskCommand,
  MountKernelCommand,
  MountInitrdCommand,
  SyncOverlayCommand,
  ExportOverlayCommand,
  ImportOverlayCommand,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
  OverlayExportedEvent,
  CapabilitiesEvent,
  RuntimeCapabilities,
  VmState,
} from './protocol.js';

export { createRequestId } from './protocol.js';

// Capability detection
export {
  detectCapabilities,
  detectSharedArrayBuffer,
  detectWebAssembly,
  detectWasmSimd,
  detectWasmThreads,
  detectBigInt,
  detectIndexedDb,
  detectFileSystemAccess,
  detectWebGpu,
  detectMaxMemory,
  summarizeCapabilities,
  checkMinimumRequirements,
} from './capabilities.js';

// Client
export { QemuClient } from './client.js';
export type { QemuClientOptions } from './client.js';
```

## packages/runtime/src/client.ts
```typescript
/**
 * QEMU Runtime Client
 *
 * Client-side API for controlling QEMU workers from the UI.
 */

import type {
  WorkerCommand,
  WorkerEvent,
  RuntimeCapabilities,
  VmState,
  StartVmCommand,
  StopVmCommand,
  SerialInCommand,
  CapabilitiesEvent,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
} from './protocol.js';
import { createRequestId } from './protocol.js';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

export interface QemuClientOptions {
  /** URL to the worker script */
  workerUrl?: string | URL;

  /** Called when serial output is received */
  onSerialOut?: (vmId: string, data: string) => void;

  /** Called on progress updates */
  onProgress?: (vmId: string | undefined, stage: string, percent: number, message: string) => void;

  /** Called on log messages */
  onLog?: (level: string, message: string, vmId?: string) => void;

  /** Called when VM state changes */
  onStateChange?: (vmId: string, state: VmState) => void;

  /** Called when capabilities are detected */
  onCapabilities?: (capabilities: RuntimeCapabilities) => void;
}

/**
 * Client for controlling QEMU workers
 */
export class QemuClient {
  private worker: Worker | null = null;
  private options: QemuClientOptions;
  private vmStates: Map<string, VmState>;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>;
  private capabilities: RuntimeCapabilities | null = null;

  constructor(options: QemuClientOptions = {}) {
    this.options = options;
    this.vmStates = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<RuntimeCapabilities> {
    if (this.worker) {
      throw new Error('QemuClient already initialized');
    }

    const workerUrl = this.options.workerUrl ?? new URL('./worker.js', import.meta.url);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);

    // Wait for capabilities
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<WorkerEvent>) => {
        if (event.data.type === 'capabilities') {
          this.capabilities = (event.data as CapabilitiesEvent).capabilities;
          this.options.onCapabilities?.(this.capabilities);
          resolve(this.capabilities);
        }
      };
      this.worker!.addEventListener('message', handler, { once: true });
    });
  }

  /**
   * Start a VM
   */
  async startVm(
    vmId: string,
    profile: VmProfile,
    inputs: VmInputs,
    overrides?: VmOverrides
  ): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    this.updateVmState(vmId, {
      vmId,
      status: 'starting',
      profile,
    });

    return this.sendRequest<StartVmCommand>({
      type: 'startVm',
      id: requestId,
      vmId,
      profile,
      inputs,
      overrides,
    }, requestId) as Promise<void>;
  }

  /**
   * Stop a VM
   */
  async stopVm(vmId: string, force = false): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    this.updateVmState(vmId, {
      ...this.vmStates.get(vmId)!,
      status: 'stopping',
    });

    return this.sendRequest<StopVmCommand>({
      type: 'stopVm',
      id: requestId,
      vmId,
      force,
    }, requestId) as Promise<void>;
  }

  /**
   * Reset a VM
   */
  async resetVm(vmId: string): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'resetVm',
      id: requestId,
      vmId,
    }, requestId) as Promise<void>;
  }

  /**
   * Send serial input to a VM
   */
  sendSerialIn(vmId: string, data: string): void {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const command: SerialInCommand = {
      type: 'serialIn',
      vmId,
      data,
    };

    this.worker.postMessage(command);
  }

  /**
   * Sync overlay to IndexedDB
   */
  async syncOverlay(vmId: string): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'syncOverlay',
      id: requestId,
      vmId,
    }, requestId) as Promise<void>;
  }

  /**
   * Export overlay data
   */
  async exportOverlay(vmId: string, diskId: string): Promise<ArrayBuffer> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'exportOverlay',
      id: requestId,
      vmId,
      diskId,
    }, requestId) as Promise<ArrayBuffer>;
  }

  /**
   * Import overlay data
   */
  async importOverlay(vmId: string, diskId: string, data: ArrayBuffer): Promise<void> {
    if (!this.worker) {
      throw new Error('QemuClient not initialized');
    }

    const requestId = createRequestId();

    return this.sendRequest({
      type: 'importOverlay',
      id: requestId,
      vmId,
      diskId,
      data,
    }, requestId) as Promise<void>;
  }

  /**
   * Get current VM state
   */
  getVmState(vmId: string): VmState | undefined {
    return this.vmStates.get(vmId);
  }

  /**
   * Get all VM states
   */
  getAllVmStates(): Map<string, VmState> {
    return new Map(this.vmStates);
  }

  /**
   * Get detected capabilities
   */
  getCapabilities(): RuntimeCapabilities | null {
    return this.capabilities;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.vmStates.clear();
    this.pendingRequests.clear();
  }

  // ============ Private Methods ============

  private sendRequest<T extends WorkerCommand>(
    command: T,
    requestId: string
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage(command);
    });
  }

  private handleMessage(event: MessageEvent<WorkerEvent>): void {
    const message = event.data;

    switch (message.type) {
      case 'vmStarted':
        this.handleVmStarted(message as VmStartedEvent);
        break;

      case 'vmStopped':
        this.handleVmStopped(message as VmStoppedEvent);
        break;

      case 'vmError':
        this.handleVmError(message as VmErrorEvent);
        break;

      case 'serialOut':
        this.handleSerialOut(message as SerialOutEvent);
        break;

      case 'progress':
        this.handleProgress(message as ProgressEvent);
        break;

      case 'log':
        this.handleLog(message as LogEvent);
        break;

      case 'capabilities':
        this.capabilities = (message as CapabilitiesEvent).capabilities;
        this.options.onCapabilities?.(this.capabilities);
        break;

      case 'overlayExported':
        this.resolveRequest(message.requestId, message.data);
        break;
    }
  }

  private handleVmStarted(event: VmStartedEvent): void {
    const state = this.vmStates.get(event.vmId);
    this.updateVmState(event.vmId, {
      ...state!,
      status: 'running',
      startTime: Date.now(),
    });
    this.resolveRequest(event.requestId, undefined);
  }

  private handleVmStopped(event: VmStoppedEvent): void {
    this.updateVmState(event.vmId, {
      ...this.vmStates.get(event.vmId)!,
      status: 'stopped',
      exitCode: event.exitCode,
    });
    if (event.requestId) {
      this.resolveRequest(event.requestId, undefined);
    }
  }

  private handleVmError(event: VmErrorEvent): void {
    if (event.vmId) {
      this.updateVmState(event.vmId, {
        ...this.vmStates.get(event.vmId)!,
        status: 'error',
        errorMessage: event.error,
      });
    }
    if (event.requestId) {
      this.rejectRequest(event.requestId, new Error(event.error));
    }
  }

  private handleSerialOut(event: SerialOutEvent): void {
    this.options.onSerialOut?.(event.vmId, event.data);
  }

  private handleProgress(event: ProgressEvent): void {
    this.options.onProgress?.(
      event.vmId,
      event.stage,
      event.percent ?? 0,
      event.message
    );
  }

  private handleLog(event: LogEvent): void {
    this.options.onLog?.(event.level, event.message, event.vmId);
  }

  private handleError(event: ErrorEvent): void {
    console.error('Worker error:', event);
    this.options.onLog?.('error', `Worker error: ${event.message}`);
  }

  private updateVmState(vmId: string, state: VmState): void {
    this.vmStates.set(vmId, state);
    this.options.onStateChange?.(vmId, state);
  }

  private resolveRequest(requestId: string, value: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.resolve(value);
    }
  }

  private rejectRequest(requestId: string, error: Error): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    }
  }
}
```

## packages/runtime/src/worker.ts
```typescript
/**
 * QEMU Worker Runtime
 *
 * Web Worker that loads and runs QEMU WebAssembly.
 */

/// <reference lib="webworker" />

import type {
  WorkerCommand,
  WorkerEvent,
  SerialOutEvent,
  ProgressEvent,
  LogEvent,
  VmStartedEvent,
  VmStoppedEvent,
  VmErrorEvent,
  CapabilitiesEvent,
} from './protocol.js';
import { detectCapabilities } from './capabilities.js';
import { buildQemuArgs } from '@qemuweb/vm-config';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

declare const self: DedicatedWorkerGlobalScope;

// ============ Worker State ============

interface VmInstance {
  vmId: string;
  profile: VmProfile;
  qemuModule: QemuModule | null;
  running: boolean;
  startTime: number;
}

interface QemuModule {
  callMain: (args: string[]) => number;
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  ready: Promise<QemuModule>;
}

const vmInstances = new Map<string, VmInstance>();
let qemuModuleFactory: ((options: unknown) => Promise<QemuModule>) | null = null;

// ============ Message Handlers ============

self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;

  try {
    switch (command.type) {
      case 'startVm':
        await handleStartVm(command.id, command.vmId, command.profile, command.inputs, command.overrides);
        break;

      case 'stopVm':
        await handleStopVm(command.id, command.vmId, command.force);
        break;

      case 'resetVm':
        await handleResetVm(command.id, command.vmId);
        break;

      case 'serialIn':
        handleSerialIn(command.vmId, command.data);
        break;

      case 'syncOverlay':
        await handleSyncOverlay(command.id, command.vmId);
        break;

      case 'exportOverlay':
        await handleExportOverlay(command.id, command.vmId, command.diskId);
        break;

      case 'importOverlay':
        await handleImportOverlay(command.id, command.vmId, command.diskId, command.data);
        break;

      default:
        log('warn', `Unknown command type: ${(command as { type: string }).type}`);
    }
  } catch (error) {
    const commandId = 'id' in command ? command.id : undefined;
    sendError(undefined, commandId, String(error), false);
  }
};

// ============ Command Handlers ============

async function handleStartVm(
  requestId: string,
  vmId: string,
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): Promise<void> {
  if (vmInstances.has(vmId)) {
    sendError(vmId, requestId, `VM ${vmId} is already running`, false);
    return;
  }

  sendProgress(vmId, requestId, 'loading', 0, 'Initializing QEMU...');

  try {
    // Build QEMU arguments
    const result = buildQemuArgs(profile, inputs, overrides);

    if (result.errors.length > 0) {
      sendError(vmId, requestId, result.errors.join('; '), true);
      return;
    }

    for (const warning of result.warnings) {
      log('warn', warning, vmId);
    }

    sendProgress(vmId, requestId, 'loading', 20, 'Loading QEMU module...');

    // Load QEMU module
    const qemuModule = await loadQemuModule(profile.arch);

    sendProgress(vmId, requestId, 'mounting', 40, 'Mounting files...');

    // Create virtual filesystem directories
    try {
      qemuModule.FS.mkdir('/vm');
    } catch {
      // Directory may already exist
    }

    // Mount files
    await mountFiles(qemuModule, inputs, result.filesToMount);

    sendProgress(vmId, requestId, 'starting', 80, 'Starting QEMU...');

    // Create VM instance
    const instance: VmInstance = {
      vmId,
      profile,
      qemuModule,
      running: true,
      startTime: Date.now(),
    };
    vmInstances.set(vmId, instance);

    // Start QEMU
    log('info', `Starting QEMU with args: ${result.args.join(' ')}`, vmId);

    // Note: In real implementation, callMain would be called in a way that
    // doesn't block the worker. This is simplified for the MVP.
    setTimeout(() => {
      try {
        const exitCode = qemuModule.callMain(result.args);
        handleVmExit(vmId, exitCode);
      } catch (error) {
        handleVmError(vmId, String(error));
      }
    }, 0);

    sendProgress(vmId, requestId, 'running', 100, 'VM started');
    sendEvent<VmStartedEvent>({
      type: 'vmStarted',
      vmId,
      requestId,
    });

  } catch (error) {
    vmInstances.delete(vmId);
    sendError(vmId, requestId, `Failed to start VM: ${error}`, true);
  }
}

async function handleStopVm(
  requestId: string,
  vmId: string,
  _force?: boolean
): Promise<void> {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    sendError(vmId, requestId, `VM ${vmId} not found`, false);
    return;
  }

  log('info', 'Stopping VM...', vmId);
  instance.running = false;

  // TODO: Implement graceful shutdown via QEMU monitor
  // For now, just mark as stopped

  vmInstances.delete(vmId);

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    requestId,
    exitCode: 0,
  });
}

async function handleResetVm(requestId: string, vmId: string): Promise<void> {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    sendError(vmId, requestId, `VM ${vmId} not found`, false);
    return;
  }

  log('info', 'Resetting VM...', vmId);

  // TODO: Implement reset via QEMU monitor
  // For now, this is a stub

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    requestId,
  });
}

function handleSerialIn(vmId: string, data: string): void {
  const instance = vmInstances.get(vmId);

  if (!instance) {
    log('warn', `Serial input for unknown VM: ${vmId}`);
    return;
  }

  // TODO: Write to QEMU's stdin
  // This requires proper stdin pipe setup in the Emscripten module
  log('debug', `Serial in: ${data}`, vmId);
}

async function handleSyncOverlay(requestId: string, vmId: string): Promise<void> {
  // TODO: Implement overlay sync
  log('info', 'Syncing overlay...', vmId);
  sendProgress(vmId, requestId, 'running', 100, 'Overlay synced');
}

async function handleExportOverlay(
  requestId: string,
  vmId: string,
  diskId: string
): Promise<void> {
  // TODO: Implement overlay export
  log('info', `Exporting overlay for disk ${diskId}...`, vmId);

  // Placeholder: send empty export
  sendEvent({
    type: 'overlayExported',
    vmId,
    diskId,
    requestId,
    data: new ArrayBuffer(0),
    blockCount: 0,
  });
}

async function handleImportOverlay(
  requestId: string,
  vmId: string,
  diskId: string,
  _data: ArrayBuffer
): Promise<void> {
  // TODO: Implement overlay import
  log('info', `Importing overlay for disk ${diskId}...`, vmId);
  sendProgress(vmId, requestId, 'running', 100, 'Overlay imported');
}

// ============ QEMU Module Loading ============

async function loadQemuModule(arch: 'x86_64' | 'aarch64'): Promise<QemuModule> {
  if (!qemuModuleFactory) {
    // In production, this would dynamically import the correct architecture
    // For MVP, we create a mock module
    qemuModuleFactory = createMockQemuModule;
  }

  const module = await qemuModuleFactory({
    print: (text: string) => handleQemuOutput(text),
    printErr: (text: string) => handleQemuError(text),
    locateFile: (path: string) => {
      // Return URL to wasm/js files based on architecture
      return `/qemu-wasm/qemu-system-${arch}${path.includes('.wasm') ? '.wasm' : '.js'}`;
    },
  });

  await module.ready;
  return module;
}

/**
 * Create a mock QEMU module for testing without actual QEMU build
 */
async function createMockQemuModule(_options: unknown): Promise<QemuModule> {
  const fs = new Map<string, Uint8Array>();

  const module: QemuModule = {
    callMain: (args: string[]) => {
      log('info', `[Mock QEMU] Running with args: ${args.join(' ')}`);

      // Simulate boot output
      const bootMessages = [
        'QEMU emulator version 8.2.0',
        'Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers',
        '',
        'Booting from disk...',
        '',
        'Linux version 6.1.0 (buildroot@buildroot) (gcc 12.3.0)',
        'Command line: console=ttyS0,115200 root=/dev/vda rw',
        '',
        'Initializing cgroup subsys cpuset',
        'Initializing cgroup subsys cpu',
        'Linux version 6.1.0',
        'CPU: ARMv8 Processor [000000] revision 0',
        'Machine model: linux,dummy-virt',
        '',
        'Memory: 512MB',
        'Virtual kernel memory layout:',
        '',
        'Mounting devtmpfs on /dev',
        'Mounted root filesystem',
        '',
        'Welcome to QemuWeb!',
        '',
        '/ # ',
      ];

      let messageIndex = 0;
      const interval = setInterval(() => {
        if (messageIndex < bootMessages.length) {
          sendSerialOut('mock-vm', bootMessages[messageIndex] + '\n');
          messageIndex++;
        } else {
          clearInterval(interval);
        }
      }, 100);

      return 0;
    },
    FS: {
      mkdir: (path: string) => {
        log('debug', `[Mock FS] mkdir: ${path}`);
      },
      writeFile: (path: string, data: Uint8Array) => {
        fs.set(path, data);
        log('debug', `[Mock FS] writeFile: ${path} (${data.length} bytes)`);
      },
      readFile: (path: string) => {
        const data = fs.get(path);
        if (!data) {
          throw new Error(`File not found: ${path}`);
        }
        return data;
      },
      unlink: (path: string) => {
        fs.delete(path);
        log('debug', `[Mock FS] unlink: ${path}`);
      },
    },
    ready: Promise.resolve(null as unknown as QemuModule),
  };

  module.ready = Promise.resolve(module);
  return module;
}

// ============ File Mounting ============

async function mountFiles(
  qemuModule: QemuModule,
  inputs: VmInputs,
  filesToMount: Array<{ path: string; source: string; index?: number }>
): Promise<void> {
  for (const mount of filesToMount) {
    let data: Uint8Array | null = null;

    switch (mount.source) {
      case 'disk':
        if (inputs.disk?.file) {
          data = await readFileAsUint8Array(inputs.disk.file);
        } else if (inputs.disk?.url) {
          data = await fetchFileAsUint8Array(inputs.disk.url);
        }
        break;

      case 'kernel':
        if (inputs.kernel?.file) {
          data = await readFileAsUint8Array(inputs.kernel.file);
        } else if (inputs.kernel?.url) {
          data = await fetchFileAsUint8Array(inputs.kernel.url);
        }
        break;

      case 'initrd':
        if (inputs.initrd?.file) {
          data = await readFileAsUint8Array(inputs.initrd.file);
        } else if (inputs.initrd?.url) {
          data = await fetchFileAsUint8Array(inputs.initrd.url);
        }
        break;

      case 'additional':
        if (mount.index !== undefined && inputs.additionalDisks?.[mount.index]) {
          const disk = inputs.additionalDisks[mount.index];
          if (disk.file) {
            data = await readFileAsUint8Array(disk.file);
          } else if (disk.url) {
            data = await fetchFileAsUint8Array(disk.url);
          }
        }
        break;
    }

    if (data) {
      qemuModule.FS.writeFile(mount.path, data);
      log('info', `Mounted ${mount.source} at ${mount.path} (${data.length} bytes)`);
    }
  }
}

async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchFileAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// ============ QEMU Output Handlers ============

function handleQemuOutput(text: string): void {
  // Find active VM and send serial output
  const vmId = getActiveVmId();
  if (vmId) {
    sendSerialOut(vmId, text);
  }
}

function handleQemuError(text: string): void {
  log('error', `QEMU stderr: ${text}`);
}

function handleVmExit(vmId: string, exitCode: number): void {
  const instance = vmInstances.get(vmId);
  if (instance) {
    instance.running = false;
  }
  vmInstances.delete(vmId);

  sendEvent<VmStoppedEvent>({
    type: 'vmStopped',
    vmId,
    exitCode,
  });
}

function handleVmError(vmId: string, error: string): void {
  vmInstances.delete(vmId);

  sendEvent<VmErrorEvent>({
    type: 'vmError',
    vmId,
    error,
    fatal: true,
  });
}

function getActiveVmId(): string | undefined {
  // Return first running VM
  for (const [vmId, instance] of vmInstances) {
    if (instance.running) {
      return vmId;
    }
  }
  return undefined;
}

// ============ Event Sending ============

function sendEvent<T extends WorkerEvent>(event: T): void {
  self.postMessage(event);
}

function sendSerialOut(vmId: string, data: string): void {
  sendEvent<SerialOutEvent>({
    type: 'serialOut',
    vmId,
    data,
  });
}

function sendProgress(
  vmId: string | undefined,
  requestId: string | undefined,
  stage: 'loading' | 'mounting' | 'starting' | 'running',
  percent: number,
  message: string
): void {
  sendEvent<ProgressEvent>({
    type: 'progress',
    vmId,
    requestId,
    stage,
    percent,
    message,
  });
}

function sendError(
  vmId: string | undefined,
  requestId: string | undefined,
  error: string,
  fatal: boolean
): void {
  sendEvent<VmErrorEvent>({
    type: 'vmError',
    vmId,
    requestId,
    error,
    fatal,
  });
}

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, vmId?: string): void {
  sendEvent<LogEvent>({
    type: 'log',
    vmId,
    level,
    message,
  });
}

// ============ Initialization ============

// Send capabilities on worker start
sendEvent<CapabilitiesEvent>({
  type: 'capabilities',
  capabilities: detectCapabilities(),
});

log('info', 'QEMU Worker initialized');
```

## packages/runtime/src/protocol.ts
```typescript
/**
 * Runtime Protocol
 *
 * Message types for communication between UI and QEMU worker.
 */

import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

/** Message types from UI to Worker */
export type WorkerCommand =
  | StartVmCommand
  | StopVmCommand
  | ResetVmCommand
  | SerialInCommand
  | MountDiskCommand
  | MountKernelCommand
  | MountInitrdCommand
  | SyncOverlayCommand
  | ExportOverlayCommand
  | ImportOverlayCommand;

/** Message types from Worker to UI */
export type WorkerEvent =
  | VmStartedEvent
  | VmStoppedEvent
  | VmErrorEvent
  | SerialOutEvent
  | ProgressEvent
  | LogEvent
  | OverlayExportedEvent
  | CapabilitiesEvent;

// ============ Commands (UI → Worker) ============

export interface StartVmCommand {
  type: 'startVm';
  id: string;
  vmId: string;
  profile: VmProfile;
  inputs: VmInputs;
  overrides?: VmOverrides;
}

export interface StopVmCommand {
  type: 'stopVm';
  id: string;
  vmId: string;
  force?: boolean;
}

export interface ResetVmCommand {
  type: 'resetVm';
  id: string;
  vmId: string;
}

export interface SerialInCommand {
  type: 'serialIn';
  vmId: string;
  data: string;
}

export interface MountDiskCommand {
  type: 'mountDisk';
  id: string;
  vmId: string;
  diskIndex: number;
  file?: File | Blob;
  url?: string;
  readonly?: boolean;
}

export interface MountKernelCommand {
  type: 'mountKernel';
  id: string;
  vmId: string;
  file?: File | Blob;
  url?: string;
}

export interface MountInitrdCommand {
  type: 'mountInitrd';
  id: string;
  vmId: string;
  file?: File | Blob;
  url?: string;
}

export interface SyncOverlayCommand {
  type: 'syncOverlay';
  id: string;
  vmId: string;
}

export interface ExportOverlayCommand {
  type: 'exportOverlay';
  id: string;
  vmId: string;
  diskId: string;
}

export interface ImportOverlayCommand {
  type: 'importOverlay';
  id: string;
  vmId: string;
  diskId: string;
  data: ArrayBuffer;
}

// ============ Events (Worker → UI) ============

export interface VmStartedEvent {
  type: 'vmStarted';
  vmId: string;
  requestId: string;
}

export interface VmStoppedEvent {
  type: 'vmStopped';
  vmId: string;
  requestId?: string;
  exitCode?: number;
}

export interface VmErrorEvent {
  type: 'vmError';
  vmId?: string;
  requestId?: string;
  error: string;
  fatal: boolean;
}

export interface SerialOutEvent {
  type: 'serialOut';
  vmId: string;
  data: string;
}

export interface ProgressEvent {
  type: 'progress';
  vmId?: string;
  requestId?: string;
  stage: 'loading' | 'mounting' | 'starting' | 'running';
  percent?: number;
  message: string;
}

export interface LogEvent {
  type: 'log';
  vmId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface OverlayExportedEvent {
  type: 'overlayExported';
  vmId: string;
  diskId: string;
  requestId: string;
  data: ArrayBuffer;
  blockCount: number;
}

export interface CapabilitiesEvent {
  type: 'capabilities';
  capabilities: RuntimeCapabilities;
}

// ============ Shared Types ============

export interface RuntimeCapabilities {
  /** SharedArrayBuffer available */
  sharedArrayBuffer: boolean;

  /** WebAssembly available */
  webAssembly: boolean;

  /** WebAssembly SIMD available */
  wasmSimd: boolean;

  /** WebAssembly threads available */
  wasmThreads: boolean;

  /** BigInt support */
  bigInt: boolean;

  /** IndexedDB available */
  indexedDb: boolean;

  /** File System Access API available */
  fileSystemAccess: boolean;

  /** WebGPU available */
  webGpu: boolean;

  /** Maximum memory in bytes (from browser limits) */
  maxMemory: number;
}

export interface VmState {
  vmId: string;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  profile?: VmProfile;
  startTime?: number;
  exitCode?: number;
  errorMessage?: string;
}

/**
 * Create a unique request ID
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
```

## packages/storage/src/types.ts
```typescript
/**
 * Block Device Type Definitions
 */

/** Default block size in bytes */
export const DEFAULT_BLOCK_SIZE = 65536; // 64 KiB

/**
 * Block device interface
 *
 * All block devices implement this interface for read/write operations.
 */
export interface BlockDevice {
  /** Unique identifier for this device */
  readonly id: string;

  /** Total size in bytes */
  readonly size: number;

  /** Block size in bytes */
  readonly blockSize: number;

  /** Whether the device is read-only */
  readonly readonly: boolean;

  /**
   * Read blocks from the device
   *
   * @param blockIndex - Starting block index
   * @param count - Number of blocks to read
   * @returns Uint8Array containing the data
   */
  readBlocks(blockIndex: number, count: number): Promise<Uint8Array>;

  /**
   * Write blocks to the device
   *
   * @param blockIndex - Starting block index
   * @param data - Data to write (must be aligned to block size)
   */
  writeBlocks(blockIndex: number, data: Uint8Array): Promise<void>;

  /**
   * Sync any pending writes
   */
  sync(): Promise<void>;

  /**
   * Close the device and release resources
   */
  close(): Promise<void>;
}

/**
 * Block range for tracking modifications
 */
export interface BlockRange {
  start: number;
  end: number;
}

/**
 * Statistics for a block device
 */
export interface BlockDeviceStats {
  readCount: number;
  writeCount: number;
  bytesRead: number;
  bytesWritten: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Options for creating a block device
 */
export interface BlockDeviceOptions {
  /** Unique ID for the device */
  id: string;

  /** Block size in bytes (default: 64 KiB) */
  blockSize?: number;

  /** Enable read caching */
  enableCache?: boolean;

  /** Cache size in blocks */
  cacheSize?: number;
}

/**
 * Options for HTTP block device
 */
export interface HttpBlockDeviceOptions extends BlockDeviceOptions {
  /** URL of the disk image */
  url: string;

  /** Expected total size (if known) */
  expectedSize?: number;

  /** Whether the server supports range requests */
  supportsRangeRequests?: boolean;

  /** Custom fetch options */
  fetchOptions?: RequestInit;
}

/**
 * Options for file-backed block device
 */
export interface FileBlockDeviceOptions extends BlockDeviceOptions {
  /** File or Blob to use as backing */
  file: File | Blob;
}

/**
 * Options for overlay block device
 */
export interface OverlayBlockDeviceOptions extends BlockDeviceOptions {
  /** The base (read-only) device */
  base: BlockDevice;

  /** VM ID for IndexedDB storage */
  vmId: string;

  /** Disk ID for IndexedDB storage */
  diskId: string;
}

/**
 * Overlay snapshot metadata
 */
export interface OverlaySnapshot {
  id: string;
  vmId: string;
  diskId: string;
  createdAt: Date;
  blockCount: number;
  totalBytes: number;
  description?: string;
}

/**
 * Exported overlay data
 */
export interface OverlayExport {
  metadata: OverlaySnapshot;
  blocks: Map<number, Uint8Array>;
}
```

## packages/storage/src/cowBlockDevice.ts
```typescript
/**
 * Copy-on-Write Block Device
 *
 * Merges a read-only base device with a writable overlay.
 * Reads fall through to base if not in overlay.
 * Writes always go to overlay.
 */

import type { BlockDevice, OverlayBlockDeviceOptions, BlockDeviceStats } from './types.js';
import { DEFAULT_BLOCK_SIZE } from './types.js';
import { IndexedDBOverlay } from './indexeddbOverlay.js';

export class CowBlockDevice implements BlockDevice {
  readonly id: string;
  readonly blockSize: number;
  readonly readonly = false;

  private base: BlockDevice;
  private overlay: IndexedDBOverlay;
  private initialized: boolean = false;
  private stats: BlockDeviceStats;

  constructor(options: OverlayBlockDeviceOptions) {
    this.id = options.id;
    this.base = options.base;
    this.blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;

    if (this.base.blockSize !== this.blockSize) {
      throw new Error(
        `Block size mismatch: base=${this.base.blockSize}, overlay=${this.blockSize}`
      );
    }

    this.overlay = new IndexedDBOverlay(options.vmId, options.diskId, this.blockSize);

    this.stats = {
      readCount: 0,
      writeCount: 0,
      bytesRead: 0,
      bytesWritten: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Total size equals base device size
   */
  get size(): number {
    return this.base.size;
  }

  /**
   * Number of blocks
   */
  get blockCount(): number {
    return Math.ceil(this.size / this.blockSize);
  }

  /**
   * Initialize the COW device
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.overlay.init();
    this.initialized = true;
  }

  /**
   * Read blocks with COW logic
   *
   * 1. Check overlay for each block
   * 2. For blocks not in overlay, read from base
   * 3. Merge results
   */
  async readBlocks(blockIndex: number, count: number): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.init();
    }

    const result = new Uint8Array(count * this.blockSize);
    const blockIndices = Array.from({ length: count }, (_, i) => blockIndex + i);

    // Check overlay for all blocks
    const overlayData = await this.overlay.readBlocks(blockIndices);

    // Collect blocks that need to be read from base
    const baseBlocksNeeded: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!overlayData.has(blockIndex + i)) {
        baseBlocksNeeded.push(blockIndex + i);
      }
    }

    // Read missing blocks from base
    if (baseBlocksNeeded.length > 0) {
      // For efficiency, read contiguous ranges from base
      const ranges = this.findContiguousRanges(baseBlocksNeeded);

      for (const range of ranges) {
        const rangeCount = range.end - range.start + 1;
        const baseData = await this.base.readBlocks(range.start, rangeCount);

        // Copy base data to result
        for (let i = 0; i < rangeCount; i++) {
          const resultOffset = (range.start + i - blockIndex) * this.blockSize;
          const baseOffset = i * this.blockSize;
          result.set(baseData.slice(baseOffset, baseOffset + this.blockSize), resultOffset);
        }

        this.stats.cacheMisses += rangeCount;
      }
    }

    // Copy overlay data to result
    for (const [idx, data] of overlayData) {
      const resultOffset = (idx - blockIndex) * this.blockSize;
      result.set(data, resultOffset);
      this.stats.cacheHits++;
    }

    this.stats.readCount++;
    this.stats.bytesRead += count * this.blockSize;

    return result;
  }

  /**
   * Write blocks to overlay
   */
  async writeBlocks(blockIndex: number, data: Uint8Array): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    if (data.length % this.blockSize !== 0) {
      throw new Error(`Data length must be a multiple of block size (${this.blockSize})`);
    }

    const blockCount = data.length / this.blockSize;

    for (let i = 0; i < blockCount; i++) {
      const blockData = data.slice(i * this.blockSize, (i + 1) * this.blockSize);
      await this.overlay.writeBlock(blockIndex + i, blockData);
    }

    this.stats.writeCount++;
    this.stats.bytesWritten += data.length;
  }

  /**
   * Sync overlay to IndexedDB
   */
  async sync(): Promise<void> {
    await this.overlay.flush();
  }

  /**
   * Close both base and overlay
   */
  async close(): Promise<void> {
    await this.overlay.close();
    await this.base.close();
  }

  /**
   * Get overlay statistics
   */
  async getOverlayStats(): Promise<{ blockCount: number; totalBytes: number }> {
    return this.overlay.getStats();
  }

  /**
   * Get device statistics
   */
  getStats(): BlockDeviceStats {
    return { ...this.stats };
  }

  /**
   * Export overlay data
   */
  async exportOverlay() {
    return this.overlay.export();
  }

  /**
   * Import overlay data
   */
  async importOverlay(data: {
    metadata: { id: string; vmId: string; diskId: string; createdAt: Date; blockCount: number; totalBytes: number };
    blocks: Array<[number, Uint8Array]>;
  }) {
    await this.overlay.import(data);
  }

  /**
   * Clear all overlay data
   */
  async clearOverlay(): Promise<void> {
    await this.overlay.clear();
  }

  /**
   * Check if there are uncommitted changes
   */
  get isDirty(): boolean {
    return this.overlay.isDirty;
  }

  /**
   * Find contiguous block ranges for efficient base reads
   */
  private findContiguousRanges(blocks: number[]): Array<{ start: number; end: number }> {
    if (blocks.length === 0) return [];

    const sorted = [...blocks].sort((a, b) => a - b);
    const ranges: Array<{ start: number; end: number }> = [];

    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push({ start, end });

    return ranges;
  }
}
```

## packages/storage/src/indexeddbOverlay.ts
```typescript
/**
 * IndexedDB Overlay Storage
 *
 * Stores sparse block modifications in IndexedDB.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { OverlaySnapshot, BlockRange } from './types.js';

const DB_NAME = 'qemuweb-storage';
const DB_VERSION = 1;
const BLOCKS_STORE = 'blocks';
const METADATA_STORE = 'metadata';

/**
 * Key format: vmId:diskId:blockIndex
 */
function makeBlockKey(vmId: string, diskId: string, blockIndex: number): string {
  return `${vmId}:${diskId}:${blockIndex}`;
}

/**
 * Parse a block key
 */
function parseBlockKey(key: string): { vmId: string; diskId: string; blockIndex: number } | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  return {
    vmId: parts[0],
    diskId: parts[1],
    blockIndex: parseInt(parts[2], 10),
  };
}

/**
 * Block entry stored in IndexedDB
 */
interface BlockEntry {
  key: string;
  vmId: string;
  diskId: string;
  blockIndex: number;
  data: Uint8Array;
  timestamp: number;
}

/**
 * IndexedDB Overlay Storage
 *
 * Provides persistent storage for block overlays using IndexedDB.
 */
export class IndexedDBOverlay {
  private db: IDBPDatabase | null = null;
  private vmId: string;
  private diskId: string;
  private blockSize: number;
  private dirtyBlocks: Set<number>;
  private writeBuffer: Map<number, Uint8Array>;
  private bufferFlushThreshold: number;

  constructor(vmId: string, diskId: string, blockSize: number = 65536) {
    this.vmId = vmId;
    this.diskId = diskId;
    this.blockSize = blockSize;
    this.dirtyBlocks = new Set();
    this.writeBuffer = new Map();
    this.bufferFlushThreshold = 16; // Flush after 16 blocks
  }

  /**
   * Initialize the IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Blocks store
        if (!db.objectStoreNames.contains(BLOCKS_STORE)) {
          const blocksStore = db.createObjectStore(BLOCKS_STORE, { keyPath: 'key' });
          blocksStore.createIndex('vmDisk', ['vmId', 'diskId']);
          blocksStore.createIndex('vmId', 'vmId');
        }

        // Metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        }
      },
    });
  }

  /**
   * Read a block from the overlay
   *
   * @returns The block data, or null if not in overlay
   */
  async readBlock(blockIndex: number): Promise<Uint8Array | null> {
    // Check write buffer first
    if (this.writeBuffer.has(blockIndex)) {
      return this.writeBuffer.get(blockIndex)!;
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
    const entry = await this.db.get(BLOCKS_STORE, key);

    if (entry) {
      return entry.data;
    }

    return null;
  }

  /**
   * Read multiple blocks from the overlay
   *
   * @returns Map of blockIndex to data (only blocks present in overlay)
   */
  async readBlocks(blockIndices: number[]): Promise<Map<number, Uint8Array>> {
    const result = new Map<number, Uint8Array>();

    // Check write buffer first
    for (const index of blockIndices) {
      if (this.writeBuffer.has(index)) {
        result.set(index, this.writeBuffer.get(index)!);
      }
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    // Fetch remaining from IndexedDB
    const remainingIndices = blockIndices.filter((i) => !result.has(i));
    if (remainingIndices.length === 0) {
      return result;
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);

    await Promise.all(
      remainingIndices.map(async (blockIndex) => {
        const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
        const entry = await store.get(key);
        if (entry) {
          result.set(blockIndex, entry.data);
        }
      })
    );

    await tx.done;
    return result;
  }

  /**
   * Write a block to the overlay
   */
  async writeBlock(blockIndex: number, data: Uint8Array): Promise<void> {
    if (data.length !== this.blockSize) {
      throw new Error(`Block data must be exactly ${this.blockSize} bytes`);
    }

    // Add to write buffer
    this.writeBuffer.set(blockIndex, data);
    this.dirtyBlocks.add(blockIndex);

    // Flush if buffer is large enough
    if (this.writeBuffer.size >= this.bufferFlushThreshold) {
      await this.flush();
    }
  }

  /**
   * Write multiple blocks to the overlay
   */
  async writeBlocks(startBlockIndex: number, data: Uint8Array): Promise<void> {
    const blockCount = Math.ceil(data.length / this.blockSize);

    for (let i = 0; i < blockCount; i++) {
      const start = i * this.blockSize;
      const end = Math.min(start + this.blockSize, data.length);
      const blockData = new Uint8Array(this.blockSize);
      blockData.set(data.slice(start, end));
      await this.writeBlock(startBlockIndex + i, blockData);
    }
  }

  /**
   * Flush write buffer to IndexedDB
   */
  async flush(): Promise<void> {
    if (this.writeBuffer.size === 0) return;

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const now = Date.now();

    for (const [blockIndex, data] of this.writeBuffer) {
      const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
      const entry: BlockEntry = {
        key,
        vmId: this.vmId,
        diskId: this.diskId,
        blockIndex,
        data,
        timestamp: now,
      };
      await store.put(entry);
    }

    await tx.done;
    this.writeBuffer.clear();
    this.dirtyBlocks.clear();
  }

  /**
   * Check if a block exists in the overlay
   */
  async hasBlock(blockIndex: number): Promise<boolean> {
    if (this.writeBuffer.has(blockIndex)) {
      return true;
    }

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
    const entry = await this.db.get(BLOCKS_STORE, key);
    return entry !== undefined;
  }

  /**
   * Get all modified block indices
   */
  async getModifiedBlocks(): Promise<number[]> {
    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const indices = new Set<number>(this.writeBuffer.keys());

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      const entry = cursor.value as BlockEntry;
      indices.add(entry.blockIndex);
    }

    await tx.done;
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Get modified block ranges (for compaction)
   */
  async getModifiedRanges(): Promise<BlockRange[]> {
    const blocks = await this.getModifiedBlocks();
    if (blocks.length === 0) return [];

    const ranges: BlockRange[] = [];
    let start = blocks[0];
    let end = blocks[0];

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] === end + 1) {
        end = blocks[i];
      } else {
        ranges.push({ start, end });
        start = blocks[i];
        end = blocks[i];
      }
    }
    ranges.push({ start, end });

    return ranges;
  }

  /**
   * Get overlay statistics
   */
  async getStats(): Promise<{ blockCount: number; totalBytes: number }> {
    const blocks = await this.getModifiedBlocks();
    return {
      blockCount: blocks.length,
      totalBytes: blocks.length * this.blockSize,
    };
  }

  /**
   * Create a snapshot of the current overlay state
   */
  async createSnapshot(description?: string): Promise<OverlaySnapshot> {
    await this.flush();
    const stats = await this.getStats();

    const snapshot: OverlaySnapshot = {
      id: `${this.vmId}:${this.diskId}:${Date.now()}`,
      vmId: this.vmId,
      diskId: this.diskId,
      createdAt: new Date(),
      blockCount: stats.blockCount,
      totalBytes: stats.totalBytes,
      description,
    };

    return snapshot;
  }

  /**
   * Export overlay data for backup
   */
  async export(): Promise<{ metadata: OverlaySnapshot; blocks: Array<[number, Uint8Array]> }> {
    await this.flush();

    const metadata = await this.createSnapshot('Export');
    const blocks: Array<[number, Uint8Array]> = [];

    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    const tx = this.db.transaction(BLOCKS_STORE, 'readonly');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      const entry = cursor.value as BlockEntry;
      blocks.push([entry.blockIndex, entry.data]);
    }

    await tx.done;
    return { metadata, blocks };
  }

  /**
   * Import overlay data from backup
   */
  async import(data: {
    metadata: OverlaySnapshot;
    blocks: Array<[number, Uint8Array]>;
  }): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDBOverlay not initialized');
    }

    // Clear existing data
    await this.clear();

    // Import blocks
    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const now = Date.now();

    for (const [blockIndex, blockData] of data.blocks) {
      const key = makeBlockKey(this.vmId, this.diskId, blockIndex);
      const entry: BlockEntry = {
        key,
        vmId: this.vmId,
        diskId: this.diskId,
        blockIndex,
        data: blockData,
        timestamp: now,
      };
      await store.put(entry);
    }

    await tx.done;
  }

  /**
   * Clear all overlay data for this VM/disk
   */
  async clear(): Promise<void> {
    this.writeBuffer.clear();
    this.dirtyBlocks.clear();

    if (!this.db) return;

    const tx = this.db.transaction(BLOCKS_STORE, 'readwrite');
    const store = tx.objectStore(BLOCKS_STORE);
    const index = store.index('vmDisk');

    for await (const cursor of index.iterate([this.vmId, this.diskId])) {
      cursor.delete();
    }

    await tx.done;
  }
  async close(): Promise<void> {
    await this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Getter for dirty state
  get isDirty(): boolean {
    return this.writeBuffer.size > 0 || this.dirtyBlocks.size > 0;
  }
}

/**
 * Delete all overlay data for a VM
 */
export async function deleteVmOverlays(vmId: string): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);

  const tx = db.transaction(BLOCKS_STORE, 'readwrite');
  const store = tx.objectStore(BLOCKS_STORE);
  const index = store.index('vmId');

  for await (const cursor of index.iterate(vmId)) {
    cursor.delete();
  }

  await tx.done;
  db.close();
}
export async function listVmsWithOverlays(): Promise<string[]> {
  const db = await openDB(DB_NAME, DB_VERSION);

  const tx = db.transaction(BLOCKS_STORE, 'readonly');
  const store = tx.objectStore(BLOCKS_STORE);
  const index = store.index('vmId');

  const vmIds = new Set<string>();
  for await (const cursor of index.iterate()) {
    const entry = cursor.value as BlockEntry;
    vmIds.add(entry.vmId);
  }

  await tx.done;
  db.close();

  return Array.from(vmIds);
}

export { parseBlockKey, makeBlockKey };
```

## packages/vm-config/src/types.ts
```typescript
/**
 * VM Profile Type Definitions
 *
 * Defines the schema for machine profiles that configure
 * QEMU for different architectures and use cases.
 */

/** Supported CPU architectures */
export type VmArch = 'x86_64' | 'aarch64';

/** Disk interface types */
export type DiskInterface = 'virtio-blk' | 'ide' | 'scsi';

/** Network modes */
export type NetworkMode = 'user' | 'none';

/** Serial console modes */
export type SerialMode = 'stdio' | 'ttyS0' | 'pty';

/**
 * Device configuration for a VM profile
 */
export interface VmDeviceConfig {
  /** Disk interface type */
  diskInterface: DiskInterface;

  /** Network mode */
  net: NetworkMode;

  /** Enable virtio-rng for guest entropy */
  rng?: boolean;

  /** Serial console configuration */
  serial: SerialMode;

  /** Enable USB controller */
  usb?: boolean;

  /** Enable keyboard input */
  keyboard?: boolean;
}

/**
 * VM Profile Definition
 *
 * Complete configuration for a virtual machine type,
 * including hardware settings and QEMU options.
 */
export interface VmProfile {
  /** Unique identifier for this profile */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the profile */
  description: string;

  /** CPU architecture */
  arch: VmArch;

  /** QEMU machine type (e.g., "q35", "virt") */
  machine: string;

  /** CPU model (optional, uses QEMU default if not specified) */
  cpu?: string;

  /** Memory size in MiB */
  memoryMiB: number;

  /** Number of CPU cores */
  smp: number;

  /** Whether this profile supports graphics output */
  supportsGraphics: boolean;

  /** Default QEMU arguments for this profile */
  defaultArgs: string[];

  /** Whether a kernel image is required (vs booting from disk) */
  requiresKernel: boolean;

  /** Help text for kernel requirement */
  kernelHelpText?: string;

  /** Device configuration */
  devices: VmDeviceConfig;

  /** Block size for disk I/O in bytes */
  blockSizeBytes?: number;

  /** Maximum memory in MiB (for memory growth) */
  maxMemoryMiB?: number;
}

/**
 * Input files for starting a VM
 */
export interface VmInputs {
  /** Main disk image (required) */
  disk?: {
    /** File/Blob for local disk */
    file?: File | Blob;
    /** URL for remote disk */
    url?: string;
    /** Whether the disk is read-only */
    readonly?: boolean;
  };

  /** Kernel image (for direct kernel boot) */
  kernel?: {
    file?: File | Blob;
    url?: string;
  };

  /** Initial ramdisk */
  initrd?: {
    file?: File | Blob;
    url?: string;
  };

  /** Kernel command line */
  kernelCmdline?: string;

  /** Additional disk images */
  additionalDisks?: Array<{
    file?: File | Blob;
    url?: string;
    readonly?: boolean;
  }>;
}

/**
 * Runtime overrides for profile defaults
 */
export interface VmOverrides {
  /** Override memory size */
  memoryMiB?: number;

  /** Override CPU count */
  smp?: number;

  /** Override network mode */
  net?: NetworkMode;

  /** Additional QEMU arguments */
  extraArgs?: string[];

  /** Override graphics setting */
  enableGraphics?: boolean;
}

/**
 * Result of building QEMU arguments
 */
export interface QemuArgsResult {
  /** The final argument list */
  args: string[];

  /** Architecture to use */
  arch: VmArch;

  /** Files that need to be mounted */
  filesToMount: Array<{
    path: string;
    source: 'disk' | 'kernel' | 'initrd' | 'additional';
    index?: number;
  }>;

  /** Validation warnings */
  warnings: string[];

  /** Validation errors (if any, args should not be used) */
  errors: string[];
}
```

## packages/vm-config/src/builder.ts
```typescript
/**
 * QEMU Argument Builder
 *
 * Constructs QEMU command-line arguments from a profile and inputs.
 */

import type { VmProfile, VmInputs, VmOverrides, QemuArgsResult } from './types.js';

/** Virtual filesystem paths used for mounting */
export const VIRT_PATHS = {
  DISK_PREFIX: '/vm/disk',
  KERNEL: '/vm/kernel',
  INITRD: '/vm/initrd',
} as const;

/**
 * Build QEMU arguments from profile, inputs, and overrides
 */
export function buildQemuArgs(
  profile: VmProfile,
  inputs: VmInputs,
  overrides?: VmOverrides
): QemuArgsResult {
  const args: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const filesToMount: QemuArgsResult['filesToMount'] = [];

  // Merge overrides with profile defaults
  const memoryMiB = overrides?.memoryMiB ?? profile.memoryMiB;
  const smp = overrides?.smp ?? profile.smp;
  const netMode = overrides?.net ?? profile.devices.net;
  const enableGraphics = overrides?.enableGraphics ?? profile.supportsGraphics;

  // Machine type
  args.push('-machine', profile.machine);

  // CPU
  if (profile.cpu) {
    args.push('-cpu', profile.cpu);
  }

  // Memory
  args.push('-m', `${memoryMiB}M`);

  // SMP
  if (smp > 1) {
    args.push('-smp', `${smp}`);
  }

  // Handle kernel requirement
  if (profile.requiresKernel) {
    if (!inputs.kernel) {
      if (inputs.disk) {
        warnings.push(
          `Profile "${profile.name}" recommends a kernel image. ` +
            `Disk-only boot may not work. ${profile.kernelHelpText ?? ''}`
        );
      } else {
        errors.push(
          `Profile "${profile.name}" requires a kernel image. ${profile.kernelHelpText ?? ''}`
        );
      }
    }
  }

  // Kernel
  if (inputs.kernel) {
    args.push('-kernel', VIRT_PATHS.KERNEL);
    filesToMount.push({ path: VIRT_PATHS.KERNEL, source: 'kernel' });
  }

  // Initrd
  if (inputs.initrd) {
    args.push('-initrd', VIRT_PATHS.INITRD);
    filesToMount.push({ path: VIRT_PATHS.INITRD, source: 'initrd' });
  }

  // Kernel command line
  if (inputs.kernelCmdline) {
    args.push('-append', inputs.kernelCmdline);
  } else if (inputs.kernel) {
    // Default kernel command line for serial console
    const defaultCmdline = enableGraphics
      ? 'console=tty0 root=/dev/vda rw'
      : 'console=ttyS0,115200 root=/dev/vda rw';
    args.push('-append', defaultCmdline);
  }

  // Main disk
  if (inputs.disk) {
    const diskPath = `${VIRT_PATHS.DISK_PREFIX}0`;
    const diskOpts = buildDiskArgs(profile, diskPath, 0, inputs.disk.readonly);
    args.push(...diskOpts);
    filesToMount.push({ path: diskPath, source: 'disk', index: 0 });
  } else if (!inputs.kernel) {
    errors.push('Either a disk image or kernel must be provided.');
  }

  // Additional disks
  if (inputs.additionalDisks) {
    inputs.additionalDisks.forEach((disk, i) => {
      const diskPath = `${VIRT_PATHS.DISK_PREFIX}${i + 1}`;
      const diskOpts = buildDiskArgs(profile, diskPath, i + 1, disk.readonly);
      args.push(...diskOpts);
      filesToMount.push({ path: diskPath, source: 'additional', index: i });
    });
  }

  // Network
  if (netMode === 'user') {
    args.push('-netdev', 'user,id=net0');
    args.push('-device', 'virtio-net-pci,netdev=net0');
    warnings.push(
      'User networking enabled. Performance may be limited. ' +
        'Some protocols (e.g., ICMP ping) may not work.'
    );
  } else {
    args.push('-net', 'none');
  }

  // Random number generator
  if (profile.devices.rng) {
    args.push('-object', 'rng-random,id=rng0,filename=/dev/urandom');
    args.push('-device', 'virtio-rng-pci,rng=rng0');
  }

  // Graphics or nographic
  if (!enableGraphics) {
    // Only add -nographic if it's not already in default args
    if (!profile.defaultArgs.includes('-nographic')) {
      args.push('-nographic');
    }
  }

  // Add profile's default args
  args.push(...profile.defaultArgs);

  // Add extra args from overrides
  if (overrides?.extraArgs) {
    args.push(...overrides.extraArgs);
  }

  // Deduplicate and clean up args
  const cleanedArgs = deduplicateArgs(args);

  return {
    args: cleanedArgs,
    arch: profile.arch,
    filesToMount,
    warnings,
    errors,
  };
}

/**
 * Build disk device arguments based on profile's disk interface
 */
function buildDiskArgs(
  profile: VmProfile,
  diskPath: string,
  index: number,
  readonly?: boolean
): string[] {
  const args: string[] = [];
  const iface = profile.devices.diskInterface;
  const driveId = `drive${index}`;
  const readonlyOpt = readonly ? ',readonly=on' : '';

  switch (iface) {
    case 'virtio-blk':
      args.push('-drive', `file=${diskPath},format=raw,if=none,id=${driveId}${readonlyOpt}`);
      args.push('-device', `virtio-blk-pci,drive=${driveId}`);
      break;

    case 'ide':
      args.push(
        '-drive',
        `file=${diskPath},format=raw,if=ide,index=${index}${readonlyOpt}`
      );
      break;

    case 'scsi':
      if (index === 0) {
        args.push('-device', 'virtio-scsi-pci,id=scsi0');
      }
      args.push('-drive', `file=${diskPath},format=raw,if=none,id=${driveId}${readonlyOpt}`);
      args.push('-device', `scsi-hd,drive=${driveId},bus=scsi0.0`);
      break;
  }

  return args;
}

/**
 * Remove duplicate arguments, keeping the last occurrence
 */
function deduplicateArgs(args: string[]): string[] {
  // Arguments that should only appear once
  const uniqueFlags = new Set(['-m', '-smp', '-machine', '-cpu', '-kernel', '-initrd', '-append']);

  const result: string[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (uniqueFlags.has(arg) && i + 1 < args.length) {
      // This is a flag with a value
      if (seen.has(arg)) {
        // Remove previous occurrence
        const prevIndex = seen.get(arg)!;
        result.splice(prevIndex, 2);
        // Update indices in seen map
        for (const [key, idx] of seen.entries()) {
          if (idx > prevIndex) {
            seen.set(key, idx - 2);
          }
        }
      }
      seen.set(arg, result.length);
      result.push(arg, args[++i]);
    } else {
      result.push(arg);
    }
  }

  return result;
}

/**
 * Validate that required inputs are provided for a profile
 */
export function validateInputs(
  profile: VmProfile,
  inputs: VmInputs
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (profile.requiresKernel && !inputs.kernel) {
    errors.push(`Profile "${profile.name}" requires a kernel image.`);
  }

  if (!inputs.disk && !inputs.kernel) {
    errors.push('Either a disk image or kernel must be provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a human-readable summary of the QEMU configuration
 */
export function summarizeConfig(profile: VmProfile, overrides?: VmOverrides): string {
  const memoryMiB = overrides?.memoryMiB ?? profile.memoryMiB;
  const smp = overrides?.smp ?? profile.smp;
  const net = overrides?.net ?? profile.devices.net;

  const lines = [
    `Profile: ${profile.name}`,
    `Architecture: ${profile.arch}`,
    `Machine: ${profile.machine}`,
    `CPU: ${profile.cpu ?? 'default'}`,
    `Memory: ${memoryMiB} MiB`,
    `CPUs: ${smp}`,
    `Disk Interface: ${profile.devices.diskInterface}`,
    `Network: ${net}`,
    `Graphics: ${profile.supportsGraphics ? 'yes' : 'no'}`,
  ];

  return lines.join('\n');
}
```

## packages/vm-config/src/profiles.ts
```typescript
/**
 * Default VM Profiles
 *
 * Pre-configured machine profiles for common use cases.
 */

import type { VmProfile } from './types.js';

/**
 * Linux x86_64 PC profile (nographic mode)
 *
 * Standard PC with Q35 chipset, suitable for most Linux distributions.
 * Uses serial console for output.
 */
export const linuxX86_64PcNographic: VmProfile = {
  id: 'linux-x86_64-pc-nographic',
  name: 'Linux x86_64 (Serial Console)',
  description: 'Standard x86_64 PC with Q35 chipset, serial console output',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-serial', 'mon:stdio'],
  requiresKernel: false,
  kernelHelpText:
    'You can boot directly from a disk image, or provide a kernel and initrd for faster boot.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536, // 64 KiB
  maxMemoryMiB: 2048,
};

/**
 * Linux x86_64 PC profile with graphics
 *
 * Standard PC with basic VGA output to canvas.
 */
export const linuxX86_64PcGraphics: VmProfile = {
  id: 'linux-x86_64-pc-graphics',
  name: 'Linux x86_64 (Graphics)',
  description: 'Standard x86_64 PC with Q35 chipset, VGA graphics output',
  arch: 'x86_64',
  machine: 'q35',
  cpu: 'qemu64',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: true,
  defaultArgs: ['-vga', 'std', '-display', 'sdl'],
  requiresKernel: false,
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'ttyS0',
    keyboard: true,
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Linux aarch64 virt profile (nographic mode)
 *
 * ARM64 virtual machine using the "virt" platform.
 * Requires kernel + initrd for boot (no BIOS/UEFI in simple mode).
 */
export const linuxAarch64VirtNographic: VmProfile = {
  id: 'linux-aarch64-virt-nographic',
  name: 'Linux aarch64 (Serial Console)',
  description: 'ARM64 virtual machine with virt platform, serial console output',
  arch: 'aarch64',
  machine: 'virt',
  cpu: 'cortex-a57',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-serial', 'mon:stdio'],
  requiresKernel: true,
  kernelHelpText:
    'The aarch64 virt machine requires a kernel and initrd. ' +
    'Disk-only boot is not supported without UEFI firmware.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'stdio',
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Linux aarch64 virt profile with graphics
 *
 * ARM64 with virtio-gpu for graphics output.
 */
export const linuxAarch64VirtGraphics: VmProfile = {
  id: 'linux-aarch64-virt-graphics',
  name: 'Linux aarch64 (Graphics)',
  description: 'ARM64 virtual machine with virt platform, virtio-gpu graphics',
  arch: 'aarch64',
  machine: 'virt',
  cpu: 'cortex-a57',
  memoryMiB: 512,
  smp: 1,
  supportsGraphics: true,
  defaultArgs: ['-device', 'virtio-gpu-pci', '-display', 'sdl'],
  requiresKernel: true,
  kernelHelpText:
    'The aarch64 virt machine requires a kernel and initrd. ' +
    'Disk-only boot is not supported without UEFI firmware.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    rng: true,
    serial: 'ttyS0',
    keyboard: true,
  },
  blockSizeBytes: 65536,
  maxMemoryMiB: 2048,
};

/**
 * Minimal x86_64 profile for testing
 *
 * Very lightweight configuration for quick testing.
 */
export const minimalX86_64: VmProfile = {
  id: 'minimal-x86_64',
  name: 'Minimal x86_64',
  description: 'Minimal x86_64 configuration for testing',
  arch: 'x86_64',
  machine: 'q35',
  memoryMiB: 128,
  smp: 1,
  supportsGraphics: false,
  defaultArgs: ['-nographic', '-no-reboot'],
  requiresKernel: true,
  kernelHelpText: 'Provide a minimal kernel for quick boot testing.',
  devices: {
    diskInterface: 'virtio-blk',
    net: 'none',
    serial: 'stdio',
  },
  blockSizeBytes: 4096,
  maxMemoryMiB: 512,
};

/**
 * All default profiles
 */
export const defaultProfiles: VmProfile[] = [
  linuxX86_64PcNographic,
  linuxX86_64PcGraphics,
  linuxAarch64VirtNographic,
  linuxAarch64VirtGraphics,
  minimalX86_64,
];

/**
 * Get a profile by ID
 */
export function getProfileById(id: string): VmProfile | undefined {
  return defaultProfiles.find((p) => p.id === id);
}

/**
 * Get profiles by architecture
 */
export function getProfilesByArch(arch: 'x86_64' | 'aarch64'): VmProfile[] {
  return defaultProfiles.filter((p) => p.arch === arch);
}

/**
 * Get profiles that support graphics
 */
export function getGraphicsProfiles(): VmProfile[] {
  return defaultProfiles.filter((p) => p.supportsGraphics);
}

/**
 * Get profiles for serial console (nographic)
 */
export function getSerialProfiles(): VmProfile[] {
  return defaultProfiles.filter((p) => !p.supportsGraphics);
}
```

## packages/vm-config/src/networking.ts
```typescript
/**
 * Virtual Network Configuration
 *
 * Software-defined networking for browser-based virtual machines.
 * Enables VM-to-VM communication via Web Workers and virtual switches.
 */

export interface VirtualNetwork {
  /** Unique network identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Network type */
  type: 'bridge' | 'nat' | 'isolated' | 'routed';

  /** CIDR notation for the network */
  cidr: string;

  /** Gateway IP address */
  gateway?: string;

  /** DHCP configuration */
  dhcp?: DhcpConfig;

  /** DNS configuration */
  dns?: DnsConfig;

  /** Connected VM interfaces */
  interfaces: VirtualInterface[];

  /** Network metadata */
  metadata: NetworkMetadata;
}

export interface DhcpConfig {
  enabled: boolean;
  rangeStart: string;
  rangeEnd: string;
  leaseTime: number; // seconds
  reservations: DhcpReservation[];
}

export interface DhcpReservation {
  mac: string;
  ip: string;
  hostname?: string;
}

export interface DnsConfig {
  enabled: boolean;
  domain: string;
  forwarders: string[];
  records: DnsRecord[];
}

export interface DnsRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'PTR' | 'MX' | 'TXT';
  value: string;
  ttl?: number;
}

export interface VirtualInterface {
  /** Unique interface identifier */
  id: string;

  /** VM this interface belongs to */
  vmId: string;

  /** MAC address */
  mac: string;

  /** Interface name in guest (e.g., eth0) */
  guestName: string;

  /** IP configuration */
  ipConfig: IpConfig;

  /** QoS settings */
  qos?: QosConfig;

  /** VLAN tag */
  vlan?: number;

  /** Whether interface is up */
  isUp: boolean;
}

export interface IpConfig {
  mode: 'dhcp' | 'static' | 'none';
  addresses?: string[]; // CIDR notation
  gateway?: string;
  dns?: string[];
  mtu?: number;
}

export interface QosConfig {
  /** Bandwidth limit in bits per second */
  bandwidthLimit?: number;

  /** Latency in milliseconds */
  latency?: number;

  /** Packet loss percentage (0-100) */
  packetLoss?: number;

  /** Jitter in milliseconds */
  jitter?: number;
}

export interface NetworkMetadata {
  createdAt: Date;
  modifiedAt: Date;
  description?: string;
  tags: string[];
}

/**
 * Virtual Switch for connecting VMs
 */
export interface VirtualSwitch {
  id: string;
  name: string;
  networkId: string;
  ports: SwitchPort[];
  macTable: Map<string, string>; // MAC -> portId
  stp: boolean; // Spanning Tree Protocol
}

export interface SwitchPort {
  id: string;
  interfaceId: string;
  vlan?: number;
  mode: 'access' | 'trunk';
  allowedVlans?: number[];
}

/**
 * Router for inter-network communication
 */
export interface VirtualRouter {
  id: string;
  name: string;
  interfaces: RouterInterface[];
  routes: Route[];
  nat?: NatConfig;
  firewall?: FirewallConfig;
}

export interface RouterInterface {
  id: string;
  networkId: string;
  ip: string;
  isGateway: boolean;
}

export interface Route {
  destination: string; // CIDR
  gateway: string;
  metric: number;
}

export interface NatConfig {
  enabled: boolean;
  rules: NatRule[];
}

export interface NatRule {
  type: 'snat' | 'dnat' | 'masquerade';
  source?: string;
  destination?: string;
  toSource?: string;
  toDestination?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number;
  toPort?: number;
}

export interface FirewallConfig {
  enabled: boolean;
  defaultPolicy: 'accept' | 'drop' | 'reject';
  rules: FirewallRule[];
}

export interface FirewallRule {
  id: string;
  name: string;
  priority: number;
  action: 'accept' | 'drop' | 'reject' | 'log';
  direction: 'inbound' | 'outbound' | 'forward';
  source?: string;
  destination?: string;
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  sourcePort?: string;
  destinationPort?: string;
  state?: ('new' | 'established' | 'related' | 'invalid')[];
}

/**
 * Network Topology - Complete network graph
 */
export interface NetworkTopology {
  networks: VirtualNetwork[];
  switches: VirtualSwitch[];
  routers: VirtualRouter[];
  connections: TopologyConnection[];
}

export interface TopologyConnection {
  id: string;
  sourceType: 'vm' | 'switch' | 'router';
  sourceId: string;
  sourcePort: string;
  targetType: 'vm' | 'switch' | 'router';
  targetId: string;
  targetPort: string;
}

// ============ Utility Functions ============

/**
 * Generate a random MAC address
 */
export function generateMac(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  // Set locally administered bit and unicast bit
  bytes[0] = (bytes[0] | 0x02) & 0xfe;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

/**
 * Generate a unique network ID
 */
export function generateNetworkId(): string {
  return `net_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique interface ID
 */
export function generateInterfaceId(): string {
  return `if_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse CIDR notation
 */
export function parseCidr(cidr: string): { network: string; prefix: number; mask: string } | null {
  const match = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!match) return null;

  const [, network, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);

  if (prefix < 0 || prefix > 32) return null;

  // Validate IP
  const parts = network.split('.').map((p) => parseInt(p, 10));
  if (parts.some((p) => p < 0 || p > 255)) return null;

  // Calculate mask
  const maskNum = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1) >>> 0;
  const mask = [
    (maskNum >>> 24) & 255,
    (maskNum >>> 16) & 255,
    (maskNum >>> 8) & 255,
    maskNum & 255,
  ].join('.');

  return { network, prefix, mask };
}

/**
 * Check if IP is in CIDR range
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  const ipNum = ipToNumber(ip);
  const netNum = ipToNumber(parsed.network);
  const maskNum = ipToNumber(parsed.mask);

  return (ipNum & maskNum) === (netNum & maskNum);
}

/**
 * Convert IP to number
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert number to IP
 */
export function numberToIp(num: number): string {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
}

/**
 * Get next available IP in CIDR
 */
export function getNextAvailableIp(cidr: string, usedIps: string[]): string | null {
  const parsed = parseCidr(cidr);
  if (!parsed) return null;

  const netNum = ipToNumber(parsed.network);
  const maskNum = ipToNumber(parsed.mask);
  const broadcastNum = (netNum | ~maskNum) >>> 0;

  const usedSet = new Set(usedIps.map(ipToNumber));

  // Skip network address and start from first usable
  for (let i = netNum + 1; i < broadcastNum; i++) {
    if (!usedSet.has(i)) {
      return numberToIp(i);
    }
  }

  return null;
}

/**
 * Create a default network configuration
 */
export function createDefaultNetwork(
  name: string,
  type: VirtualNetwork['type'] = 'nat',
  cidr: string = '10.0.0.0/24'
): VirtualNetwork {
  const now = new Date();
  const parsed = parseCidr(cidr);
  const gateway = parsed ? numberToIp(ipToNumber(parsed.network) + 1) : undefined;

  return {
    id: generateNetworkId(),
    name,
    type,
    cidr,
    gateway,
    dhcp: {
      enabled: true,
      rangeStart: parsed ? numberToIp(ipToNumber(parsed.network) + 100) : '10.0.0.100',
      rangeEnd: parsed ? numberToIp(ipToNumber(parsed.network) + 200) : '10.0.0.200',
      leaseTime: 3600,
      reservations: [],
    },
    dns: {
      enabled: true,
      domain: 'vm.local',
      forwarders: ['8.8.8.8', '8.8.4.4'],
      records: [],
    },
    interfaces: [],
    metadata: {
      createdAt: now,
      modifiedAt: now,
      tags: [],
    },
  };
}

/**
 * Create a virtual interface for a VM
 */
export function createVirtualInterface(
  vmId: string,
  _networkId: string,
  config: Partial<VirtualInterface> = {}
): VirtualInterface {
  return {
    id: generateInterfaceId(),
    vmId,
    mac: generateMac(),
    guestName: config.guestName ?? 'eth0',
    ipConfig: config.ipConfig ?? { mode: 'dhcp' },
    isUp: true,
    ...config,
  };
}

/**
 * Generate QEMU network arguments
 */
export function generateQemuNetworkArgs(
  iface: VirtualInterface,
  network: VirtualNetwork,
  index: number
): string[] {
  const args: string[] = [];

  // Network backend
  const netdevId = `net${index}`;
  if (network.type === 'nat' || network.type === 'bridge') {
    args.push('-netdev', `user,id=${netdevId}`);
  } else {
    args.push('-netdev', `socket,id=${netdevId},mcast=230.0.0.1:${1234 + index}`);
  }

  // Device frontend
  args.push(
    '-device',
    `virtio-net-pci,netdev=${netdevId},mac=${iface.mac},id=nic${index}`
  );

  return args;
}

// ============ Default Networks ============

export const DEFAULT_NETWORKS: Record<string, Partial<VirtualNetwork>> = {
  'management': {
    name: 'Management Network',
    type: 'nat',
    cidr: '10.0.0.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Default management network with NAT',
      tags: ['management', 'default'],
    },
  },
  'internal': {
    name: 'Internal Network',
    type: 'isolated',
    cidr: '192.168.100.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'Isolated internal network',
      tags: ['internal', 'isolated'],
    },
  },
  'dmz': {
    name: 'DMZ Network',
    type: 'routed',
    cidr: '172.16.0.0/24',
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      description: 'DMZ for public-facing services',
      tags: ['dmz', 'public'],
    },
  },
};
```

## packages/sidecar-proto/src/types.ts
```typescript
/**
 * Sidecar Protocol Types
 *
 * Defines interfaces for WebGPU sidecar communication.
 * The sidecar can run locally (same machine) or remotely (server/peer).
 */

/** Sidecar operating mode */
export type SidecarMode = 'local' | 'remote' | 'disabled';

/** Frame format for transmission */
export type FrameFormat = 'rgba' | 'rgb565' | 'yuv420' | 'compressed';

/** Sidecar connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Frame metadata
 */
export interface FrameMetadata {
  /** Frame sequence number */
  sequence: number;

  /** Timestamp in milliseconds */
  timestamp: number;

  /** Frame width in pixels */
  width: number;

  /** Frame height in pixels */
  height: number;

  /** Pixel format */
  format: FrameFormat;

  /** Whether this is a keyframe (full frame vs delta) */
  keyframe: boolean;
}

/**
 * Frame data container
 */
export interface Frame {
  metadata: FrameMetadata;

  /** Raw frame data */
  data: ArrayBuffer | SharedArrayBuffer;
}

/**
 * Sidecar configuration
 */
export interface SidecarConfig {
  /** Operating mode */
  mode: SidecarMode;

  /** Target frame rate (frames per second) */
  targetFps?: number;

  /** Preferred frame format */
  preferredFormat?: FrameFormat;

  /** WebSocket URL for remote mode */
  remoteUrl?: string;

  /** Enable frame compression for remote mode */
  enableCompression?: boolean;

  /** Ring buffer size in frames (for local mode) */
  ringBufferSize?: number;
}

/**
 * Sidecar statistics
 */
export interface SidecarStats {
  /** Frames received */
  framesReceived: number;

  /** Frames dropped */
  framesDropped: number;

  /** Average frame latency in ms */
  avgLatency: number;

  /** Current FPS */
  currentFps: number;

  /** Total bytes transferred */
  bytesTransferred: number;
}

// ============ Protocol Messages ============

/** Messages from QEMU/Emulator to Sidecar */
export type EmulatorToSidecarMessage =
  | SetModeMessage
  | SetFormatMessage
  | FrameMessage
  | PingMessage;

/** Messages from Sidecar to QEMU/Emulator */
export type SidecarToEmulatorMessage =
  | ModeAckMessage
  | FormatAckMessage
  | FrameAckMessage
  | PongMessage
  | ErrorMessage;

export interface SetModeMessage {
  type: 'setMode';
  mode: SidecarMode;
  config?: Partial<SidecarConfig>;
}

export interface ModeAckMessage {
  type: 'modeAck';
  mode: SidecarMode;
  success: boolean;
  error?: string;
}

export interface SetFormatMessage {
  type: 'setFormat';
  format: FrameFormat;
  width: number;
  height: number;
}

export interface FormatAckMessage {
  type: 'formatAck';
  format: FrameFormat;
  success: boolean;
}

export interface FrameMessage {
  type: 'frame';
  metadata: FrameMetadata;
  // Data is sent separately for efficiency
}

export interface FrameAckMessage {
  type: 'frameAck';
  sequence: number;
  latency: number;
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
  serverTime: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}
```

## apps/web/src/App.tsx
```typescript
import { useState, useEffect } from 'react';
import { IDELayout } from './components/IDELayout';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ModelSelector, ModelEndpoint } from './components/model/ModelSelector';
import { ViewCustomizer } from './components/views/ViewCustomizer';
import { ApprovalWorkflowProvider } from './components/approval/ApprovalWorkflow';
import { AtlasFrame } from './components/agent/AtlasFrame';
import { OllamaManager } from './components/ollama/OllamaManager';
import { InternalBrowser } from './components/browser/InternalBrowser';
import { getEventTracker } from './services/eventTracker';
import { getMemoryStore } from './services/vectorMemory';
import { getAuditLog } from './services/auditLog';
import { initOllamaService } from './services/ollamaService';
import { initAtlasPersistence } from './services/atlasPersistence';
import { getA11yEvents } from './services/accessibilityEvents';

// Legacy imports for VM mode
import { VmLauncher } from './components/VmLauncher';
import { TerminalView } from './components/TerminalView';
import { StatusBar } from './components/StatusBar';
import { CapabilityWarnings } from './components/CapabilityWarnings';
import { useQemuClient } from './hooks/useQemuClient';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

type AppMode = 'dashboard' | 'ide' | 'vm' | 'network' | 'browser' | 'ollama';

function App() {
  const [mode, setMode] = useState<AppMode>('dashboard');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showViewCustomizer, setShowViewCustomizer] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelEndpoint | undefined>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [agentPanelWidth] = useState(400);
  const [agentPanelExpanded, setAgentPanelExpanded] = useState(true);

  // Initialize tracking systems and Ollama
  useEffect(() => {
    const init = async () => {
      try {
        await getMemoryStore();
        await getEventTracker();
        await getAuditLog();
        // Initialize Ollama service
        await initOllamaService();
        // Initialize Atlas persistence
        await initAtlasPersistence();
        // Start A11y event tracking
        getA11yEvents().start();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setIsInitialized(true); // Continue anyway
      }
    };
    init();
  }, []);

  // Track mode changes
  useEffect(() => {
    if (!isInitialized) return;
    getEventTracker().then(tracker => {
      tracker.trackViewChange(mode);
    });
    // Also log navigation to audit
    getAuditLog().then(log => {
      log.logNavigation('app', mode);
    });
  }, [mode, isInitialized]);

  // Listen for navigation events from agent
  useEffect(() => {
    const handleAgentNav = (event: CustomEvent<{ view: string }>) => {
      const view = event.detail.view as AppMode;
      if (['dashboard', 'ide', 'vm', 'network', 'browser', 'ollama'].includes(view)) {
        setMode(view);
      }
    };
    window.addEventListener('agent:navigate', handleAgentNav as EventListener);
    return () => window.removeEventListener('agent:navigate', handleAgentNav as EventListener);
  }, []);

  const handleModelSelect = (model: ModelEndpoint) => {
    setCurrentModel(model);
    setShowModelSelector(false);
  };

  // Helper to get button class for nav items
  const getNavButtonClass = (targetMode: AppMode) => {
    return `px-3 py-1.5 rounded-lg text-sm font-medium ${
      mode === targetMode ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
    }`;
  };

  // Wrapper component that includes persistent floating Atlas panel
  const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ApprovalWorkflowProvider>
      <div className="flex h-screen bg-gray-900">
        {/* Main content area - add padding for floating panel */}
        <div 
          className="flex-1 flex flex-col min-w-0 transition-all duration-200"
          style={{ marginRight: agentPanelExpanded ? agentPanelWidth : 48 }}
        >
          {children}
        </div>
        {/* Floating Atlas Panel */}
        <AtlasFrame 
          defaultCollapsed={!agentPanelExpanded}
          defaultWidth={agentPanelWidth}
        />
      </div>
    </ApprovalWorkflowProvider>
  );

  // Render dashboard mode (default)
  if (mode === 'dashboard') {
    return (
      <AppShell>
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">🖥️ QemuWeb</h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setMode('dashboard')}
                className={getNavButtonClass('dashboard')}
              >
                Dashboard
              </button>
              <button
                onClick={() => setMode('ide')}
                className={getNavButtonClass('ide')}
              >
                IDE
              </button>
              <button
                onClick={() => setMode('vm')}
                className={getNavButtonClass('vm')}
              >
                VM
              </button>
              <button
                onClick={() => setMode('network')}
                className={getNavButtonClass('network')}
              >
                Network
              </button>
              <button
                onClick={() => setMode('browser')}
                className={getNavButtonClass('browser')}
              >
                Browser
              </button>
              <button
                onClick={() => setMode('ollama')}
                className={getNavButtonClass('ollama')}
              >
                Ollama
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Model Status */}
            <button
              onClick={() => setShowModelSelector(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
            >
              <span className={`w-2 h-2 rounded-full ${
                currentModel?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              <span className="text-gray-300">
                {currentModel?.name || 'No Model'}
              </span>
            </button>
            
            {/* Customize Views */}
            <button
              onClick={() => setShowViewCustomizer(true)}
              className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600"
            >
              ⚙️ Customize
            </button>

            {/* Toggle Agent Panel */}
            <button
              onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
              className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600"
            >
              🤖 {agentPanelExpanded ? 'Hide' : 'Show'} Agent
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden min-h-0">
          <MainDashboard />
        </main>

        {/* Model Selector Modal */}
        {showModelSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ModelSelector
                  currentModel={currentModel}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </div>
          </div>
        )}

        {/* View Customizer Modal */}
        {showViewCustomizer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowViewCustomizer(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ViewCustomizer />
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }
  
  if (mode === 'ide') {
    return (
      <AppShell>
        {/* Minimal header for IDE mode */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModelSelector(true)}
              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              <span className={`w-2 h-2 rounded-full ${
                currentModel?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              {currentModel?.name || 'Select Model'}
            </button>
            <button
              onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
              className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              🤖
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <IDELayout />
        </main>

        {showModelSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(false)}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10"
                >
                  ×
                </button>
                <ModelSelector
                  currentModel={currentModel}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  if (mode === 'network') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Network Topology</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-4">🌐</div>
            <p>Network topology view coming soon...</p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (mode === 'browser') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Internal Browser</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <InternalBrowser />
        </main>
      </AppShell>
    );
  }

  if (mode === 'ollama') {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <nav className="flex gap-2">
            <button
              onClick={() => setMode('dashboard')}
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
            >
              ← Dashboard
            </button>
          </nav>
          <h2 className="text-lg font-medium text-white">Ollama Manager</h2>
          <button
            onClick={() => setAgentPanelExpanded(!agentPanelExpanded)}
            className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white"
          >
            🤖
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">
          <OllamaManager />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <VmMode 
        onSwitchMode={() => setMode('dashboard')} 
        agentPanelExpanded={agentPanelExpanded}
        onToggleAgent={() => setAgentPanelExpanded(!agentPanelExpanded)}
      />
    </AppShell>
  );
}

// Legacy VM Mode Component
interface VmModeProps {
  onSwitchMode: () => void;
  agentPanelExpanded: boolean;
  onToggleAgent: () => void;
}

function VmMode({ onSwitchMode, agentPanelExpanded, onToggleAgent }: VmModeProps) {
  const [vmId, setVmId] = useState<string | null>(null);
  const [serialOutput, setSerialOutput] = useState<string[]>([]);

  const {
    capabilities,
    vmState,
    isReady,
    error,
    startVm,
    stopVm,
    sendSerialIn,
  } = useQemuClient({
    onSerialOut: (id: string, data: string) => {
      if (id === vmId || vmId === null) {
        setSerialOutput((prev) => [...prev, data]);
      }
    },
  });

  const handleStart = async (profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides) => {
    const id = `vm-${Date.now()}`;
    setVmId(id);
    setSerialOutput([]);
    await startVm(id, profile, inputs, overrides);
  };

  const handleStop = async () => {
    if (vmId) {
      await stopVm(vmId);
    }
  };

  const handleSerialInput = (data: string) => {
    if (vmId) {
      sendSerialIn(vmId, data);
    }
  };

  const isRunning = vmState?.status === 'running';
  const isStarting = vmState?.status === 'starting';

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 container mx-auto px-4 py-6 overflow-auto">
        {/* Mode Switcher */}
        <div className="mb-4 flex justify-between">
          <button
            onClick={onSwitchMode}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Switch to Dashboard
          </button>
          <button
            onClick={onToggleAgent}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            🤖 {agentPanelExpanded ? 'Hide' : 'Show'} Agent
          </button>
        </div>

        {!isReady ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Initializing runtime...</p>
            </div>
          </div>
        ) : error ? (
          <div className="card bg-red-900/50 border border-red-700">
            <h2 className="text-xl font-bold text-red-400 mb-2">Initialization Error</h2>
            <p className="text-red-200">{error}</p>
          </div>
        ) : (
          <>
            <CapabilityWarnings capabilities={capabilities} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: VM Launcher */}
              <div className="lg:col-span-1">
                <VmLauncher
                  onStart={handleStart}
                  onStop={handleStop}
                  isRunning={isRunning}
                  isStarting={isStarting}
                />
              </div>

              {/* Right: Terminal */}
              <div className="lg:col-span-2">
                <TerminalView
                  output={serialOutput}
                  onInput={handleSerialInput}
                  isRunning={isRunning}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <StatusBar
        vmState={vmState}
        capabilities={capabilities}
      />
    </div>
  );
}

export default App;
```

---
# PACKAGE CONFIGURATIONS

## Root package.json
```json
{
  "name": "qemuweb",
  "version": "0.1.0",
  "private": true,
  "description": "Run QEMU disk images in the browser via WebAssembly",
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "build:qemu": "pnpm --filter @qemuweb/qemu-wasm build",
    "dev": "turbo run dev --filter=@qemuweb/web",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "clean": "turbo run clean && rm -rf node_modules",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^3.2.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

## turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "test:unit": {
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "lint:fix": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---
# END OF EXPORT
Generated: Fri Jan  9 22:07:48 GMT 2026
