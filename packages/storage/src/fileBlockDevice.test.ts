import { describe, it, expect, beforeEach } from 'vitest';
import { FileBlockDevice } from '../src/fileBlockDevice.js';

describe('FileBlockDevice', () => {
  let device: FileBlockDevice;
  const blockSize = 4096;
  const testData = new Uint8Array(blockSize * 4);

  beforeEach(() => {
    // Fill test data with patterns
    for (let i = 0; i < testData.length; i++) {
      testData[i] = i % 256;
    }

    const blob = new Blob([testData]);
    device = new FileBlockDevice({
      id: 'test-device',
      file: blob,
      blockSize,
    });
  });

  it('should report correct size and block count', () => {
    expect(device.size).toBe(testData.length);
    expect(device.blockCount).toBe(4);
    expect(device.blockSize).toBe(blockSize);
  });

  it('should be read-only', () => {
    expect(device.readonly).toBe(true);
  });

  it('should read a single block', async () => {
    const data = await device.readBlocks(0, 1);

    expect(data.length).toBe(blockSize);
    expect(data[0]).toBe(0);
    expect(data[100]).toBe(100);
  });

  it('should read multiple blocks', async () => {
    const data = await device.readBlocks(0, 2);

    expect(data.length).toBe(blockSize * 2);
    expect(data[0]).toBe(0);
    expect(data[blockSize]).toBe(blockSize % 256);
  });

  it('should read blocks from middle', async () => {
    const data = await device.readBlocks(2, 1);

    expect(data.length).toBe(blockSize);
    expect(data[0]).toBe((blockSize * 2) % 256);
  });

  it('should return zeros when reading beyond end', async () => {
    const data = await device.readBlocks(10, 1);

    expect(data.length).toBe(blockSize);
    expect(data.every((b) => b === 0)).toBe(true);
  });

  it('should throw when writing', async () => {
    await expect(device.writeBlocks(0, new Uint8Array(blockSize))).rejects.toThrow(
      'read-only'
    );
  });

  it('should close without error', async () => {
    await expect(device.close()).resolves.not.toThrow();
  });

  it('should track read statistics', async () => {
    await device.readBlocks(0, 1);
    await device.readBlocks(1, 2);

    const stats = device.getStats();
    expect(stats.readCount).toBe(2);
    expect(stats.bytesRead).toBe(blockSize * 3);
  });
});
