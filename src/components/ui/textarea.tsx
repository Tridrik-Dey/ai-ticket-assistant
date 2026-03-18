import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className = "", rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-200 transition focus:ring ${className}`}
      {...props}
    />
  );
}