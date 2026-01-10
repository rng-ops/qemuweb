import { Card, CardHeader, CardContent } from '../../components/ui';
import { Button, Input, Select } from '../../components/ui';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure QemuWeb preferences
        </p>
      </div>

      {/* General settings */}
      <Card>
        <CardHeader>General</CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Theme"
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
            defaultValue="dark"
          />
          
          <Select
            label="Default Architecture"
            options={[
              { value: 'x86_64', label: 'x86_64' },
              { value: 'aarch64', label: 'ARM64 (aarch64)' },
              { value: 'riscv64', label: 'RISC-V 64' },
            ]}
            defaultValue="x86_64"
          />
        </CardContent>
      </Card>

      {/* Sidecar settings */}
      <Card>
        <CardHeader>Sidecar Connection</CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Local Sidecar URL"
            defaultValue="ws://localhost:8765"
            hint="WebSocket URL for local sidecar connection"
          />
          
          <Input
            label="Remote Sidecar URL"
            placeholder="wss://sidecar.example.com"
            hint="Optional remote sidecar for cloud rendering"
          />
          
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="auto-connect" 
              className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/40"
            />
            <label htmlFor="auto-connect" className="text-sm text-zinc-300">
              Auto-connect to sidecar on startup
            </label>
          </div>
        </CardContent>
      </Card>

      {/* VM defaults */}
      <Card>
        <CardHeader>VM Defaults</CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Default Memory (MB)"
            type="number"
            defaultValue="512"
          />
          
          <Input
            label="Default CPU Cores"
            type="number"
            defaultValue="2"
          />
          
          <Input
            label="Default Disk Size (GB)"
            type="number"
            defaultValue="4"
          />
          
          <Select
            label="Default Network Mode"
            options={[
              { value: 'user', label: 'User (SLIRP)' },
              { value: 'tap', label: 'TAP (requires sidecar)' },
              { value: 'none', label: 'None' },
            ]}
            defaultValue="user"
          />
        </CardContent>
      </Card>

      {/* Storage settings */}
      <Card>
        <CardHeader>Storage</CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-zinc-200">IndexedDB Storage</p>
              <p className="text-xs text-zinc-500">Used: 2.1 GB</p>
            </div>
            <Button size="sm" variant="secondary">Clear Cache</Button>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="persist-storage" 
              defaultChecked
              className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/40"
            />
            <label htmlFor="persist-storage" className="text-sm text-zinc-300">
              Request persistent storage (prevents browser from clearing data)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Ollama settings */}
      <Card>
        <CardHeader>Ollama</CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Ollama API URL"
            defaultValue="http://localhost:11434"
            hint="URL of your local Ollama instance"
          />
          
          <Select
            label="Default Model"
            options={[
              { value: 'llama3.2', label: 'llama3.2' },
              { value: 'codellama', label: 'codellama' },
              { value: 'mistral', label: 'mistral' },
            ]}
            defaultValue="llama3.2"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button variant="secondary">Reset to Defaults</Button>
        <Button variant="primary">Save Changes</Button>
      </div>
    </div>
  );
}
