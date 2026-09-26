/**
 * Installs document.modelContext when the browser has no native WebMCP.
 * Matches the 26 Aug 2026 Community Group draft enough for discovery + invoke:
 * registerTool / getTools / executeTool + toolchange.
 * Native Chromium wins when present. Pulse is never registered.
 */

export type WebMcpExecuteResult = unknown;

export type WebMcpToolDescriptor = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<WebMcpExecuteResult>;
};

export type RegisteredTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: string;
};

export type ModelContextLike = {
  registerTool: (
    tool: WebMcpToolDescriptor,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => Promise<void>;
  getTools: (options?: { fromOrigins?: string[] }) => Promise<RegisteredTool[]>;
  executeTool: (
    tool: RegisteredTool | string,
    input?: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
  addEventListener: EventTarget["addEventListener"];
  removeEventListener: EventTarget["removeEventListener"];
};

class ModelContextPolyfill extends EventTarget implements ModelContextLike {
  #tools = new Map<string, WebMcpToolDescriptor>();

  async registerTool(
    tool: WebMcpToolDescriptor,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    if (!tool?.name || !tool.description || typeof tool.execute !== "function") {
      throw new Error("Invalid WebMCP tool descriptor");
    }
    if (this.#tools.has(tool.name)) {
      throw new Error(`WebMCP tool already registered: ${tool.name}`);
    }
    this.#tools.set(tool.name, tool);
    options.signal?.addEventListener("abort", () => {
      this.#tools.delete(tool.name);
      this.dispatchEvent(new Event("toolchange"));
    });
    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(): Promise<RegisteredTool[]> {
    return [...this.#tools.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: JSON.stringify(tool.inputSchema ?? { type: "object", properties: {} }),
      }));
  }

  async executeTool(
    tool: RegisteredTool | string,
    input: Record<string, unknown> = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<string> {
    const name = typeof tool === "string" ? tool : tool.name;
    const entry = this.#tools.get(name);
    if (!entry) throw new Error(`Unknown WebMCP tool: ${name}`);
    const result = await entry.execute(input ?? {}, { signal: options.signal });
    return JSON.stringify(result);
  }
}

export type WebMcpHostKind = "native" | "polyfill";

export function ensureModelContext(): { kind: WebMcpHostKind; context: ModelContextLike } {
  const holder = document as Document & { modelContext?: ModelContextLike };
  if (holder.modelContext && typeof holder.modelContext.registerTool === "function") {
    return { kind: "native", context: holder.modelContext };
  }
  const polyfill = new ModelContextPolyfill();
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    enumerable: true,
    value: polyfill,
  });
  const nav = navigator as Navigator & { modelContext?: ModelContextLike };
  if (!nav.modelContext) {
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      enumerable: true,
      value: polyfill,
    });
  }
  return { kind: "polyfill", context: polyfill };
}

export function getModelContext(): ModelContextLike | null {
  const holder = document as Document & { modelContext?: ModelContextLike };
  return holder.modelContext ?? null;
}
