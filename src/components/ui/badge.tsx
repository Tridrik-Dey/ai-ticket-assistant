import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "outline" | "destructive";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  destructive: "bg-rose-100 text-rose-700",
  outline: "border border-slate-300 text-slate-700 bg-white",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variantStyles[variant]}`}>{children}</span>;
}
