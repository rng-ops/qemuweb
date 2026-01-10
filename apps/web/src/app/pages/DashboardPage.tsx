import { Card, CardHeader, CardContent } from '../../components/ui';
import { StatusPill, Badge } from '../../components/ui';

// Dashboard metrics cards
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

function MetricCard({ title, value, change, changeType = 'neutral', icon }: MetricCardProps) {
  const changeColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-zinc-400',
  };

  return (
    <Card className="flex-1 min-w-[200px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-semibold text-zinc-100 mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 ${changeColors[changeType]}`}>{change}</p>
          )}
        </div>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
    </Card>
  );
}

// Service status item
interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'pending';
  type: string;
  uptime?: string;
}

const mockServices: ServiceStatus[] = [
  { name: 'QEMU VM 1', status: 'running', type: 'Virtual Machine', uptime: '2h 34m' },
  { name: 'WebSocket Sidecar', status: 'running', type: 'Sidecar', uptime: '2h 34m' },
  { name: 'Storage Backend', status: 'running', type: 'Storage', uptime: '2h 34m' },
  { name: 'Ollama Local', status: 'stopped', type: 'AI Model', uptime: undefined },
];

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Overview of your QemuWeb environment
        </p>
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-4">
        <MetricCard 
          title="Virtual Machines" 
          value={1} 
          change="1 running"
          changeType="positive"
        />
        <MetricCard 
          title="Active Services" 
          value={3} 
        />
        <MetricCard 
          title="Memory Usage" 
          value="512 MB" 
          change="of 4 GB allocated"
        />
        <MetricCard 
          title="Storage Used" 
          value="2.1 GB" 
          change="+120 MB today"
          changeType="neutral"
        />
      </div>

      {/* Services overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>Active Services</CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockServices.map(service => (
                <div 
                  key={service.name}
                  className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <StatusPill status={service.status} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{service.name}</p>
                      <p className="text-xs text-zinc-500">{service.type}</p>
                    </div>
                  </div>
                  {service.uptime && (
                    <Badge variant="default" size="sm">{service.uptime}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Quick Actions</CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-colors">
                <div className="text-blue-400 mb-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-200">New VM</p>
                <p className="text-xs text-zinc-500">Create virtual machine</p>
              </button>
              
              <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-colors">
                <div className="text-green-400 mb-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-200">Upload ISO</p>
                <p className="text-xs text-zinc-500">Add boot image</p>
              </button>
              
              <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-colors">
                <div className="text-purple-400 mb-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-200">Start Ollama</p>
                <p className="text-xs text-zinc-500">Launch AI service</p>
              </button>
              
              <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-colors">
                <div className="text-orange-400 mb-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-200">View Docs</p>
                <p className="text-xs text-zinc-500">Read documentation</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>Recent Activity</CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'VM Started', target: 'QEMU VM 1', time: '2 minutes ago' },
              { action: 'Sidecar Connected', target: 'WebSocket Sidecar', time: '2 minutes ago' },
              { action: 'Storage Mounted', target: '/dev/sda1', time: '5 minutes ago' },
              { action: 'ISO Uploaded', target: 'alpine-virt-3.19.iso', time: '1 hour ago' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm text-zinc-200">{activity.action}</p>
                  <p className="text-xs text-zinc-500">{activity.target}</p>
                </div>
                <p className="text-xs text-zinc-500">{activity.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
