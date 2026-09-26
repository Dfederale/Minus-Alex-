import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReflexStore } from "@/store/reflex-store";

export function DeviceDeck() {
  const scene = useReflexStore((s) => s.scene);
  const invokeTool = useReflexStore((s) => s.invokeTool);
  const busy = useReflexStore((s) => s.busy);

  return (
    <section className="reflex-panel panel-amber p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Playground controls</h2>
          <p className="mt-0.5 text-sm text-muted">Bounded host controls the Resident can request through First Touch. They do not depend on what the Screen Map is showing.</p>
        </div>
        <Badge tone="warn">native</Badge>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DeviceCard
          label="Wi-Fi"
          value={scene.wifiOn ? "ON" : "OFF"}
          sight="wifi"
          controls={[
            { label: "On", binding: "wifi:on", run: () => invokeTool("device.set_wifi", { enabled: true }) },
            { label: "Off", binding: "wifi:off", run: () => invokeTool("device.set_wifi", { enabled: false }) },
          ]}
          busy={busy}
        />
        <DeviceCard
          label="Bluetooth"
          value={scene.bluetoothOn ? "ON" : "OFF"}
          sight="bluetooth"
          controls={[
            { label: "On", binding: "bluetooth:on", run: () => invokeTool("device.set_bluetooth", { enabled: true }) },
            { label: "Off", binding: "bluetooth:off", run: () => invokeTool("device.set_bluetooth", { enabled: false }) },
          ]}
          busy={busy}
        />
        <LevelCard
          label="Volume"
          value={scene.volume}
          sight="volume"
          busy={busy}
          onSet={(value) => invokeTool("device.set_volume", { value })}
        />
        <LevelCard
          label="Brightness"
          value={scene.brightness}
          sight="brightness"
          busy={busy}
          onSet={(value) => invokeTool("device.set_brightness", { value })}
        />
      </div>

      <p className="mt-3 font-mono text-2xs text-subtle">
        These are real host controls. Resident requests still pass through First Touch, and the native bridge is localhost-only.
      </p>
    </section>
  );
}

function DeviceCard({
  label,
  value,
  sight,
  controls,
  busy,
}: {
  label: string;
  value: string;
  sight: "wifi" | "bluetooth";
  controls: Array<{ label: string; binding: string; run: () => void }>;
  busy: boolean;
}) {
  return (
    <div data-sight={sight} data-label={label} className="rounded-md border border-line bg-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <span data-first-sight-word className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-fg">{value}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {controls.map((control) => (
          <Button
            key={control.binding}
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={control.run}
          >
            {control.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function LevelCard({
  label,
  value,
  sight,
  busy,
  onSet,
}: {
  label: string;
  value: number;
  sight: "volume" | "brightness";
  busy: boolean;
  onSet: (value: number) => void;
}) {
  return (
    <div data-sight={sight} data-label={label} className="rounded-md border border-line bg-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <span data-first-sight-word className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-fg">{value}%</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {[0, 25, 50, 75, 100].map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={value === next ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => onSet(next)}
            className="px-1"
          >
            {next}
          </Button>
        ))}
      </div>
    </div>
  );
}
