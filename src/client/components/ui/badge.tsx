import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded font-bold leading-none',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground',
        pk: 'bg-[#fef3c7] text-[#92400e]',
        fk: 'bg-accent text-accent-foreground',
        muted: 'bg-muted text-muted-foreground border border-border',
      },
      size: {
        xs: 'px-1.5 py-px text-[10px]',
        sm: 'px-1.5 py-0.5 text-[11px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
