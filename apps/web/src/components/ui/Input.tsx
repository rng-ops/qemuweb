import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="w-4 h-4 text-zinc-500">{leftIcon}</span>
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            block w-full rounded-md
            bg-zinc-900 border
            ${error ? 'border-red-500' : 'border-zinc-700'}
            text-zinc-100 placeholder-zinc-500
            focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800
            text-sm py-2
            ${leftIcon ? 'pl-10' : 'pl-3'}
            ${rightIcon ? 'pr-10' : 'pr-3'}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="w-4 h-4 text-zinc-500">{rightIcon}</span>
          </div>
        )}
      </div>
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-400' : 'text-zinc-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  fullWidth = true,
  className = '',
  id,
  ...props
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={`
          block w-full rounded-md
          bg-zinc-900 border
          ${error ? 'border-red-500' : 'border-zinc-700'}
          text-zinc-100 placeholder-zinc-500
          focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800
          text-sm py-2 px-3
          min-h-[80px] resize-y
          ${className}
        `}
        {...props}
      />
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-400' : 'text-zinc-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  hint,
  options,
  fullWidth = true,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`
          block w-full rounded-md
          bg-zinc-900 border
          ${error ? 'border-red-500' : 'border-zinc-700'}
          text-zinc-100
          focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800
          text-sm py-2 px-3
          ${className}
        `}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-400' : 'text-zinc-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
