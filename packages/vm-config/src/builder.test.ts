import { describe, it, expect } from 'vitest';
import {
  buildQemuArgs,
  validateInputs,
  linuxX86_64PcNographic,
  linuxAarch64VirtNographic,
  type VmInputs,
} from '../src/index.js';

describe('buildQemuArgs', () => {
  it('should build basic x86_64 args with disk', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs);

    expect(result.errors).toHaveLength(0);
    expect(result.args).toContain('-machine');
    expect(result.args).toContain('q35');
    expect(result.args).toContain('-m');
    expect(result.args).toContain('512M');
    expect(result.filesToMount).toHaveLength(1);
    expect(result.filesToMount[0].source).toBe('disk');
  });

  it('should include kernel and initrd when provided', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
      kernel: { file: new Blob(['kernel']) },
      initrd: { file: new Blob(['initrd']) },
      kernelCmdline: 'console=ttyS0 root=/dev/vda',
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs);

    expect(result.args).toContain('-kernel');
    expect(result.args).toContain('-initrd');
    expect(result.args).toContain('-append');
    expect(result.filesToMount).toHaveLength(3);
  });

  it('should apply memory override', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs, { memoryMiB: 1024 });

    expect(result.args).toContain('1024M');
  });

  it('should apply SMP override', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs, { smp: 4 });

    expect(result.args).toContain('-smp');
    expect(result.args).toContain('4');
  });

  it('should add user networking when enabled', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs, { net: 'user' });

    expect(result.args).toContain('-netdev');
    expect(result.args.some((a) => a.includes('user'))).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should warn when aarch64 profile lacks kernel', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxAarch64VirtNographic, inputs);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('kernel');
  });

  it('should error when no disk or kernel provided', () => {
    const inputs: VmInputs = {};

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should include extra args from overrides', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = buildQemuArgs(linuxX86_64PcNographic, inputs, {
      extraArgs: ['-no-reboot', '-snapshot'],
    });

    expect(result.args).toContain('-no-reboot');
    expect(result.args).toContain('-snapshot');
  });
});

describe('validateInputs', () => {
  it('should pass for valid x86_64 inputs', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = validateInputs(linuxX86_64PcNographic, inputs);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for aarch64 without kernel', () => {
    const inputs: VmInputs = {
      disk: { file: new Blob(['test']) },
    };

    const result = validateInputs(linuxAarch64VirtNographic, inputs);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail when no disk or kernel provided', () => {
    const inputs: VmInputs = {};

    const result = validateInputs(linuxX86_64PcNographic, inputs);

    expect(result.valid).toBe(false);
  });
});
