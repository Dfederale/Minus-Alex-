import type {
  LogEntry,
  RouteTab,
  SceneState,
  ScreenHook,
} from "@/lib/reflex/types";

const STORAGE_KEY = "reflex.v033.resident-memory";
const STORAGE_VERSION = 1;
const MESSAGE_CAP = 12;
const SNAPSHOT_CAP = 8;

export type ResidentMemoryMessage = {
  id: string;
  ts: number;
  role: "human" | "resident";
  text: string;
};

export type ResidentContinuitySnapshot = {
  id: string;
  ts: number;
  note: string;
  scene: SceneState;
  route: RouteTab;
  pending: {
    intent: string;
    target: string;
    channel: string;
  } | null;
  lastVerdict: {
    decision: "PASS" | "UNRESOLVED" | "ERROR";
    reason: string;
  } | null;
  hooks: string[];
};

type ResidentMemoryState = {
  version: 1;
  messages: ResidentMemoryMessage[];
  snapshots: ResidentContinuitySnapshot[];
};

const EMPTY_MEMORY: ResidentMemoryState = {
  version: STORAGE_VERSION,
  messages: [],
  snapshots: [],
};

function safeText(value: unknown, max = 600): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function readState(): ResidentMemoryState {
  if (typeof window === "undefined") return EMPTY_MEMORY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_MEMORY;
    const parsed = JSON.parse(raw) as Partial<ResidentMemoryState>;

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter((item): item is ResidentMemoryMessage => {
            if (!item || typeof item !== "object") return false;
            return (
              typeof item.id === "string" &&
              typeof item.ts === "number" &&
              Number.isFinite(item.ts) &&
              (item.role === "human" || item.role === "resident") &&
              typeof item.text === "string"
            );
          })
          .map((item) => ({ ...item, text: item.text.slice(0, 600) }))
          .slice(-MESSAGE_CAP)
      : [];

    const snapshots = Array.isArray(parsed.snapshots)
      ? parsed.snapshots
          .filter((item): item is ResidentContinuitySnapshot => {
            if (!item || typeof item !== "object") return false;
            return (
              typeof item.id === "string" &&
              typeof item.ts === "number" &&
              Number.isFinite(item.ts) &&
              typeof item.note === "string" &&
              !!item.scene &&
              typeof item.route === "string" &&
              Array.isArray(item.hooks)
            );
          })
          .slice(-SNAPSHOT_CAP)
      : [];

    return { version: STORAGE_VERSION, messages, snapshots };
  } catch {
    return EMPTY_MEMORY;
  }
}

function writeState(state: ResidentMemoryState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[REFLEX] Could not persist Resident memory:", error);
  }
}

export function getResidentMessages(): ResidentMemoryMessage[] {
  return readState().messages;
}

export function appendResidentMessage(
  role: ResidentMemoryMessage["role"],
  text: string,
): ResidentMemoryMessage[] {
  const clean = safeText(text);
  if (!clean) return getResidentMessages();

  const state = readState();
  const message: ResidentMemoryMessage = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    role,
    text: clean,
  };
  const messages = [...state.messages, message].slice(-MESSAGE_CAP);
  writeState({ ...state, messages });
  return messages;
}

export function captureResidentSnapshot(input: {
  note: string;
  scene: SceneState;
  route: RouteTab;
  pending: {
    intent: string;
    target: string;
    channel: string;
  } | null;
  lastVerdict: {
    decision: "PASS" | "UNRESOLVED" | "ERROR";
    reason: string;
  } | null;
  hooks: ScreenHook[];
}): ResidentContinuitySnapshot[] {
  const state = readState();
  const snapshot: ResidentContinuitySnapshot = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    note: input.note.slice(0, 180),
    scene: input.scene,
    route: input.route,
    pending: input.pending,
    lastVerdict: input.lastVerdict,
    hooks: input.hooks.map((hook) => hook.name).filter(Boolean).slice(0, 24),
  };
  const snapshots = [...state.snapshots, snapshot].slice(-SNAPSHOT_CAP);
  writeState({ ...state, snapshots });
  return snapshots;
}

export function clearResidentMemory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The demo remains functional even if local storage is unavailable.
  }
}

export function buildResidentMemoryPrompt(log: LogEntry[]): string {
  const state = readState();

  const working = state.messages
    .slice(-8)
    .map((message) => `${message.role === "human" ? "Human" : "Resident"}: ${message.text}`)
    .join("\n");

  const events = log
    .slice(0, 8)
    .reverse()
    .map(
      (entry) =>
        `${new Date(entry.ts).toLocaleTimeString()} | ${entry.gate} | ${entry.intent} | ${entry.result}`,
    )
    .join("\n");

  const continuity = state.snapshots
    .slice(-6)
    .map((snapshot, index) => {
      const scene = snapshot.scene;
      const verdict = snapshot.lastVerdict
        ? `${snapshot.lastVerdict.decision}:${snapshot.lastVerdict.reason}`
        : "none";
      return `${index + 1}. ${snapshot.note} | lamp=${scene.lampOn ? "on" : "off"}, square=${Math.round(scene.squareX)}, wifi=${scene.wifiOn ? "on" : "off"}, bluetooth=${scene.bluetoothOn ? "on" : "off"}, volume=${scene.volume}, brightness=${scene.brightness}, route=${snapshot.route}, verdict=${verdict}, hooks=${snapshot.hooks.join(",") || "none"}`;
    })
    .join("\n");

  return [
    "Resident memory has three factual layers. Use only what is present here; do not invent missing history.",
    "Layer 1 — working conversation (roughly three exchanges back):",
    working || "none yet",
    "",
    "Layer 2 — recent First Touch events:",
    events || "none yet",
    "",
    "Layer 3 — continuity snapshots across recent interactions/reloads:",
    continuity || "none yet",
  ].join("\n");
}

export function getResidentMemoryCounts(log: LogEntry[]) {
  const state = readState();
  return {
    workingMessages: state.messages.length,
    events: Math.min(log.length, 8),
    snapshots: state.snapshots.length,
  };
}
