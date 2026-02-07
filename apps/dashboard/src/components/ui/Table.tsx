import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortKey?: keyof T & string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: keyof T & string) => void;
  onRowClick?: (row: T) => void;
  renderCell?: (key: keyof T & string, value: T[keyof T], row: T) => ReactNode;
}

function SortIcon({ active, order }: { active: boolean; order?: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-4 w-4 text-text-secondary" />;
  return order === 'asc' ? (
    <ChevronUp className="h-4 w-4 text-brand-primary" />
  ) : (
    <ChevronDown className="h-4 w-4 text-brand-primary" />
  );
}

export function Table<T extends object>({
  columns,
  data,
  sortKey,
  sortOrder,
  onSort,
  onRowClick,
  renderCell,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary ${col.sortable && onSort ? 'cursor-pointer select-none' : ''}`}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && onSort && (
                    <SortIcon
                      active={sortKey === col.key}
                      order={sortKey === col.key ? sortOrder : undefined}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-border transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text-primary">
                  {renderCell
                    ? renderCell(col.key, row[col.key], row)
                    : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
