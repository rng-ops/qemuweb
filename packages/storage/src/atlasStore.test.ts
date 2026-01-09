/**
 * Atlas Store Tests
 *
 * Note: These tests require a browser environment with IndexedDB.
 * In Node.js, use fake-indexeddb or run in a browser test environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hashBlob,
  generateId,
  isValidContentHash,
  parseContentHash,
  ContentHash,
  FileManifest,
  DEFAULT_CHUNK_SIZE,
} from './atlasStore/types';

describe('Atlas Store Types', () => {
  describe('hashBlob', () => {
    it('should generate consistent SHA-256 hashes', async () => {
      const data = new TextEncoder().encode('hello world').buffer;
      const hash1 = await hashBlob(data);
      const hash2 = await hashBlob(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should generate different hashes for different data', async () => {
      const data1 = new TextEncoder().encode('hello').buffer;
      const data2 = new TextEncoder().encode('world').buffer;

      const hash1 = await hashBlob(data1);
      const hash2 = await hashBlob(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate the correct hash for known input', async () => {
      // SHA-256 of empty string is well-known
      const emptyHash = await hashBlob(new ArrayBuffer(0));
      expect(emptyHash).toBe(
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should generate 32-character hex strings', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('isValidContentHash', () => {
    it('should validate correct SHA-256 hashes', () => {
      const hash: ContentHash =
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(isValidContentHash(hash)).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidContentHash('sha256:invalid')).toBe(false);
      expect(isValidContentHash('md5:e3b0c44298fc1c149afbf4c8996fb924')).toBe(false);
      expect(isValidContentHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(false);
      expect(isValidContentHash('')).toBe(false);
    });
  });

  describe('parseContentHash', () => {
    it('should parse valid content hashes', () => {
      const hash = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const parsed = parseContentHash(hash);

      expect(parsed).not.toBeNull();
      expect(parsed?.algorithm).toBe('sha256');
      expect(parsed?.hex).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });

    it('should return null for invalid hashes', () => {
      expect(parseContentHash('invalid')).toBeNull();
      expect(parseContentHash('sha256:short')).toBeNull();
    });
  });

  describe('DEFAULT_CHUNK_SIZE', () => {
    it('should be 4 MiB', () => {
      expect(DEFAULT_CHUNK_SIZE).toBe(4 * 1024 * 1024);
    });
  });
});

describe('FileManifest', () => {
  it('should have correct structure', () => {
    const manifest: FileManifest = {
      version: 1,
      type: 'qcow2',
      totalSize: 1024 * 1024 * 100, // 100 MiB
      chunks: [
        {
          hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          offset: 0,
          size: DEFAULT_CHUNK_SIZE,
        },
      ],
      mimeType: 'application/x-qemu-disk',
      metadata: {
        format: 'qcow2',
        virtualSize: 1024 * 1024 * 1024 * 10, // 10 GiB
      },
    };

    expect(manifest.version).toBe(1);
    expect(manifest.type).toBe('qcow2');
    expect(manifest.chunks).toHaveLength(1);
  });
});

// Note: BrowserAtlasStore tests would require IndexedDB mocking
// For full integration tests, run in a browser environment with Playwright
