import { useState, useEffect } from 'react';
import type { InfrastructureConfig } from '@qemuweb/vm-config';
import {
  generateTerraformConfig,
  parseTerraformConfig,
  createSingleVmInfra,
  createWebAppInfra,
  createClusterInfra,
} from '@qemuweb/vm-config';

interface InfrastructureEditorProps {
  config: InfrastructureConfig;
  onConfigChange: (config: InfrastructureConfig) => void;
}

const TEMPLATES = [
  { id: 'single-vm', name: 'Single VM', description: 'Basic single virtual machine' },
  { id: 'web-app', name: 'Web App', description: 'Web server with load balancer' },
  { id: 'cluster', name: 'Cluster', description: 'Multi-node compute cluster' },
] as const;

export function InfrastructureEditor({ config, onConfigChange }: InfrastructureEditorProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [codeContent, setCodeContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Sync code content with config
  useEffect(() => {
    setCodeContent(generateTerraformConfig(config));
  }, [config]);

  const handleCodeChange = (value: string) => {
    setCodeContent(value);
    setParseError(null);

    // Try to parse on change
    try {
      const parsed = parseTerraformConfig(value);
      onConfigChange(parsed);
    } catch (err) {
      setParseError((err as Error).message);
    }
  };

  const applyTemplate = (templateId: typeof TEMPLATES[number]['id']) => {
    let newConfig: InfrastructureConfig;

    switch (templateId) {
      case 'single-vm':
        newConfig = createSingleVmInfra('my-vm');
        break;
      case 'web-app':
        newConfig = createWebAppInfra('webapp');
        break;
      case 'cluster':
        newConfig = createClusterInfra('cluster');
        break;
    }

    onConfigChange(newConfig);
    setShowTemplates(false);
  };

  const addResource = (type: string) => {
    const resourceCount = config.resources.filter((r) => r.type === type).length;

    const newResource = {
      type,
      name: `${type.replace('qemuweb_', '')}_${resourceCount + 1}`,
      config: getDefaultConfigForType(type),
    };

    onConfigChange({
      ...config,
      resources: [...config.resources, newResource as any],
    });
  };

  const removeResource = (index: number) => {
    onConfigChange({
      ...config,
      resources: config.resources.filter((_, i) => i !== index),
    });
  };

  const updateResource = (index: number, updates: Record<string, unknown>) => {
    const newResources = [...config.resources];
    newResources[index] = {
      ...newResources[index],
      config: {
        ...newResources[index].config,
        ...updates,
      },
    };
    onConfigChange({ ...config, resources: newResources });
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Infrastructure Config
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="btn btn-sm btn-secondary"
          >
            Templates
          </button>
          <div className="flex bg-gray-700 rounded-lg">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 text-sm rounded-l-lg transition-colors ${
                viewMode === 'visual'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 text-sm rounded-r-lg transition-colors ${
                viewMode === 'code'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Code
            </button>
          </div>
        </div>
      </div>

      {/* Visual Editor */}
      {viewMode === 'visual' && (
        <div className="space-y-4">
          {/* Resource Type Buttons */}
          <div className="flex flex-wrap gap-2">
            {['qemuweb_vm', 'qemuweb_disk', 'qemuweb_network'].map((type) => (
              <button
                key={type}
                onClick={() => addResource(type)}
                className="btn btn-sm btn-secondary"
              >
                + {type.replace('qemuweb_', '')}
              </button>
            ))}
          </div>

          {/* Resource List */}
          <div className="space-y-3">
            {config.resources.map((resource, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      resource.type.includes('vm') ? 'bg-blue-900 text-blue-300' :
                      resource.type.includes('disk') ? 'bg-green-900 text-green-300' :
                      resource.type.includes('network') ? 'bg-purple-900 text-purple-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {resource.type.replace('qemuweb_', '')}
                    </span>
                    <h3 className="font-medium text-white mt-1">{resource.name}</h3>
                  </div>
                  <button
                    onClick={() => removeResource(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Resource-specific fields */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {resource.type.includes('vm') && (
                    <>
                      <div>
                        <label className="block text-gray-500 mb-1">Memory (MB)</label>
                        <input
                          type="number"
                          value={(resource.config as any).memory ?? 256}
                          onChange={(e) => updateResource(index, { memory: parseInt(e.target.value) })}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1">CPUs</label>
                        <input
                          type="number"
                          value={(resource.config as any).cpus ?? 1}
                          onChange={(e) => updateResource(index, { cpus: parseInt(e.target.value) })}
                          min={1}
                          max={4}
                          className="input w-full"
                        />
                      </div>
                    </>
                  )}
                  {resource.type.includes('disk') && (
                    <>
                      <div>
                        <label className="block text-gray-500 mb-1">Size (GB)</label>
                        <input
                          type="number"
                          value={(resource.config as any).size ?? 2}
                          onChange={(e) => updateResource(index, { size: parseInt(e.target.value) })}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1">Format</label>
                        <select
                          value={(resource.config as any).format ?? 'qcow2'}
                          onChange={(e) => updateResource(index, { format: e.target.value })}
                          className="input w-full"
                        >
                          <option value="qcow2">QCOW2</option>
                          <option value="raw">RAW</option>
                        </select>
                      </div>
                    </>
                  )}
                  {resource.type.includes('network') && (
                    <>
                      <div>
                        <label className="block text-gray-500 mb-1">Type</label>
                        <select
                          value={(resource.config as any).type ?? 'nat'}
                          onChange={(e) => updateResource(index, { type: e.target.value })}
                          className="input w-full"
                        >
                          <option value="nat">NAT</option>
                          <option value="bridge">Bridge</option>
                          <option value="isolated">Isolated</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1">CIDR</label>
                        <input
                          type="text"
                          value={(resource.config as any).cidr ?? '10.0.0.0/24'}
                          onChange={(e) => updateResource(index, { cidr: e.target.value })}
                          className="input w-full font-mono"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {config.resources.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No resources defined. Add a VM, disk, or network to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Editor */}
      {viewMode === 'code' && (
        <div className="space-y-2">
          <textarea
            value={codeContent}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="w-full h-[400px] bg-gray-900 text-gray-100 font-mono text-sm p-4 rounded-lg border border-gray-700 focus:border-indigo-500 focus:outline-none"
            spellCheck={false}
          />
          {parseError && (
            <div className="text-red-400 text-sm">
              Parse error: {parseError}
            </div>
          )}
        </div>
      )}

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-4">Choose a Template</h3>

            <div className="space-y-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className="w-full p-4 text-left bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <h4 className="font-medium text-white">{template.name}</h4>
                  <p className="text-sm text-gray-400">{template.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowTemplates(false)}
              className="btn btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultConfigForType(type: string): Record<string, unknown> {
  switch (type) {
    case 'qemuweb_vm':
      return { memory: 256, cpus: 1, architecture: 'x86_64' };
    case 'qemuweb_disk':
      return { size: 2, format: 'qcow2', bootable: true };
    case 'qemuweb_network':
      return { type: 'nat', cidr: '10.0.0.0/24', dhcp_enabled: true };
    default:
      return {};
  }
}
