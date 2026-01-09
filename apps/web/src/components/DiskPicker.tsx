import { useCallback, useRef, useState } from 'react';

interface DiskPickerProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
}

export function DiskPicker({
  label,
  file,
  onFileChange,
  accept,
  disabled,
}: DiskPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0] ?? null;
      onFileChange(selectedFile);
    },
    [onFileChange]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        onFileChange(droppedFile);
      }
    },
    [disabled, onFileChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileChange(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onFileChange]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`drop-zone p-4 text-center cursor-pointer ${
          isDragging ? 'active' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'}`}
      >
        {file ? (
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className="text-white font-medium truncate max-w-[200px]">
                {file.name}
              </div>
              <div className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-red-400 p-1"
              disabled={disabled}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
