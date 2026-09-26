import { INITIAL_SCENE } from "@/lib/reflex/apply-action";
import type {
  ArmingMode,
  HookBinding,
  LogEntry,
  RouteTab,
  SceneState,
  ScreenHook,
} from "@/lib/reflex/types";
import { useReflexStore } from "@/store/reflex-store";

const STORAGE_KEY = "reflex.v033.runtime";
const STORAGE_VERSION = 2;

export type PersistedRuntime = {
  version: 2;
  savedAt: number;
  scene: SceneState;
  hooks: ScreenHook[];
  route: RouteTab;
  arming: ArmingMode;
  lastVerdict: { decision: "PASS" | "UNRESOLVED" | "ERROR"; reason: string } | null;
  log: LogEntry[];
};

let installed = false;
let applyingExternalState = false;
let lastSerialized = "";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeScene(value: unknown): SceneState | null {
  if (!value || typeof value !== "object") return null;
  const scene = value as Partial<SceneState>;
  if (
    !isFiniteNumber(scene.squareX) ||
    typeof scene.lampOn !== "boolean" ||
    typeof scene.inscription !== "string" ||
    !isFiniteNumber(scene.pulseCount)
  ) {
    return null;
  }
  return {
    squareX: scene.squareX,
    lampOn: scene.lampOn,
    inscription: scene.inscription,
    pulseCount: scene.pulseCount,
    wifiOn: typeof scene.wifiOn === "boolean" ? scene.wifiOn : INITIAL_SCENE.wifiOn,
    bluetoothOn:
      typeof scene.bluetoothOn === "boolean" ? scene.bluetoothOn : INITIAL_SCENE.bluetoothOn,
    volume: isFiniteNumber(scene.volume)
      ? Math.min(100, Math.max(0, Math.round(scene.volume)))
      : INITIAL_SCENE.volume,
    brightness: isFiniteNumber(scene.brightness)
      ? Math.min(100, Math.max(0, Math.round(scene.brightness)))
      : INITIAL_SCENE.brightness,
  };
}

function isRoute(value: unknown): value is RouteTab {
  return value === "structured" || value === "visual" || value === "voice";
}

function isArming(value: unknown): value is ArmingMode {
  return value === "auto" || value === "manual";
}

function sanitizeLog(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is LogEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<LogEntry>;
      return (
        typeof item.id === "string" &&
        isFiniteNumber(item.ts) &&
        typeof item.intent === "string" &&
        typeof item.target === "string" &&
        typeof item.method === "string" &&
        typeof item.coordinates === "string" &&
        typeof item.result === "string" &&
        (item.source === "agent" ||
          item.source === "voice" ||
          item.source === "visual" ||
          item.source === "gate") &&
        (item.channel === "WEBMCP" ||
          item.channel === "VISUAL" ||
          item.channel === "UNRESOLVED") &&
        (item.gate === "PENDING" || item.gate === "PASS" || item.gate === "UNRESOLVED" || item.gate === "ERROR")
      );
    })
    .slice(0, 40);
}

function sanitizeBinding(value: unknown): HookBinding | null {
  if (!value || typeof value !== "object") return null;
  const binding = value as { tool?: unknown; args?: Record<string, unknown> };
  const args = binding.args ?? {};

  if (binding.tool === "chamber.toggle_lamp") {
    return { tool: "chamber.toggle_lamp", args: {} };
  }
  if (binding.tool === "device.set_wifi" && typeof args.enabled === "boolean") {
    return { tool: "device.set_wifi", args: { enabled: args.enabled } };
  }
  if (binding.tool === "device.set_bluetooth" && typeof args.enabled === "boolean") {
    return { tool: "device.set_bluetooth", args: { enabled: args.enabled } };
  }
  if (binding.tool === "device.set_volume" && isFiniteNumber(args.value)) {
    return {
      tool: "device.set_volume",
      args: { value: Math.min(100, Math.max(0, Math.round(args.value))) },
    };
  }
  return null;
}

function sanitizeHooks(value: unknown): ScreenHook[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ScreenHook => {
      if (!item || typeof item !== "object") return false;
      const hook = item as Partial<ScreenHook>;
      return (
        typeof hook.id === "string" &&
        typeof hook.name === "string" &&
        isFiniteNumber(hook.xNorm) &&
        isFiniteNumber(hook.yNorm) &&
        isFiniteNumber(hook.widthNorm) &&
        isFiniteNumber(hook.heightNorm) &&
        isFiniteNumber(hook.viewportWidth) &&
        isFiniteNumber(hook.viewportHeight) &&
        isFiniteNumber(hook.screenWidth) &&
        isFiniteNumber(hook.screenHeight) &&
        isFiniteNumber(hook.devicePixelRatio) &&
        isFiniteNumber(hook.createdAt)
      );
    })
    .map((hook) => ({
      ...hook,
      displaySurface: typeof hook.displaySurface === "string" ? hook.displaySurface : undefined,
      binding: sanitizeBinding(hook.binding),
    }))
    .slice(0, 24);
}

function parseRuntime(raw: string | null): PersistedRuntime | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      savedAt?: unknown;
      scene?: unknown;
      hooks?: unknown;
      route?: unknown;
      arming?: unknown;
      lastVerdict?: unknown;
      log?: unknown;
    };
    const scene = normalizeScene(parsed.scene);
    if (!scene || !isRoute(parsed.route) || !isArming(parsed.arming)) return null;

    const verdict = parsed.lastVerdict as
      | { decision?: unknown; reason?: unknown }
      | null
      | undefined;
    const safeVerdict: PersistedRuntime["lastVerdict"] =
      verdict &&
      (verdict.decision === "PASS" || verdict.decision === "UNRESOLVED" || verdict.decision === "ERROR") &&
      typeof verdict.reason === "string"
        ? { decision: verdict.decision, reason: verdict.reason }
        : null;

    return {
      version: STORAGE_VERSION,
      savedAt: isFiniteNumber(parsed.savedAt) ? parsed.savedAt : Date.now(),
      scene,
      hooks: sanitizeHooks(parsed.hooks),
      route: parsed.route,
      arming: parsed.arming,
      lastVerdict: safeVerdict,
      log: sanitizeLog(parsed.log),
    };
  } catch {
    return null;
  }
}

function snapshotRuntime(): PersistedRuntime {
  const state = useReflexStore.getState();
  return {
    version: STORAGE_VERSION,
    savedAt: Date.now(),
    scene: state.scene,
    hooks: state.hooks,
    route: state.route,
    arming: state.arming,
    lastVerdict: state.lastVerdict,
    log: state.log,
  };
}

function writeRuntime() {
  if (applyingExternalState) return;
  const serialized = JSON.stringify(snapshotRuntime());
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.warn("[REFLEX] Could not persist runtime state:", error);
  }
}

function applyRuntime(runtime: PersistedRuntime) {
  applyingExternalState = true;
  try {
    useReflexStore.setState({
      scene: runtime.scene,
      hooks: runtime.hooks,
      route: runtime.route,
      arming: runtime.arming,
      lastVerdict: runtime.lastVerdict,
      log: runtime.log,
      pending: null,
      busy: false,
      probe: null,
      overlayOn: false,
      pulseFlash: false,
      notice: null,
      listening: false,
    });
    lastSerialized = JSON.stringify(runtime);
  } finally {
    applyingExternalState = false;
  }
}

export function installStatePersistence() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const saved = parseRuntime(window.localStorage.getItem(STORAGE_KEY));
  if (saved) {
    applyRuntime(saved);
    console.info("[REFLEX] Restored chamber and hook state from local persistence.");
  } else {
    writeRuntime();
  }

  const unsubscribe = useReflexStore.subscribe(() => {
    writeRuntime();
  });

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const runtime = parseRuntime(event.newValue);
    if (!runtime || event.newValue === lastSerialized) return;
    applyRuntime(runtime);
    console.info("[REFLEX] Synced state from another REFLEX browser tab.");
  };

  const flush = () => writeRuntime();

  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", flush);

  (window as typeof window & { __REFLEX_PERSIST_CLEANUP__?: () => void }).__REFLEX_PERSIST_CLEANUP__ = () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", flush);
    installed = false;
  };
}

export function clearPersistedReflexState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; the current in-memory demo still works.
  }
}
