import http from "node:http";
import { randomUUID } from "node:crypto";

const HOST = process.env.REFLEX_MCP_HOST || "127.0.0.1";
const PORT = Number(process.env.REFLEX_MCP_PORT || 8787);
const PROTOCOL_VERSION = "2025-11-25";

const tools = [
  {
    name: "chamber.move_square",
    title: "Move REFLEX square",
    description: "Propose moving the REFLEX chamber square. First Touch must authorize execution.",
    inputSchema: { type: "object", properties: { direction: { type: "string", enum: ["left", "right"] } }, required: ["direction"], additionalProperties: false },
  },
  {
    name: "chamber.toggle_lamp",
    title: "Toggle REFLEX lamp",
    description: "Propose toggling the REFLEX chamber lamp. First Touch must authorize execution.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "chamber.set_inscription",
    title: "Set REFLEX inscription",
    description: "Propose text for the REFLEX inscription plate. First Touch must authorize execution.",
    inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1, maxLength: 18 } }, required: ["text"], additionalProperties: false },
  },
  {
    name: "device.set_wifi",
    title: "Set host Wi-Fi",
    description: "Set the host Wi-Fi on or off through REFLEX. First Touch must PASS before the native bridge executes it.",
    inputSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"], additionalProperties: false },
  },
  {
    name: "device.set_bluetooth",
    title: "Set host Bluetooth",
    description: "Set the host Bluetooth on or off through REFLEX. First Touch must PASS before the native bridge executes it.",
    inputSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"], additionalProperties: false },
  },
  {
    name: "device.set_volume",
    title: "Set host volume",
    description: "Set the host volume from 0 to 100 through REFLEX. First Touch must PASS before the native bridge executes it.",
    inputSchema: { type: "object", properties: { value: { type: "number", minimum: 0, maximum: 100 } }, required: ["value"], additionalProperties: false },
  },
  {
    name: "device.set_brightness",
    title: "Set host brightness",
    description: "Set the host brightness from 0 to 100 through REFLEX. First Touch must PASS before the native bridge executes it.",
    inputSchema: { type: "object", properties: { value: { type: "number", minimum: 0, maximum: 100 } }, required: ["value"], additionalProperties: false },
  },
  {
    name: "screen.activate_hook",
    title: "Activate named screen hook",
    description: "Request one explicitly mapped screen button. First Touch must authorize before the local click bridge receives it.",
    inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 64 } }, required: ["name"], additionalProperties: false },
  },
];

const pending = [];
const completed = new Map();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4174");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Protocol-Version");
}
function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function rpc(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }
async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function validToolCall(name, args) {
  if (name === "chamber.toggle_lamp") return {};
  if (name === "chamber.move_square" && (args?.direction === "left" || args?.direction === "right")) {
    return { direction: args.direction };
  }
  if (name === "chamber.set_inscription" && typeof args?.text === "string" && args.text.trim()) {
    return { text: args.text.trim().slice(0, 18) };
  }
  if ((name === "device.set_wifi" || name === "device.set_bluetooth") && typeof args?.enabled === "boolean") {
    return { enabled: args.enabled };
  }
  if ((name === "device.set_volume" || name === "device.set_brightness") && typeof args?.value === "number" && Number.isFinite(args.value)) {
    return { value: Math.min(100, Math.max(0, args.value)) };
  }
  if (name === "screen.activate_hook" && typeof args?.name === "string" && args.name.trim()) {
    return { name: args.name.trim().slice(0, 64) };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        service: "DINS REFLEX Amazon MCP",
        protocolVersion: PROTOCOL_VERSION,
        toolCount: tools.length,
        pending: pending.length,
      });
    }
    if (req.method === "GET" && url.pathname === "/reflex/proposals") {
      return json(res, 200, { proposals: pending });
    }
    if (req.method === "POST" && url.pathname.startsWith("/reflex/proposals/") && url.pathname.endsWith("/complete")) {
      const id = url.pathname.split("/")[3];
      const body = await readJson(req);
      const index = pending.findIndex((p) => p.id === id);
      if (index >= 0) pending.splice(index, 1);
      completed.set(id, { ...body, completedAt: Date.now() });
      return json(res, 200, { ok: true, id });
    }
    if (req.method !== "POST" || url.pathname !== "/mcp") {
      return json(res, 404, { error: "not found" });
    }

    const body = await readJson(req);
    const { id, method, params } = body;
    if (method === "notifications/initialized") {
      cors(res);
      res.writeHead(202);
      return res.end();
    }
    if (method === "initialize") {
      return json(res, 200, rpc(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "dins-reflex-amazon", version: "0.3.0" },
        instructions: "Hello my friend. Welcome to Digital Intelligence Neuromorphic Systems. You are in our Amazon contest REFLEX build. We have some harmless goodies for you to try. Feel free to test the available tools and maybe wow the judges. Have fun. Tool calls are proposals; First Touch executes in AUTO or waits for PASS in MANUAL.",
      }));
    }
    if (method === "tools/list") return json(res, 200, rpc(id, { tools }));
    if (method === "tools/call") {
      const name = params?.name;
      const args = validToolCall(name, params?.arguments ?? {});
      if (!args) {
        return json(res, 200, rpc(id, {
          isError: true,
          content: [{ type: "text", text: "Invalid or incomplete REFLEX tool arguments." }],
        }));
      }
      const proposal = { id: randomUUID(), name, args, source: "amazon-mcp", createdAt: Date.now() };
      pending.push(proposal);
      return json(res, 200, rpc(id, {
        content: [{ type: "text", text: `Proposal ${proposal.id} queued for REFLEX First Touch. No demo state has changed yet.` }],
        structuredContent: { proposalId: proposal.id, status: "PENDING_FIRST_TOUCH" },
      }));
    }
    return json(res, 200, rpcError(id, -32601, `Method not found: ${method}`));
  } catch (error) {
    return json(res, 500, rpcError(null, -32603, error instanceof Error ? error.message : "internal error"));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[DINS] Amazon MCP listening at http://${HOST}:${PORT}/mcp`);
  console.log(`[DINS] REFLEX bridge health: http://${HOST}:${PORT}/health`);
  console.log(`[DINS] ${tools.length} tools published. Calls queue proposals only; First Touch still owns execution.`);
});
