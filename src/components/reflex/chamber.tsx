import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReflexStore } from "@/store/reflex-store";
import { useEffect } from "react";

export function Chamber() {
  const setChamberEl = useReflexStore((s) => s.setChamberEl);
  const scene = useReflexStore((s) => s.scene);
  const overlayOn = useReflexStore((s) => s.overlayOn);
  const regions = useReflexStore((s) => s.regions);
  const pending = useReflexStore((s) => s.pending);
  const probe = useReflexStore((s) => s.probe);
  const pulseFlash = useReflexStore((s) => s.pulseFlash);
  const activateSight = useReflexStore((s) => s.activateSight);
  const observe = useReflexStore((s) => s.observe);
  const busy = useReflexStore((s) => s.busy);
  const invokeTool = useReflexStore((s) => s.invokeTool);

  useEffect(() => {
    if (!overlayOn) return;
    const onResize = () => observe();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [overlayOn, observe]);

  const pendingId = pending?.target === "—" ? null : pending?.target;

  return (
    <section className="reflex-panel panel-green chamber-panel flex flex-col p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 font-mono text-2xs text-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-pass" />
          <span className="truncate tracking-wide">chamber://reflex.local/cell-01</span>
        </div>
        <Badge>scene</Badge>
      </header>

      <div
        ref={setChamberEl}
        className={cn(
          "relative overflow-hidden rounded-lg border border-line-strong bg-inset",
          pulseFlash && "border-filament",
        )}
      >
        <div
          className={cn(
            "chamber-grid pointer-events-none absolute inset-0 transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            overlayOn ? "opacity-100" : "opacity-20",
          )}
        />

        <div className="relative grid gap-6 p-5 sm:gap-8 sm:p-6">
          <div className="grid grid-cols-[auto_1fr_auto] items-end gap-3 sm:gap-5">
            <Lamp on={scene.lampOn} active={pendingId === "lamp"} />
            <Rail x={scene.squareX} active={pendingId === "slider"} />
            <Pulse count={scene.pulseCount} flash={pulseFlash} active={pendingId === "pulse"} />
          </div>
          <Inscription text={scene.inscription} active={pendingId === "inscription"} />
        </div>

        {overlayOn &&
          regions.map((region) => (
            <button
              key={region.id}
              type="button"
              disabled={busy}
              onClick={() => activateSight(region.id)}
              className={cn(
                "absolute z-10 rounded-sm border border-accent/50 bg-accent/5 transition-[border-color,background-color] duration-[var(--motion-quick)]",
                "hover:border-accent hover:bg-accent/10",
                pendingId === region.id && "border-filament bg-filament/10",
              )}
              style={{
                left: region.x,
                top: region.y,
                width: region.width,
                height: region.height,
              }}
              aria-label={`Activate ${region.label} via First Sight`}
            >
              <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-8px)] truncate font-mono text-2xs text-accent">
                {region.label} {Math.round(region.cx)},{Math.round(region.cy)}
              </span>
            </button>
          ))}

        {probe && probe.phase !== "idle" && (
          <span
            className={cn(
              "pointer-events-none absolute z-20 size-8 rounded-full border-2 border-probe",
              probe.phase === "travel" && "probe-travel",
              probe.phase === "strike" && "probe-strike",
            )}
            style={{ left: probe.x, top: probe.y }}
            aria-hidden
          >
            <span className="absolute inset-1 rounded-full border border-probe/60" />
            <span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-probe" />
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Chamber controls">
        <button type="button" disabled={busy} onClick={() => invokeTool("chamber.toggle_lamp")} className="rounded border border-line px-3 py-2 text-xs disabled:opacity-40">Toggle lamp</button>
        <button type="button" disabled={busy} onClick={() => invokeTool("chamber.move_square", { direction: "left" })} className="rounded border border-line px-3 py-2 text-xs disabled:opacity-40">Square left</button>
        <button type="button" disabled={busy} onClick={() => invokeTool("chamber.move_square", { direction: "right" })} className="rounded border border-line px-3 py-2 text-xs disabled:opacity-40">Square right</button>
        <button type="button" disabled={busy} onClick={() => activateSight("pulse")} className="rounded border border-line px-3 py-2 text-xs disabled:opacity-40">Pulse</button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-2xs text-muted sm:grid-cols-4">
        <StateRow label="square" value={String(Math.round(scene.squareX))} />
        <StateRow label="lamp" value={scene.lampOn ? "on" : "off"} />
        <StateRow label="text" value={scene.inscription || "—"} />
        <StateRow label="pulse" value={String(scene.pulseCount)} />
      </dl>
    </section>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="truncate text-fg tabular-nums">{value}</dd>
    </div>
  );
}

function Lamp({ on, active }: { on: boolean; active: boolean }) {
  return (
    <div
      data-sight="lamp"
      data-label="Lamp"
      data-hook-binding="lamp:toggle"
      className={cn(
        "flex w-16 flex-col items-center gap-2",
        active && "opacity-100",
      )}
    >
      <div
        className={cn(
          "relative flex size-14 items-center justify-center rounded-full border bg-elevated transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          on ? "lamp-lit border-filament" : "border-line-strong",
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full transition-colors duration-[var(--motion-fast)]",
            on ? "bg-filament" : "bg-subtle/40",
          )}
        />
      </div>
      <span className="font-mono text-2xs uppercase tracking-wide text-muted">Lamp</span>
    </div>
  );
}

function Rail({ x, active }: { x: number; active: boolean }) {
  return (
    <div data-sight="slider" data-label="Square rail" className="min-w-0 pb-6">
      <div
        className={cn(
          "relative h-16 rounded-md border bg-elevated",
          active ? "border-accent" : "border-line",
        )}
      >
        <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        <div
          className="absolute top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-line-strong bg-accent transition-[left] duration-[var(--motion-slow)] ease-[var(--ease-smooth-out)]"
          style={{ left: `${x}%` }}
        />
      </div>
      <span className="mt-2 block font-mono text-2xs uppercase tracking-wide text-muted">
        Square
      </span>
    </div>
  );
}

function Pulse({
  count,
  flash,
  active,
}: {
  count: number;
  flash: boolean;
  active: boolean;
}) {
  return (
    <div
      data-sight="pulse"
      data-label="Pulse actuator"
      className="flex w-16 flex-col items-center gap-2"
    >
      <div className="relative flex size-14 items-center justify-center">
        {flash && (
          <span className="pulse-ring absolute inset-0 rounded-full border border-filament" />
        )}
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full border bg-elevated transition-[transform,border-color] duration-[var(--motion-quick)]",
            flash ? "scale-95 border-filament" : "border-line-strong",
            active && "border-filament",
          )}
        >
          <span className="size-3 rounded-full bg-fg" />
        </div>
      </div>
      <span className="font-mono text-2xs uppercase tracking-wide text-muted">
        Pulse {count > 0 ? count : ""}
      </span>
    </div>
  );
}

function Inscription({ text, active }: { text: string; active: boolean }) {
  return (
    <div
      data-sight="inscription"
      data-label="Inscription plate"
      className={cn(
        "rounded-md border bg-elevated px-4 py-3",
        active ? "border-accent" : "border-line",
      )}
    >
      <div className="font-mono text-2xs uppercase tracking-wide text-subtle">Inscription</div>
      <div
        data-first-sight-word
        className={cn(
          "mt-1 min-h-7 font-mono text-lg tracking-inscription",
          text ? "text-fg" : "text-subtle",
        )}
      >
        {text || "————"}
      </div>
    </div>
  );
}
