import { useReflexStore } from "@/store/reflex-store";

export function ScreenProbe() {
  const pending = useReflexStore((s) => s.pending);
  if (pending?.target !== "screen_hook" || !pending.coordinates) return null;

  return (
    <div
      className="screen-hook-probe"
      style={{ left: pending.coordinates.x, top: pending.coordinates.y }}
      aria-hidden
    >
      <span />
    </div>
  );
}
