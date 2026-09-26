import { useEffect } from "react";
import { registerChamberTools } from "@/lib/reflex/webmcp";
import { useReflexStore } from "@/store/reflex-store";

/**
 * Registers chamber tools on document.modelContext after mount.
 * execute() only submits a First Touch proposal.
 */
export function WebMcpHost() {
  const invokeFromAgent = useReflexStore((s) => s.invokeFromAgent);
  const setWebmcpKind = useReflexStore((s) => s.setWebmcpKind);

  useEffect(() => {
    let cancelled = false;
    registerChamberTools(invokeFromAgent)
      .then((result) => {
        if (!cancelled) setWebmcpKind(result.kind);
      })
      .catch((error) => {
        console.warn("[REFLEX] WebMCP registration failed", error);
        if (!cancelled) setWebmcpKind("off");
      });
    return () => {
      cancelled = true;
    };
  }, [invokeFromAgent, setWebmcpKind]);

  return null;
}
