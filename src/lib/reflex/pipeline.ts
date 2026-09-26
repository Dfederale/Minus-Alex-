import { parseUtterance } from "./delta-voice";
import { mapChamber, resolveRegion } from "./genesis";
import { observeChamber } from "./first-sight";
import { actionFromToolCall, findTool, toolForAction } from "./webmcp";
import type {
  ActionProposal,
  Channel,
  ExecutableAction,
  GenesisRegion,
  InputSource,
  SceneState,
  ScreenHook,
  SightId,
  Sighting,
  ToolArgs,
  WebMcpToolName,
} from "./types";

function newId(): string {
  return crypto.randomUUID();
}

function coordsOf(region: GenesisRegion | undefined): ActionProposal["coordinates"] {
  if (!region) return null;
  return { x: Math.round(region.cx), y: Math.round(region.cy) };
}

export type PreparedScene = {
  sightings: Sighting[];
  regions: GenesisRegion[];
};

export function prepareScene(root: HTMLElement | null, scene: SceneState): PreparedScene {
  return {
    sightings: observeChamber(root, scene),
    regions: mapChamber(root),
  };
}

function visualProposal(args: {
  source: InputSource;
  intent: string;
  action: ExecutableAction;
  target: SightId;
  regions: GenesisRegion[];
  method: string;
}): ActionProposal {
  const region = resolveRegion(args.regions, args.target);
  return {
    id: newId(),
    source: args.source,
    intent: args.intent,
    target: args.target,
    channel: "VISUAL",
    method: args.method,
    coordinates: coordsOf(region),
    action: args.action,
    unresolvedReason: region ? undefined : "First Sight could not resolve target region",
  };
}

function structuredProposal(args: {
  source: InputSource;
  intent: string;
  action: ExecutableAction;
  target: SightId;
}): ActionProposal {
  const tool = toolForAction(args.action);
  return {
    id: newId(),
    source: args.source,
    intent: args.intent,
    target: args.target,
    channel: "WEBMCP",
    method: tool ? `WebMCP ${tool.name}` : "WebMCP tool call",
    coordinates: null,
    action: args.action,
  };
}

export function proposeFromTool(name: WebMcpToolName, args: ToolArgs): ActionProposal {
  const tool = findTool(name);
  const action = actionFromToolCall(name, args);
  if (!tool || !action) {
    return {
      id: newId(),
      source: "agent",
      intent: name,
      target: tool?.target ?? "—",
      channel: "UNRESOLVED",
      method: "WebMCP tool call",
      coordinates: null,
      action: null,
      unresolvedReason:
        name === "screen.activate_hook"
          ? "named screen buttons are resolved against the live First Sight map"
          : "tool arguments were incomplete or unknown",
    };
  }
  return structuredProposal({
    source: "agent",
    intent: `${tool.name}(${summarizeArgs(args)})`,
    action,
    target: tool.target,
  });
}

function executableSurface(surface: string | undefined): boolean {
  return surface === "monitor" || surface === "screen";
}

export function proposeFromHook(hook: ScreenHook): ActionProposal {
  const bounds = hook.nativeBounds;
  // Compatibility for the original first-screen maps. Their saved coordinates
  // were calibrated in browser screen units, while the newly working second
  // screen uses physical virtual-desktop coordinates. Do not rescale Screen 2.
  const firstScreenWidth = hook.screenWidth * (hook.devicePixelRatio || 1);
  const originalScreen = Boolean(
    bounds && bounds.left >= 0 && bounds.top >= 0 &&
    (bounds.left === 0 || bounds.left + bounds.width / 2 < firstScreenWidth),
  );
  const legacyPreview = originalScreen && hook.previewMapped === true;
  const scale = hook.devicePixelRatio || 1;
  const x = Math.round(
    legacyPreview && bounds ? (bounds.left + hook.xNorm * bounds.width) / scale
      : originalScreen || !bounds ? hook.xNorm * hook.screenWidth
        : bounds.left + hook.xNorm * bounds.width,
  );
  const y = Math.round(
    legacyPreview && bounds ? (bounds.top + hook.yNorm * bounds.height) / scale
      : originalScreen || !bounds ? hook.yNorm * hook.screenHeight
        : bounds.top + hook.yNorm * bounds.height,
  );
  const runnable = executableSurface(hook.displaySurface);
  return {
    id: newId(),
    source: "agent",
    intent: `screen.activate_hook(${JSON.stringify(hook.name)})`,
    target: "screen_hook",
    channel: runnable ? "VISUAL" : "UNRESOLVED",
    method: `First Sight screen map · ${hook.name}`,
    coordinates: { x, y },
    action: runnable ? { type: "screen_click", x, y, name: hook.name } : null,
    unresolvedReason: runnable ? undefined : `hook "${hook.name}" was not mapped from an Entire Screen capture`,
  };
}

export function proposeMissingHook(name: string): ActionProposal {
  return {
    id: newId(),
    source: "agent",
    intent: `screen.activate_hook(${JSON.stringify(name)})`,
    target: "screen_hook",
    channel: "UNRESOLVED",
    method: "First Sight screen map",
    coordinates: null,
    action: null,
    unresolvedReason: `named screen button "${name}" was not found`,
  };
}

export function proposeFromSight(target: SightId, prepared: PreparedScene): ActionProposal {
  const sighted = prepared.sightings.find((item) => item.id === target);
  const action = actionForVisualTarget(target);
  if (!sighted || !action) {
    return {
      id: newId(),
      source: "visual",
      intent: `activate ${target}`,
      target,
      channel: "UNRESOLVED",
      method: "First Sight",
      coordinates: null,
      action: null,
      unresolvedReason: "First Sight has no executable action for that object",
    };
  }
  return visualProposal({
    source: "visual",
    intent: `activate ${sighted.label}`,
    action,
    target,
    regions: prepared.regions,
    method: "First Sight detect + coordinate resolve",
  });
}

export function proposeFromVoice(utterance: string, prepared: PreparedScene): ActionProposal {
  const parsed = parseUtterance(utterance);
  if (!parsed.ok) {
    return {
      id: newId(),
      source: "voice",
      intent: parsed.label,
      target: "—",
      channel: "UNRESOLVED",
      method: "Delta Voice",
      coordinates: null,
      action: null,
      unresolvedReason: parsed.reason,
    };
  }
  if (parsed.prefersVisual || !toolForAction(parsed.action)) {
    return visualProposal({
      source: "voice",
      intent: parsed.label,
      action: parsed.action,
      target: parsed.target,
      regions: prepared.regions,
      method: "Delta Voice → First Sight",
    });
  }
  return structuredProposal({
    source: "voice",
    intent: parsed.label,
    action: parsed.action,
    target: parsed.target,
  });
}

function actionForVisualTarget(target: SightId): ExecutableAction | null {
  switch (target) {
    case "lamp":
      return { type: "toggle_lamp" };
    case "slider":
      return { type: "move_square", direction: "right" };
    case "inscription":
      return { type: "set_inscription", text: "SIGHTED" };
    case "pulse":
      return { type: "pulse" };
    case "wifi":
    case "bluetooth":
    case "volume":
    case "brightness":
    case "screen_hook":
      return null;
  }
}

function summarizeArgs(args: ToolArgs): string {
  if (args.direction) return args.direction;
  if (args.text) return JSON.stringify(args.text);
  if (typeof args.enabled === "boolean") return String(args.enabled);
  if (typeof args.value === "number") return String(args.value);
  if (args.name) return JSON.stringify(args.name);
  return "";
}

export function channelLabel(channel: Channel): string {
  return channel;
}

export { formatCoords } from "./genesis";
