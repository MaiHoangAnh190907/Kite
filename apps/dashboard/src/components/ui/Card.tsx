import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  borderColor?: 'amber' | 'red';
}

const borderStyles = {
  amber: 'border-l-4 border-l-flag-amber',
  red: 'border-l-4 border-l-flag-red',
} as const;

export function Card({ children, className = '', borderColor }: CardProps) {
  return (
    <div
      className={`rounded-lg bg-bg-card shadow-sm ${borderColor ? borderStyles[borderColor] : ''} ${className}`}
    >
      {children}
    </div>
  );
}
