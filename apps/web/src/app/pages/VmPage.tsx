import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui';
import { Tabs, StatusPill, Button, Badge } from '../../components/ui';

interface VmConfig {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'pending';
  arch: string;
  memory: number;
  cores: number;
  diskSize: string;
  bootDevice: string;
  uptime?: string;
}

const mockVm: VmConfig = {
  id: 'vm-001',
  name: 'Alpine Linux VM',
  status: 'running',
  arch: 'x86_64',
  memory: 512,
  cores: 2,
  diskSize: '2 GB',
  bootDevice: 'alpine-virt-3.19.iso',
  uptime: '2h 34m',
};

function VmConsole() {
  return (
    <div className="bg-black rounded-lg overflow-hidden border border-zinc-700">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-zinc-400">Console - {mockVm.name}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost">Fullscreen</Button>
        </div>
      </div>
      <div className="aspect-video bg-black flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
          <p className="text-sm">VNC Console</p>
          <p className="text-xs mt-1">Display will appear when VM is running</p>
        </div>
      </div>
    </div>
  );
}

function VmConfiguration() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>Hardware</CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Architecture</dt>
              <dd className="text-sm text-zinc-100">{mockVm.arch}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Memory</dt>
              <dd className="text-sm text-zinc-100">{mockVm.memory} MB</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">CPU Cores</dt>
              <dd className="text-sm text-zinc-100">{mockVm.cores}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Disk Size</dt>
              <dd className="text-sm text-zinc-100">{mockVm.diskSize}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Boot Configuration</CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Boot Device</dt>
              <dd className="text-sm text-zinc-100">{mockVm.bootDevice}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Boot Order</dt>
              <dd className="text-sm text-zinc-100">CD-ROM → Hard Disk</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">BIOS</dt>
              <dd className="text-sm text-zinc-100">SeaBIOS</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Network</CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Network Mode</dt>
              <dd className="text-sm text-zinc-100">User (SLIRP)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">MAC Address</dt>
              <dd className="text-sm text-zinc-100 font-mono">52:54:00:12:34:56</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Port Forwards</dt>
              <dd className="text-sm text-zinc-100">22 → 2222</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Display</CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Display Type</dt>
              <dd className="text-sm text-zinc-100">VNC</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">Resolution</dt>
              <dd className="text-sm text-zinc-100">1024×768</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-zinc-400">VGA Device</dt>
              <dd className="text-sm text-zinc-100">virtio-vga</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function VmLogs() {
  const logs = [
    { time: '14:32:01', level: 'info', message: 'QEMU process started' },
    { time: '14:32:02', level: 'info', message: 'Loading BIOS from /usr/share/seabios/bios.bin' },
    { time: '14:32:02', level: 'info', message: 'VNC server listening on :5900' },
    { time: '14:32:03', level: 'info', message: 'Booting from CD-ROM...' },
    { time: '14:32:05', level: 'info', message: 'Guest kernel loaded' },
    { time: '14:32:08', level: 'info', message: 'Network initialized' },
  ];

  return (
    <Card>
      <CardHeader 
        action={
          <Button size="sm" variant="ghost">Clear Logs</Button>
        }
      >
        System Logs
      </CardHeader>
      <CardContent>
        <div className="bg-zinc-950 rounded-md p-3 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-zinc-500">{log.time}</span>
              <span className={log.level === 'error' ? 'text-red-400' : 'text-blue-400'}>
                [{log.level}]
              </span>
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VmPage() {
  const { vmId } = useParams();
  const [activeTab, setActiveTab] = useState('console');

  // If we have a vmId, show detailed view, otherwise show list
  const showDetail = !!vmId || true; // For now, always show detail

  if (!showDetail) {
    // VM list view would go here
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-zinc-100">{mockVm.name}</h1>
              <StatusPill status={mockVm.status} />
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {mockVm.arch} • {mockVm.memory} MB • {mockVm.cores} cores
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mockVm.status === 'running' ? (
            <>
              <Button variant="secondary">Pause</Button>
              <Button variant="danger">Stop</Button>
            </>
          ) : (
            <Button variant="success">Start</Button>
          )}
          <Button variant="ghost">Settings</Button>
        </div>
      </div>

      {/* Status bar */}
      {mockVm.status === 'running' && (
        <Card padding="sm">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-zinc-400">Uptime: </span>
                <span className="text-zinc-200">{mockVm.uptime}</span>
              </div>
              <div>
                <span className="text-zinc-400">CPU: </span>
                <span className="text-zinc-200">12%</span>
              </div>
              <div>
                <span className="text-zinc-400">Memory: </span>
                <span className="text-zinc-200">384 / 512 MB</span>
              </div>
            </div>
            <Badge variant="success">Connected via WebSocket</Badge>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'console', label: 'Console', content: <VmConsole /> },
          { id: 'config', label: 'Configuration', content: <VmConfiguration /> },
          { id: 'logs', label: 'Logs', content: <VmLogs /> },
          { id: 'snapshots', label: 'Snapshots', content: <div className="text-zinc-400">No snapshots yet</div> },
        ]}
        defaultTab={activeTab}
        onChange={setActiveTab}
      />
    </div>
  );
}
