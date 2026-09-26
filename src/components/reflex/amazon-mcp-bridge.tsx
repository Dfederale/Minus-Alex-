import { useEffect, useRef } from "react";
import { useReflexStore } from "@/store/reflex-store";
import type { ToolArgs, WebMcpToolName } from "@/lib/reflex/types";

type AmazonProposal = {
  id: string;
  name: WebMcpToolName;
  args: ToolArgs;
};

const BRIDGE = "http://127.0.0.1:8787";

export function AmazonMcpBridge() {
  const invokeTool = useReflexStore((s) => s.invokeTool);
  const busy = useReflexStore((s) => s.busy);
  const pending = useReflexStore((s) => s.pending);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled || busy || pending) return;

      try {
        const response = await fetch(`${BRIDGE}/reflex/proposals`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { proposals?: AmazonProposal[] };
        const proposal = data.proposals?.find((item) => !seen.current.has(item.id));
        if (!proposal) return;

        seen.current.add(proposal.id);
        invokeTool(proposal.name, proposal.args ?? {});

        await fetch(`${BRIDGE}/reflex/proposals/${proposal.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveredTo: "First Touch",
            status: "DELIVERED_TO_FIRST_TOUCH",
          }),
        });
      } catch {
        // Amazon MCP remains optional during ordinary local REFLEX use.
      }
    }

    const timer = window.setInterval(poll, 500);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busy, pending, invokeTool]);

  return null;
}
