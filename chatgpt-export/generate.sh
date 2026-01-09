#!/bin/bash
# Script to generate ChatGPT-friendly export
# Run from project root: ./chatgpt-export/generate.sh

cd "$(dirname "$0")/.."

OUTPUT="chatgpt-export/BROWSERQEMU_COMPLETE.md"

echo "Generating ChatGPT export..."

cat > "$OUTPUT" << 'HEADER'
# BrowserQEMU - Complete Codebase Documentation

This document contains the complete documentation and key source files for the BrowserQEMU project.
It is designed to be uploaded to ChatGPT or other AI assistants for context.

---

HEADER

# Add PLAN.md
echo "## PLAN.md - Project Documentation" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo '```markdown' >> "$OUTPUT"
cat PLAN.md >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Add key source files
echo "---" >> "$OUTPUT"
echo "# KEY SOURCE FILES" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Runtime package
echo "## packages/runtime/src/index.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/runtime/src/index.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/runtime/src/client.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/runtime/src/client.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/runtime/src/worker.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/runtime/src/worker.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/runtime/src/protocol.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/runtime/src/protocol.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Storage package
echo "## packages/storage/src/types.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/storage/src/types.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/storage/src/cowBlockDevice.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/storage/src/cowBlockDevice.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/storage/src/indexeddbOverlay.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/storage/src/indexeddbOverlay.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# VM Config package
echo "## packages/vm-config/src/types.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/vm-config/src/types.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/vm-config/src/builder.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/vm-config/src/builder.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/vm-config/src/profiles.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/vm-config/src/profiles.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## packages/vm-config/src/networking.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/vm-config/src/networking.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Sidecar proto
echo "## packages/sidecar-proto/src/types.ts" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat packages/sidecar-proto/src/types.ts >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Web app
echo "## apps/web/src/App.tsx" >> "$OUTPUT"
echo '```typescript' >> "$OUTPUT"
cat apps/web/src/App.tsx >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Package.json files for dependency info
echo "---" >> "$OUTPUT"
echo "# PACKAGE CONFIGURATIONS" >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## Root package.json" >> "$OUTPUT"
echo '```json' >> "$OUTPUT"
cat package.json >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "## turbo.json" >> "$OUTPUT"
echo '```json' >> "$OUTPUT"
cat turbo.json >> "$OUTPUT"
echo '```' >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "---" >> "$OUTPUT"
echo "# END OF EXPORT" >> "$OUTPUT"
echo "Generated: $(date)" >> "$OUTPUT"

echo "Done! Export saved to: $OUTPUT"
wc -l "$OUTPUT"
