import type {
  ExecutableAction,
  SightId,
  ToolArgs,
  WebMcpTool,
  WebMcpToolName,
} from "./types";
import {
  ensureModelContext,
  type ModelContextLike,
  type WebMcpHostKind,
} from "./webmcp-polyfill";

/**
 * WebMCP — structured tools an agent can discover and call via
 * document.modelContext (native Chromium or in-page polyfill).
 *
 * Capability is not permission: execute() only creates a First Touch
 * proposal. It never mutates the chamber directly.
 */

export const WEBMCP_TOOLS: WebMcpTool[] = [
  {
    name: "chamber.move_square",
    title: "Move square",
    description: "Slide the chamber square along the rail. First Touch must PASS before it moves.",
    target: "slider",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["left", "right"],
          description: "Direction to slide the square.",
        },
      },
      required: ["direction"],
      additionalProperties: false,
    },
  },
  {
    name: "chamber.toggle_lamp",
    title: "Toggle lamp",
    description: "Toggle the chamber lamp. First Touch must PASS before it changes.",
    target: "lamp",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "chamber.set_inscription",
    title: "Set inscription",
    description: "Write text on the inscription plate. First Touch must PASS before it changes.",
    target: "inscription",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to stamp on the plate (max 18 characters).",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: 'chamber.pulse',
    title: 'Pulse actuator',
    description: 'Strike the pulse actuator through First Touch.',
    target: 'pulse',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: "device.set_wifi",
    title: "Wi-Fi native control",
    description: "Set the host Wi-Fi on or off. First Touch must PASS before the native bridge executes it.",
    target: "wifi",
    inputSchema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
      additionalProperties: false,
    },
  },
  {
    name: "device.set_bluetooth",
    title: "Bluetooth native control",
    description: "Set the host Bluetooth on or off. First Touch must PASS before the native bridge executes it.",
    target: "bluetooth",
    inputSchema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
      additionalProperties: false,
    },
  },
  {
    name: "device.set_volume",
    title: "Volume native control",
    description: "Set the host volume from 0 to 100. First Touch must PASS before the native bridge executes it.",
    target: "volume",
    inputSchema: {
      type: "object",
      properties: { value: { type: "number", minimum: 0, maximum: 100 } },
      required: ["value"],
      additionalProperties: false,
    },
  },
  {
    name: "device.set_brightness",
    title: "Brightness native control",
    description: "Set the host brightness from 0 to 100. First Touch must PASS before the native bridge executes it.",
    target: "brightness",
    inputSchema: {
      type: "object",
      properties: { value: { type: "number", minimum: 0, maximum: 100 } },
      required: ["value"],
      additionalProperties: false,
    },
  },
  {
    name: "screen.activate_hook",
    title: "Click named screen button",
    description: "Request one screen button that was explicitly mapped from a captured display. First Touch must PASS before the native click bridge receives it.",
    target: "screen_hook",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", minLength: 1, maxLength: 64 } },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

type ToolBackedAction = Exclude<ExecutableAction["type"], "screen_click">;

const TOOL_BY_ACTION: Record<ToolBackedAction, WebMcpToolName> = {
  move_square: "chamber.move_square",
  toggle_lamp: "chamber.toggle_lamp",
  set_inscription: "chamber.set_inscription",
  pulse: 'chamber.pulse',
  set_wifi: "device.set_wifi",
  set_bluetooth: "device.set_bluetooth",
  set_volume: "device.set_volume",
  set_brightness: "device.set_brightness",
};

export function listWebMcpTools(): WebMcpTool[] {
  return WEBMCP_TOOLS;
}

export function findTool(name: string): WebMcpTool | undefined {
  return WEBMCP_TOOLS.find((tool) => tool.name === name);
}

export function toolForAction(action: ExecutableAction): WebMcpTool | undefined {
  if (action.type === "screen_click") return undefined;
  return findTool(TOOL_BY_ACTION[action.type]);
}

export function isPublishedTarget(id: SightId): boolean {
  return WEBMCP_TOOLS.some((tool) => tool.target === id);
}

export function actionFromToolCall(
  name: WebMcpToolName,
  args: ToolArgs,
): ExecutableAction | null {
  switch (name) {
    case "chamber.move_square":
      if (args.direction !== "left" && args.direction !== "right") return null;
      return { type: "move_square", direction: args.direction };
    case 'chamber.pulse':
      return { type: 'pulse' };
    case "chamber.toggle_lamp":
      return { type: "toggle_lamp" };
    case "chamber.set_inscription": {
      const text = (args.text ?? "").trim();
      if (!text) return null;
      return { type: "set_inscription", text };
    }
    case "device.set_wifi":
      return typeof args.enabled === "boolean" ? { type: "set_wifi", enabled: args.enabled } : null;
    case "device.set_bluetooth":
      return typeof args.enabled === "boolean"
        ? { type: "set_bluetooth", enabled: args.enabled }
        : null;
    case "device.set_volume":
      return typeof args.value === "number" && Number.isFinite(args.value)
        ? { type: "set_volume", value: Math.min(100, Math.max(0, args.value)) }
        : null;
    case "device.set_brightness":
      return typeof args.value === "number" && Number.isFinite(args.value)
        ? { type: "set_brightness", value: Math.min(100, Math.max(0, args.value)) }
        : null;
    case "screen.activate_hook":
      // Dynamic screen-button coordinates are resolved against the current saved map in the store.
      return null;
    default:
      return null;
  }
}

export type WebMcpInvokeOutcome = {
  accepted: boolean;
  gate: "PASS" | "UNRESOLVED" | "ERROR" | "REJECTED";
  result: string;
};

export type WebMcpInvokeHandler = (
  name: WebMcpToolName,
  args: ToolArgs,
) => Promise<WebMcpInvokeOutcome>;

function parseArgs(name: WebMcpToolName, input: Record<string, unknown>): ToolArgs {
  if (name === "chamber.move_square") {
    const direction = input.direction === "left" || input.direction === "right" ? input.direction : undefined;
    return { direction };
  }
  if (name === "chamber.set_inscription") {
    return { text: typeof input.text === "string" ? input.text : "" };
  }
  if (name === "device.set_wifi" || name === "device.set_bluetooth") {
    return { enabled: typeof input.enabled === "boolean" ? input.enabled : undefined };
  }
  if (name === "device.set_volume" || name === "device.set_brightness") {
    return { value: typeof input.value === "number" ? input.value : undefined };
  }
  if (name === "screen.activate_hook") {
    return { name: typeof input.name === "string" ? input.name : "" };
  }
  return {};
}

export async function registerChamberTools(invoke: WebMcpInvokeHandler): Promise<{
  kind: WebMcpHostKind;
  context: ModelContextLike;
  names: WebMcpToolName[];
}> {
  const { kind, context } = ensureModelContext();
  const controller = new AbortController();
  const already = new Set(
    ((await context.getTools().catch(() => [])) as { name?: string }[]).map((tool) => tool.name),
  );

  for (const tool of WEBMCP_TOOLS) {
    if (already.has(tool.name)) continue;
    await context.registerTool(
      {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          const args = parseArgs(tool.name, input ?? {});
          const outcome = await invoke(tool.name, args);
          return {
            content: [
              {
                type: "text",
                text: outcome.accepted
                  ? `First Touch ${outcome.gate}: ${outcome.result}`
                  : `First Touch rejected: ${outcome.result}`,
              },
            ],
            firstTouch: outcome,
          };
        },
      },
      { signal: controller.signal },
    );
  }

  return { kind, context, names: WEBMCP_TOOLS.map((tool) => tool.name) };
}
