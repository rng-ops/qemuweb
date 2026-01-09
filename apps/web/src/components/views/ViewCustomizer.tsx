/**
 * View Customization System
 * 
 * Allows users to:
 * - Suggest new views via natural language
 * - Arrange existing pages and panels
 * - Export reports with cryptographic provenance
 * - Save and share layouts
 */

import React, { useState, useCallback, useRef } from 'react';
import { getMemoryStore } from '../../services/vectorMemory';
import { getEventTracker } from '../../services/eventTracker';

// ============ Types ============

export interface ViewDefinition {
  id: string;
  name: string;
  type: 'panel' | 'page' | 'modal' | 'sidebar';
  component?: string;
  layout: ViewLayout;
  props?: Record<string, unknown>;
  isCustom?: boolean;
  createdAt?: number;
  createdBy?: 'user' | 'agent' | 'system';
}

export interface ViewLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  isResizable?: boolean;
  isDraggable?: boolean;
}

export interface LayoutPreset {
  id: string;
  name: string;
  description?: string;
  views: ViewDefinition[];
  isBuiltIn?: boolean;
}

export interface ViewSuggestion {
  id: string;
  prompt: string;
  generatedCode?: string;
  status: 'pending' | 'generating' | 'ready' | 'applied' | 'rejected';
  preview?: string;
}

export interface ExportConfig {
  format: 'json' | 'html' | 'pdf' | 'markdown';
  includeProvenance: boolean;
  includeMemory: boolean;
  signReport: boolean;
  sections: string[];
}

export interface ReportProvenance {
  generatedAt: string;
  generatedBy: string;
  sessionId: string;
  contentHash: string;
  signature?: string;
  attestations?: {
    type: string;
    issuer: string;
    timestamp: string;
    data: Record<string, unknown>;
  }[];
}

// ============ Built-in Layouts ============

const BUILT_IN_LAYOUTS: LayoutPreset[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Services and images split view',
    isBuiltIn: true,
    views: [
      {
        id: 'services-panel',
        name: 'Running Services',
        type: 'panel',
        component: 'ServicesPanel',
        layout: { x: 0, y: 0, width: 100, height: 50 },
      },
      {
        id: 'images-panel',
        name: 'Images',
        type: 'panel',
        component: 'ImagesPanel',
        layout: { x: 0, y: 50, width: 100, height: 50 },
      },
    ],
  },
  {
    id: 'ide',
    name: 'IDE Layout',
    description: 'Code editor with terminal and sidebar',
    isBuiltIn: true,
    views: [
      {
        id: 'sidebar',
        name: 'Explorer',
        type: 'sidebar',
        component: 'FileExplorer',
        layout: { x: 0, y: 0, width: 20, height: 100, minWidth: 15, maxWidth: 40 },
      },
      {
        id: 'editor',
        name: 'Editor',
        type: 'panel',
        component: 'CodeEditor',
        layout: { x: 20, y: 0, width: 80, height: 70 },
      },
      {
        id: 'terminal',
        name: 'Terminal',
        type: 'panel',
        component: 'Terminal',
        layout: { x: 20, y: 70, width: 80, height: 30 },
      },
    ],
  },
  {
    id: 'network',
    name: 'Network View',
    description: 'Network topology and traffic analysis',
    isBuiltIn: true,
    views: [
      {
        id: 'topology',
        name: 'Network Topology',
        type: 'panel',
        component: 'NetworkTopology',
        layout: { x: 0, y: 0, width: 60, height: 100 },
      },
      {
        id: 'traffic',
        name: 'Traffic Analysis',
        type: 'panel',
        component: 'TrafficAnalysis',
        layout: { x: 60, y: 0, width: 40, height: 50 },
      },
      {
        id: 'policies',
        name: 'Policies',
        type: 'panel',
        component: 'NetworkPolicies',
        layout: { x: 60, y: 50, width: 40, height: 50 },
      },
    ],
  },
];

// ============ View Suggestion Input Component ============

interface ViewSuggestionInputProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
}

function ViewSuggestionInput({ onSubmit, isGenerating }: ViewSuggestionInputProps) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  }, [prompt, isGenerating, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Describe the view you want to create
        </label>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g., Create a panel showing CPU and memory usage for all running containers with real-time charts..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!prompt.trim() || isGenerating}
        className={`
          w-full py-2 rounded-lg font-medium transition-colors
          ${!prompt.trim() || isGenerating
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }
        `}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating View...
          </span>
        ) : (
          '✨ Generate View'
        )}
      </button>
    </form>
  );
}

// ============ Layout Selector Component ============

interface LayoutSelectorProps {
  layouts: LayoutPreset[];
  currentLayoutId: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

function LayoutSelector({ layouts, currentLayoutId, onSelect, onDelete }: LayoutSelectorProps) {
  return (
    <div className="space-y-2">
      {layouts.map(layout => (
        <div
          key={layout.id}
          className={`
            p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
            ${currentLayoutId === layout.id
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }
          `}
          onClick={() => onSelect(layout.id)}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{layout.name}</span>
              {layout.isBuiltIn && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                  Built-in
                </span>
              )}
            </div>
            {layout.description && (
              <p className="text-sm text-gray-400 mt-0.5">{layout.description}</p>
            )}
          </div>
          {!layout.isBuiltIn && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(layout.id); }}
              className="p-1 text-gray-500 hover:text-red-400"
            >
              🗑️
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ View Arrangement Panel Component ============

interface ViewArrangementProps {
  views: ViewDefinition[];
  onUpdateView: (id: string, updates: Partial<ViewDefinition>) => void;
  onRemoveView: (id: string) => void;
}

function ViewArrangement({ views, onUpdateView, onRemoveView }: ViewArrangementProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-400 mb-2">Arrange Views</label>
      <div className="space-y-2">
        {views.map((view) => (
          <div
            key={view.id}
            draggable
            onDragStart={() => setDraggingId(view.id)}
            onDragEnd={() => setDraggingId(null)}
            className={`
              p-3 rounded-lg border bg-gray-800/50 cursor-move
              ${draggingId === view.id ? 'border-indigo-500 opacity-50' : 'border-gray-700'}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">⋮⋮</span>
                <input
                  type="text"
                  value={view.name}
                  onChange={e => onUpdateView(view.id, { name: e.target.value })}
                  className="bg-transparent border-none text-white focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{view.type}</span>
                <button
                  onClick={() => onRemoveView(view.id)}
                  className="p-1 text-gray-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-gray-500">X</label>
                <input
                  type="number"
                  value={view.layout.x}
                  onChange={e => onUpdateView(view.id, { layout: { ...view.layout, x: Number(e.target.value) } })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-gray-500">Y</label>
                <input
                  type="number"
                  value={view.layout.y}
                  onChange={e => onUpdateView(view.id, { layout: { ...view.layout, y: Number(e.target.value) } })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-gray-500">W</label>
                <input
                  type="number"
                  value={view.layout.width}
                  onChange={e => onUpdateView(view.id, { layout: { ...view.layout, width: Number(e.target.value) } })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-gray-500">H</label>
                <input
                  type="number"
                  value={view.layout.height}
                  onChange={e => onUpdateView(view.id, { layout: { ...view.layout, height: Number(e.target.value) } })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Report Export Component ============

interface ReportExportProps {
  onExport: (config: ExportConfig) => void;
  isExporting: boolean;
}

function ReportExport({ onExport, isExporting }: ReportExportProps) {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'json',
    includeProvenance: true,
    includeMemory: true,
    signReport: true,
    sections: ['services', 'images', 'network', 'memory'],
  });

  const toggleSection = (section: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter(s => s !== section)
        : [...prev.sections, section],
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-2">Export Format</label>
        <select
          value={config.format}
          onChange={e => setConfig(prev => ({ ...prev, format: e.target.value as ExportConfig['format'] }))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="json">JSON</option>
          <option value="html">HTML Report</option>
          <option value="markdown">Markdown</option>
          <option value="pdf">PDF (requires renderer)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Sections to Include</label>
        <div className="grid grid-cols-2 gap-2">
          {['services', 'images', 'network', 'memory', 'agents', 'config'].map(section => (
            <label key={section} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.sections.includes(section)}
                onChange={() => toggleSection(section)}
                className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm text-white capitalize">{section}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeProvenance}
            onChange={e => setConfig(prev => ({ ...prev, includeProvenance: e.target.checked }))}
            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm text-white">Include Cryptographic Provenance</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeMemory}
            onChange={e => setConfig(prev => ({ ...prev, includeMemory: e.target.checked }))}
            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm text-white">Include Event Memory</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.signReport}
            onChange={e => setConfig(prev => ({ ...prev, signReport: e.target.checked }))}
            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm text-white">Sign Report (ECDSA)</span>
        </label>
      </div>

      <button
        onClick={() => onExport(config)}
        disabled={isExporting || config.sections.length === 0}
        className={`
          w-full py-2 rounded-lg font-medium transition-colors
          ${isExporting || config.sections.length === 0
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }
        `}
      >
        {isExporting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating Report...
          </span>
        ) : (
          '📄 Export Report'
        )}
      </button>
    </div>
  );
}

// ============ Main View Customizer Component ============

interface ViewCustomizerProps {
  currentLayoutId?: string;
  onLayoutChange?: (layoutId: string, views: ViewDefinition[]) => void;
}

export function ViewCustomizer({ currentLayoutId = 'dashboard', onLayoutChange }: ViewCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'layouts' | 'arrange' | 'suggest' | 'export'>('layouts');
  const [layouts, setLayouts] = useState<LayoutPreset[]>(BUILT_IN_LAYOUTS);
  const [selectedLayoutId, setSelectedLayoutId] = useState(currentLayoutId);
  const [currentViews, setCurrentViews] = useState<ViewDefinition[]>(
    BUILT_IN_LAYOUTS.find(l => l.id === currentLayoutId)?.views || []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [suggestions, setSuggestions] = useState<ViewSuggestion[]>([]);

  // Handle layout selection
  const handleLayoutSelect = useCallback((id: string) => {
    const layout = layouts.find(l => l.id === id);
    if (layout) {
      setSelectedLayoutId(id);
      setCurrentViews([...layout.views]);
      onLayoutChange?.(id, layout.views);
    }
  }, [layouts, onLayoutChange]);

  // Handle view updates
  const handleUpdateView = useCallback((id: string, updates: Partial<ViewDefinition>) => {
    setCurrentViews(prev => prev.map(view => 
      view.id === id ? { ...view, ...updates } : view
    ));
  }, []);

  // Handle view removal
  const handleRemoveView = useCallback((id: string) => {
    setCurrentViews(prev => prev.filter(view => view.id !== id));
  }, []);

  // Handle view suggestion
  const handleSuggestView = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    
    const suggestion: ViewSuggestion = {
      id: `sug_${Date.now()}`,
      prompt,
      status: 'generating',
    };
    setSuggestions(prev => [...prev, suggestion]);

    try {
      // Track the suggestion event
      const tracker = await getEventTracker();
      tracker.trackUserInput({
        field: 'view-suggestion',
        value: prompt,
        type: 'suggestion',
      });

      // Simulate AI generation (replace with actual model call)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a mock view based on the prompt
      const newView: ViewDefinition = {
        id: `view_${Date.now()}`,
        name: extractViewName(prompt),
        type: 'panel',
        component: 'CustomView',
        layout: { x: 0, y: 0, width: 50, height: 50 },
        isCustom: true,
        createdAt: Date.now(),
        createdBy: 'agent',
        props: { prompt },
      };

      setSuggestions(prev => prev.map(s => 
        s.id === suggestion.id
          ? { ...s, status: 'ready', generatedCode: JSON.stringify(newView, null, 2) }
          : s
      ));

      // Add to current views
      setCurrentViews(prev => [...prev, newView]);

    } catch (error) {
      setSuggestions(prev => prev.map(s => 
        s.id === suggestion.id
          ? { ...s, status: 'rejected' }
          : s
      ));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Handle report export
  const handleExport = useCallback(async (config: ExportConfig) => {
    setIsExporting(true);

    try {
      const memoryStore = await getMemoryStore();
      const tracker = await getEventTracker();

      // Gather data
      const memories = config.includeMemory 
        ? await memoryStore.exportMemories({ limit: 500 })
        : [];
      
      const stats = await memoryStore.getStats();

      // Generate content hash
      const contentString = JSON.stringify({ memories, stats, views: currentViews });
      const encoder = new TextEncoder();
      const data = encoder.encode(contentString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Build provenance
      const provenance: ReportProvenance = {
        generatedAt: new Date().toISOString(),
        generatedBy: 'qemuweb/view-customizer',
        sessionId: memoryStore.getSessionId(),
        contentHash,
      };

      // Sign if requested (using SubtleCrypto)
      if (config.signReport) {
        const keyPair = await crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );
        
        const signature = await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          keyPair.privateKey,
          data
        );
        
        provenance.signature = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      // Build report
      const report = {
        version: '1.0',
        provenance: config.includeProvenance ? provenance : undefined,
        layout: {
          id: selectedLayoutId,
          views: currentViews,
        },
        data: {
          ...(config.sections.includes('memory') ? { memories } : {}),
          ...(config.sections.includes('services') ? { services: [] } : {}), // Add real data
          ...(config.sections.includes('images') ? { images: [] } : {}),
          ...(config.sections.includes('network') ? { network: {} } : {}),
        },
        stats,
      };

      // Format output
      let output: string;
      let mimeType: string;
      let extension: string;

      switch (config.format) {
        case 'html':
          output = generateHtmlReport(report);
          mimeType = 'text/html';
          extension = 'html';
          break;
        case 'markdown':
          output = generateMarkdownReport(report);
          mimeType = 'text/markdown';
          extension = 'md';
          break;
        default:
          output = JSON.stringify(report, null, 2);
          mimeType = 'application/json';
          extension = 'json';
      }

      // Download
      const blob = new Blob([output], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qemuweb-report-${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      // Track export
      tracker.trackAgentAction({
        agentId: 'system',
        action: 'export_report',
        input: config as unknown as Record<string, unknown>,
      });

    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [currentViews, selectedLayoutId]);

  // Save current layout
  const handleSaveLayout = useCallback(() => {
    const name = prompt('Enter layout name:');
    if (!name) return;

    const newLayout: LayoutPreset = {
      id: `custom_${Date.now()}`,
      name,
      views: currentViews,
      isBuiltIn: false,
    };

    setLayouts(prev => [...prev, newLayout]);
    setSelectedLayoutId(newLayout.id);
  }, [currentViews]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Customize Views</h2>
        <button
          onClick={handleSaveLayout}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          💾 Save Layout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['layouts', 'arrange', 'suggest', 'export'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors capitalize
              ${activeTab === tab 
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' 
                : 'text-gray-400 hover:text-white'
              }
            `}
          >
            {tab === 'layouts' && '📐 '}
            {tab === 'arrange' && '🔧 '}
            {tab === 'suggest' && '✨ '}
            {tab === 'export' && '📄 '}
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'layouts' && (
          <LayoutSelector
            layouts={layouts}
            currentLayoutId={selectedLayoutId}
            onSelect={handleLayoutSelect}
            onDelete={(id) => setLayouts(prev => prev.filter(l => l.id !== id))}
          />
        )}

        {activeTab === 'arrange' && (
          <ViewArrangement
            views={currentViews}
            onUpdateView={handleUpdateView}
            onRemoveView={handleRemoveView}
          />
        )}

        {activeTab === 'suggest' && (
          <div className="space-y-4">
            <ViewSuggestionInput
              onSubmit={handleSuggestView}
              isGenerating={isGenerating}
            />
            
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Recent Suggestions</label>
                {suggestions.slice(-5).reverse().map(s => (
                  <div
                    key={s.id}
                    className={`
                      p-3 rounded-lg border
                      ${s.status === 'ready' ? 'border-green-500/30 bg-green-500/5' :
                        s.status === 'rejected' ? 'border-red-500/30 bg-red-500/5' :
                        'border-gray-700 bg-gray-800/50'}
                    `}
                  >
                    <p className="text-sm text-white truncate">{s.prompt}</p>
                    <p className="text-xs text-gray-400 mt-1 capitalize">{s.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <ReportExport
            onExport={handleExport}
            isExporting={isExporting}
          />
        )}
      </div>
    </div>
  );
}

// ============ Helper Functions ============

function extractViewName(prompt: string): string {
  // Extract a meaningful name from the prompt
  const words = prompt.toLowerCase().split(' ');
  const keywords = ['panel', 'view', 'chart', 'dashboard', 'monitor', 'list', 'table', 'graph'];
  const found = words.find(w => keywords.some(k => w.includes(k)));
  
  if (found) {
    const idx = words.indexOf(found);
    return words.slice(Math.max(0, idx - 2), idx + 1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  return 'Custom View';
}

function generateHtmlReport(report: Record<string, unknown>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>QemuWeb Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #818cf8; }
    pre { background: #16213e; padding: 15px; border-radius: 8px; overflow: auto; }
    .provenance { background: #0f3460; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .verified { color: #34d399; }
  </style>
</head>
<body>
  <h1>🖥️ QemuWeb Report</h1>
  ${report.provenance ? `
  <div class="provenance">
    <h3>📋 Provenance</h3>
    <p>Generated: ${(report.provenance as ReportProvenance).generatedAt}</p>
    <p>Session: ${(report.provenance as ReportProvenance).sessionId}</p>
    <p>Content Hash: <code>${(report.provenance as ReportProvenance).contentHash.slice(0, 16)}...</code></p>
    ${(report.provenance as ReportProvenance).signature ? '<p class="verified">✓ Cryptographically Signed</p>' : ''}
  </div>
  ` : ''}
  <h2>📊 Data</h2>
  <pre>${JSON.stringify(report.data, null, 2)}</pre>
  <h2>📈 Statistics</h2>
  <pre>${JSON.stringify(report.stats, null, 2)}</pre>
</body>
</html>`;
}

function generateMarkdownReport(report: Record<string, unknown>): string {
  const provenance = report.provenance as ReportProvenance | undefined;
  
  return `# 🖥️ QemuWeb Report

${provenance ? `## 📋 Provenance

- **Generated:** ${provenance.generatedAt}
- **Session:** ${provenance.sessionId}
- **Content Hash:** \`${provenance.contentHash.slice(0, 32)}...\`
${provenance.signature ? '- ✓ **Cryptographically Signed**' : ''}

---
` : ''}

## 📊 Data

\`\`\`json
${JSON.stringify(report.data, null, 2)}
\`\`\`

## 📈 Statistics

\`\`\`json
${JSON.stringify(report.stats, null, 2)}
\`\`\`
`;
}

export default ViewCustomizer;
