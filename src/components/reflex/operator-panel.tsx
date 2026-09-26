import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VOICE_EXAMPLES } from "@/lib/reflex/delta-voice";
import { listWebMcpTools } from "@/lib/reflex/webmcp";
import { cn } from "@/lib/utils";
import { useReflexStore } from "@/store/reflex-store";
import type { RouteTab } from "@/lib/reflex/types";

const TABS: { id: RouteTab; label: string; hint: string }[] = [
  { id: "structured", label: "Structured", hint: "WebMCP tools" },
  { id: "visual", label: "Visual", hint: "First Sight" },
  { id: "voice", label: "Voice", hint: "Delta Voice" },
];

export function OperatorPanel() {
  const route = useReflexStore((s) => s.route);
  const setRoute = useReflexStore((s) => s.setRoute);

  return (
    <section className="reflex-panel panel-cyan route-panel flex flex-col p-4">
      <header className="mb-3">
        <h2 className="text-sm font-medium tracking-tight">Routes</h2>
        <p className="mt-0.5 text-sm text-muted">Structured, visual, and voice routes share one execution boundary.</p>
      </header>

      <div className="mb-4 flex rounded-md border border-line bg-inset p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRoute(tab.id)}
            className={cn(
              "h-10 flex-1 rounded-sm px-2 text-xs font-medium transition-colors duration-[var(--motion-quick)]",
              route === tab.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            <span className="block leading-tight">{tab.label}</span>
            <span className="hidden font-mono text-2xs text-subtle sm:block">{tab.hint}</span>
          </button>
        ))}
      </div>

      {route === "structured" && <StructuredRoute />}
      {route === "visual" && <VisualRoute />}
      {route === "voice" && <VoiceRoute />}
    </section>
  );
}

function StructuredRoute() {
  const invokeTool = useReflexStore((s) => s.invokeTool);
  const busy = useReflexStore((s) => s.busy);
  const [text, setText] = useState("HELLO");
  const tools = listWebMcpTools().filter((tool) => tool.name.startsWith("chamber."));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Here you can use structured MCP tools to move the square, toggle the lamp, and set the inscription.</p>
      {tools.map((tool) => (
        <article key={tool.name} className="rounded-md border border-line bg-inset p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-mono text-xs text-fg">{tool.name}</h3>
            <Badge>webmcp</Badge>
          </div>
          {tool.name === "chamber.move_square" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => invokeTool(tool.name, { direction: "left" })}
              >
                Left
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => invokeTool(tool.name, { direction: "right" })}
              >
                Right
              </Button>
            </div>
          )}
          {(tool.name === "chamber.toggle_lamp" || tool.name === "chamber.pulse") && (
            <Button
              className="mt-2 w-full"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => invokeTool(tool.name)}
            >
              Call tool
            </Button>
          )}
          {tool.name === "chamber.set_inscription" && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                invokeTool(tool.name, { text });
              }}
            >
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={18}
                aria-label="Inscription text"
              />
              <Button variant="secondary" size="sm" disabled={busy || !text.trim()} type="submit">
                Call
              </Button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}

function VisualRoute() {
  const observe = useReflexStore((s) => s.observe);
  const overlayOn = useReflexStore((s) => s.overlayOn);
  const toggleOverlay = useReflexStore((s) => s.toggleOverlay);
  const sightings = useReflexStore((s) => s.sightings);
  const regions = useReflexStore((s) => s.regions);
  const activateSight = useReflexStore((s) => s.activateSight);
  const busy = useReflexStore((s) => s.busy);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Here you can use structured MCP tools to move the square, toggle the lamp, and set the inscription.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => observe()}>
          Observe
        </Button>
        <Button variant="secondary" disabled={!overlayOn} onClick={() => toggleOverlay(false)}>
          Stop map
        </Button>
      </div>
      {sightings.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-muted">
          No observation yet. Run First Sight.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sightings.map((item) => {
            const region = regions.find((entry) => entry.id === item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => activateSight(item.id)}
                  className="flex w-full flex-col rounded-md border border-line bg-inset p-3 text-left transition-colors duration-[var(--motion-quick)] hover:border-line-strong disabled:opacity-40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.published && <Badge tone="neutral">webmcp</Badge>}
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-2xs text-muted">
                    <span>
                      {item.kind} · {item.state}
                    </span>
                    <span>
                      {region ? `${Math.round(region.cx)}, ${Math.round(region.cy)}` : "unmapped"}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function VoiceRoute() {
  const speak = useReflexStore((s) => s.speak);
  const listening = useReflexStore((s) => s.listening);
  const setListening = useReflexStore((s) => s.setListening);
  const busy = useReflexStore((s) => s.busy);
  const [draft, setDraft] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechCtor()));
  }, []);

  function stopRec() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function toggleMic() {
    if (listening) {
      stopRec();
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setDraft(transcript);
        speak(transcript);
      }
    };
    rec.onerror = () => stopRec();
    rec.onend = () => stopRec();
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Here you can use structured MCP tools to move the square, toggle the lamp, and set the inscription.</p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() || busy) return;
          speak(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Speak or type a command"
          aria-label="Voice command"
        />
        {supported && (
          <Button
            variant="secondary"
            size="icon"
            aria-label={listening ? "Stop listening" : "Start listening"}
            onClick={toggleMic}
            type="button"
          >
            {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={busy || !draft.trim()}>
          Send
        </Button>
      </form>
      {!supported && (
        <p className="text-xs text-subtle">
          Live mic is unavailable here. Type a command or use a phrase below.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {VOICE_EXAMPLES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(phrase);
              speak(phrase);
            }}
            className="rounded-sm border border-line bg-inset px-2.5 py-2 text-left text-xs text-muted transition-colors duration-[var(--motion-quick)] hover:border-line-strong hover:text-fg disabled:opacity-40"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}
