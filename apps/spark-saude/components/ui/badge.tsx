import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        gray: "bg-status-gray-bg text-status-gray-fg",
        blue: "bg-status-blue-bg text-status-blue-fg",
        green: "bg-status-green-bg text-status-green-fg",
        amber: "bg-status-amber-bg text-status-amber-fg",
        red: "bg-status-red-bg text-status-red-fg",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
