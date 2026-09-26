import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  appendResidentMessage,
  captureResidentSnapshot,
  clearResidentMemory,
  getResidentMemoryCounts,
  getResidentMessages,
} from "@/lib/reflex/resident-memory";
import { useReflexStore } from "@/store/reflex-store";
import { runResidentTurn } from "@/lib/reflex/resident-core";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function initialMessages(): ChatMessage[] {
  const saved = getResidentMessages();
  if (saved.length === 0) {
    return [
      {
        id: "hello",
        role: "assistant",
        text: "I can observe the chamber and request actions through First Touch.",
      },
    ];
  }
  return saved.slice(-8).map((message) => ({
    id: message.id,
    role: message.role === "human" ? "user" : "assistant",
    text: message.text,
  }));
}

export function LocalChat() {
  const scene = useReflexStore((s) => s.scene);
  const route = useReflexStore((s) => s.route);
  const pending = useReflexStore((s) => s.pending);
  const lastVerdict = useReflexStore((s) => s.lastVerdict);
  const hooks = useReflexStore((s) => s.hooks);
  const log = useReflexStore((s) => s.log);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [memoryEpoch, setMemoryEpoch] = useState(0);

  const sceneLine = useMemo(
    () =>
      `lamp ${scene.lampOn ? "on" : "off"}  |  square ${Math.round(scene.squareX)}  |  pulse ${scene.pulseCount}`,
    [scene.lampOn, scene.squareX, scene.pulseCount],
  );

  const memoryCounts = useMemo(
    () => getResidentMemoryCounts(log),
    [log, messages, memoryEpoch],
  );

  function snapshot(note: string) {
    const { scene, route, pending, lastVerdict, hooks } = useReflexStore.getState();
    captureResidentSnapshot({
      note,
      scene,
      route,
      pending: pending
        ? { intent: pending.intent, target: pending.target, channel: pending.channel }
        : null,
      lastVerdict,
      hooks,
    });
  }

  async function sendText(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) return;

    snapshot(`Before human message: ${text.slice(0, 80)}`);
    const storedAfterHuman = appendResidentMessage("human", text);
    const userMessage: ChatMessage = {
      id: storedAfterHuman.at(-1)?.id ?? crypto.randomUUID(),
      role: "user",
      text,
    };

    const nextMessages = [...messages, userMessage].slice(-8);
    setMessages(nextMessages);
    setBusy(true);
    setMemoryEpoch((value) => value + 1);

    try {
      const finalReply = await runResidentTurn(text, log);
      const stored = appendResidentMessage("resident", finalReply);
      snapshot(`After Resident reply to: ${text.slice(0, 80)}`);
      setMessages(
        stored.slice(-8).map((message) => ({
          id: message.id,
          role: message.role === "human" ? "user" : "assistant",
          text: message.text,
        })),
      );
      setMemoryEpoch((value) => value + 1);
      window.dispatchEvent(new CustomEvent("reflex:resident-reply", { detail: { text: finalReply } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local chat unavailable.";
      const offlineText = `Resident error: ${message}`;
      const stored = appendResidentMessage("resident", offlineText);
      setMessages(
        stored.slice(-8).map((item) => ({
          id: item.id,
          role: item.role === "human" ? "user" : "assistant",
          text: item.text,
        })),
      );
      setMemoryEpoch((value) => value + 1);
      window.dispatchEvent(new CustomEvent("reflex:resident-offline", { detail: { text: offlineText } }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onFirstHearing(event: Event) {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      void sendText(text);
    }

    window.addEventListener("reflex:first-hearing", onFirstHearing as EventListener);
    return () => window.removeEventListener("reflex:first-hearing", onFirstHearing as EventListener);
  });

  function clearMemory() {
    clearResidentMemory();
    setMessages([
      {
        id: "hello-reset",
        role: "assistant",
        text: "Memory cleared. I can observe the chamber and request actions through First Touch.",
      },
    ]);
    setMemoryEpoch((value) => value + 1);
  }

  return (
    <section className="reflex-panel panel-violet observer-panel flex min-h-0 flex-col p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Resident</h2>
          <p className="mt-0.5 font-mono text-2xs text-muted">{sceneLine}</p>
          <p className="mt-1 font-mono text-2xs text-subtle">
            memory  |  working {memoryCounts.workingMessages}/12  |  events {memoryCounts.events}/8  |  continuity {memoryCounts.snapshots}/8
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearMemory}
            className="rounded-md border border-line bg-black/20 px-2 py-1 font-mono text-2xs uppercase tracking-wide text-subtle transition hover:text-foreground"
          >
            Clear memory
          </button>
          <Badge tone="accent">3 layers</Badge>
        </div>
      </header>

      <div className="max-h-40 min-h-28 space-y-2 overflow-y-auto rounded-md border border-line bg-inset p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-md border border-line bg-elevated px-3 py-2 text-xs text-fg"
                : "mr-5 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted"
            }
          >
            <span className="mr-2 font-mono text-2xs uppercase tracking-wide text-subtle">
              {message.role === "user" ? "you" : "resident"}
            </span>
            {message.text}
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          void sendText(text);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask what it sees or remembers..."
          aria-label="Resident chat message"
          className="min-w-0 flex-1 rounded-md border border-line bg-black/20 px-3 py-2 font-mono text-xs text-foreground outline-none"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-md border border-line bg-black/20 px-3 py-2 font-mono text-2xs uppercase tracking-wide text-foreground transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "Ask"}
        </button>
      </form>

      <p className="mt-2 font-mono text-2xs text-subtle">
        Conversation and action requests share this panel. Actions pass through First Touch.
      </p>
    </section>
  );
}
