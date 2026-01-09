import { useState } from 'react';
import type {
  DiskImageConfig,
  NetworkTopology,
  InfrastructureConfig,
  RegistryImage,
  VirtualNetwork,
} from '@qemuweb/vm-config';
import {
  createSingleVmInfra,
  generateNetworkId,
} from '@qemuweb/vm-config';

import { DiskImageManager } from './DiskImageManager';
import { NetworkTopology as NetworkTopologyView } from './NetworkTopology';
import { ImageRegistry } from './ImageRegistry';
import { InfrastructureEditor } from './InfrastructureEditor';

export interface VmInstance {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  disk: DiskImageConfig;
  networkInterfaces: string[];
  memoryMb: number;
  cpus: number;
  createdAt: Date;
}

interface CloudDashboardProps {
  onLaunchVm: (vm: VmInstance) => void;
  onStopVm: (vmId: string) => void;
  runningVms: VmInstance[];
}

type TabId = 'vms' | 'disks' | 'networks' | 'images' | 'infrastructure';

export function CloudDashboard({ onLaunchVm, onStopVm, runningVms }: CloudDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('vms');

  // State for disk management
  const [selectedDisk, setSelectedDisk] = useState<DiskImageConfig | null>(null);
  const [, setDiskFile] = useState<File | null>(null);

  // Create default network
  const defaultNetwork: VirtualNetwork = {
    id: generateNetworkId(),
    name: 'Management Network',
    type: 'nat',
    cidr: '10.0.0.0/24',
    gateway: '10.0.0.1',
    dhcp: {
      enabled: true,
      rangeStart: '10.0.0.100',
      rangeEnd: '10.0.0.200',
      leaseTime: 86400,
      reservations: [],
    },
    interfaces: [],
    metadata: {
      createdAt: new Date(),
      modifiedAt: new Date(),
      tags: ['default'],
    },
  };

  // State for networking
  const [topology, setTopology] = useState<NetworkTopology>({
    networks: [defaultNetwork],
    routers: [],
    switches: [],
    connections: [],
  });

  // State for image registry
  const [selectedImage, setSelectedImage] = useState<RegistryImage | null>(null);

  // State for infrastructure
  const [infraConfig, setInfraConfig] = useState<InfrastructureConfig>(
    createSingleVmInfra('my-first-vm')
  );

  // Handle disk selection
  const handleDiskSelected = (disk: DiskImageConfig, file?: File) => {
    setSelectedDisk(disk);
    if (file) {
      setDiskFile(file);
    }
  };

  // Handle launching a new VM
  const handleLaunchVm = () => {
    if (!selectedDisk) return;

    const vm: VmInstance = {
      id: `vm-${Date.now()}`,
      name: selectedDisk.name ?? 'Untitled VM',
      status: 'starting',
      disk: selectedDisk,
      networkInterfaces: topology.networks.length > 0 ? [topology.networks[0].id] : [],
      memoryMb: 256,
      cpus: 1,
      createdAt: new Date(),
    };

    onLaunchVm(vm);
    setActiveTab('vms');
  };

  // Tab definitions
  const tabs = [
    { id: 'vms' as const, label: 'Virtual Machines', icon: '🖥️' },
    { id: 'disks' as const, label: 'Disk Images', icon: '💾' },
    { id: 'networks' as const, label: 'Networks', icon: '🌐' },
    { id: 'images' as const, label: 'Image Registry', icon: '📦' },
    { id: 'infrastructure' as const, label: 'Infrastructure', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">☁️</span>
              QemuWeb Cloud
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Virtual infrastructure running entirely in your browser
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-400">Running VMs:</span>
              <span className="ml-2 text-green-400 font-medium">
                {runningVms.filter((vm) => vm.status === 'running').length}
              </span>
            </div>
            <button
              onClick={handleLaunchVm}
              disabled={!selectedDisk}
              className="btn btn-primary"
            >
              + Launch VM
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-400'
                    : 'text-gray-400 border-transparent hover:text-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {/* VMs Tab */}
        {activeTab === 'vms' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Virtual Machines</h2>
              <div className="text-sm text-gray-400">
                {runningVms.length} VMs configured
              </div>
            </div>

            {runningVms.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-6xl mb-4">🖥️</div>
                <h3 className="text-xl font-medium text-white mb-2">No Virtual Machines</h3>
                <p className="text-gray-400 mb-6">
                  Get started by selecting a disk image and launching a VM
                </p>
                <button
                  onClick={() => setActiveTab('disks')}
                  className="btn btn-primary"
                >
                  Configure Disk Image →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {runningVms.map((vm) => (
                  <div key={vm.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-white">{vm.name}</h3>
                        <p className="text-xs text-gray-500">{vm.id}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        vm.status === 'running' ? 'bg-green-900 text-green-300' :
                        vm.status === 'starting' ? 'bg-yellow-900 text-yellow-300' :
                        vm.status === 'error' ? 'bg-red-900 text-red-300' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {vm.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">Memory:</span>
                        <span className="text-gray-300 ml-2">{vm.memoryMb} MB</span>
                      </div>
                      <div>
                        <span className="text-gray-500">CPUs:</span>
                        <span className="text-gray-300 ml-2">{vm.cpus}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Disk:</span>
                        <span className="text-gray-300 ml-2">{vm.disk.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Networks:</span>
                        <span className="text-gray-300 ml-2">{vm.networkInterfaces.length}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {vm.status === 'running' && (
                        <button
                          onClick={() => onStopVm(vm.id)}
                          className="btn btn-sm btn-secondary flex-1"
                        >
                          Stop
                        </button>
                      )}
                      {vm.status === 'stopped' && (
                        <button className="btn btn-sm btn-primary flex-1">
                          Start
                        </button>
                      )}
                      <button className="btn btn-sm btn-secondary">
                        Console
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disks Tab */}
        {activeTab === 'disks' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DiskImageManager
              onDiskSelected={handleDiskSelected}
              selectedDisk={selectedDisk}
            />

            {selectedDisk && (
              <div className="card">
                <h3 className="text-lg font-bold text-white mb-4">Selected Disk Configuration</h3>

                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Name:</div>
                      <div className="text-gray-300">{selectedDisk.name}</div>

                      <div className="text-gray-500">Format:</div>
                      <div className="text-gray-300">{selectedDisk.format}</div>

                      <div className="text-gray-500">Size:</div>
                      <div className="text-gray-300">
                        {(selectedDisk.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                      </div>

                      <div className="text-gray-500">Bootable:</div>
                      <div className="text-gray-300">{selectedDisk.bootable ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  {selectedDisk.cloudInit && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">Cloud-Init</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-500">Hostname:</div>
                        <div className="text-gray-300">{selectedDisk.cloudInit.hostname}</div>

                        <div className="text-gray-500">Users:</div>
                        <div className="text-gray-300">
                          {selectedDisk.cloudInit.users?.map((u) => u.name).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLaunchVm}
                    className="btn btn-primary w-full"
                  >
                    Launch VM with this Disk
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Networks Tab */}
        {activeTab === 'networks' && (
          <NetworkTopologyView
            topology={topology}
            onTopologyChange={setTopology}
          />
        )}

        {/* Image Registry Tab */}
        {activeTab === 'images' && (
          <ImageRegistry
            onImageSelected={setSelectedImage}
            selectedImage={selectedImage}
          />
        )}

        {/* Infrastructure Tab */}
        {activeTab === 'infrastructure' && (
          <InfrastructureEditor
            config={infraConfig}
            onConfigChange={setInfraConfig}
          />
        )}
      </div>
    </div>
  );
}
