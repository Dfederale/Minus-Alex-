import type { ActionProposal, GateDecision } from "./types";

export type GateVerdict = {
  decision: Exclude<GateDecision, "PENDING">;
  reason: string;
};

/**
 * First Touch — the sole execution boundary.
 * Nothing clicks, types, or otherwise affects the chamber until this module
 * returns PASS. WebMCP capability is not permission. Sight is not Touch.
 */
export function evaluateProposal(proposal: ActionProposal): GateVerdict {
  if (!proposal.action) {
    return {
      decision: "UNRESOLVED",
      reason: proposal.unresolvedReason ?? "no executable action",
    };
  }
  if (proposal.channel === "UNRESOLVED") {
    return { decision: "UNRESOLVED", reason: "unresolved route" };
  }
  if (proposal.channel === "VISUAL" && !proposal.coordinates) {
    return {
      decision: "UNRESOLVED",
      reason: "visual route requires mapped coordinates",
    };
  }
  return { decision: "PASS", reason: "proposal is armed and complete" };
}

export function describeAction(proposal: ActionProposal): string {
  const action = proposal.action;
  if (!action) return "none";
  switch (action.type) {
    case "move_square":
      return `move square ${action.direction}`;
    case "toggle_lamp":
      return "toggle lamp";
    case "set_inscription":
      return `inscribe "${action.text}"`;
    case "pulse":
      return "strike pulse actuator";
    case "set_wifi":
      return `Wi-Fi ${action.enabled ? "on" : "off"}`;
    case "set_bluetooth":
      return `Bluetooth ${action.enabled ? "on" : "off"}`;
    case "set_volume":
      return `set volume to ${Math.round(action.value)}%`;
    case "set_brightness":
      return `set brightness to ${Math.round(action.value)}%`;
    case "screen_click":
      return `click mapped screen button "${action.name}" at ${action.x}, ${action.y}`;
  }
}
