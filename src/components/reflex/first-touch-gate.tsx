import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReflexStore } from "@/store/reflex-store";

export function FirstTouchGate() {
  const pending = useReflexStore((s) => s.pending);
  const lastVerdict = useReflexStore((s) => s.lastVerdict);
  const arming = useReflexStore((s) => s.arming);
  const setArming = useReflexStore((s) => s.setArming);
  const pass = useReflexStore((s) => s.pass);
  const busy = useReflexStore((s) => s.busy);
  const cancelPending = useReflexStore((s) => s.cancelPending);

  const status = pending ? "PENDING" : lastVerdict?.decision ?? "IDLE";

  return (
    <section className="reflex-panel panel-amber touch-panel flex flex-col p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium tracking-tight">First Touch</h2>
          <p className="mt-0.5 text-sm text-muted">Sole execution boundary</p>
        </div>
        <Badge
          tone={status === "PASS" ? "pass" : status === "PENDING" ? "warn" : status === "UNRESOLVED" || status === "ERROR" ? "warn" : "neutral"}
        >
          {status}
        </Badge>
      </header>

      <div className="mb-3 flex rounded-md border border-line bg-inset p-1">
        {(["auto", "manual"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setArming(mode)}
            className={cn(
              "h-9 flex-1 rounded-sm font-mono text-2xs uppercase tracking-wide transition-colors duration-[var(--motion-quick)]",
              arming === mode ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {mode} arm
          </button>
        ))}
      </div>

      <div className="relative min-h-28 overflow-hidden rounded-md border border-line bg-inset p-3 font-mono text-xs">
        {pending && arming === "auto" && (
          <span
            className="arming-bar absolute inset-x-0 top-0 h-0.5 bg-filament"
            style={{ ["--arm-ms" as string]: "1100ms" }}
          />
        )}
        {pending ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <Row k="source" v={pending.source} />
            <Row k="intent" v={pending.intent} />
            <Row k="target" v={pending.target} />
            <Row k="method" v={pending.method} />
            <Row k="channel" v={pending.channel} />
            <Row
              k="coords"
              v={
                pending.coordinates
                  ? `${pending.coordinates.x}, ${pending.coordinates.y}`
                  : "—"
              }
            />
          </dl>
        ) : (
          <p className="text-muted">
            {lastVerdict
              ? `${lastVerdict.decision}: ${lastVerdict.reason}`
              : "No proposal. Routes submit here. Nothing is physical until PASS."}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button variant="pass" disabled={!pending || !busy} onClick={() => pass()}>
          Pass
        </Button>
        <Button variant="secondary" disabled={!pending} onClick={cancelPending}>Cancel pending</Button>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-subtle uppercase tracking-wide">{k}</dt>
      <dd className="truncate text-fg">{v}</dd>
    </>
  );
}
