import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

type HearingStatus = "idle" | "listening" | "thinking" | "speaking" | "unavailable" | "error";

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = Event & {
  results?: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type HearingWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const hearingWindow = window as HearingWindow;
  return hearingWindow.SpeechRecognition ?? hearingWindow.webkitSpeechRecognition ?? null;
}

function cleanTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}


export function FirstHearing() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mountedRef = useRef(true);
  const conversationRef = useRef(false);
  const speakingRef = useRef(false);
  const speakRepliesRef = useRef(true);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<HearingStatus>("idle");
  const [lastHeard, setLastHeard] = useState("Nothing heard yet.");
  const [lastSpoken, setLastSpoken] = useState("Nothing spoken yet.");
  const [conversationMode, setConversationMode] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [errorText, setErrorText] = useState("");

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(getRecognitionCtor() && window.speechSynthesis && window.SpeechSynthesisUtterance);
  }, []);

  useEffect(() => {
    conversationRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    speakRepliesRef.current = speakReplies;
  }, [speakReplies]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback((abort = false) => {
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch {
      // The browser may already have ended the recognition session.
    }
  }, [clearRestartTimer]);

  const startListening: () => void = useCallback(() => {
    if (!supported || speakingRef.current) {
      if (!supported) setStatus("unavailable");
      return;
    }

    stopRecognition(true);
    setErrorText("");

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unavailable");
      return;
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (mountedRef.current) setStatus("listening");
    };

    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;
      const result = results[results.length - 1];
      const transcript = cleanTranscript(result?.[0]?.transcript ?? "");
      if (!transcript) return;

      setLastHeard(transcript);
      setStatus("thinking");
      stopRecognition(true);

      window.dispatchEvent(
        new CustomEvent("reflex:first-hearing", {
          detail: { text: transcript, source: "microphone" },
        }),
      );
    };

    recognition.onerror = (event) => {
      const error = event.error ?? event.message ?? "microphone recognition failed";
      if (error === "aborted") return;
      if (!mountedRef.current) return;
      const silenceRecovery = error === 'no-speech';
      if (silenceRecovery) {
        setErrorText('');
        setStatus('idle');
        if (conversationRef.current) {
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (mountedRef.current && conversationRef.current && recognitionRef.current === recognition && !speakingRef.current) startListening();
          }, 700);
        }
        return;
      }
      setErrorText(error);
      setStatus(error === "not-allowed" || error === "service-not-allowed" ? "unavailable" : "error");
    };

    recognition.onend = () => {
      if (!mountedRef.current || speakingRef.current) return;
      if (status === "listening") setStatus("idle");
    };

    try {
      recognition.start();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "could not start microphone recognition");
      setStatus("error");
    }
  }, [clearRestartTimer, status, stopRecognition, supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !speakRepliesRef.current) {
      if (conversationRef.current) {
        restartTimerRef.current = setTimeout(() => startListening(), 450);
      } else {
        setStatus("idle");
      }
      return;
    }

    const cleaned = text.trim();
    if (!cleaned) return;

    stopRecognition(true);
    window.speechSynthesis.cancel();
    speakingRef.current = true;
    setStatus("speaking");
    setLastSpoken(cleaned);
    window.dispatchEvent(new CustomEvent("reflex:speech-start"));

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const finish = () => {
      speakingRef.current = false;
      window.dispatchEvent(new CustomEvent("reflex:speech-end"));
      if (!mountedRef.current) return;
      setStatus("idle");
      if (conversationRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => startListening(), 550);
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }, [clearRestartTimer, startListening, stopRecognition, supported]);

  useEffect(() => {
    function onResidentReply(event: Event) {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      speak(text);
    }

    function onResidentOffline() {
      setStatus("idle");
    }

    window.addEventListener("reflex:resident-reply", onResidentReply as EventListener);
    window.addEventListener("reflex:resident-offline", onResidentOffline);
    return () => {
      window.removeEventListener("reflex:resident-reply", onResidentReply as EventListener);
      window.removeEventListener("reflex:resident-offline", onResidentOffline);
    };
  }, [speak]);

  useEffect(() => {
    mountedRef.current = true;
    if (!supported) setStatus("unavailable");
    return () => {
      mountedRef.current = false;
      clearRestartTimer();
      stopRecognition(true);
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [clearRestartTimer, stopRecognition, supported]);

  function toggleConversationMode() {
    const next = !conversationMode;
    setConversationMode(next);
    conversationRef.current = next;
    if (next && !speakingRef.current) startListening();
    if (!next) {
      stopRecognition(true);
      if (!speakingRef.current) setStatus("idle");
    }
  }

  function stopAll() {
    setConversationMode(false);
    conversationRef.current = false;
    clearRestartTimer();
    stopRecognition(true);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setStatus("idle");
  }

  const statusTone = status === "listening" ? "LISTENING" : status === "speaking" ? "SPEAKING" : status === "thinking" ? "THINKING" : status === "unavailable" ? "UNAVAILABLE" : status === "error" ? "ERROR" : "READY";

  return (
    <section className="reflex-panel panel-cyan flex min-h-0 flex-col p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">First Hearing</h2>
          <p className="mt-0.5 text-xs text-muted">ARM and AUTO modes available</p>
        </div>
        <Badge tone={status === "error" || status === "unavailable" ? "warn" : "pass"}>{statusTone}</Badge>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={startListening}
          disabled={!supported || status === "listening" || status === "speaking" || conversationMode}
          className="rounded-md border border-cyan/40 bg-cyan/10 px-3 py-2 font-mono text-2xs uppercase tracking-wide text-foreground transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Listen once
        </button>
        <button
          type="button"
          onClick={toggleConversationMode}
          disabled={!supported}
          className={
            conversationMode
              ? "rounded-md border border-success/50 bg-success/10 px-3 py-2 font-mono text-2xs uppercase tracking-wide text-foreground"
              : "rounded-md border border-line bg-black/20 px-3 py-2 font-mono text-2xs uppercase tracking-wide text-foreground transition hover:bg-white/5 disabled:opacity-40"
          }
        >
          Conversation {conversationMode ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={stopAll}
          className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 font-mono text-2xs uppercase tracking-wide text-foreground transition hover:bg-danger/10"
        >
          Stop voice
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-inset p-3">
          <p className="font-mono text-2xs uppercase tracking-wide text-subtle">Last heard</p>
          <p className="mt-1 text-xs text-muted">{lastHeard}</p>
        </div>
        <div className="rounded-md border border-line bg-inset p-3">
          <p className="font-mono text-2xs uppercase tracking-wide text-subtle">Last spoken</p>
          <p className="mt-1 line-clamp-3 text-xs text-muted">{lastSpoken}</p>
        </div>
      </div>

      <label className="mt-3 hidden items-center justify-between gap-3 rounded-md border border-line bg-black/20 px-3 py-2">
        <span>
          <span className="block text-xs text-foreground">Speak Resident replies</span>
          <span className="block font-mono text-2xs text-subtle">speech output only · no execution authority</span>
        </span>
        <input
          type="checkbox"
          checked={speakReplies}
          onChange={(event) => setSpeakReplies(event.target.checked)}
          className="h-4 w-4 accent-cyan-400"
        />
      </label>

      {errorText ? <p className="mt-2 font-mono text-2xs text-warning">{errorText}</p> : null}
      {!supported ? (
        <p className="mt-2 font-mono text-2xs text-warning">
          Browser speech recognition is unavailable here. Typed Resident conversation still works.
        </p>
      ) : null}

      <p className="mt-3 font-mono text-2xs text-subtle">
        Voice commands use the available tools through First Touch. AUTO ARM executes automatically after safety checks. MANUAL ARM holds actions pending until Pass or Cancel pending. Hearing pauses while Minus Alex speaks so it does not answer itself.
      </p>
    </section>
  );
}
