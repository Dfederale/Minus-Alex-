import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sourceLabel, useReflexStore } from "@/store/reflex-store";

export function EventLog() {
  const log = useReflexStore((s) => s.log);
  const clearLog = useReflexStore((s) => s.clearLog);

  return (
    <section className="reflex-panel panel-blue event-panel flex min-h-56 flex-col p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Event log</h2>
          <p className="mt-0.5 text-sm text-muted">Every proposal that reached First Touch</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearLog} disabled={log.length === 0}>
          Clear
        </Button>
      </header>
      {log.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-sm text-muted">
          Empty. Invoke a WebMCP tool, observe a control, or speak an intent.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {log.map((entry, index) => (
            <li
              key={entry.id}
              className={cn(
                "rounded-md border border-line bg-inset p-3 font-mono text-2xs",
                index === 0 && "log-enter",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">{sourceLabel(entry.source)}</span>
                <Badge tone={entry.gate === "PASS" ? "pass" : "warn"}>{entry.gate}</Badge>
              </div>
              <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 sm:grid-cols-[9rem_1fr]">
                <Field k="intent" v={entry.intent} />
                <Field k="target" v={entry.target} />
                <Field k="resolution" v={entry.method} />
                <Field k="channel" v={entry.channel} />
                <Field k="coords" v={entry.coordinates} />
                <Field k="result" v={entry.result} />
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="uppercase tracking-wide text-subtle">{k}</dt>
      <dd className="truncate text-fg">{v}</dd>
    </>
  );
}
