import { describe, it, expect } from 'vitest';

describe('sidecar-proto', () => {
  it('should export transport types', async () => {
    const module = await import('./index');
    expect(module).toBeDefined();
  });
});
