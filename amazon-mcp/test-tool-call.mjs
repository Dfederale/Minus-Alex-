const MCP = "http://127.0.0.1:8787/mcp";

async function rpc(id, method, params) {
  const response = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Mcp-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

try {
  const init = await rpc(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "dins-reflex-test", version: "0.1.0" },
  });
  console.log(`[OK] MCP initialized: ${init.result?.protocolVersion ?? "unknown"}`);

  const result = await rpc(2, "tools/call", {
    name: "chamber.toggle_lamp",
    arguments: {},
  });

  if (result.error) throw new Error(result.error.message || "MCP error");
  const status = result.result?.structuredContent?.status;
  const proposalId = result.result?.structuredContent?.proposalId;
  if (status !== "PENDING_FIRST_TOUCH" || !proposalId) {
    throw new Error(`Unexpected response: ${JSON.stringify(result)}`);
  }

  console.log(`[PASS] Amazon MCP queued proposal: ${proposalId}`);
  console.log(`[PASS] Status: ${status}`);
  console.log("[PASS] No chamber action was executed by MCP.");
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
