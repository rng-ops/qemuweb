import { ReactNode } from 'react';

type StatusType = 'running' | 'stopped' | 'error' | 'warning' | 'pending' | 'success' | 'offline' | 'online';

interface StatusPillProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const statusConfig: Record<StatusType, { color: string; bgColor: string; dotColor: string; defaultLabel: string }> = {
  running: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-500',
    defaultLabel: 'Running',
  },
  online: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-500',
    defaultLabel: 'Online',
  },
  success: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-500',
    defaultLabel: 'Success',
  },
  stopped: {
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    dotColor: 'bg-zinc-500',
    defaultLabel: 'Stopped',
  },
  offline: {
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    dotColor: 'bg-zinc-500',
    defaultLabel: 'Offline',
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    dotColor: 'bg-red-500',
    defaultLabel: 'Error',
  },
  warning: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    dotColor: 'bg-yellow-500',
    defaultLabel: 'Warning',
  },
  pending: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-500 animate-pulse',
    defaultLabel: 'Pending',
  },
};

export function StatusPill({ 
  status, 
  label, 
  size = 'md',
  showDot = true 
}: StatusPillProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}>
      {showDot && <span className={`${dotSize} rounded-full ${config.dotColor}`} />}
      {label || config.defaultLabel}
    </span>
  );
}

// Badge variant - simpler, no dot
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const badgeVariants = {
  default: 'bg-zinc-700 text-zinc-200',
  primary: 'bg-blue-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-600 text-white',
  danger: 'bg-red-600 text-white',
  info: 'bg-cyan-600 text-white',
};

const badgeSizes = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '' 
}: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded font-medium ${badgeVariants[variant]} ${badgeSizes[size]} ${className}`}>
      {children}
    </span>
  );
}
