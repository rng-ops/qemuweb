import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'bordered' | 'elevated';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantClasses = {
  default: 'bg-zinc-900 border border-zinc-800',
  bordered: 'bg-transparent border border-zinc-700',
  elevated: 'bg-zinc-900 border border-zinc-800 shadow-lg shadow-black/20',
};

export function Card({ 
  children, 
  className = '', 
  padding = 'md',
  variant = 'default' 
}: CardProps) {
  return (
    <div className={`rounded-lg ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="text-sm font-medium text-zinc-200">{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-4 pt-4 border-t border-zinc-800 ${className}`}>
      {children}
    </div>
  );
}
