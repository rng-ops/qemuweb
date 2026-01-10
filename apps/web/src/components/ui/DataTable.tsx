import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: ReactNode;
  render: (item: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
  compact?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyState,
  loading = false,
  className = '',
  compact = false,
  striped = false,
  hoverable = true,
}: DataTableProps<T>) {
  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const headerPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (loading) {
    return (
      <div className={`bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className={`bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`${headerPadding} ${alignClasses[column.align || 'left']} text-xs font-semibold text-zinc-400 uppercase tracking-wider`}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.map((item, index) => (
              <tr
                key={keyExtractor(item, index)}
                onClick={() => onRowClick?.(item, index)}
                className={`
                  ${onRowClick ? 'cursor-pointer' : ''}
                  ${hoverable ? 'hover:bg-zinc-800/50' : ''}
                  ${striped && index % 2 === 1 ? 'bg-zinc-900/30' : ''}
                  transition-colors
                `}
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={`${cellPadding} ${alignClasses[column.align || 'left']} text-sm text-zinc-300`}
                    style={{ width: column.width }}
                  >
                    {column.render(item, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple list variant for non-tabular data
interface DataListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onItemClick?: (item: T, index: number) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
  divider?: boolean;
}

export function DataList<T>({
  data,
  keyExtractor,
  renderItem,
  onItemClick,
  emptyState,
  loading = false,
  className = '',
  divider = true,
}: DataListProps<T>) {
  if (loading) {
    return (
      <div className={`bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className={`bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden ${className}`}>
      <ul className={divider ? 'divide-y divide-zinc-800' : ''}>
        {data.map((item, index) => (
          <li
            key={keyExtractor(item, index)}
            onClick={() => onItemClick?.(item, index)}
            className={`
              ${onItemClick ? 'cursor-pointer hover:bg-zinc-800/50' : ''}
              transition-colors
            `}
          >
            {renderItem(item, index)}
          </li>
        ))}
      </ul>
    </div>
  );
}
