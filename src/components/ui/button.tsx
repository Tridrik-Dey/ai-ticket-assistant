import type { ButtonHTMLAttributes } from "react";
import type { ReactNode } from "react";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-200",
  secondary: "border border-gray-300 bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-200",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-200",
  ghost: "bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-200",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-10 rounded-lg px-4 text-sm",
  sm: "h-8 rounded-md px-3 text-xs",
};

export function Button({
  variant = "default",
  size = "default",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 ${sizeStyles[size]} ${variantStyles[variant]} disabled:pointer-events-none disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
