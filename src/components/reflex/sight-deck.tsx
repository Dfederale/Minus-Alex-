import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReflexStore } from "@/store/reflex-store";

export function SightDeck() {
  const hooks = useReflexStore((s) => s.hooks);
  const removeHook = useReflexStore((s) => s.removeHook);
  const invokeTool = useReflexStore((s) => s.invokeTool);
  const busy = useReflexStore((s) => s.busy);
  const [wordCount, setWordCount] = useState(0);
  const [objectCount, setObjectCount] = useState(0);
  const [faceState, setFaceState] = useState("on request");

  const dimensions = useMemo(() => {
    if (typeof window === "undefined") return "â€”";
    return `${window.screen.width}x${window.screen.height} screen | ${window.innerWidth}x${window.innerHeight} viewport`;
  }, []);

  function scanScene() {
    const words = Array.from(document.querySelectorAll<HTMLElement>("[data-first-sight-word]"))
      .map((node) => node.innerText.trim())
      .filter(Boolean);
    const objects = new Set(
      Array.from(document.querySelectorAll<HTMLElement>("[data-sight]"))
        .map((node) => node.dataset.sight)
        .filter(Boolean),
    );
    setWordCount(words.length);
    setObjectCount(objects.size + hooks.length);
  }

  async function scanFaceOnce() {
    setFaceState("checkingâ€¦");
    const FaceDetectorCtor = (window as typeof window & {
      FaceDetector?: new (options?: { fastMode?: boolean }) => {
        detect: (image: CanvasImageSource) => Promise<unknown[]>;
      };
    }).FaceDetector;
    if (!FaceDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setFaceState("adapter unavailable");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) resolve();
        else video.onloadedmetadata = () => resolve();
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, video.videoWidth);
      canvas.height = Math.max(1, video.videoHeight);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const detector = new FaceDetectorCtor({ fastMode: true });
      const faces = await detector.detect(canvas);
      setFaceState(`${faces.length} detected`);
    } catch {
      setFaceState("camera declined");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function openScreenMap() {
    document.getElementById("screen-map-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="reflex-panel panel-violet p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">First Sight</h2>
          <p className="mt-0.5 text-sm text-muted">Real screen buttons.</p>
        </div>
        <Badge tone="accent">First Sight</Badge>
      </header>

      <div className="grid gap-2 sm:grid-cols-1">
        <button type="button" onClick={openScreenMap} className="sight-tile text-left">
          <span>Screen buttons</span>
          <strong>{hooks.length ? `${hooks.length} mapped` : "map one"}</strong>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="primary" onClick={openScreenMap}>Open screen mapper</Button>
        <span className="font-mono text-2xs text-subtle">{dimensions}</span>
      </div>

      {hooks.length > 0 && (
        <div className="mt-3 grid gap-2">
          {hooks.map((hook) => (
            <div key={hook.id} className="hook-row">
              <div className="min-w-0">
                <strong className="block truncate text-xs text-fg">{hook.name}</strong>
                <span className="font-mono text-2xs text-subtle">
                  screen click | {Math.round(hook.xNorm * 100)}%, {Math.round(hook.yNorm * 100)}% | {hook.displaySurface ?? "legacy map"}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => invokeTool("screen.activate_hook", { name: hook.name })}
                >
                  Try
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => removeHook(hook.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 font-mono text-2xs text-subtle">
        1. Open screen mapper | 2. Map and name buttons | 3. Close mapper and use your buttons.
      </p>
    </section>
  );
}

function SightTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="sight-tile">
      <span data-first-sight-word>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
