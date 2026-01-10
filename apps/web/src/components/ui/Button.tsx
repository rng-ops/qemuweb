import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantClasses = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white border-transparent focus:ring-blue-500',
  secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border-transparent focus:ring-zinc-500',
  ghost: 'bg-transparent hover:bg-zinc-800 text-zinc-300 border-zinc-700 focus:ring-zinc-500',
  danger: 'bg-red-600 hover:bg-red-500 text-white border-transparent focus:ring-red-500',
  success: 'bg-green-600 hover:bg-green-500 text-white border-transparent focus:ring-green-500',
};

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-4 py-2.5 text-base gap-2',
};

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        font-medium rounded-md border
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className={iconSizes[size]}>{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={iconSizes[size]}>{icon}</span>
      )}
    </button>
  );
}

// Icon-only button variant
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label: string; // For accessibility
}

const iconButtonSizes = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`
        inline-flex items-center justify-center
        rounded-md border border-transparent
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${iconButtonSizes[size]}
        ${className}
      `}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </button>
  );
}
