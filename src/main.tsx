import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/reflex/app-shell";
import { ensureModelContext } from "@/lib/reflex/webmcp-polyfill";
import { clearPersistedReflexState, installStatePersistence } from "@/lib/reflex/state-persistence";
import "./styles.css";

ensureModelContext();

if (new URLSearchParams(window.location.search).get("fresh") === "1") {
  clearPersistedReflexState();
  window.history.replaceState({}, "", window.location.pathname);
}

installStatePersistence();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
