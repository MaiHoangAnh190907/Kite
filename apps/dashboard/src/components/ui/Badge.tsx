import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const variantConfig = {
  green: {
    className: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
  },
  amber: {
    className: 'bg-amber-100 text-amber-700',
    Icon: AlertTriangle,
  },
  red: {
    className: 'bg-red-100 text-red-700',
    Icon: AlertCircle,
  },
} as const;

interface BadgeProps {
  variant: keyof typeof variantConfig;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  const { className: variantClass, Icon } = variantConfig[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClass} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
