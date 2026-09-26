import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "accent" | "pass" | "warn";

const tones: Record<Tone, string> = {
  neutral: "border-line text-muted",
  accent: "border-line-strong text-fg",
  pass: "border-pass/40 text-pass",
  warn: "border-filament/40 text-filament",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-2xs uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
