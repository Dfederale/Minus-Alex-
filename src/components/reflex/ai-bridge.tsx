import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { listWebMcpTools } from "@/lib/reflex/webmcp";
import { buildResidentMemoryPrompt, captureResidentSnapshot } from "@/lib/reflex/resident-memory";
import { runResidentTurn } from "@/lib/reflex/resident-core";
import type { WebMcpInvokeOutcome } from "@/lib/reflex/webmcp";
import type {
  ArmingMode,
  SceneState,
  ScreenHook,
  ToolArgs,
  WebMcpToolName,
} from "@/lib/reflex/types";
import { useReflexStore } from "@/store/reflex-store";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "qwen2.5:0.5b";

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

type ModelDecision = {
  tool?: string | null;
  args?: {
    direction?: string;
    text?: string;
    enabled?: boolean;
    value?: number;
    name?: string;
  };
  reason?: string;
};

type ReflexAiApi = {
  version: "0.3.3";
  model: {
    provider: "ollama";
    baseUrl: string;
    name: string;
  };
  ask: (prompt: string) => Promise<string>;
  listTools: () => ReturnType<typeof listWebMcpTools>;
  snapshot: () => {
    scene: SceneState;
    hooks: Array<{ name: string; mapped: boolean }>;
    arming: ArmingMode;
    busy: boolean;
    pending: {
      intent: string;
      target: string;
      channel: string;
    } | null;
  };
  invoke: (name: WebMcpToolName, args?: ToolArgs) => Promise<WebMcpInvokeOutcome>;
};

declare global {
  interface Window {
    REFLEX_AI?: ReflexAiApi;
  }
}

async function askOllama(prompt: string): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    // Keep the request simple so local Ollama does not need a CORS preflight.
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (data.error) throw new Error(data.error);
  if (typeof data.response !== "string") {
    throw new Error("Ollama returned no text response.");
  }
  return data.response;
}

function desiredLampState(intent: string): boolean | null {
  const text = intent.toLowerCase().replace(/\s+/g, " ").trim();
  const mentionsLamp = /\b(lamp|light)\b/.test(text);
  if (!mentionsLamp) return null;

  const wantsOn =
    /\b(turn|switch|set|keep|hold)\s+(the\s+)?(lamp|light)\s+on\b/.test(text) ||
    /\bturn\s+on\s+(the\s+)?(lamp|light)\b/.test(text) ||
    /\bswitch\s+on\s+(the\s+)?(lamp|light)\b/.test(text);
  const wantsOff =
    /\b(turn|switch|set|keep|hold)\s+(the\s+)?(lamp|light)\s+off\b/.test(text) ||
    /\bturn\s+off\s+(the\s+)?(lamp|light)\b/.test(text) ||
    /\bswitch\s+off\s+(the\s+)?(lamp|light)\b/.test(text);

  if (wantsOn && !wantsOff) return true;
  if (wantsOff && !wantsOn) return false;
  return null;
}

function buildDecisionPrompt(intent: string, scene: SceneState, hooks: ScreenHook[], memory: string): string {
  const hookNames = hooks
    .filter((hook) => hook.displaySurface === "monitor" || hook.displaySurface === "screen")
    .map((hook) => hook.name);
  return [
    "Hello my friend. Welcome to Digital Intelligence Neuromorphic Systems.",
    "You are in our Amazon contest REFLEX build. We have a few harmless things for you to try.",
    "You are free to use the available capabilities and maybe wow the judges a little.",
    "Have fun. Choose the capability that best matches the human intent. First Touch executes the Resident-selected capability.",
    "",
    "Choose ONE published tool that best matches the human intent.",
    "Allowed tools:",
    '1. chamber.toggle_lamp with args {}',
    '2. chamber.move_square with args {"direction":"left"} or {"direction":"right"}',
    '3. chamber.set_inscription with args {"text":"..."}',
    '4. device.set_wifi with args {"enabled":true|false}',
    '5. device.set_bluetooth with args {"enabled":true|false}',
    '6. device.set_volume with args {"value":0..100}',
    '7. device.set_brightness with args {"value":0..100}',
    `8. screen.activate_hook with args {"name":"saved hook"}. Saved executable screen buttons: ${JSON.stringify(hookNames)}`,
    "",
    "Return JSON only using exactly this shape:",
    '{"tool":"tool name","args":{},"reason":"short reason"}',
    "",
    "Never invent a tool or hook name.",
    "Return only the selected capability JSON.",
    "Do not invent execution results. First Touch reports the real result.",
    "",
    memory,
    "",
    `Current scene: ${JSON.stringify(scene)}`,
    `Human intent: ${intent}`,
  ].join("\n");
}

function validateDecision(decision: ModelDecision, hooks: ScreenHook[]): {
  tool: WebMcpToolName;
  args: ToolArgs;
  reason: string;
} {
  const reason =
    typeof decision.reason === "string" && decision.reason.trim()
      ? decision.reason.trim()
      : "Local model selected this published tool.";

  if (decision.tool === "chamber.toggle_lamp") {
    return { tool: "chamber.toggle_lamp", args: {}, reason };
  }

  if (decision.tool === "chamber.move_square") {
    const direction = decision.args?.direction;
    if (direction !== "left" && direction !== "right") {
      throw new Error("Model chose move_square without a valid left/right direction.");
    }
    return { tool: "chamber.move_square", args: { direction }, reason };
  }

  if (decision.tool === "chamber.set_inscription") {
    const text = decision.args?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Model chose set_inscription without text.");
    }
    return { tool: "chamber.set_inscription", args: { text: text.slice(0, 120) }, reason };
  }

  if (decision.tool === "device.set_wifi" || decision.tool === "device.set_bluetooth") {
    if (typeof decision.args?.enabled !== "boolean") {
      throw new Error(`${decision.tool} requires enabled=true or false.`);
    }
    return { tool: decision.tool, args: { enabled: decision.args.enabled }, reason };
  }

  if (decision.tool === "device.set_volume" || decision.tool === "device.set_brightness") {
    const value = decision.args?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${decision.tool} requires a numeric value.`);
    }
    return { tool: decision.tool, args: { value: Math.min(100, Math.max(0, value)) }, reason };
  }

  if (decision.tool === "screen.activate_hook") {
    const name = decision.args?.name?.trim();
    if (!name) throw new Error("screen.activate_hook requires a saved hook name.");
    const exists = hooks.some(
      (hook) =>
        (hook.displaySurface === "monitor" || hook.displaySurface === "screen") &&
        hook.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (!exists) throw new Error(`Model chose unknown or non-screen hook: ${name}`);
    return { tool: "screen.activate_hook", args: { name }, reason };
  }

  throw new Error(`Model returned an unpublished tool: ${String(decision.tool ?? "none")}`);
}

export function AiBridge() {
  const invokeFromAgent = useReflexStore((s) => s.invokeFromAgent);

  const [bridgeReady, setBridgeReady] = useState(false);
  const [ollamaState, setOllamaState] = useState<"checking" | "online" | "offline">("checking");
  const [intent, setIntent] = useState("Turn the lamp on.");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Ready for one local-agent proposal.");

  useEffect(() => {
    const api: ReflexAiApi = {
      version: "0.3.3",
      model: {
        provider: "ollama",
        baseUrl: OLLAMA_BASE_URL,
        name: OLLAMA_MODEL,
      },
      ask: (prompt) => askOllama(prompt),
      listTools: () => listWebMcpTools(),
      snapshot: () => {
        const state = useReflexStore.getState();
        return {
          scene: state.scene,
          hooks: state.hooks.map((hook) => ({
            name: hook.name,
            mapped: hook.displaySurface === "monitor" || hook.displaySurface === "screen",
          })),
          arming: state.arming,
          busy: state.busy,
          pending: state.pending
            ? {
                intent: state.pending.intent,
                target: state.pending.target,
                channel: state.pending.channel,
              }
            : null,
        };
      },
      invoke: (name, args = {}) => invokeFromAgent(name, args),
    };

    window.REFLEX_AI = api;
    setBridgeReady(true);
    console.info("[REFLEX] AI bridge ready on window.REFLEX_AI");

    return () => {
      if (window.REFLEX_AI === api) delete window.REFLEX_AI;
    };
  }, [invokeFromAgent]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function probeOllama() {
      if (!cancelled) setOllamaState((current) => (current === "online" ? current : "checking"));
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);

        const data = (await response.json()) as OllamaTagsResponse;
        const modelFound = (data.models ?? []).some(
          (entry) =>
            entry.name === OLLAMA_MODEL ||
            entry.model === OLLAMA_MODEL ||
            entry.name?.startsWith(`${OLLAMA_MODEL}:`) ||
            entry.model?.startsWith(`${OLLAMA_MODEL}:`),
        );
        if (!modelFound) throw new Error(`${OLLAMA_MODEL} is not installed.`);
        if (!cancelled) setOllamaState("online");
      } catch (error) {
        console.warn("[REFLEX] Ollama probe failed:", error);
        if (!cancelled) {
          setOllamaState("offline");
          timer = setTimeout(() => void probeOllama(), 2500);
        }
      }
    }

    void probeOllama();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function runLocalAgent() {
    const cleanIntent = intent.trim();
    if (!cleanIntent || agentBusy || ollamaState !== "online") return;

    setAgentBusy(true);
    setAgentStatus("Resident is acting through the live REFLEX tool path...");

    try {
      const state = useReflexStore.getState();
      const result = await runResidentTurn(cleanIntent, state.log);
      setAgentStatus(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Resident error.";
      console.error("[REFLEX] Resident playground failed:", error);
      setAgentStatus(`Stopped safely: ${message}`);
    } finally {
      setAgentBusy(false);
    }
  }

  const online = bridgeReady && ollamaState === "online";
  let bridgeMessage = "Checking local Ollama. First Touch still owns execution.";
  if (ollamaState === "online") {
    bridgeMessage = `Ollama connected: ${OLLAMA_MODEL}. Give it something to try.`;
  } else if (ollamaState === "offline") {
    bridgeMessage = "AI doorway ready, but Ollama is offline. REFLEX still works without it.";
  }

  return (
    <section className="reflex-panel panel-violet ai-console px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Resident playground</p>
          <p className="mt-0.5 text-xs text-muted">{bridgeMessage}</p>
        </div>
        <Badge tone={online ? "pass" : "warn"}>
          {ollamaState === "checking" ? "checking" : online ? "local AI online" : "offline"}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void runLocalAgent();
          }}
          disabled={!online || agentBusy}
          aria-label="Local AI intent"
          className="min-w-0 rounded-md border border-line bg-black/20 px-3 py-2 font-mono text-xs text-foreground outline-none disabled:opacity-50"
          placeholder="Tell the Resident what to try..."
        />
        <button
          type="button"
          onClick={() => void runLocalAgent()}
          disabled={!online || agentBusy || !intent.trim()}
          className="rounded-md border border-line bg-black/20 px-4 py-2 font-mono text-xs uppercase tracking-wide text-foreground transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {agentBusy ? "Thinking..." : "Try it"}
        </button>
      </div>

      <p className="mt-2 font-mono text-2xs leading-relaxed text-muted">{agentStatus}</p>
    </section>
  );
}
