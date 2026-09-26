import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScreenHook } from "@/lib/reflex/types";
import { useReflexStore } from "@/store/reflex-store";
import { bondedPerspectiveKey, loadBondedPerspectives, mountBondedPerspectiveSelector, rememberBondedPerspective, type BondedPerspective } from "../../lib/reflex/bonded-perspectives";

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Point = { x: number; y: number };
type NativeBounds = NonNullable<ScreenHook["nativeBounds"]>;
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type Gesture = {
  kind: "move" | "resize";
  hookId: string;
  pointerId: number;
  start: Point;
  startBox: Box;
  handle?: ResizeHandle;
};

const SCREEN_BRIDGE = "http://127.0.0.1:8790";
const MIN_BOX = 0.012;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function boxFromPoints(a: Point, b: Point): Box {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  return {
    left,
    top,
    width: Math.max(0.002, Math.abs(a.x - b.x)),
    height: Math.max(0.002, Math.abs(a.y - b.y)),
  };
}

function centerOf(box: Box): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function boxOfHook(hook: ScreenHook): Box {
  return {
    left: clamp(hook.xNorm - hook.widthNorm / 2),
    top: clamp(hook.yNorm - hook.heightNorm / 2),
    width: Math.min(1, Math.max(MIN_BOX, hook.widthNorm)),
    height: Math.min(1, Math.max(MIN_BOX, hook.heightNorm)),
  };
}

function hookPatchFromBox(box: Box): Pick<ScreenHook, "xNorm" | "yNorm" | "widthNorm" | "heightNorm"> {
  const center = centerOf(box);
  return {
    xNorm: clamp(center.x),
    yNorm: clamp(center.y),
    widthNorm: Math.min(1, Math.max(MIN_BOX, box.width)),
    heightNorm: Math.min(1, Math.max(MIN_BOX, box.height)),
  };
}

function moveBox(start: Box, delta: Point): Box {
  return {
    ...start,
    left: Math.max(0, Math.min(1 - start.width, start.left + delta.x)),
    top: Math.max(0, Math.min(1 - start.height, start.top + delta.y)),
  };
}

function resizeBox(start: Box, handle: ResizeHandle, delta: Point): Box {
  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;

  if (handle.includes("w")) left = Math.max(0, Math.min(right - MIN_BOX, start.left + delta.x));
  if (handle.includes("e")) right = Math.min(1, Math.max(left + MIN_BOX, start.left + start.width + delta.x));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - MIN_BOX, start.top + delta.y));
  if (handle.includes("s")) bottom = Math.min(1, Math.max(top + MIN_BOX, start.top + start.height + delta.y));

  return {
    left,
    top,
    width: Math.max(MIN_BOX, right - left),
    height: Math.max(MIN_BOX, bottom - top),
  };
}

function isWholeScreen(surface: string): boolean {
  return surface === "monitor" || surface === "screen";
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "screen-map";
}

export function ScreenMap() {
  const hooks = useReflexStore((s) => s.hooks);
  const addHook = useReflexStore((s) => s.addHook);
  const updateHook = useReflexStore((s) => s.updateHook);
  const removeHook = useReflexStore((s) => s.removeHook);
  const clearHooks = useReflexStore((s) => s.clearHooks);
  const invokeTool = useReflexStore((s) => s.invokeTool);
  const pending = useReflexStore((s) => s.pending);
  const busy = useReflexStore((s) => s.busy);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [displaySurface, setDisplaySurface] = useState("screen");
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [nativeBounds, setNativeBounds] = useState<NativeBounds | null>(null);
  const [windowBonded, setWindowBonded] = useState(false);
  const [screenBoundsBeforeBond, setScreenBoundsBeforeBond] = useState<NativeBounds | null>(null);
  const [bondedPerspectives, setBondedPerspectives] = useState<BondedPerspective[]>(() => loadBondedPerspectives());
  const [activeBondKey, setActiveBondKey] = useState("");
  const [monitors, setMonitors] = useState<Array<NativeBounds & { name: string; primary: boolean }>>([]);
  const [status, setStatus] = useState("Link a screen, then drag a box around a real onscreen button.");

  const visibleHooks = useMemo(() => {
    if (!nativeBounds) return hooks;
    return hooks.filter((hook) => {
      const bounds = hook.nativeBounds;
      return Boolean(
        bounds &&
        bounds.left === nativeBounds.left &&
        bounds.top === nativeBounds.top &&
        bounds.width === nativeBounds.width &&
        bounds.height === nativeBounds.height
      );
    });
  }, [hooks, nativeBounds]);

  const selectedHook = visibleHooks.find((hook) => hook.id === selectedId) ?? null;
  const isLive = Boolean(stream && !snapshot);
  const canMap = !busy;
  const wholeScreen = isWholeScreen(displaySurface);
  const physicalScreenSelectionBounds = windowBonded ? screenBoundsBeforeBond : nativeBounds;
  const physicalScreenSelectionValue = physicalScreenSelectionBounds
    ? `${physicalScreenSelectionBounds.left},${physicalScreenSelectionBounds.top},${physicalScreenSelectionBounds.width},${physicalScreenSelectionBounds.height}`
    : "";

  const sourceLabel = useMemo(() => {
    if (!sourceSize.width || !sourceSize.height) return `${nativeBounds?.width || window.screen.width}x${nativeBounds?.height || window.screen.height} blank map`;
    return `${sourceSize.width}x${sourceSize.height} ${displaySurface}`;
  }, [displaySurface, sourceSize, nativeBounds]);

  useEffect(() => {
    if (!bridgeReady) return;
    void fetch(`${SCREEN_BRIDGE}/monitors`)
      .then(async (response) => {
        const data = await response.json() as { monitors?: Array<Record<string, unknown>> };
        if (!response.ok || !Array.isArray(data.monitors)) throw new Error("monitor lookup failed");
        const found = data.monitors
          .map((item) => ({
            name: String(item.name ?? "Screen"),
            left: Number(item.left),
            top: Number(item.top),
            width: Number(item.width),
            height: Number(item.height),
            primary: Boolean(item.primary),
          }))
          .filter((item) => [item.left, item.top, item.width, item.height].every(Number.isFinite) && item.width > 0 && item.height > 0);
        setMonitors(found);
      })
      .catch(() => setMonitors([]));
  }, [bridgeReady]);
  useEffect(() => {
    if (!bridgeReady || stream || snapshot || nativeBounds) return;
    let cancelled = false;
    void readActiveMonitor(0)
      .then((bounds) => {
        if (cancelled) return;
        setNativeBounds(bounds);

        void fetch(`${SCREEN_BRIDGE}/unbond-window`, { method: "POST" }).catch(() => undefined);
        setStatus(`Blank map attached to active monitor ${bounds.width}x${bounds.height}. Draw buttons immediately.`);
      })
      .catch(() => {
        if (!cancelled) setStatus("Blank map ready. Native monitor attachment is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [bridgeReady, stream, snapshot, nativeBounds]);
  useEffect(() => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    if (!selectedHook) {
      setEditName("");
      return;
    }
    setEditName(selectedHook.name);
  }, [selectedHook?.id, selectedHook?.name]);

  useEffect(() => {
    if (selectedId && !hooks.some((hook) => hook.id === selectedId)) setSelectedId(null);
  }, [hooks, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function probeBridge() {
      try {
        const response = await fetch(`${SCREEN_BRIDGE}/health`, { cache: "no-store" });
        if (!cancelled) setBridgeReady(response.ok);
      } catch {
        if (!cancelled) setBridgeReady(false);
      }
    }
    void probeBridge();
    const timer = window.setInterval(probeBridge, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("Screen capture is not available in this browser.");
      return;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    setSnapshot(null);
    setSourceSize({ width: 0, height: 0 });
    setNativeBounds(null);
    setSelection(null);
    setSelectedId(null);

    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 8, max: 15 } },
        audio: false,
      });
      const track = next.getVideoTracks()[0];
      const settings = track?.getSettings();
      const surface = String(settings?.displaySurface ?? "screen");
      setDisplaySurface(surface);
      setStream(next);
      setStatus(
        isWholeScreen(surface)
          ? "LIVE screen preview. Drag empty space to make a button map."
          : "Preview linked. Map geometry is visible, but native clicking requires desktop-coordinate bonding.",
      );

      track?.addEventListener(
        "ended",
        () => {
          setStream(null);
          setStatus((current) =>
            snapshot ? current : "Preview ended. Link or capture again to continue mapping.",
          );
        },
        { once: true },
      );
    } catch {
      setStatus("Screen capture cancelled.");
    }
  }

  function stopShare() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setSnapshot(null);
    setSourceSize({ width: 0, height: 0 });
    setStatus("Preview stopped.");
  }

  function syncVideoSize() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    setSourceSize({ width: video.videoWidth, height: video.videoHeight });
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setStatus("Wait for the live screen image first.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSourceSize({ width: canvas.width, height: canvas.height });
    setSnapshot(canvas.toDataURL("image/jpeg", 0.88));
    setStatus("CAPTURED frame. The picture is frozen so you can place and adjust boxes precisely.");
  }

  function resumeLive() {
    if (!stream) return;
    setSnapshot(null);
    setStatus("LIVE screen preview. Drag empty space to make a button map.");
  }

  function normalizedPoint(event: React.PointerEvent<HTMLElement>): Point | null {
    const frame = frameRef.current;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canMap) return;
    if ((event.target as HTMLElement).closest("[data-screen-map-box]")) return;
    const point = normalizedPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setDragStart(point);
    setSelection({ left: point.x, top: point.y, width: 0.002, height: 0.002 });
  }

  function beginMove(event: React.PointerEvent<HTMLDivElement>, hook: ScreenHook) {
    if (!canMap) return;
    if ((event.target as HTMLElement).closest("[data-resize-handle]")) return;
    const point = normalizedPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection(null);
    setSelectedId(hook.id);
    setGesture({
      kind: "move",
      hookId: hook.id,
      pointerId: event.pointerId,
      start: point,
      startBox: boxOfHook(hook),
    });
    setStatus(`Moving ${hook.name}. Release when the box lines up.`);
  }

  function beginResize(event: React.PointerEvent<HTMLSpanElement>, hook: ScreenHook, handle: ResizeHandle) {
    if (!canMap) return;
    const point = normalizedPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection(null);
    setSelectedId(hook.id);
    setGesture({
      kind: "resize",
      hookId: hook.id,
      pointerId: event.pointerId,
      start: point,
      startBox: boxOfHook(hook),
      handle,
    });
    setStatus(`Resizing ${hook.name}. Release when the box fits.`);
  }

  function updateGeometry(hookId: string, box: Box) {
    updateHook(hookId, {
      ...hookPatchFromBox(box),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      displaySurface,
    });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = normalizedPoint(event);
    if (!point) return;

    if (gesture) {
      const delta = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
      const box = gesture.kind === "move"
        ? moveBox(gesture.startBox, delta)
        : resizeBox(gesture.startBox, gesture.handle ?? "se", delta);
      updateGeometry(gesture.hookId, box);
      return;
    }

    if (!dragStart) return;
    setSelection(boxFromPoints(dragStart, point));
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (gesture) {
      const hook = hooks.find((item) => item.id === gesture.hookId);
      setGesture(null);
      if (hook) setStatus(`${hook.name} adjusted. Geometry saved automatically.`);
      return;
    }

    if (!dragStart) return;
    const point = normalizedPoint(event);
    if (point) setSelection(boxFromPoints(dragStart, point));
    setDragStart(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Browser may already have released capture.
    }
  }

  async function readActiveMonitor(delayMs = 0): Promise<NativeBounds> {
    const response = await fetch(`${SCREEN_BRIDGE}/window`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayMs }),
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error ?? "window lookup failed"));
    const bounds: NativeBounds = {
      left: Number(data.monitorLeft),
      top: Number(data.monitorTop),
      width: Number(data.monitorWidth),
      height: Number(data.monitorHeight),
    };
    if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
      throw new Error("native monitor geometry was invalid");
    }
    return bounds;
  }
  async function selectBondedPerspective(item: BondedPerspective) {
    if (!bridgeReady) {
      setStatus("Native click bridge is offline.");
      return;
    }

    if (!windowBonded) setScreenBoundsBeforeBond(nativeBounds);
    setStatus(`REBOND SAVED SCREEN: ${item.title}`);

    try {
      const response = await fetch(`${SCREEN_BRIDGE}/bond-window?hwnd=${encodeURIComponent(String(item.hwnd))}`, {
        method: "POST",
      });
      const data = await response.json() as {
        ok?: boolean;
        bonded?: {
          hwnd?: number;
          title?: string;
          left?: number;
          top?: number;
          width?: number;
          height?: number;
        };
        preview?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.bonded || !data.preview) {
        throw new Error(data.error ?? "saved bonded screen is unavailable");
      }

      const returnedHwnd = Number(data.bonded.hwnd);
      const returnedTitle = String(data.bonded.title ?? "").trim();
      if (returnedHwnd !== item.hwnd || (returnedTitle && returnedTitle !== item.title)) {
        throw new Error("Saved bonded screen no longer matches. Use Bond window again.");
      }

      const bounds: NativeBounds = {
        left: Number(data.bonded.left),
        top: Number(data.bonded.top),
        width: Number(data.bonded.width),
        height: Number(data.bonded.height),
      };

      if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error("bonded screen geometry was invalid");
      }

      const refreshed: BondedPerspective = {
        hwnd: returnedHwnd,
        title: returnedTitle || item.title,
        ...bounds,
        bondedAt: new Date().toISOString(),
      };

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setNativeBounds(bounds);
      setDisplaySurface("monitor");
      setSourceSize({ width: bounds.width, height: bounds.height });
      setSnapshot(data.preview);
      setWindowBonded(true);
      setSelectedId(null);
      setBondedPerspectives((previous) => rememberBondedPerspective(previous, refreshed));
      setActiveBondKey(bondedPerspectiveKey(refreshed));
      setStatus(`WINDOW BONDED: ${refreshed.title}. Shared perspective restored.`);
    } catch (error) {
      setStatus(`Saved bond failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  async function previewSelectedScreen(bounds: NativeBounds, screenName: string) {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setSnapshot(null);
    setSourceSize({ width: 0, height: 0 });

    try {
      const query = new URLSearchParams({
        left: String(bounds.left),
        top: String(bounds.top),
        width: String(bounds.width),
        height: String(bounds.height),
      });

      const response = await fetch(`${SCREEN_BRIDGE}/monitor-preview?${query.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json() as {
        ok?: boolean;
        preview?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.preview) {
        throw new Error(data.error ?? "monitor preview failed");
      }

      setSnapshot(data.preview);
      setSourceSize({ width: bounds.width, height: bounds.height });
      setDisplaySurface("monitor");
      setStatus(`Screen selected: ${screenName} ${bounds.width}x${bounds.height}. Preview captured.`);
    } catch (error) {
      setStatus(`Screen preview failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  async function bondWindow() {
    if (!bridgeReady) {
      setStatus("Native click bridge is offline.");
      return;
    }

    if (!windowBonded) setScreenBoundsBeforeBond(nativeBounds);
    setStatus("BOND WINDOW: within 4 seconds focus the target window.");

    try {
      const response = await fetch(`${SCREEN_BRIDGE}/bond-window`, { method: "POST" });
      const data = await response.json() as {
        ok?: boolean;
        bonded?: {
          hwnd?: number;
          title?: string;
          left?: number;
          top?: number;
          width?: number;
          height?: number;
        };
        preview?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.bonded || !data.preview) {
        throw new Error(data.error ?? "window bond/capture failed");
      }

      const bounds: NativeBounds = {
        left: Number(data.bonded.left),
        top: Number(data.bonded.top),
        width: Number(data.bonded.width),
        height: Number(data.bonded.height),
      };

      if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error("bonded window geometry was invalid");
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);

      setNativeBounds(bounds);
      setDisplaySurface("monitor");
      setSourceSize({ width: bounds.width, height: bounds.height });
      setSnapshot(data.preview);
      setWindowBonded(true);
      const rememberedPerspective: BondedPerspective = {
        hwnd: Number(data.bonded.hwnd),
        title: String(data.bonded.title ?? "").trim() || `Window ${String(data.bonded.hwnd ?? "")}`,
        ...bounds,
        bondedAt: new Date().toISOString(),
      };
      setBondedPerspectives((previous) => rememberBondedPerspective(previous, rememberedPerspective));
      setActiveBondKey(bondedPerspectiveKey(rememberedPerspective));
      setSelectedId(null);



      setStatus(
        `WINDOW BONDED${data.bonded.title ? `: ${data.bonded.title}` : ""}. Shared perspective captured. Geometry guard active.`,
      );
    } catch (error) {
      setStatus(`Bond failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async function unbondWindow() {
    try {
      const response = await fetch(`${SCREEN_BRIDGE}/unbond-window`, { method: "POST" });
      if (!response.ok) throw new Error("unbond failed");

      const restore =
        screenBoundsBeforeBond ??
        monitors.find((item) => item.primary) ??
        monitors[0] ??
        null;

      setWindowBonded(false);
      setActiveBondKey("");
      setSelectedId(null);
      setSnapshot(null);
      setSourceSize({ width: 0, height: 0 });

      if (restore) {
        const bounds: NativeBounds = {
          left: restore.left,
          top: restore.top,
          width: restore.width,
          height: restore.height,
        };
        setNativeBounds(bounds);
        setDisplaySurface("monitor");

      }

      setScreenBoundsBeforeBond(null);
      setStatus("Window unbonded. Button pattern returned to the chosen screen.");
    } catch (error) {
      setStatus(`Unbond failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  function saveHook() {
    if (!selection || !name.trim()) return;
    const center = centerOf(selection);
    const width = window.screen.width;
    const height = window.screen.height;
    const cleanName = name.trim().slice(0, 64);
    const hook: ScreenHook = {
      id: crypto.randomUUID(),
      name: cleanName,
      xNorm: center.x,
      yNorm: center.y,
      widthNorm: selection.width,
      heightNorm: selection.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: width,
      screenHeight: height,
      devicePixelRatio: window.devicePixelRatio || 1,
      displaySurface: nativeBounds ? "monitor" : displaySurface,
      nativeBounds: nativeBounds ?? undefined,
      previewMapped: Boolean(snapshot && nativeBounds && windowBonded),
      binding: null,
      createdAt: Date.now(),
    };
    addHook(hook);
    setSelectedId(hook.id);
    const px = Math.round((nativeBounds?.left ?? 0) + center.x * (nativeBounds?.width ?? width));
    const py = Math.round((nativeBounds?.top ?? 0) + center.y * (nativeBounds?.height ?? height));
    setStatus(
      nativeBounds
        ? `Saved ${hook.name} at native desktop ${px}, ${py}. Drag it to move; use the corners to resize.`
        : `Saved ${hook.name} as map geometry. Press Bond screen before native clicking.`,
    );
    setName("");
    setSelection(null);
  }

  function renameSelected() {
    if (!selectedHook) return;
    const clean = editName.trim().slice(0, 64);
    if (!clean) {
      setStatus("A mapped button needs a name.");
      return;
    }
    const collision = hooks.some(
      (hook) => hook.id !== selectedHook.id && hook.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase(),
    );
    if (collision) {
      setStatus(`Another mapped button is already named ${clean}.`);
      return;
    }
    updateHook(selectedHook.id, { name: clean });
    setStatus(`Renamed mapped button to ${clean}.`);
  }

  function deleteSelected() {
    if (!selectedHook) return;
    const oldName = selectedHook.name;
    removeHook(selectedHook.id);
    setSelectedId(null);
    setStatus(`Deleted ${oldName}.`);
  }

  function trySelected() {
    if (!selectedHook) return;
    invokeTool("screen.activate_hook", { name: selectedHook.name });
    setStatus(`${selectedHook.name} proposed to First Touch. AUTO executes now; MANUAL waits for PASS.`);
  }

  function exportMap() {
    const definition = {
      architecture: "DINS-REFLEX-first-sight-screen-map",
      templateVersion: 1,
      templateRole: "preserved-interface-definition",
      savedAt: new Date().toISOString(),
      source: {
        width: sourceSize.width || null,
        height: sourceSize.height || null,
        displaySurface,
      },
      hooks: visibleHooks.map((hook) => ({
        id: hook.id,
        name: hook.name,
        xNorm: hook.xNorm,
        yNorm: hook.yNorm,
        widthNorm: hook.widthNorm,
        heightNorm: hook.heightNorm,
        viewportWidth: hook.viewportWidth,
        viewportHeight: hook.viewportHeight,
        screenWidth: hook.screenWidth,
        screenHeight: hook.screenHeight,
        devicePixelRatio: hook.devicePixelRatio,
        displaySurface: hook.displaySurface,
        nativeBounds: hook.nativeBounds,
        createdAt: hook.createdAt,
      })),
    };
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilename("dins-first-sight-screen-map")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${visibleHooks.length} mapped button${visibleHooks.length === 1 ? "" : "s"} as this First Sight perspective.`);
  }

  async function importMap(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as { hooks?: unknown };
      if (!Array.isArray(parsed.hooks)) throw new Error("No hooks array");
      const imported: ScreenHook[] = [];
      for (const raw of parsed.hooks.slice(0, 24)) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Partial<ScreenHook>;
        const cleanName = typeof item.name === "string" ? item.name.trim().slice(0, 64) : "";
        if (!cleanName) continue;
        const values = [item.xNorm, item.yNorm, item.widthNorm, item.heightNorm];
        if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) continue;
        const widthNorm = Math.min(1, Math.max(MIN_BOX, Number(item.widthNorm)));
        const heightNorm = Math.min(1, Math.max(MIN_BOX, Number(item.heightNorm)));
        imported.push({
          id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
          name: cleanName,
          xNorm: clamp(Number(item.xNorm)),
          yNorm: clamp(Number(item.yNorm)),
          widthNorm,
          heightNorm,
          viewportWidth: Number.isFinite(item.viewportWidth) ? Number(item.viewportWidth) : window.innerWidth,
          viewportHeight: Number.isFinite(item.viewportHeight) ? Number(item.viewportHeight) : window.innerHeight,
          screenWidth: Number.isFinite(item.screenWidth) ? Number(item.screenWidth) : (sourceSize.width || window.screen.width),
          screenHeight: Number.isFinite(item.screenHeight) ? Number(item.screenHeight) : (sourceSize.height || window.screen.height),
          devicePixelRatio: Number.isFinite(item.devicePixelRatio) ? Number(item.devicePixelRatio) : (window.devicePixelRatio || 1),
          displaySurface: typeof item.displaySurface === "string" ? item.displaySurface : displaySurface,
          nativeBounds: item.nativeBounds &&
            Number.isFinite(item.nativeBounds.left) &&
            Number.isFinite(item.nativeBounds.top) &&
            Number.isFinite(item.nativeBounds.width) &&
            Number.isFinite(item.nativeBounds.height)
              ? {
                  left: Number(item.nativeBounds.left),
                  top: Number(item.nativeBounds.top),
                  width: Number(item.nativeBounds.width),
                  height: Number(item.nativeBounds.height),
                }
              : undefined,
          binding: null,
          createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
        });
      }
      if (!imported.length) throw new Error("No valid mapped buttons");
      clearHooks();
      imported.slice().reverse().forEach((hook) => addHook(hook));
      setSelectedId(null);

      const restoredBounds = imported[0]?.nativeBounds ?? null;
      if (restoredBounds) {
        setNativeBounds(restoredBounds);
        setDisplaySurface("monitor");
        setSourceSize({ width: 0, height: 0 });
        setSnapshot(null);
      }

      void fetch(`${SCREEN_BRIDGE}/unbond-window`, { method: "POST" }).catch(() => undefined);
      setWindowBonded(false);
      setScreenBoundsBeforeBond(null);
      setStatus(`Loaded ${imported.length} mapped button${imported.length === 1 ? "" : "s"} with its saved First Sight perspective.`);
    } catch {
      setStatus("Could not load that map. Expected a DINS First Sight screen-map JSON file.");
    }
  }

  useEffect(() => {
    return mountBondedPerspectiveSelector({
      items: bondedPerspectives,
      activeKey: activeBondKey,
      enabled: bridgeReady,
      physicalScreenValue: physicalScreenSelectionValue,
      onSelect: (item) => selectBondedPerspective(item),
    });
  });
  return (
    <section id="screen-map-panel" className="reflex-panel panel-cyan p-4 screen-map-panel">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Screen map</h2>
          <p className="mt-0.5 text-sm text-muted">Capture what you see. Draw, move, resize, rename, delete and save real screen buttons.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge tone={isLive ? "pass" : "accent"}>{isLive ? "live" : snapshot ? "captured" : "first sight"}</Badge>
          <Badge tone={bridgeReady ? "pass" : "warn"}>{bridgeReady ? "native click ready" : "click bridge offline"}</Badge>
        </div>
      </header>

      <div className="screen-map-toolbar">
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          value={nativeBounds ? `${nativeBounds.left},${nativeBounds.top},${nativeBounds.width},${nativeBounds.height}` : ""}
          onClick={(event) => {
            const chosen = monitors.find((item) => `${item.left},${item.top},${item.width},${item.height}` === event.currentTarget.value);
            if (!chosen) return;
            const bounds: NativeBounds = { left: chosen.left, top: chosen.top, width: chosen.width, height: chosen.height };
            void previewSelectedScreen(bounds, chosen.name);
          }}
          onChange={(event) => {
            const chosen = monitors.find((item) => `${item.left},${item.top},${item.width},${item.height}` === event.target.value);
            if (!chosen) return;
            const bounds: NativeBounds = { left: chosen.left, top: chosen.top, width: chosen.width, height: chosen.height };
            setNativeBounds(bounds);
            setDisplaySurface("monitor");

            void fetch(`${SCREEN_BRIDGE}/unbond-window`, { method: "POST" }).catch(() => undefined);
            setWindowBonded(false);
      setSelectedId(null);
            setScreenBoundsBeforeBond(null);
            setSnapshot(null);
            setSourceSize({ width: 0, height: 0 });
            setSelectedId(null);
            void previewSelectedScreen(bounds, chosen.name);
          }}
          aria-label="Choose screen"
        >
          <option value="">Choose screen</option>
          {monitors.map((item, index) => (
            <option key={`${item.name}-${index}`} value={`${item.left},${item.top},${item.width},${item.height}`}>
              {`Screen ${index + 1}${item.primary ? " (primary)" : ""} - ${item.width}x${item.height}`}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="secondary" disabled={!bridgeReady} onClick={() => void bondWindow()}>
          {windowBonded ? "Rebond window" : "Bond window"}
        </Button>
        {windowBonded && (
          <Button type="button" size="sm" variant="ghost" onClick={() => void unbondWindow()}>Unbond window</Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={!stream && !snapshot} onClick={stopShare}>Stop preview</Button>
        <Button type="button" size="sm" variant="ghost" disabled={!visibleHooks.length} onClick={exportMap}>Save map</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => importRef.current?.click()}>Load map</Button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importMap(event)} />
        <span className="screen-map-source">{sourceLabel}</span>
      </div>

      <div className="screen-map-help">
        <span>empty space: drag new box</span>
        <span>mapped box: drag to move</span>
        <span>corners: resize</span>
        <span>click box: select</span>
      </div>

      <div
        ref={frameRef}
        className={`screen-map-frame ${canMap ? "screen-map-frame--active screen-map-frame--linked" : ""}`}
        style={{ aspectRatio: `${sourceSize.width || nativeBounds?.width || window.screen.width} / ${sourceSize.height || nativeBounds?.height || window.screen.height}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={() => {
          setDragStart(null);
          setGesture(null);
        }}
      >
        {!stream && !snapshot && (
          <div className="screen-map-empty">
            <div className="dins-mark dins-mark--small" aria-hidden><span /><span /><span /></div>
            <strong>SHARED PERSPECTIVE</strong>
            <span>Choose a screen for blind mapping, or Bond window to capture the exact window and map buttons over what First Sight sees.</span>
          </div>
        )}

        {stream && (
          <video
            ref={videoRef}
            className={`screen-map-media ${snapshot ? "screen-map-media--hidden" : ""}`}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={syncVideoSize}
          />
        )}

        {snapshot && <img className="screen-map-media" src={snapshot} alt="Captured shared screen" draggable={false} />}

        {visibleHooks.map((hook) => {
          const box = boxOfHook(hook);
          const hookPending = pending?.target === "screen_hook" && pending.intent.includes(JSON.stringify(hook.name));
          const selected = selectedId === hook.id;
          return (
            <div
              role="button"
              tabIndex={0}
              key={hook.id}
              className={`screen-map-hook ${hookPending ? "screen-map-hook--pending" : ""} ${selected ? "screen-map-hook--selected" : ""}`}
              data-screen-map-box
              style={{
                left: `${box.left * 100}%`,
                top: `${box.top * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              title={`Select/edit: ${hook.name}`}
              onPointerDown={(event) => beginMove(event, hook)}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(hook.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(hook.id);
                }
              }}
            >
              <span className="screen-map-hook-label">{hook.name}</span>
              {selected && (["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
                <span
                  key={handle}
                  className={`screen-map-resize screen-map-resize--${handle}`}
                  data-resize-handle
                  aria-label={`Resize ${hook.name} ${handle}`}
                  onPointerDown={(event) => beginResize(event, hook, handle)}
                />
              ))}
            </div>
          );
        })}

        {selection && (
          <div
            className="screen-map-selection"
            data-screen-map-box
            style={{
              left: `${selection.left * 100}%`,
              top: `${selection.top * 100}%`,
              width: `${selection.width * 100}%`,
              height: `${selection.height * 100}%`,
            }}
          />
        )}
      </div>

      {selection && (
        <div className="screen-map-config">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="name this onscreen button, e.g. submit"
            maxLength={64}
          />
          <Button type="button" variant="primary" disabled={!name.trim()} onClick={saveHook}>Save screen button</Button>
        </div>
      )}

      {selectedHook && (
        <div className="screen-map-editor">
          <div className="screen-map-editor-title">
            <span>SELECTED</span>
            <strong>{selectedHook.name}</strong>
          </div>
          <Input
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") renameSelected();
            }}
            maxLength={64}
            aria-label="Mapped button name"
          />
          <div className="screen-map-editor-actions">
            <Button type="button" size="sm" variant="secondary" onClick={renameSelected}>Rename</Button>
            <Button type="button" size="sm" variant="primary" disabled={busy} onClick={trySelected}>Try via First Touch</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={deleteSelected}>Delete</Button>
          </div>
        </div>
      )}

      {!selection && !selectedHook && canMap && (
        <div className="screen-map-tip">Drag empty preview space to create a mapped button. Existing boxes stay editable and are saved automatically.</div>
      )}

      <div className="screen-map-foot">
        <span>{status}</span>
        <span>{visibleHooks.length} mapped button{visibleHooks.length === 1 ? "" : "s"} in this perspective</span>
      </div>
    </section>
  );
}
