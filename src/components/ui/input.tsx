import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-sm border border-line bg-inset px-3 text-sm text-fg placeholder:text-subtle",
          "transition-[border-color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          className,
        )}
        {...props}
      />
    );
  },
);
