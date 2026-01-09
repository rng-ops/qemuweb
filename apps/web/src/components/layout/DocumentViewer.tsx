import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileMetadata, createBrowserAtlasStore } from '@qemuweb/storage';

interface DocumentViewerProps {
  file: FileMetadata;
  onContentChange?: (content: unknown) => void;
  onGenerateRequest?: (type: string) => void;
  onSave?: (file: FileMetadata, content: ArrayBuffer) => Promise<void>;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  file,
  onContentChange,
  onGenerateRequest,
  onSave,
}) => {
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const store = await createBrowserAtlasStore();
        const data = await store.readFile(file.name);
        
        if (mounted) {
          setContent(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      mounted = false;
    };
  }, [file.name, file.manifestHash]);

  // Handle saving content back to the store
  const handleSave = useCallback(async (newContent: ArrayBuffer): Promise<void> => {
    if (onSave) {
      await onSave(file, newContent);
    } else {
      // Default save implementation using Atlas Store
      const store = await createBrowserAtlasStore();
      const blobHash = await store.putBlob(newContent);
      
      // Create new manifest with updated content
      const manifestHash = await store.putManifest({
        version: 1,
        type: file.type as import('@qemuweb/storage').ManifestType,
        totalSize: newContent.byteLength,
        chunks: [{ hash: blobHash, offset: 0, size: newContent.byteLength }],
        mimeType: file.mimeType,
        metadata: {},
      });

      // Update the file registration
      await store.registerFile(file.name, manifestHash, {
        type: file.type,
        mimeType: file.mimeType,
        origin: file.origin,
        originDetails: file.originDetails,
        tags: file.tags,
      });

      // Update local content state
      setContent(newContent);
    }
  }, [file, onSave]);

  // Select appropriate viewer based on file type
  const ViewerComponent = useMemo(() => {
    return getViewerForType(file.type, file.mimeType);
  }, [file.type, file.mimeType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
          <span className="text-sm text-gray-400">Loading {file.name}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800">
        <div className="flex flex-col items-center gap-3 text-red-400">
          <ErrorIcon className="w-12 h-12" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center gap-3">
          <FileTypeIcon type={file.type} className="w-5 h-5" />
          <div>
            <div className="text-sm font-medium text-gray-200">{file.name}</div>
            <div className="text-xs text-gray-500">
              {formatBytes(file.size)} • {file.type}
              {file.mimeType && ` • ${file.mimeType}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Generate Actions */}
          {canGenerate(file.type) && (
            <div className="relative group">
              <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1">
                <SparklesIcon className="w-4 h-4" />
                Generate
                <ChevronDownIcon className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px] hidden group-hover:block z-10">
                {getGenerateOptions(file.type).map((option) => (
                  <button
                    key={option.type}
                    onClick={() => onGenerateRequest?.(option.type)}
                    className="w-full px-3 py-2 text-sm text-left text-gray-200 hover:bg-gray-700"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {file.sharedWithAssistant && (
            <span className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded">
              Shared with Assistant
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <ViewerComponent
          file={file}
          content={content}
          onContentChange={onContentChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

// ============ Viewer Registry ============

interface ViewerProps {
  file: FileMetadata;
  content: ArrayBuffer | null;
  onContentChange?: (content: unknown) => void;
  onSave?: (content: ArrayBuffer) => Promise<void>;
}

type ViewerComponent = React.FC<ViewerProps>;

function getViewerForType(type: string, mimeType?: string): ViewerComponent {
  // Check by file type first
  switch (type) {
    case 'config':
    case 'script':
    case 'plan':
      return CodeViewer;
    case 'qcow2':
    case 'raw-disk':
      return DiskImageViewer;
    case 'wasm':
      return WasmViewer;
    case 'kernel':
    case 'initrd':
      return BinaryViewer;
    case 'report':
      return MarkdownViewer;
    case 'bundle':
      return BundleViewer;
  }

  // Check by MIME type
  if (mimeType) {
    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('yaml')) {
      return CodeViewer;
    }
    if (mimeType.startsWith('image/')) {
      return ImageViewer;
    }
  }

  return BinaryViewer;
}

// ============ Viewer Components ============

const CodeViewer: React.FC<ViewerProps> = ({ file, content, onContentChange, onSave }) => {
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAssistant, setShowAssistant] = useState(true);
  const [assistantInput, setAssistantInput] = useState('');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (content) {
      const decoded = new TextDecoder().decode(content);
      setText(decoded);
      setOriginalText(decoded);
      // Generate initial suggestions based on file content
      generateSuggestions(decoded, file.type);
    }
  }, [content, file.type]);

  const hasChanges = text !== originalText;

  const generateSuggestions = async (currentText: string, fileType: string) => {
    // Generate context-aware suggestions
    const newSuggestions: AISuggestion[] = [];

    if (fileType === 'config' || fileType === 'plan') {
      // Check for common security issues
      if (currentText.includes('password') && !currentText.includes('***')) {
        newSuggestions.push({
          id: 'security-password',
          type: 'warning',
          title: 'Exposed Password',
          description: 'Consider using environment variables or a secrets manager for sensitive credentials.',
          action: 'Replace with reference',
        });
      }

      if (currentText.includes('0.0.0.0') || currentText.includes('*:')) {
        newSuggestions.push({
          id: 'security-binding',
          type: 'warning',
          title: 'Open Network Binding',
          description: 'Binding to 0.0.0.0 exposes the service on all interfaces. Consider restricting to specific IPs.',
          action: 'Restrict binding',
        });
      }

      if (currentText.includes('port') && currentText.includes('22')) {
        newSuggestions.push({
          id: 'policy-ssh',
          type: 'policy',
          title: 'SSH Access Policy',
          description: 'SSH access detected. Ensure key-based authentication is enabled and password auth is disabled.',
          action: 'Apply SSH hardening',
        });
      }

      if (currentText.includes('firewall') || currentText.includes('iptables')) {
        newSuggestions.push({
          id: 'policy-firewall',
          type: 'info',
          title: 'Firewall Configuration',
          description: 'Firewall rules detected. I can help you review and optimize these rules.',
          action: 'Review rules',
        });
      }

      // Check for networking configs
      if (currentText.includes('network') || currentText.includes('interface')) {
        newSuggestions.push({
          id: 'network-config',
          type: 'info',
          title: 'Network Configuration',
          description: 'Network settings detected. I can help validate subnet configurations and routing.',
          action: 'Validate network',
        });
      }
    }

    if (fileType === 'script') {
      if (currentText.includes('rm -rf') || currentText.includes('rm -r')) {
        newSuggestions.push({
          id: 'safety-rm',
          type: 'warning',
          title: 'Destructive Command',
          description: 'This script contains recursive delete commands. Ensure proper safeguards are in place.',
          action: 'Add safeguards',
        });
      }

      if (!currentText.includes('set -e')) {
        newSuggestions.push({
          id: 'best-practice-errexit',
          type: 'info',
          title: 'Error Handling',
          description: 'Consider adding "set -e" to exit on first error.',
          action: 'Add set -e',
        });
      }
    }

    setSuggestions(newSuggestions);
  };

  const handleSave = async () => {
    if (!onSave || !hasChanges) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const buffer = new TextEncoder().encode(text).buffer;
      await onSave(buffer);
      setOriginalText(text);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setText(originalText);
    setIsEditing(false);
  };

  const handleAssistantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantInput.trim()) return;

    setIsGenerating(true);
    
    // Simulate AI response - in real implementation this would call the AI service
    setTimeout(() => {
      const response: AISuggestion = {
        id: `ai-${Date.now()}`,
        type: 'ai-response',
        title: 'AI Assistant',
        description: getAIResponse(assistantInput, text, file.type),
        action: 'Apply suggestion',
        codeSnippet: getCodeSuggestion(assistantInput, text, file.type),
      };
      setSuggestions(prev => [response, ...prev]);
      setAssistantInput('');
      setIsGenerating(false);
    }, 500);
  };

  const handleApplySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.codeSnippet) {
      // Apply the code suggestion
      setText(prev => {
        if (suggestion.replacePattern) {
          return prev.replace(suggestion.replacePattern, suggestion.codeSnippet!);
        }
        // Append at cursor or end
        return prev + '\n' + suggestion.codeSnippet;
      });
      setIsEditing(true);
      onContentChange?.(text);
    }
    // Remove the suggestion after applying
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const language = useMemo(() => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      tf: 'terraform',
      hcl: 'terraform',
      sh: 'bash',
      py: 'python',
      js: 'javascript',
      ts: 'typescript',
      md: 'markdown',
    };
    return langMap[ext || ''] || 'plaintext';
  }, [file.name]);

  // Validate JSON if applicable
  const jsonError = useMemo(() => {
    if (language !== 'json') return null;
    try {
      JSON.parse(text);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid JSON';
    }
  }, [text, language]);

  // Re-generate suggestions when text changes significantly
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        generateSuggestions(text, file.type);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [text, file.type, isEditing]);

  return (
    <div className="h-full flex bg-gray-900">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{language}</span>
            {hasChanges && (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded">
                Unsaved changes
              </span>
            )}
            {jsonError && isEditing && (
              <span className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-400 rounded">
                {jsonError}
              </span>
            )}
            {saveError && (
              <span className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-400 rounded">
                {saveError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing && hasChanges && (
              <>
                <button
                  onClick={handleDiscard}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || (language === 'json' && !!jsonError)}
                  className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2 py-1 text-xs rounded ${
                isEditing ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {isEditing ? 'Editing' : 'Edit'}
            </button>
            <button
              onClick={() => setShowAssistant(!showAssistant)}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                showAssistant ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <SparklesIcon className="w-3 h-3" />
              AI
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {isEditing ? (
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onContentChange?.(e.target.value);
              }}
              className="w-full h-full p-4 bg-gray-900 text-gray-200 font-mono text-sm resize-none focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <pre className="p-4 text-sm text-gray-200 font-mono whitespace-pre-wrap break-words">
              {text || '(empty file)'}
            </pre>
          )}
        </div>
      </div>

      {/* AI Assistant Sidebar */}
      {showAssistant && (
        <div className="w-80 border-l border-gray-700 flex flex-col bg-gray-850">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-200">AI Assistant</span>
            </div>
            <button
              onClick={() => setShowAssistant(false)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400"
            >
              <CloseIconSmall className="w-3 h-3" />
            </button>
          </div>

          {/* Ask AI Input */}
          <form onSubmit={handleAssistantSubmit} className="p-3 border-b border-gray-700">
            <div className="relative">
              <input
                type="text"
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Ask about this config..."
                className="w-full px-3 py-2 pr-8 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isGenerating || !assistantInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 disabled:opacity-50"
              >
                {isGenerating ? (
                  <LoadingSpinner className="w-4 h-4" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <QuickAction label="Explain this" onClick={() => setAssistantInput('Explain what this configuration does')} />
              <QuickAction label="Find issues" onClick={() => setAssistantInput('Find potential issues or security problems')} />
              <QuickAction label="Optimize" onClick={() => setAssistantInput('Suggest optimizations')} />
            </div>
          </form>

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No suggestions yet</p>
                <p className="text-xs mt-1">Ask a question or edit the file</p>
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={() => handleApplySuggestion(suggestion)}
                  onDismiss={() => setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))}
                />
              ))
            )}
          </div>

          {/* Quick Tips */}
          <div className="p-3 border-t border-gray-700 bg-gray-800/50">
            <div className="text-xs text-gray-500">
              <strong className="text-gray-400">Tips:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Ask for explanations of specific sections</li>
                <li>• Request security policy suggestions</li>
                <li>• Get help with network configurations</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Suggestion Types
interface AISuggestion {
  id: string;
  type: 'warning' | 'info' | 'policy' | 'ai-response';
  title: string;
  description: string;
  action?: string;
  codeSnippet?: string;
  replacePattern?: RegExp;
}

// Suggestion Card Component
const SuggestionCard: React.FC<{
  suggestion: AISuggestion;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ suggestion, onApply, onDismiss }) => {
  const bgColor = {
    warning: 'bg-yellow-900/20 border-yellow-700/50',
    info: 'bg-blue-900/20 border-blue-700/50',
    policy: 'bg-purple-900/20 border-purple-700/50',
    'ai-response': 'bg-green-900/20 border-green-700/50',
  }[suggestion.type];

  const iconColor = {
    warning: 'text-yellow-400',
    info: 'text-blue-400',
    policy: 'text-purple-400',
    'ai-response': 'text-green-400',
  }[suggestion.type];

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 ${iconColor}`}>
          {suggestion.type === 'warning' && <WarningIcon className="w-4 h-4" />}
          {suggestion.type === 'info' && <InfoIcon className="w-4 h-4" />}
          {suggestion.type === 'policy' && <ShieldIcon className="w-4 h-4" />}
          {suggestion.type === 'ai-response' && <SparklesIcon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-200">{suggestion.title}</h4>
            <button
              onClick={onDismiss}
              className="p-0.5 hover:bg-gray-700 rounded text-gray-500"
            >
              <CloseIconSmall className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{suggestion.description}</p>
          {suggestion.codeSnippet && (
            <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 font-mono overflow-x-auto">
              {suggestion.codeSnippet}
            </pre>
          )}
          {suggestion.action && (
            <button
              onClick={onApply}
              className="mt-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
            >
              {suggestion.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Quick Action Button
const QuickAction: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
  >
    {label}
  </button>
);

// Helper functions for AI responses
function getAIResponse(query: string, content: string, fileType: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('explain')) {
    if (fileType === 'config') {
      return 'This configuration file defines settings for your infrastructure. It includes network configurations, service definitions, and security parameters.';
    }
    if (fileType === 'plan') {
      return 'This Terraform plan defines infrastructure resources. It specifies providers, variables, and resource definitions for deployment.';
    }
    return 'This file contains code/configuration that can be executed or applied to your system.';
  }
  
  if (lowerQuery.includes('issue') || lowerQuery.includes('problem') || lowerQuery.includes('security')) {
    const issues: string[] = [];
    if (content.includes('password')) issues.push('hardcoded credentials');
    if (content.includes('0.0.0.0')) issues.push('unrestricted network binding');
    if (!content.includes('log')) issues.push('missing logging configuration');
    return issues.length > 0 
      ? `Potential issues found: ${issues.join(', ')}. Consider addressing these for better security.`
      : 'No obvious issues detected. Consider running a full security scan for thorough analysis.';
  }
  
  if (lowerQuery.includes('optim')) {
    return 'Consider: 1) Using environment variables for configuration, 2) Adding caching where appropriate, 3) Implementing health checks for services.';
  }
  
  return 'I can help you understand and modify this configuration. Try asking about specific sections or requesting security recommendations.';
}

function getCodeSuggestion(query: string, content: string, _fileType: string): string | undefined {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('security') || lowerQuery.includes('harden')) {
    if (content.includes('ssh') || content.includes('22')) {
      return `# SSH Hardening
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3`;
    }
  }
  
  if (lowerQuery.includes('log')) {
    return `# Logging Configuration
logging:
  level: info
  format: json
  output: /var/log/app.log`;
  }
  
  return undefined;
}

// Additional Icons
const CloseIconSmall: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const DiskImageViewer: React.FC<ViewerProps> = ({ file }) => (
  <div className="p-6 space-y-6">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-purple-600/20 rounded-lg flex items-center justify-center">
        <DiskIcon className="w-8 h-8 text-purple-400" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-200">Disk Image</h3>
        <p className="text-sm text-gray-400">
          {file.type === 'qcow2' ? 'QCOW2 Format' : 'Raw Format'}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <InfoCard label="Size" value={formatBytes(file.size)} />
      <InfoCard label="Format" value={file.type.toUpperCase()} />
      <InfoCard label="Created" value={new Date(file.createdAt).toLocaleDateString()} />
      <InfoCard label="Hash" value={file.manifestHash.slice(0, 16) + '...'} mono />
    </div>

    <div className="flex gap-3">
      <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
        Launch VM
      </button>
      <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
        Clone
      </button>
      <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
        Convert Format
      </button>
    </div>
  </div>
);

const WasmViewer: React.FC<ViewerProps> = ({ file, content }) => {
  const [info, setInfo] = useState<{ exports: string[]; imports: string[] } | null>(null);

  useEffect(() => {
    if (content) {
      // Parse WASM module info
      WebAssembly.compile(content).then((module) => {
        const exports = WebAssembly.Module.exports(module).map((e) => e.name);
        const imports = WebAssembly.Module.imports(module).map(
          (i) => `${i.module}.${i.name}`
        );
        setInfo({ exports, imports });
      }).catch(() => {
        setInfo(null);
      });
    }
  }, [content]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-green-600/20 rounded-lg flex items-center justify-center">
          <WasmIcon className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-200">WebAssembly Module</h3>
          <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
        </div>
      </div>

      {info && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Exports ({info.exports.length})
            </h4>
            <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
              {info.exports.map((name) => (
                <div key={name} className="text-xs text-gray-400 font-mono py-0.5">
                  {name}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Imports ({info.imports.length})
            </h4>
            <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
              {info.imports.map((name) => (
                <div key={name} className="text-xs text-gray-400 font-mono py-0.5">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BinaryViewer: React.FC<ViewerProps> = ({ file, content }) => {
  const hexDump = useMemo(() => {
    if (!content) return '';
    const bytes = new Uint8Array(content.slice(0, 512));
    const lines: string[] = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const offset = i.toString(16).padStart(8, '0');
      const hex = Array.from(bytes.slice(i, i + 16))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(bytes.slice(i, i + 16))
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(`${offset}  ${hex.padEnd(48)}  ${ascii}`);
    }

    return lines.join('\n');
  }, [content]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-600/20 rounded-lg flex items-center justify-center">
          <BinaryIcon className="w-8 h-8 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-200">Binary File</h3>
          <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Hex Dump (first 512 bytes)</h4>
        <pre className="bg-gray-900 rounded-lg p-4 text-xs text-gray-400 font-mono overflow-x-auto">
          {hexDump || '(empty)'}
        </pre>
      </div>
    </div>
  );
};

const MarkdownViewer: React.FC<ViewerProps> = ({ content }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (content) {
      const text = new TextDecoder().decode(content);
      // Simple markdown to HTML conversion
      setHtml(simpleMarkdown(text));
    }
  }, [content]);

  return (
    <div className="p-6 prose prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

const ImageViewer: React.FC<ViewerProps> = ({ file, content }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (content) {
      const blob = new Blob([content], { type: file.mimeType });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [content, file.mimeType]);

  return (
    <div className="flex items-center justify-center h-full p-6">
      {url && <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />}
    </div>
  );
};

const BundleViewer: React.FC<ViewerProps> = ({ file }) => (
  <div className="p-6 space-y-6">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-teal-600/20 rounded-lg flex items-center justify-center">
        <BundleIcon className="w-8 h-8 text-teal-400" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-200">Atlas Bundle</h3>
        <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
      </div>
    </div>

    <div className="flex gap-3">
      <button className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm">
        Extract Bundle
      </button>
      <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
        View Contents
      </button>
    </div>
  </div>
);

// ============ Helper Components ============

const InfoCard: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="bg-gray-900 rounded-lg p-3">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

// ============ Generate Options ============

function canGenerate(type: string): boolean {
  return ['config', 'plan', 'script'].includes(type);
}

function getGenerateOptions(type: string): Array<{ type: string; label: string }> {
  switch (type) {
    case 'config':
      return [
        { type: 'validate', label: 'Validate Config' },
        { type: 'expand', label: 'Expand Variables' },
        { type: 'diagram', label: 'Generate Diagram' },
      ];
    case 'plan':
      return [
        { type: 'apply', label: 'Apply Plan' },
        { type: 'preview', label: 'Preview Changes' },
        { type: 'diagram', label: 'Generate Topology' },
        { type: 'cost', label: 'Estimate Resources' },
      ];
    case 'script':
      return [
        { type: 'run', label: 'Run Script' },
        { type: 'lint', label: 'Lint Script' },
        { type: 'explain', label: 'Explain with AI' },
      ];
    default:
      return [];
  }
}

// ============ Helpers ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\n/gim, '<br />');
}

// ============ Icons ============

const FileTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  const colors: Record<string, string> = {
    qcow2: 'text-purple-400',
    'raw-disk': 'text-purple-300',
    wasm: 'text-green-400',
    kernel: 'text-orange-400',
    initrd: 'text-orange-300',
    config: 'text-blue-400',
    script: 'text-cyan-400',
    plan: 'text-indigo-400',
    report: 'text-pink-400',
    bundle: 'text-teal-400',
  };

  return (
    <svg className={`${className} ${colors[type] || 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
};

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const DiskIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const WasmIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const BinaryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const BundleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
