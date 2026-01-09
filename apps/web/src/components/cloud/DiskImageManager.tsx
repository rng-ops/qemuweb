import { useState, useRef } from 'react';
import type { DiskImageConfig, CloudInitConfig } from '@qemuweb/vm-config';
import {
  DEFAULT_DISK_CONFIGS,
  createDiskConfig,
  parseQcow2Header,
} from '@qemuweb/vm-config';

interface DiskImageManagerProps {
  onDiskSelected: (disk: DiskImageConfig, file?: File) => void;
  selectedDisk?: DiskImageConfig | null;
}

export function DiskImageManager({ onDiskSelected, selectedDisk }: DiskImageManagerProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'upload' | 'create'>('templates');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadInfo, setUploadInfo] = useState<{ virtual: number; actual: number } | null>(null);
  const [customConfig, setCustomConfig] = useState({
    name: '',
    sizeGb: 2,
    format: 'qcow2' as 'qcow2' | 'raw',
    bootable: false,
    enableCloudInit: false,
    hostname: '',
    users: ['admin'],
    packages: [] as string[],
    sshKey: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    // Try to parse QCOW2 header
    try {
      const buffer = await file.slice(0, 512).arrayBuffer();
      const info = await parseQcow2Header(buffer);
      if (info) {
        setUploadInfo({
          virtual: Number(info.virtualSize),
          actual: file.size,
        });

        // Create disk config from uploaded file
        const config = createDiskConfig('minimal-linux', {
          name: file.name.replace(/\.(qcow2|raw|img)$/i, ''),
          sizeBytes: Number(info.virtualSize),
          format: 'qcow2',
          bootable: true,
        });

        onDiskSelected(config, file);
      }
    } catch {
      // Not a QCOW2 file or parse error
      const config = createDiskConfig('minimal-linux', {
        name: file.name.replace(/\.(qcow2|raw|img)$/i, ''),
        sizeBytes: file.size,
        format: file.name.endsWith('.raw') ? 'raw' : 'qcow2',
        bootable: true,
      });
      setUploadInfo({
        virtual: file.size,
        actual: file.size,
      });
      onDiskSelected(config, file);
    }
  };

  const selectTemplate = (templateId: keyof typeof DEFAULT_DISK_CONFIGS) => {
    const config = createDiskConfig(templateId);
    onDiskSelected(config);
  };

  const createCustomDisk = () => {
    let cloudInit: CloudInitConfig | undefined;

    if (customConfig.enableCloudInit) {
      cloudInit = {
        hostname: customConfig.hostname || 'custom-vm',
        users: customConfig.users.map((name) => ({
          name,
          groups: ['sudo', 'wheel'],
          sudo: 'ALL=(ALL) NOPASSWD:ALL',
          shell: '/bin/sh',
          sshAuthorizedKeys: customConfig.sshKey ? [customConfig.sshKey] : [],
          lockPasswd: true,
        })),
        sshAuthorizedKeys: customConfig.sshKey ? [customConfig.sshKey] : [],
        packages: customConfig.packages,
        runcmd: [],
        writeFiles: [],
      };
    }

    const config = createDiskConfig('minimal-linux', {
      name: customConfig.name || 'Custom Disk',
      sizeBytes: customConfig.sizeGb * 1024 * 1024 * 1024,
      format: customConfig.format,
      bootable: customConfig.bootable,
      cloudInit,
    });

    onDiskSelected(config);
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        Disk Images
      </h2>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        {(['templates', 'upload', 'create'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {Object.entries(DEFAULT_DISK_CONFIGS).map(([id, config]) => (
            <button
              key={id}
              onClick={() => selectTemplate(id as keyof typeof DEFAULT_DISK_CONFIGS)}
              className={`w-full p-3 text-left rounded-lg border transition-colors ${
                selectedDisk?.id === config.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-white">{config.name}</h3>
                  <p className="text-sm text-gray-400">
                    {config.sizeBytes ? formatSize(config.sizeBytes) : 'N/A'} • {config.format ?? 'qcow2'} • {config.bootable ? 'Bootable' : 'Data'}
                  </p>
                </div>
                {selectedDisk?.id === config.id && (
                  <span className="text-indigo-400">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".qcow2,.raw,.img"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-500 transition-colors"
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-300 mb-1">Drop QCOW2 or RAW image here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </div>

          {uploadedFile && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">{uploadedFile.name}</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>File size: {formatSize(uploadedFile.size)}</p>
                {uploadInfo && uploadInfo.virtual !== uploadInfo.actual && (
                  <p>Virtual size: {formatSize(uploadInfo.virtual)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Tab */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Disk Name</label>
            <input
              type="text"
              value={customConfig.name}
              onChange={(e) => setCustomConfig((c) => ({ ...c, name: e.target.value }))}
              placeholder="my-custom-disk"
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Size (GB)</label>
              <input
                type="number"
                value={customConfig.sizeGb}
                onChange={(e) => setCustomConfig((c) => ({ ...c, sizeGb: parseInt(e.target.value) || 1 }))}
                min={1}
                max={100}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
              <select
                value={customConfig.format}
                onChange={(e) => setCustomConfig((c) => ({ ...c, format: e.target.value as 'qcow2' | 'raw' }))}
                className="input w-full"
              >
                <option value="qcow2">QCOW2</option>
                <option value="raw">RAW</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bootable"
              checked={customConfig.bootable}
              onChange={(e) => setCustomConfig((c) => ({ ...c, bootable: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="bootable" className="text-sm text-gray-300">Bootable</label>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="cloudInit"
                checked={customConfig.enableCloudInit}
                onChange={(e) => setCustomConfig((c) => ({ ...c, enableCloudInit: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="cloudInit" className="text-sm font-medium text-gray-300">Enable Cloud-Init</label>
            </div>

            {customConfig.enableCloudInit && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hostname</label>
                  <input
                    type="text"
                    value={customConfig.hostname}
                    onChange={(e) => setCustomConfig((c) => ({ ...c, hostname: e.target.value }))}
                    placeholder="my-vm"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SSH Public Key</label>
                  <textarea
                    value={customConfig.sshKey}
                    onChange={(e) => setCustomConfig((c) => ({ ...c, sshKey: e.target.value }))}
                    placeholder="ssh-ed25519 AAAA..."
                    rows={2}
                    className="input w-full font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={createCustomDisk}
            className="btn btn-primary w-full mt-4"
          >
            Create Disk Configuration
          </button>
        </div>
      )}
    </div>
  );
}
