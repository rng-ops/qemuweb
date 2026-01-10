import { Card } from '../../components/ui';
import { DataTable, StatusPill, Badge, EmptyState, EmptyServerIcon } from '../../components/ui';
import { Button } from '../../components/ui';interface Service {
  id: string;
  name: string;
  type: 'vm' | 'sidecar' | 'storage' | 'ai' | 'network';
  status: 'running' | 'stopped' | 'error' | 'pending';
  uptime?: string;
  memory?: string;
  cpu?: string;
}

const mockServices: Service[] = [
  { id: '1', name: 'QEMU VM 1', type: 'vm', status: 'running', uptime: '2h 34m', memory: '512 MB', cpu: '12%' },
  { id: '2', name: 'WebSocket Sidecar', type: 'sidecar', status: 'running', uptime: '2h 34m', memory: '24 MB', cpu: '1%' },
  { id: '3', name: 'Storage Backend', type: 'storage', status: 'running', uptime: '2h 34m', memory: '48 MB', cpu: '2%' },
  { id: '4', name: 'Ollama Local', type: 'ai', status: 'stopped' },
  { id: '5', name: 'Virtual Network', type: 'network', status: 'running', uptime: '2h 34m' },
];

const typeLabels: Record<Service['type'], string> = {
  vm: 'Virtual Machine',
  sidecar: 'Sidecar',
  storage: 'Storage',
  ai: 'AI Model',
  network: 'Network',
};

const typeColors: Record<Service['type'], 'primary' | 'success' | 'warning' | 'info' | 'default'> = {
  vm: 'primary',
  sidecar: 'info',
  storage: 'warning',
  ai: 'success',
  network: 'default',
};

export default function ServicesPage() {
  const columns = [
    {
      key: 'name',
      header: 'Service',
      render: (service: Service) => (
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium text-zinc-100">{service.name}</p>
            <p className="text-xs text-zinc-500">{service.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (service: Service) => (
        <Badge variant={typeColors[service.type]}>{typeLabels[service.type]}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (service: Service) => <StatusPill status={service.status} />,
    },
    {
      key: 'uptime',
      header: 'Uptime',
      render: (service: Service) => (
        <span className="text-zinc-400">{service.uptime || '—'}</span>
      ),
    },
    {
      key: 'memory',
      header: 'Memory',
      render: (service: Service) => (
        <span className="text-zinc-400">{service.memory || '—'}</span>
      ),
    },
    {
      key: 'cpu',
      header: 'CPU',
      render: (service: Service) => (
        <span className="text-zinc-400">{service.cpu || '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right' as const,
      render: (service: Service) => (
        <div className="flex items-center justify-end gap-2">
          {service.status === 'running' ? (
            <Button size="sm" variant="ghost">Stop</Button>
          ) : (
            <Button size="sm" variant="primary">Start</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Services</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage all running services in your environment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">Refresh</Button>
          <Button variant="primary">New Service</Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-sm text-zinc-400">Total Services</p>
          <p className="text-2xl font-semibold text-zinc-100">{mockServices.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-zinc-400">Running</p>
          <p className="text-2xl font-semibold text-green-400">
            {mockServices.filter(s => s.status === 'running').length}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-zinc-400">Stopped</p>
          <p className="text-2xl font-semibold text-zinc-400">
            {mockServices.filter(s => s.status === 'stopped').length}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-zinc-400">Errors</p>
          <p className="text-2xl font-semibold text-red-400">
            {mockServices.filter(s => s.status === 'error').length}
          </p>
        </Card>
      </div>

      {/* Services table */}
      <DataTable
        columns={columns}
        data={mockServices}
        keyExtractor={(service) => service.id}
        onRowClick={() => {}}
        emptyState={
          <EmptyState
            icon={<EmptyServerIcon className="w-full h-full" />}
            title="No services found"
            description="Get started by creating a new virtual machine or enabling a service."
            action={<Button>Create Service</Button>}
          />
        }
      />
    </div>
  );
}
