import type { ExecutableAction, SightId } from "./types";

export type ParsedIntent =
  | {
      ok: true;
      action: ExecutableAction;
      target: SightId;
      prefersVisual: boolean;
      label: string;
    }
  | {
      ok: false;
      reason: string;
      label: string;
    };

function extractInscription(text: string): string | null {
  const match = text.match(
    /(?:write|inscribe|type|fill|set(?:\s+(?:the\s+)?(?:text|inscription|field))?(?:\s+to)?)\s+["']?(.+?)["']?\s*$/i,
  );
  if (!match?.[1]) return null;
  return match[1].trim().replace(/[.!]+$/, "");
}

/**
 * Delta Voice — spoken (or typed) intent → structured command.
 * Understanding an action is not executing it.
 */
export function parseUtterance(raw: string): ParsedIntent {
  const label = raw.trim();
  const text = label.toLowerCase();
  if (!text) return { ok: false, reason: "empty utterance", label };

  if (
    /\b(pulse|beacon|actuator)\b/.test(text) ||
    (/\b(press|hit|push|click|tap|activate)\b/.test(text) &&
      /\b(unmarked|unlisted|hidden|round|stamp|unpublished)\b/.test(text))
  ) {
    return {
      ok: true,
      action: { type: "pulse" },
      target: "pulse",
      prefersVisual: true,
      label,
    };
  }

  const inscription = extractInscription(text);
  if (inscription) {
    return {
      ok: true,
      action: { type: "set_inscription", text: inscription },
      target: "inscription",
      prefersVisual: false,
      label,
    };
  }

  const wantsLeft = /\b(left|west|back)\b/.test(text);
  const wantsRight = /\b(right|east|forward)\b/.test(text);
  const mentionsSquare = /\b(square|block|tile|slider|rail|slide)\b/.test(text);
  if ((wantsLeft || wantsRight) && (mentionsSquare || /^(go|move|slide)\s+(left|right)$/.test(text))) {
    return {
      ok: true,
      action: { type: "move_square", direction: wantsLeft ? "left" : "right" },
      target: "slider",
      prefersVisual: false,
      label,
    };
  }
  if (wantsLeft && !wantsRight) {
    return {
      ok: true,
      action: { type: "move_square", direction: "left" },
      target: "slider",
      prefersVisual: false,
      label,
    };
  }
  if (wantsRight && !wantsLeft) {
    return {
      ok: true,
      action: { type: "move_square", direction: "right" },
      target: "slider",
      prefersVisual: false,
      label,
    };
  }

  if (/\b(lamp|light|filament|glow)\b/.test(text) || /\b(toggle|switch)\b/.test(text)) {
    return {
      ok: true,
      action: { type: "toggle_lamp" },
      target: "lamp",
      prefersVisual: false,
      label,
    };
  }

  return {
    ok: false,
    reason: "intent did not resolve to a chamber action",
    label,
  };
}

export const VOICE_EXAMPLES = [
  "move the square left",
  "slide the square right",
  "toggle the lamp",
  "inscribe REFLEX",
  "press the pulse actuator",
] as const;
