import { Card, CardHeader, CardContent } from '../../components/ui';
import { StatusPill, Button, Badge } from '../../components/ui';

export default function NetworkPage() {
  const networkConfig = {
    mode: 'user',
    hostNetwork: 'NAT',
    guestCIDR: '10.0.2.0/24',
    guestGateway: '10.0.2.2',
    dns: '10.0.2.3',
  };

  const portForwards = [
    { name: 'SSH', protocol: 'TCP', hostPort: 2222, guestPort: 22, status: 'active' },
    { name: 'HTTP', protocol: 'TCP', hostPort: 8080, guestPort: 80, status: 'active' },
    { name: 'HTTPS', protocol: 'TCP', hostPort: 8443, guestPort: 443, status: 'inactive' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Networking</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure network settings and port forwarding
          </p>
        </div>
        <Button variant="primary">Add Port Forward</Button>
      </div>

      {/* Network overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>Network Configuration</CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">Network Mode</dt>
                <dd className="text-sm">
                  <Badge variant="primary">{networkConfig.mode.toUpperCase()}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">Host Network</dt>
                <dd className="text-sm text-zinc-100">{networkConfig.hostNetwork}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">Guest CIDR</dt>
                <dd className="text-sm text-zinc-100 font-mono">{networkConfig.guestCIDR}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">Gateway</dt>
                <dd className="text-sm text-zinc-100 font-mono">{networkConfig.guestGateway}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-zinc-400">DNS Server</dt>
                <dd className="text-sm text-zinc-100 font-mono">{networkConfig.dns}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Connection Status</CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <StatusPill status="online" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">WebSocket Sidecar</p>
                    <p className="text-xs text-zinc-500">ws://localhost:8765</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">Latency: 2ms</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <StatusPill status="online" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">VNC Server</p>
                    <p className="text-xs text-zinc-500">vnc://localhost:5900</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">Connected</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <StatusPill status="offline" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Remote Sidecar</p>
                    <p className="text-xs text-zinc-500">wss://sidecar.example.com</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost">Connect</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Port forwarding */}
      <Card>
        <CardHeader 
          action={<Button size="sm" variant="ghost">Refresh</Button>}
        >
          Port Forwarding
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Name</th>
                  <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Protocol</th>
                  <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Host Port</th>
                  <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Guest Port</th>
                  <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {portForwards.map((pf, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-zinc-200">{pf.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="default">{pf.protocol}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-200 font-mono">{pf.hostPort}</td>
                    <td className="py-3 px-4 text-sm text-zinc-200 font-mono">{pf.guestPort}</td>
                    <td className="py-3 px-4">
                      <StatusPill 
                        status={pf.status === 'active' ? 'running' : 'stopped'} 
                        label={pf.status}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost">Edit</Button>
                        <Button size="sm" variant="ghost">Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
