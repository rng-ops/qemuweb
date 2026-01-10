import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { CowBlockDevice } from '../src/cowBlockDevice.js';
import { FileBlockDevice } from '../src/fileBlockDevice.js';

describe('CowBlockDevice', () => {
  let baseDevice: FileBlockDevice;
  let cowDevice: CowBlockDevice;
  const blockSize = 4096;

  beforeEach(async () => {
    // Create base device with test data
    const baseData = new Uint8Array(blockSize * 8);
    for (let i = 0; i < baseData.length; i++) {
      baseData[i] = i % 256;
    }

    const blob = new Blob([baseData]);
    baseDevice = new FileBlockDevice({
      id: 'base-device',
      file: blob,
      blockSize,
    });

    cowDevice = new CowBlockDevice({
      id: 'cow-device',
      base: baseDevice,
      vmId: 'test-vm',
      diskId: 'test-disk',
      blockSize,
    });

    await cowDevice.init();
  });

  afterEach(async () => {
    await cowDevice.close();
    // Delete all IndexedDB databases to ensure clean state
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });

  it('should report correct size', () => {
    expect(cowDevice.size).toBe(baseDevice.size);
    expect(cowDevice.blockCount).toBe(8);
  });

  it('should not be read-only', () => {
    expect(cowDevice.readonly).toBe(false);
  });

  it('should read from base when overlay is empty', async () => {
    const data = await cowDevice.readBlocks(0, 1);

    expect(data.length).toBe(blockSize);
    expect(data[0]).toBe(0);
    expect(data[100]).toBe(100);
  });

  it('should write to overlay', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(255);

    await cowDevice.writeBlocks(0, writeData);
    const data = await cowDevice.readBlocks(0, 1);

    expect(data[0]).toBe(255);
    expect(data[100]).toBe(255);
  });

  it('should read from overlay for modified blocks', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(42);

    await cowDevice.writeBlocks(2, writeData);

    // Block 0 should still come from base
    const block0 = await cowDevice.readBlocks(0, 1);
    expect(block0[0]).toBe(0);

    // Block 2 should come from overlay
    const block2 = await cowDevice.readBlocks(2, 1);
    expect(block2[0]).toBe(42);
  });

  it('should handle reading multiple blocks with mixed sources', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(99);

    await cowDevice.writeBlocks(1, writeData);
    await cowDevice.writeBlocks(3, writeData);

    // Read blocks 0-3 (mix of base and overlay)
    const data = await cowDevice.readBlocks(0, 4);

    // Block 0: base
    expect(data[0]).toBe(0);
    // Block 1: overlay
    expect(data[blockSize]).toBe(99);
    // Block 2: base
    expect(data[blockSize * 2]).toBe((blockSize * 2) % 256);
    // Block 3: overlay
    expect(data[blockSize * 3]).toBe(99);
  });

  it('should sync to IndexedDB', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(77);

    await cowDevice.writeBlocks(0, writeData);
    await cowDevice.sync();

    const stats = await cowDevice.getOverlayStats();
    expect(stats.blockCount).toBe(1);
  });

  it('should export overlay data', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(55);

    await cowDevice.writeBlocks(0, writeData);
    await cowDevice.writeBlocks(5, writeData);
    await cowDevice.sync();

    const exported = await cowDevice.exportOverlay();
    expect(exported.blocks.length).toBe(2);
  });

  it('should clear overlay data', async () => {
    const writeData = new Uint8Array(blockSize);
    writeData.fill(33);

    await cowDevice.writeBlocks(0, writeData);
    await cowDevice.sync();
    await cowDevice.clearOverlay();

    // Should now read from base again
    const data = await cowDevice.readBlocks(0, 1);
    expect(data[0]).toBe(0);
  });
});
