import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileMetadata } from '@qemuweb/storage';
import { useAtlasStore } from '../../hooks/useAtlasStore';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  generating?: boolean;
}

interface FileAttachment {
  fileId: string;
  fileName: string;
  fileType: string;
}

interface AssistantPanelProps {
  sharedFiles?: FileMetadata[];
  activeFile?: FileMetadata | null;
  onFileRequest?: (fileName: string) => void;
  onGenerateFile?: (prompt: string, type: string) => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  sharedFiles: _sharedFiles = [], // Used for context display
  activeFile,
  onFileRequest: _onFileRequest, // Future: open files from chat
  onGenerateFile: _onGenerateFile, // Future: generate files from chat
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'I\'m your local AI assistant powered by Ollama. I can help you with infrastructure configuration, terraform plans, and file generation. Share files with me to analyze them.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { files } = useAtlasStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get files shared with assistant
  const assistantFiles = files.filter((f) => f.sharedWithAssistant);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      attachments: activeFile
        ? [{ fileId: activeFile.id, fileName: activeFile.name, fileType: activeFile.type }]
        : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    // Add placeholder for assistant response
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        generating: true,
      },
    ]);

    try {
      // Call local Ollama API
      const response = await generateWithOllama(input, {
        sharedFiles: assistantFiles,
        activeFile,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: response, generating: false }
            : m
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
                generating: false,
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, activeFile, assistantFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickActions = [
    { label: 'Generate Terraform', action: () => setInput('Generate a Terraform configuration for ') },
    { label: 'Explain File', action: () => setInput('Explain the contents of the current file') },
    { label: 'Create VM Config', action: () => setInput('Create a VM configuration with ') },
    { label: 'Network Diagram', action: () => setInput('Generate a network topology diagram for ') },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Context Panel */}
      {showContext && (
        <div className="border-b border-gray-700 p-3 bg-gray-850">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Shared Files ({assistantFiles.length})</span>
            <button
              onClick={() => setShowContext(false)}
              className="text-gray-500 hover:text-gray-300"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {assistantFiles.length === 0 ? (
              <p className="text-xs text-gray-500">No files shared. Right-click files to share them.</p>
            ) : (
              assistantFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1 text-xs text-gray-300 bg-gray-800 rounded"
                >
                  <FileIcon className="w-3 h-3" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-t border-gray-700 flex gap-2 overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            className="flex-shrink-0 px-2 py-1 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        {activeFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-indigo-600/20 rounded text-xs text-indigo-300">
            <FileIcon className="w-3 h-3" />
            <span>Context: {activeFile.name}</span>
            <button className="ml-auto text-indigo-400 hover:text-indigo-200">×</button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowContext(!showContext)}
            className={`p-2 rounded ${showContext ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Show context"
          >
            <ContextIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isGenerating}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
          >
            {isGenerating ? (
              <LoadingIcon className="w-5 h-5 animate-spin" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          Powered by Ollama • Running locally
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-400 max-w-[90%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-800 text-gray-200'
        }`}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.attachments.map((att) => (
              <span
                key={att.fileId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded text-xs"
              >
                <FileIcon className="w-3 h-3" />
                {att.fileName}
              </span>
            ))}
          </div>
        )}

        {message.generating ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        )}

        <div className="mt-1 text-xs opacity-50">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// Ollama API Integration
async function generateWithOllama(
  prompt: string,
  context: {
    sharedFiles: FileMetadata[];
    activeFile?: FileMetadata | null;
  }
): Promise<string> {
  // Build context string
  let contextStr = '';
  
  if (context.activeFile) {
    contextStr += `\nCurrent file: ${context.activeFile.name} (${context.activeFile.type}, ${context.activeFile.size} bytes)`;
  }
  
  if (context.sharedFiles.length > 0) {
    contextStr += `\nShared files: ${context.sharedFiles.map((f) => f.name).join(', ')}`;
  }

  const systemPrompt = `You are an AI assistant for QemuWeb, a browser-based virtualization platform. You help users with:
- Creating and managing virtual machine configurations
- Writing Terraform-like infrastructure plans
- Analyzing disk images and system files
- Generating network topologies and diagrams
- Debugging VM issues

Be concise and helpful. When generating code or configurations, use proper formatting.${contextStr}`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        system: systemPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || 'No response generated';
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'Cannot connect to Ollama. Make sure Ollama is running locally on port 11434.\n\nTo start Ollama:\n```\nollama serve\n```\n\nThen pull a model:\n```\nollama pull llama3.2\n```';
    }
    throw error;
  }
}

// Icons
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
  </svg>
);

const ContextIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
  </svg>
);

const LoadingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);
