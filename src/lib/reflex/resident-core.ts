import { buildResidentMemoryPrompt } from "./resident-memory";
import type { LogEntry, ToolArgs, WebMcpToolName } from "./types";

const OLLAMA_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "qwen2.5:0.5b";

type NativeToolCall = {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: NativeToolCall[];
  };
  error?: string;
};

type NativeTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function argsObject(call: NativeToolCall): Record<string, unknown> {
  const raw = call.function?.arguments;

  if (raw && typeof raw === "object") return raw;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function numberArg(
  args: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = args[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return undefined;
}

function stringArg(
  args: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function booleanArg(
  args: Record<string, unknown>,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = args[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "on", "enable", "enabled", "yes", "1"].includes(normalized)) {
        return true;
      }

      if (["false", "off", "disable", "disabled", "no", "0"].includes(normalized)) {
        return false;
      }
    }
  }

  return undefined;
}

function buildTools(hookNames: string[]): NativeTool[] {
  const tools: NativeTool[] = [
    {
      type: "function",
      function: {
        name: "chamber_toggle_lamp",
        description:
          "Toggle the chamber lamp. Use only when the human asks you to change the lamp now.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "chamber_move_square",
        description: "Move the chamber square left or right.",
        parameters: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: ["left", "right"],
            },
          },
          required: ["direction"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "chamber_set_inscription",
        description: "Write text on the chamber inscription plate.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
          },
          required: ["text"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "device_set_wifi",
        description: "Turn the host Wi-Fi on or off.",
        parameters: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "device_set_bluetooth",
        description: "Turn the host Bluetooth on or off.",
        parameters: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "device_set_volume",
        description: "Set the host audio volume from 0 to 100.",
        parameters: {
          type: "object",
          properties: {
            value: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
          },
          required: ["value"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "device_set_brightness",
        description: "Set the host display brightness from 0 to 100.",
        parameters: {
          type: "object",
          properties: {
            value: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
          },
          required: ["value"],
        },
      },
    },
  ];

  if (hookNames.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: "screen_activate_hook",
        description:
          "Click one saved named screen target. Use only when the human explicitly asks to activate that saved target.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: hookNames,
            },
          },
          required: ["name"],
        },
      },
    });
  }

  return tools;
}

function normalizeToolCall(
  call: NativeToolCall,
): { tool: WebMcpToolName; args: ToolArgs } | null {
  const name = call.function?.name ?? "";
  const args = argsObject(call);

  switch (name) {
    case "chamber_toggle_lamp":
      return {
        tool: "chamber.toggle_lamp",
        args: {},
      };

    case "chamber_move_square": {
      const direction = stringArg(args, "direction", "dir");

      if (direction !== "left" && direction !== "right") return null;

      return {
        tool: "chamber.move_square",
        args: { direction },
      };
    }

    case "chamber_set_inscription": {
      const text = stringArg(args, "text", "message", "inscription");
      if (!text) return null;

      return {
        tool: "chamber.set_inscription",
        args: { text },
      };
    }

    case "device_set_wifi": {
      const enabled = booleanArg(args, "enabled", "state", "on");
      if (enabled === undefined) return null;

      return {
        tool: "device.set_wifi",
        args: { enabled },
      };
    }

    case "device_set_bluetooth": {
      const enabled = booleanArg(args, "enabled", "state", "on");
      if (enabled === undefined) return null;

      return {
        tool: "device.set_bluetooth",
        args: { enabled },
      };
    }

    case "device_set_volume": {
      const value = numberArg(args, "value", "volume", "percent", "level");
      if (value === undefined) return null;

      return {
        tool: "device.set_volume",
        args: {
          value: Math.min(100, Math.max(0, value)),
        },
      };
    }

    case "device_set_brightness": {
      const value = numberArg(args, "value", "brightness", "percent", "level");
      if (value === undefined) return null;

      return {
        tool: "device.set_brightness",
        args: {
          value: Math.min(100, Math.max(0, value)),
        },
      };
    }

    case "screen_activate_hook": {
      const nameArg = stringArg(args, "name", "target", "button");
      if (!nameArg) return null;

      return {
        tool: "screen.activate_hook",
        args: { name: nameArg },
      };
    }

    default:
      return null;
  }
}

async function chat(
  text: string,
  memory: string,
  scene: unknown,
  tools: NativeTool[],
): Promise<OllamaChatResponse> {
  const system = [
    "You are the Resident inside Digital Intelligence Neuromorphic Systems REFLEX.",
    "Talk naturally with the human.",
    "You can also act through tools attached to your body.",
    "Use a tool only when the human clearly asks you to perform that action now.",
    "Greetings, jokes, questions, explanations, conversation, memory questions, and discussion about capabilities must not call tools.",
    "If a tool is appropriate, call exactly one tool.",
    "For lamp on/off requests, compare the current lamp state first; do not toggle if it already matches.",
    "Pulse is a visual-only actuator. If asked to pulse, direct the human to the Pulse button; never substitute a different tool.",
    "Do not invent actions or claim success before the tool result exists.",
    "",
    memory,
    "",
    `Current scene: ${JSON.stringify(scene)}`,
  ].join("\n");

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      keep_alive: "4h",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      tools,
      options: {
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 400 && /does not support tools|doesn't support tools|tools? (?:are |is )?not supported/i.test(detail)) {
      return jsonDecision(text, system, tools);
    }
    throw new Error(`Ollama returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (data.error) throw new Error(data.error);

  return data;
}

async function jsonDecision(text: string, system: string, tools: NativeTool[]): Promise<OllamaChatResponse> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: `${system}\nAvailable functions: ${JSON.stringify(tools.map((tool) => tool.function))}\nReturn one JSON object: {"tool":null,"args":{},"reply":"natural conversational reply"} for conversation; or {"tool":"exact function name","args":{},"reply":""} for an explicitly requested action. Never claim an action executed.` },
        { role: "user", content: text },
      ],
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama JSON decision returned HTTP ${response.status}`);
  const data = (await response.json()) as OllamaChatResponse;
  if (data.error) throw new Error(data.error);
  const decision = JSON.parse(data.message?.content ?? "") as { tool?: unknown; args?: unknown; reply?: unknown };
  if (!decision || typeof decision !== "object") throw new Error("Invalid model decision; no action executed.");
  if (decision.tool === null) {
    return { message: { content: typeof decision.reply === "string" ? decision.reply : "" } };
  }
  if (typeof decision.tool !== "string" || !tools.some((tool) => tool.function.name === decision.tool) || !decision.args || typeof decision.args !== "object" || Array.isArray(decision.args)) {
    throw new Error("Invalid model decision; no action executed.");
  }
  return { message: { tool_calls: [{ function: { name: decision.tool, arguments: decision.args as Record<string, unknown> } }] } };
}

async function plainConversation(
  text: string,
  memory: string,
  scene: unknown,
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      keep_alive: "4h",
      messages: [
        {
          role: "system",
          content: [
            "You are the Resident inside Digital Intelligence Neuromorphic Systems REFLEX.",
            "Talk naturally with the human.",
            "Keep replies concise unless detail is requested.",
            "Use memory when relevant.",
            "",
            memory,
            "",
            `Current scene: ${JSON.stringify(scene)}`,
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
      options: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (data.error) throw new Error(data.error);

  return data.message?.content?.trim() || "I am here.";
}

// Explicit saved-button commands should not depend on a 0.5B model
// guessing a tool name. Only an exact, affirmative command is eligible.
function requestedScreenHook(text: string, hookNames: string[]): string | null {
  if (/\b(?:do\s+not|don't|dont|never|without)\b/i.test(text)) return null;
  const command = text.trim().match(
    /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:click(?:\s+on)?|press|tap(?:\s+on)?|activate)\s+(?:the\s+)?(?:button\s+)?(?:named\s+)?(.+?)(?:\s+please)?[.!?]*$/i,
  );
  if (!command) return null;
  const spoken = command[1].trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const exact = hookNames.find((name) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === spoken);
  if (exact) return exact;
  // 'Click the Submit button' should match a saved target named 'Submit'.
  const withoutButton = spoken.replace(/\s+button$/, "");
  if (withoutButton === spoken) return null;
  return hookNames.find((name) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === withoutButton) ?? null;
}

export async function runResidentTurn(
  text: string,
  log: LogEntry[],
): Promise<string> {
  const api = window.REFLEX_AI;

  if (!api) {
    throw new Error("Resident action bridge is not ready.");
  }

  const snapshot = api.snapshot();
  const hookNames = snapshot.hooks
    .filter((hook) => hook.mapped)
    .map((hook) => hook.name);

  const lamp = text.trim().match(/^(?:please\s+)?(?:turn|switch|set)\s+(?:the\s+)?(?:lamp|light)\s+(on|off)(?:\s+please)?[.!]?$/i)
    ?? text.trim().match(/^(?:please\s+)?(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(?:lamp|light)(?:\s+please)?[.!]?$/i);
  if (lamp) {
    const on = lamp[1].toLowerCase() === 'on';
    if (snapshot.scene.lampOn === on) return on ? 'Lamp already on.' : 'Lamp already off.';
    const result = await api.invoke('chamber.toggle_lamp', {});
    if (!result.accepted || result.gate !== 'PASS') return 'Lamp action failed: ' + result.result;
    if (api.snapshot().scene.lampOn !== on) return 'Lamp did not reach the requested state.';
    return result.result;
  }
  const squareMentioned = /\bsquare\b/i.test(text);
  const squareDirections = text.match(/\b(left|right)\b/gi) ?? [];
  if (squareMentioned && squareDirections.length > 0 &&
      (squareDirections.length !== 1 || /\b(?:do not|never|without|don't)\b/i.test(text))) {
    return 'Square direction ambiguous or negated; no action taken.';
  }
  const squareMove = squareMentioned && squareDirections.length === 1 ? text.match(/\b(left|right)\b/i) : null;
  if (squareMove) {
    const before = snapshot.scene.squareX;
    const result = await api.invoke('chamber.move_square', { direction: squareMove[1].toLowerCase() === 'left' ? 'left' : 'right' });
    if (!result.accepted || result.gate !== 'PASS') return 'Square action failed: ' + result.result;
    if (api.snapshot().scene.squareX === before) return 'Square did not move.';
    return result.result;
  }
  const radioCommand = text.trim().match(/^(?:please\s+)?(?:(?:turn|switch|set)\s+)?(?:the\s+)?(wi-?fi|bluetooth)\s+(on|off)(?:\s+please)?[.!]?$/i)
    ?? text.trim().match(/^(?:please\s+)?(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(wi-?fi|bluetooth)(?:\s+please)?[.!]?$/i);
  if (radioCommand) {
    const stateFirst = /^(on|off)$/i.test(radioCommand[1]);
    const radio = (stateFirst ? radioCommand[2] : radioCommand[1]).toLowerCase();
    const enabled = (stateFirst ? radioCommand[1] : radioCommand[2]).toLowerCase() === 'on';
    const tool = radio === 'bluetooth' ? 'device.set_bluetooth' : 'device.set_wifi';
    const result = await api.invoke(tool, { enabled });
    return result.accepted && result.gate === 'PASS' ? result.result : 'Radio action failed: ' + result.result;
  }
  const inscriptionMatch = text.trim().match(/^(?:(?:please\s+)?(?:set|change|write|stamp)\s+(?:the\s+)?inscription(?:\s+to)?|(?:please\s+)?inscription)\s+(.+)$/i);
  if (inscriptionMatch) {
    const label = inscriptionMatch[1].trim().replace(/[.!]+$/, '').trim().slice(0, 18).toUpperCase();
    if (!label) return 'Inscription text missing.';
    if (snapshot.scene.inscription === label) return 'Inscription already set.';
    const result = await api.invoke('chamber.set_inscription', { text: label });
    if (!result.accepted || result.gate !== 'PASS') return 'Inscription failed: ' + result.result;
    return result.result;
  }
  const pulseText = text.trim();
  const pulseStart = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:pulse\b|(?:press|trigger|activate)\s+(?:the\s+)?pulse\b|make\s+it\s+pulse\b)/i;
  if (pulseStart.test(pulseText)) {
    const match = pulseText.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:pulse|(?:press|trigger|activate)\s+(?:the\s+)?pulse(?:\s+actuator)?|make\s+it\s+pulse)(?:\s+(once|twice|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)(?:\s+times?)?)?(?:\s+please)?[.!]?$/i);
    if (!match) return 'Pulse request unclear; no action taken.';
    const names: Record<string, number> = { once: 1, twice: 2, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    const token = match[1]?.toLowerCase();
    const count = token ? (names[token] ?? Number(token)) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 12) return 'Pulse count must be 1 to 12.';
    const before = api.snapshot().scene.pulseCount;
    for (let n = 0; n < count; n++) {
      const result = await api.invoke('chamber.pulse', {});
      if (!result.accepted || result.gate !== 'PASS') return `Pulse stopped after ${n}/${count}: ${result.result}`;
      if (n + 1 < count) await new Promise<void>((resolve) => setTimeout(resolve, 600));
    }
    const actual = api.snapshot().scene.pulseCount - before;
    return actual === count ? `Pulsed ${count} time(s).` : `Pulse count mismatch: ${actual}/${count}.`;
  }
  // First Hearing and Local Chat share this same exact-name route.
  // api.invoke is still the existing First Touch gate (AUTO or MANUAL ARM).
  const directHook = requestedScreenHook(text, hookNames);
  if (directHook) {
    const result = await api.invoke("screen.activate_hook", { name: directHook });
    return result.accepted && result.gate === "PASS"
      ? result.result
      : `Screen button ${directHook} was not clicked: ${result.result}`;
  }

  const memory = buildResidentMemoryPrompt(log);
  const tools = buildTools(hookNames);

  const data = await chat(text, memory, snapshot.scene, tools);
  const message = data.message;

  if (!message) {
    throw new Error("Ollama returned no Resident message.");
  }

  const calls = message.tool_calls ?? [];

  if (calls.length > 1) return "No action executed: the model returned multiple actions. Please request one action at a time.";

  if (calls.length === 0) {
    const natural = message.content?.trim();

    if (natural) return natural;

    return plainConversation(text, memory, snapshot.scene);
  }

  const selected = normalizeToolCall(calls[0]);

  if (!selected) {
    return "I understood that as an action, but I could not map the tool arguments cleanly.";
  }

  const available = new Set(
    api.listTools().map((tool) => tool.name),
  );

  if (!available.has(selected.tool)) {
    return `That capability is not attached right now: ${selected.tool}`;
  }

  if (selected.tool === "screen.activate_hook") {
    const wanted = selected.args.name?.trim() ?? "";

    const exists = hookNames.some(
      (name) =>
        name.toLocaleLowerCase() === wanted.toLocaleLowerCase(),
    );

    if (!wanted || !exists) {
      return `I do not have a saved screen target named ${wanted || "that"}.`;
    }
  }

  if (selected.tool === "chamber.toggle_lamp") {
    const request = text.toLowerCase().trim().replace(/[.!]+$/, "");
    const desired = request.match(/^(?:please\s+)?(?:turn|switch|set|keep)\s+(?:the\s+)?(?:lamp|light)\s+(on|off)(?:\s+please)?$/)
      ?? request.match(/^(?:please\s+)?(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(?:lamp|light)(?:\s+please)?$/);
    if (desired && api.snapshot().scene.lampOn === (desired[1] === "on")) {
      return `Lamp is already ${desired[1]}; no action needed.`;
    }
  }

  const outcome = await api.invoke(
    selected.tool,
    selected.args,
  );

  if (!outcome.accepted || outcome.gate !== "PASS") {
    return `I could not complete that: ${outcome.result}`;
  }

  // Only First Touch can report whether execution succeeded.
  return outcome.result;
}
