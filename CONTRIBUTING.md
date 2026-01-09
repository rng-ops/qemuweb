# Contributing to QemuWeb

Thank you for your interest in contributing to QemuWeb! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Install dependencies**: `pnpm install`
4. **Create a branch**: `git checkout -b feature/your-feature-name`

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
pnpm dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @qemuweb/storage test

# Run tests in watch mode
pnpm test:watch
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint --fix

# Format code
pnpm format
```

### Type Checking

```bash
pnpm typecheck
```

## Pull Request Process

1. **Update tests** - Add or update tests for any new functionality
2. **Update documentation** - Update README or add docs if needed
3. **Run checks** - Ensure `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass
4. **Write clear commit messages** - Use conventional commits format:
   - `feat: add new feature`
   - `fix: resolve bug`
   - `docs: update documentation`
   - `refactor: improve code structure`
   - `test: add tests`
   - `chore: update dependencies`

5. **Submit PR** - Create a pull request with a clear description

## Project Structure

```
qemuweb/
├── apps/
│   └── web/           # Main web application
├── extensions/
│   └── chrome/        # Chrome extension
├── packages/
│   ├── qemu-wasm/     # QEMU WASM build
│   ├── vm-config/     # VM profiles
│   ├── storage/       # Storage layer
│   ├── runtime/       # Worker runtime
│   └── sidecar-proto/ # WebGPU protocol
└── docs/              # Documentation
```

## Adding New Features

### New VM Profile

1. Add profile to `packages/vm-config/src/profiles.ts`
2. Add tests in `packages/vm-config/src/__tests__/`
3. Update documentation

### New Block Device Type

1. Create device in `packages/storage/src/`
2. Export from `packages/storage/src/index.ts`
3. Add tests

### UI Components

1. Create component in `apps/web/src/components/`
2. Use Tailwind CSS for styling
3. Add TypeScript types

## Building QEMU WASM

Building QEMU to WebAssembly requires Docker:

```bash
cd packages/qemu-wasm
./scripts/build.sh
```

This takes 30-60 minutes. Pre-built binaries are available in releases.

## Questions?

Open an issue or start a discussion on GitHub.
