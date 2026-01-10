import { describe, it, expect } from 'vitest';
import {
  detectCapabilities,
  detectWebAssembly,
  detectBigInt,
  createRequestId,
  summarizeCapabilities,
  checkMinimumRequirements,
} from './index.js';

describe('runtime', () => {
  describe('createRequestId', () => {
    it('should create unique request IDs', () => {
      const id1 = createRequestId();
      const id2 = createRequestId();
      expect(id1).not.toBe(id2);
    });

    it('should create IDs with correct format', () => {
      const id = createRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('capability detection', () => {
    it('should detect WebAssembly support', () => {
      const result = detectWebAssembly();
      expect(typeof result).toBe('boolean');
    });

    it('should detect BigInt support', () => {
      const result = detectBigInt();
      expect(result).toBe(true); // Node.js supports BigInt
    });

    it('should detect capabilities object', async () => {
      const caps = await detectCapabilities();
      expect(caps).toHaveProperty('webAssembly');
      expect(caps).toHaveProperty('bigInt');
    });

    it('should summarize capabilities', async () => {
      const caps = await detectCapabilities();
      const summary = summarizeCapabilities(caps);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should check minimum requirements', async () => {
      const caps = await detectCapabilities();
      const result = checkMinimumRequirements(caps);
      expect(result).toHaveProperty('satisfied');
      expect(result).toHaveProperty('missing');
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });
});
