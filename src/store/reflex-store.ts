import { create } from "zustand";
import { applyAction, INITIAL_SCENE } from "@/lib/reflex/apply-action";
import { evaluateProposal } from "@/lib/reflex/first-touch";
import {
  prepareScene,
  proposeFromHook,
  proposeFromSight,
  proposeFromTool,
  proposeFromVoice,
  proposeMissingHook,
} from "@/lib/reflex/pipeline";
import type { WebMcpInvokeOutcome } from "@/lib/reflex/webmcp";
import type {
  ActionProposal,
  ArmingMode,
  GenesisRegion,
  LogEntry,
  NoticeState,
  ProbeState,
  RouteTab,
  SceneState,
  ScreenHook,
  SightId,
  Sighting,
  ToolArgs,
  WebMcpToolName,
} from "@/lib/reflex/types";

const BRIDGE_TIMEOUT_MS = 15000;
const PROBE_TRAVEL_MS = 420;
const PROBE_STRIKE_MS = 180;
const NOTICE_MS = 2600;
const LOG_CAP = 40;
const SCREEN_BRIDGE_URL = "http://127.0.0.1:8790";

type ReflexState = {
  scene: SceneState;
  chamberEl: HTMLElement | null;
  sightings: Sighting[];
  regions: GenesisRegion[];
  hooks: ScreenHook[];
  overlayOn: boolean;
  route: RouteTab;
  arming: ArmingMode;
  pending: ActionProposal | null;
  lastVerdict: { decision: "PASS" | "UNRESOLVED" | "ERROR"; reason: string } | null;
  probe: ProbeState | null;
  pulseFlash: boolean;
  notice: NoticeState | null;
  log: LogEntry[];
  listening: boolean;
  busy: boolean;
  setChamberEl: (el: HTMLElement | null) => void;
  setRoute: (route: RouteTab) => void;
  setArming: (arming: ArmingMode) => void;
  observe: () => void;
  toggleOverlay: (on?: boolean) => void;
  addHook: (hook: ScreenHook) => void;
  updateHook: (id: string, patch: Partial<ScreenHook>) => void;
  removeHook: (id: string) => void;
  clearHooks: () => void;
  invokeTool: (name: WebMcpToolName, args?: ToolArgs) => void;
  invokeFromAgent: (name: WebMcpToolName, args?: ToolArgs) => Promise<WebMcpInvokeOutcome>;
  webmcpKind: "native" | "polyfill" | "off";
  setWebmcpKind: (kind: "native" | "polyfill" | "off") => void;
  activateSight: (id: SightId) => void;
  speak: (utterance: string) => void;
  setListening: (listening: boolean) => void;
  pass: () => void;
  cancelPending: () => void;
  clearNotice: () => void;
  clearLog: () => void;
};

let armTimer: ReturnType<typeof setTimeout> | null = null;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let gateWaiter: ((outcome: WebMcpInvokeOutcome) => void) | null = null;

function settleGate(outcome: WebMcpInvokeOutcome) {
  if (!gateWaiter) return;
  const resolve = gateWaiter;
  gateWaiter = null;
  resolve(outcome);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearArmTimer() {
  if (armTimer) {
    clearTimeout(armTimer);
    armTimer = null;
  }
}

function clearProbeTimer() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
}

function pushLog(log: LogEntry[], entry: Omit<LogEntry, "id" | "ts">): LogEntry[] {
  const next: LogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    ts: Date.now(),
  };
  return [next, ...log].slice(0, LOG_CAP);
}

function normalizeHookName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export const useReflexStore = create<ReflexState>((set, get) => {
  function snapshotScene() {
    const { chamberEl, scene } = get();
    const prepared = prepareScene(chamberEl, scene);
    set({ sightings: prepared.sightings, regions: prepared.regions });
    return prepared;
  }

  function showNotice(text: string) {
    if (noticeTimer) clearTimeout(noticeTimer);
    const notice = { id: crypto.randomUUID(), text };
    set({ notice });
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      set((state) => (state.notice?.id === notice.id ? { notice: null } : state));
    }, NOTICE_MS);
  }

  function submit(proposal: ActionProposal): boolean {
    const state = get();
    if (state.busy || state.pending) return false;
    clearArmTimer();

    set({ pending: proposal, lastVerdict: null, busy: true });

    const verdict = evaluateProposal(proposal);
    if (verdict.decision !== "PASS") {
      finishUnresolved(verdict.reason);
      return true;
    }

    if (state.arming === "auto") {
      executeNow(proposal);
    }

    return true;
  }

  function finishNonPass(decision: "UNRESOLVED" | "ERROR", reason: string) {
    const pending = get().pending;
    clearArmTimer();
    clearProbeTimer();

    if (!pending) {
      set({ busy: false, probe: null });
      settleGate({ accepted: false, gate: "REJECTED", result: reason });
      return;
    }

    set((state) => ({
      pending: null,
      busy: false,
      probe: null,
      lastVerdict: { decision, reason },
      log: pushLog(state.log, {
        source: pending.source,
        intent: pending.intent,
        target: pending.target,
        method: pending.method,
        channel: pending.channel,
        coordinates: pending.coordinates
          ? `${pending.coordinates.x}, ${pending.coordinates.y}`
          : "-",
        gate: decision,
        result: reason,
      }),
    }));

    showNotice(`${decision}: ${reason}`);
    settleGate({ accepted: true, gate: decision, result: reason });
  }

  function finishUnresolved(reason: string) {
    finishNonPass("UNRESOLVED", reason);
  }

  function finishError(reason: string) {
    finishNonPass("ERROR", reason);
  }

  function finishPass(proposal: ActionProposal, result: string, scene = get().scene) {
    set((state) => ({
      scene,
      pending: null,
      busy: false,
      probe: null,
      overlayOn: state.overlayOn,
      lastVerdict: { decision: "PASS", reason: result },
      log: pushLog(state.log, {
        source: proposal.source,
        intent: proposal.intent,
        target: proposal.target,
        method: proposal.method,
        channel: proposal.channel,
        coordinates: proposal.coordinates
          ? `${proposal.coordinates.x}, ${proposal.coordinates.y}`
          : "—",
        gate: "PASS",
        result,
      }),
    }));
    snapshotScene();
    showNotice(result);
    settleGate({ accepted: true, gate: "PASS", result });
  }

  let executingId: string | null = null;

  function executeNow(proposal: ActionProposal) {
    if (get().pending?.id !== proposal.id || executingId === proposal.id) return;
    executingId = proposal.id;
    if (!proposal.action) {
      finishUnresolved("no executable action");
      return;
    }

    if (proposal.action.type === "screen_click") {
      const action = proposal.action;
      void (async () => {
        try {
          const response = await fetch(`${SCREEN_BRIDGE_URL}/click`, {
            method: "POST",
            signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: action.x, y: action.y, name: action.name }),
          });
          const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: string; error?: string };
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || `screen bridge HTTP ${response.status}`);
          }
          if (get().pending?.id !== proposal.id) return;
          finishPass(proposal, payload.result || `screen click ${action.name} at ${action.x}, ${action.y}`);
        } catch (error) {
          if (get().pending?.id !== proposal.id) return;
          const message = error instanceof Error ? error.message : "screen click bridge failed";
          finishError(`screen click failed: ${message}`);
        }
      })();
      return;
    }


    if (
      proposal.action.type === "set_wifi" ||
      proposal.action.type === "set_bluetooth" ||
      proposal.action.type === "set_volume" ||
      proposal.action.type === "set_brightness"
    ) {
      const action = proposal.action;
      void (async () => {
        try {
          const body =
            action.type === "set_wifi"
              ? { action: "wifi", enabled: action.enabled }
              : action.type === "set_bluetooth"
                ? { action: "bluetooth", enabled: action.enabled }
                : action.type === "set_volume"
                  ? { action: "volume", value: action.value }
                  : { action: "brightness", value: action.value };

          const response = await fetch(`${SCREEN_BRIDGE_URL}/device`, {
            method: "POST",
            signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const payload = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            result?: string;
            error?: string;
          };
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || `device bridge HTTP ${response.status}`);
          }
          if (get().pending?.id !== proposal.id) return;

          const applied = applyAction(get().scene, action);
          finishPass(proposal, payload.result || applied.result, applied.scene);
        } catch (error) {
          if (get().pending?.id !== proposal.id) return;
          const message = error instanceof Error ? error.message : "device bridge failed";
          finishError(`device action failed: ${message}`);
        }
      })();
      return;
    }

    const applied = applyAction(get().scene, proposal.action);
    if (proposal.action.type === "pulse") {
      set({ pulseFlash: true });
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashTimer = null;
        set({ pulseFlash: false });
      }, 520);
    }
    finishPass(proposal, applied.result, applied.scene);
  }

  function submitNamedHook(name: string): boolean {
    const wanted = normalizeHookName(name);
    const hook = get().hooks.find((item) => normalizeHookName(item.name) === wanted);
    if (!hook) return submit(proposeMissingHook(name));
    // Named screen hooks use the same First Touch execution path.
    return submit(proposeFromHook(hook));
  }

  return {
    scene: INITIAL_SCENE,
    chamberEl: null,
    sightings: [],
    regions: [],
    hooks: [],
    overlayOn: false,
    route: "structured",
    arming: "auto",
    pending: null,
    lastVerdict: null,
    probe: null,
    pulseFlash: false,
    notice: null,
    log: [],
    listening: false,
    busy: false,
    webmcpKind: "off",
    setChamberEl: (el) => set({ chamberEl: el }),
    setRoute: (route) => set({ route }),
    setArming: (arming) => {
      set({ arming });
      const proposal = get().pending;
      if (arming === "auto" && proposal) get().pass();
    },
    observe: () => {
      const prepared = snapshotScene();
      set({ overlayOn: true, sightings: prepared.sightings, regions: prepared.regions });
    },
    toggleOverlay: (on) => set((state) => ({ overlayOn: on ?? !state.overlayOn })),
    addHook: (hook) =>
      set((state) => ({
        hooks: [hook, ...state.hooks.filter((item) => normalizeHookName(item.name) !== normalizeHookName(hook.name))].slice(0, 24),
      })),
    updateHook: (id, patch) =>
      set((state) => ({
        hooks: state.hooks.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, binding: null } : item)),
      })),
    removeHook: (id) => set((state) => ({ hooks: state.hooks.filter((item) => item.id !== id) })),
    clearHooks: () => set({ hooks: [] }),
    setWebmcpKind: (kind) => set({ webmcpKind: kind }),
    invokeTool: (name, args = {}) => {
      if (name === "screen.activate_hook") {
        submitNamedHook(args.name ?? "");
        return;
      }
      submit(proposeFromTool(name, args));
    },
    invokeFromAgent: (name, args = {}) => {
      return new Promise((resolve) => {
        if (get().busy || get().pending) {
          resolve({
            accepted: false,
            gate: "REJECTED",
            result: "First Touch is busy with another proposal",
          });
          return;
        }
        gateWaiter = resolve;
        const accepted =
          name === "screen.activate_hook"
            ? submitNamedHook(args.name ?? "")
            : submit(proposeFromTool(name, args));
        if (!accepted) {
          gateWaiter = null;
          resolve({
            accepted: false,
            gate: "REJECTED",
            result: "First Touch is busy with another proposal",
          });
        }
      });
    },
    activateSight: (id) => {
      const prepared = snapshotScene();
      submit(proposeFromSight(id, prepared));
    },
    speak: (utterance) => {
      const prepared = snapshotScene();
      submit(proposeFromVoice(utterance, prepared));
    },
    setListening: (listening) => set({ listening }),
    cancelPending: () => {
      if (get().pending) finishError("Cancelled locally. An already-sent native action may still complete; check the device before retrying.");
    },
    pass: () => {
      const proposal = get().pending;
      if (!proposal || executingId === proposal.id) return;
      clearArmTimer();
      const verdict = evaluateProposal(proposal);
      if (verdict.decision !== "PASS") {
        finishUnresolved(verdict.reason);
        return;
      }
      const reduced = prefersReducedMotion();
      const needsProbe =
        proposal.channel === "VISUAL" &&
        proposal.target !== "screen_hook" &&
        proposal.coordinates &&
        !reduced;
      if (!needsProbe || !proposal.coordinates) {
        executeNow(proposal);
        return;
      }
      const coords = proposal.coordinates;
      set({
        overlayOn: true,
        probe: { x: coords.x, y: coords.y, phase: "travel" },
      });
      clearProbeTimer();
      probeTimer = setTimeout(() => {
        set({ probe: { x: coords.x, y: coords.y, phase: "strike" } });
        probeTimer = setTimeout(() => {
          probeTimer = null;
          executeNow(proposal);
        }, PROBE_STRIKE_MS);
      }, PROBE_TRAVEL_MS);
    },
    clearNotice: () => set({ notice: null }),
    clearLog: () => set({ log: [] }),
  };
});

export function sourceLabel(source: LogEntry["source"]): string {
  switch (source) {
    case "agent":
      return "AGENT / STRUCTURED";
    case "voice":
      return "DELTA VOICE";
    case "visual":
      return "VISUAL FALLBACK";
    case "gate":
      return "FIRST TOUCH";
  }
}
