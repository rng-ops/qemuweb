import { useState, useCallback } from 'react';
import { ProfilePicker } from './ProfilePicker';
import { DiskPicker } from './DiskPicker';
import { MemorySelector } from './MemorySelector';
import type { VmProfile, VmInputs, VmOverrides } from '@qemuweb/vm-config';

interface VmLauncherProps {
  onStart: (profile: VmProfile, inputs: VmInputs, overrides?: VmOverrides) => Promise<void>;
  onStop: () => Promise<void>;
  isRunning: boolean;
  isStarting: boolean;
}

export function VmLauncher({ onStart, onStop, isRunning, isStarting }: VmLauncherProps) {
  const [profile, setProfile] = useState<VmProfile | null>(null);
  const [diskFile, setDiskFile] = useState<File | null>(null);
  const [kernelFile, setKernelFile] = useState<File | null>(null);
  const [initrdFile, setInitrdFile] = useState<File | null>(null);
  const [kernelCmdline, setKernelCmdline] = useState('');
  const [memoryMiB, setMemoryMiB] = useState<number | undefined>(undefined);
  const [smp, setSmp] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!profile) {
      setError('Please select a VM profile');
      return;
    }

    if (!diskFile && !kernelFile) {
      setError('Please provide a disk image or kernel');
      return;
    }

    setError(null);

    const inputs: VmInputs = {};

    if (diskFile) {
      inputs.disk = { file: diskFile };
    }

    if (kernelFile) {
      inputs.kernel = { file: kernelFile };
    }

    if (initrdFile) {
      inputs.initrd = { file: initrdFile };
    }

    if (kernelCmdline.trim()) {
      inputs.kernelCmdline = kernelCmdline.trim();
    }

    const overrides: VmOverrides = {};
    if (memoryMiB !== undefined) {
      overrides.memoryMiB = memoryMiB;
    }
    if (smp !== undefined) {
      overrides.smp = smp;
    }

    try {
      await onStart(profile, inputs, Object.keys(overrides).length > 0 ? overrides : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start VM');
    }
  }, [profile, diskFile, kernelFile, initrdFile, kernelCmdline, memoryMiB, smp, onStart]);

  const handleStop = useCallback(async () => {
    try {
      await onStop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop VM');
    }
  }, [onStop]);

  const isDisabled = isRunning || isStarting;

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-white">VM Configuration</h2>

      {/* Profile Selection */}
      <div>
        <ProfilePicker
          value={profile}
          onChange={setProfile}
          disabled={isDisabled}
        />
      </div>

      {/* Profile Info */}
      {profile && (
        <div className="text-sm text-gray-400 bg-gray-900 rounded p-3">
          <div><span className="text-gray-500">Arch:</span> {profile.arch}</div>
          <div><span className="text-gray-500">Machine:</span> {profile.machine}</div>
          {profile.requiresKernel && (
            <div className="text-yellow-500 mt-2">
              ⚠️ This profile requires a kernel image
            </div>
          )}
        </div>
      )}

      {/* Disk Image */}
      <div>
        <label>Disk Image</label>
        <DiskPicker
          label="Select or drop disk image"
          file={diskFile}
          onFileChange={setDiskFile}
          accept=".qcow2,.img,.raw,.iso"
          disabled={isDisabled}
        />
      </div>

      {/* Kernel (optional or required) */}
      {profile && (
        <div>
          <label>
            Kernel {profile.requiresKernel ? '(required)' : '(optional)'}
          </label>
          <DiskPicker
            label="Select kernel image"
            file={kernelFile}
            onFileChange={setKernelFile}
            accept=".vmlinuz,.bzImage,.kernel,*"
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Initrd (shown if kernel is selected) */}
      {kernelFile && (
        <div>
          <label>Initrd (optional)</label>
          <DiskPicker
            label="Select initrd"
            file={initrdFile}
            onFileChange={setInitrdFile}
            accept=".initrd,.img,.cpio,.gz"
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Kernel Command Line */}
      {kernelFile && (
        <div>
          <label>Kernel Command Line</label>
          <input
            type="text"
            value={kernelCmdline}
            onChange={(e) => setKernelCmdline(e.target.value)}
            placeholder="console=ttyS0 root=/dev/vda rw"
            className="w-full"
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Memory */}
      <div>
        <MemorySelector
          label="Memory"
          value={memoryMiB ?? profile?.memoryMiB ?? 512}
          onChange={setMemoryMiB}
          min={64}
          max={2048}
          disabled={isDisabled}
        />
      </div>

      {/* SMP */}
      <div>
        <label>CPU Cores</label>
        <select
          value={smp ?? profile?.smp ?? 1}
          onChange={(e) => setSmp(parseInt(e.target.value, 10))}
          className="w-full"
          disabled={isDisabled}
        >
          {[1, 2, 4].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'core' : 'cores'}
            </option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={isStarting || !profile}
            className="btn btn-primary flex-1"
          >
            {isStarting ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                Starting...
              </>
            ) : (
              '▶ Start VM'
            )}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="btn btn-danger flex-1"
          >
            ■ Stop VM
          </button>
        )}
      </div>
    </div>
  );
}
