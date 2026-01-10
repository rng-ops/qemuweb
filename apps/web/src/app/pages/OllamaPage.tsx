import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui';
import { StatusPill, Button, Badge, Input } from '../../components/ui';

interface Model {
  name: string;
  size: string;
  quantization: string;
  status: 'ready' | 'downloading' | 'not-installed';
  downloadProgress?: number;
}

const mockModels: Model[] = [
  { name: 'llama3.2', size: '2.0 GB', quantization: 'Q4_0', status: 'ready' },
  { name: 'codellama', size: '3.8 GB', quantization: 'Q4_K_M', status: 'ready' },
  { name: 'mistral', size: '4.1 GB', quantization: 'Q4_K_M', status: 'downloading', downloadProgress: 67 },
  { name: 'phi-2', size: '1.7 GB', quantization: 'Q4_0', status: 'not-installed' },
];

function ChatInterface() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I\'m running locally via Ollama. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    // Simulate response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'This is a mock response. In a real implementation, this would connect to your local Ollama instance.' 
      }]);
    }, 500);
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader>Chat with Local LLM</CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OllamaPage() {
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const ollamaStatus = 'running' as const;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-100">Ollama</h1>
            <StatusPill status={ollamaStatus} label="Running" />
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Run local LLMs with Ollama integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">Settings</Button>
          {ollamaStatus === 'running' ? (
            <Button variant="danger">Stop Ollama</Button>
          ) : (
            <Button variant="success">Start Ollama</Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Models */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader 
              action={<Button size="sm" variant="ghost">Pull Model</Button>}
            >
              Available Models
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockModels.map(model => (
                  <button
                    key={model.name}
                    onClick={() => model.status === 'ready' && setSelectedModel(model.name)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedModel === model.name
                        ? 'bg-blue-600/20 border border-blue-500/50'
                        : 'bg-zinc-800/50 hover:bg-zinc-800 border border-transparent'
                    }`}
                    disabled={model.status !== 'ready'}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-200">{model.name}</span>
                      {model.status === 'ready' && (
                        <Badge variant="success" size="sm">Ready</Badge>
                      )}
                      {model.status === 'downloading' && (
                        <Badge variant="warning" size="sm">{model.downloadProgress}%</Badge>
                      )}
                      {model.status === 'not-installed' && (
                        <Badge variant="default" size="sm">Not Installed</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{model.size}</span>
                      <span>•</span>
                      <span>{model.quantization}</span>
                    </div>
                    {model.status === 'downloading' && (
                      <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500 transition-all"
                          style={{ width: `${model.downloadProgress}%` }}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>System Info</CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-400">Ollama Version</dt>
                  <dd className="text-zinc-200">0.1.27</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-400">GPU</dt>
                  <dd className="text-zinc-200">WebGPU (Metal)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-400">VRAM</dt>
                  <dd className="text-zinc-200">8 GB</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-400">Endpoint</dt>
                  <dd className="text-zinc-200 font-mono text-xs">localhost:11434</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Chat */}
        <div className="lg:col-span-2">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
