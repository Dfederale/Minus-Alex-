import { cn } from "@/lib/utils";
import { useReflexStore } from "@/store/reflex-store";

const STEPS = [
  { id: "route", label: "Alexa+ / MCP" },
  { id: "touch", label: "First Touch" },
  { id: "action", label: "Action" },
] as const;

export function Pipeline() {
  const pending = useReflexStore((s) => s.pending);
  const lastVerdict = useReflexStore((s) => s.lastVerdict);
  const probe = useReflexStore((s) => s.probe);

  const active = pending
    ? probe
      ? "action"
      : "touch"
    : lastVerdict
      ? "action"
      : "route";

  return (
    <ol className="reflex-pipeline flex gap-1 overflow-x-auto pb-1">
      {STEPS.map((step, index) => {
        const on = step.id === active;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                "pipeline-node flex h-10 w-full items-center justify-center border px-3 font-mono text-2xs uppercase tracking-wide transition-colors duration-[var(--motion-quick)]",
                on ? "pipeline-node--active" : "pipeline-node--idle",
              )}
            >
              <span className="truncate">{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <span className="pipeline-arrow hidden shrink-0 sm:inline" aria-hidden>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
