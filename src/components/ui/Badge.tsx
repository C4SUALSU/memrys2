import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  children: ReactNode;
}

const variantMap: Record<string, string> = {
  default: 'badge',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return <span className={variantMap[variant]}>{children}</span>;
}
