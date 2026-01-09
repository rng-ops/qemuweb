import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBOverlay } from '../src/indexeddbOverlay.js';

describe('IndexedDBOverlay', () => {
  let overlay: IndexedDBOverlay;
  const vmId = 'test-vm';
  const diskId = 'test-disk';
  const blockSize = 4096;

  beforeEach(async () => {
    overlay = new IndexedDBOverlay(vmId, diskId, blockSize);
    await overlay.init();
  });

  afterEach(async () => {
    await overlay.close();
  });

  it('should initialize without error', async () => {
    expect(overlay).toBeDefined();
  });

  it('should return null for non-existent block', async () => {
    const data = await overlay.readBlock(0);
    expect(data).toBeNull();
  });

  it('should write and read a block', async () => {
    const testData = new Uint8Array(blockSize);
    testData.fill(42);

    await overlay.writeBlock(0, testData);
    const data = await overlay.readBlock(0);

    expect(data).not.toBeNull();
    expect(data![0]).toBe(42);
    expect(data!.length).toBe(blockSize);
  });

  it('should flush writes to IndexedDB', async () => {
    const testData = new Uint8Array(blockSize);
    testData.fill(123);

    await overlay.writeBlock(5, testData);
    await overlay.flush();

    // Create new overlay and verify data persisted
    const overlay2 = new IndexedDBOverlay(vmId, diskId, blockSize);
    await overlay2.init();

    const data = await overlay2.readBlock(5);
    expect(data).not.toBeNull();
    expect(data![0]).toBe(123);

    await overlay2.close();
  });

  it('should track modified blocks', async () => {
    const testData = new Uint8Array(blockSize);

    await overlay.writeBlock(0, testData);
    await overlay.writeBlock(5, testData);
    await overlay.writeBlock(10, testData);
    await overlay.flush();

    const modified = await overlay.getModifiedBlocks();
    expect(modified).toContain(0);
    expect(modified).toContain(5);
    expect(modified).toContain(10);
    expect(modified.length).toBe(3);
  });

  it('should report correct statistics', async () => {
    const testData = new Uint8Array(blockSize);

    await overlay.writeBlock(0, testData);
    await overlay.writeBlock(1, testData);
    await overlay.flush();

    const stats = await overlay.getStats();
    expect(stats.blockCount).toBe(2);
    expect(stats.totalBytes).toBe(blockSize * 2);
  });

  it('should clear overlay data', async () => {
    const testData = new Uint8Array(blockSize);

    await overlay.writeBlock(0, testData);
    await overlay.flush();
    await overlay.clear();

    const data = await overlay.readBlock(0);
    expect(data).toBeNull();
  });

  it('should export and import overlay data', async () => {
    const testData = new Uint8Array(blockSize);
    testData[0] = 99;
    testData[1] = 88;

    await overlay.writeBlock(0, testData);
    await overlay.writeBlock(3, testData);
    await overlay.flush();

    const exported = await overlay.export();
    expect(exported.blocks.length).toBe(2);

    // Clear and reimport
    await overlay.clear();
    const dataAfterClear = await overlay.readBlock(0);
    expect(dataAfterClear).toBeNull();

    await overlay.import(exported);
    const dataAfterImport = await overlay.readBlock(0);
    expect(dataAfterImport).not.toBeNull();
    expect(dataAfterImport![0]).toBe(99);
    expect(dataAfterImport![1]).toBe(88);
  });

  it('should throw if block size is wrong', async () => {
    const wrongSize = new Uint8Array(100);
    await expect(overlay.writeBlock(0, wrongSize)).rejects.toThrow();
  });
});
