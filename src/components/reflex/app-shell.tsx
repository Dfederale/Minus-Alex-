import { ActionToast } from "./action-toast";
import { AiBridge } from "./ai-bridge";
import { AmazonMcpBridge } from "./amazon-mcp-bridge";
import { AmazonMcpStatus } from "./amazon-mcp-status";
import { Chamber } from "./chamber";
import { DeviceDeck } from "./device-deck";
import { EventLog } from "./event-log";
import { FirstTouchGate } from "./first-touch-gate";
import { FirstHearing } from "./first-hearing";
import { LocalChat } from "./local-chat";
import { OperatorPanel } from "./operator-panel";
import { Pipeline } from "./pipeline";
import { ScreenMap } from "./screen-map";
import { SightDeck } from "./sight-deck";
import { WebMcpHost } from "./webmcp-host";

export function AppShell() {
  return (
    <main className="reflex-shell mx-auto flex min-h-dvh max-w-[1500px] flex-col gap-4 px-4 py-5 pb-20 sm:px-6 sm:py-7 sm:pb-24">
      <WebMcpHost />
      <AmazonMcpBridge />
      <ActionToast />

      <header className="dins-hero">
        <div className="dins-brand">
          <div className="dins-mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="min-w-0">
            <p className="dins-kicker">Digital Intelligence Neuromorphic Systems</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h1 className="dins-title">Minus Alex</h1>
              <span className="dins-unit">Amazon Alexa+ / MCP contest unit</span>
            </div>
            <p className="dins-subtitle">
              Give the agent something to see and something to try. First Touch decides what actually happens.
            </p>
          </div>
        </div>

        <div className="dins-principles" aria-label="REFLEX principles">
          <span>SIGHT IS NOT TOUCH</span>
          <span>CAPABILITY IS NOT PERMISSION</span>
          <span>UNDERSTANDING IS NOT EXECUTION</span>
        </div>
      </header>

      <AmazonMcpStatus />
      <AiBridge />
      <Pipeline />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(22rem,0.78fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Chamber />
          <SightDeck />
          <DeviceDeck />
          <ScreenMap />
        </div>
        <div className="flex flex-col gap-4">
          <FirstTouchGate />
          <OperatorPanel />
          <FirstHearing />
          <LocalChat />
        </div>
      </div>

      <EventLog />
    </main>
  );
}
