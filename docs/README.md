# QemuWeb Documentation

This folder contains visual documentation for the QemuWeb project.

## Diagrams

All diagrams are in SVG format and can be opened in any browser or image viewer.

| File | Description |
|------|-------------|
| [01-architecture-overview.svg](diagrams/01-architecture-overview.svg) | High-level system architecture showing Main Thread, Web Worker, and Storage layers |
| [02-cow-storage.svg](diagrams/02-cow-storage.svg) | Copy-on-Write block device architecture with IndexedDB overlay |
| [03-worker-protocol.svg](diagrams/03-worker-protocol.svg) | Worker communication protocol - commands, events, and startup sequence |
| [04-virtual-networking.svg](diagrams/04-virtual-networking.svg) | Virtual SDN networking with multi-network topology |
| [05-atlas-store.svg](diagrams/05-atlas-store.svg) | Content-Addressed Storage (CAS) with deduplication |
| [06-ai-mcp-integration.svg](diagrams/06-ai-mcp-integration.svg) | AI Agent and MCP Server integration architecture |
| [07-package-dependencies.svg](diagrams/07-package-dependencies.svg) | Monorepo package structure and build dependencies |

## For AI Assistants

The main documentation file is [PLAN.md](../PLAN.md) in the project root. It contains:

- Executive Summary
- Complete Architecture Overview
- Package-by-Package Deep Dives
- Key Subsystem Documentation
- Implementation Status Tables
- API Reference
- Technical Challenges and Solutions

When working with this codebase, always start by reading PLAN.md for full context.

## Viewing Diagrams

The SVG files can be viewed by:
1. Opening them directly in a web browser
2. Using VS Code's built-in SVG preview
3. Any SVG-compatible image viewer

Each diagram uses a dark theme matching the project's aesthetic.
