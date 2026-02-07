import type { HTMLAttributes } from 'react';

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof sizeMap;
}

export function Spinner({ size = 'md', className = '', ...rest }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-current border-t-transparent text-brand-primary ${sizeMap[size]} ${className}`}
      {...rest}
    />
  );
}
