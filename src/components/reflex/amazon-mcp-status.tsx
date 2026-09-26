import { useEffect, useState } from "react";

const HEALTH_URL = "http://127.0.0.1:8787/health";

type BridgeState = "checking" | "online" | "offline";

export function AmazonMcpStatus() {
  const [state, setState] = useState<BridgeState>("checking");
  const [toolCount, setToolCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(HEALTH_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("offline");
        const data = (await response.json()) as { toolCount?: number };
        if (!cancelled) {
          setState("online");
          setToolCount(typeof data.toolCount === "number" ? data.toolCount : null);
        }
      } catch {
        if (!cancelled) {
          setState("offline");
          setToolCount(null);
        }
      }
    };
    void check();
    const timer = window.setInterval(check, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const label = state === "online" ? "ONLINE" : state === "offline" ? "OFFLINE" : "CHECKING";

  return (
    <section className="amazon-uplink reflex-panel panel-cyan">
      <div className="amazon-uplink__identity">
        <span className={`amazon-uplink__dot amazon-uplink__dot--${state}`} aria-hidden />
        <div>
          <p className="amazon-uplink__kicker">Amazon Alexa+ / MCP</p>
          <h2>DINS Amazon Bridge</h2>
        </div>
      </div>

      <div className="amazon-uplink__route">
        <span>ALEXA+ / MCP</span>
        <b>→</b>
        <span>FIRST TOUCH</span>
        <b>→</b>
        <span>ACTION</span>
      </div>

      <div className="amazon-uplink__endpoint">
        <span>MCP // 127.0.0.1:8787/mcp</span>
        <strong className={`amazon-uplink__state amazon-uplink__state--${state}`}>
          {label}{state === "online" && toolCount ? ` · ${toolCount} TOOLS` : ""}
        </strong>
      </div>
    </section>
  );
}
