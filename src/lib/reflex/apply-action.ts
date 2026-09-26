import type { ExecutableAction, SceneState } from "./types";

const STEP = 22;
const MIN_X = 8;
const MAX_X = 92;
const INSCRIPTION_MAX = 18;

export function clampInscription(text: string): string {
  return text
    .trim()
    .slice(0, INSCRIPTION_MAX)
    .toUpperCase();
}

export function applyAction(scene: SceneState, action: Exclude<ExecutableAction, { type: "screen_click" }>): {
  scene: SceneState;
  result: string;
} {
  switch (action.type) {
    case "move_square": {
      const next =
        action.direction === "left"
          ? Math.max(MIN_X, scene.squareX - STEP)
          : Math.min(MAX_X, scene.squareX + STEP);
      if (next === scene.squareX) {
        return { scene, result: `square already at ${action.direction} stop` };
      }
      return {
        scene: { ...scene, squareX: next },
        result: `square ${scene.squareX} → ${next}`,
      };
    }
    case "toggle_lamp": {
      const lampOn = !scene.lampOn;
      return {
        scene: { ...scene, lampOn },
        result: `lamp ${lampOn ? "on" : "off"}`,
      };
    }
    case "set_inscription": {
      const inscription = clampInscription(action.text);
      return {
        scene: { ...scene, inscription },
        result: inscription ? `inscription "${inscription}"` : "inscription cleared",
      };
    }
    case "pulse": {
      const pulseCount = scene.pulseCount + 1;
      return {
        scene: { ...scene, pulseCount },
        result: `pulse #${pulseCount}`,
      };
    }
    case "set_wifi": {
      return {
        scene: { ...scene, wifiOn: action.enabled },
        result: `Wi-Fi ${action.enabled ? "ON" : "OFF"}`,
      };
    }
    case "set_bluetooth": {
      return {
        scene: { ...scene, bluetoothOn: action.enabled },
        result: `Bluetooth ${action.enabled ? "ON" : "OFF"}`,
      };
    }
    case "set_volume": {
      const volume = Math.min(100, Math.max(0, Math.round(action.value)));
      return {
        scene: { ...scene, volume },
        result: `Volume ${volume}%`,
      };
    }
    case "set_brightness": {
      const brightness = Math.min(100, Math.max(0, Math.round(action.value)));
      return {
        scene: { ...scene, brightness },
        result: `Brightness ${brightness}%`,
      };
    }
  }
}

export const INITIAL_SCENE: SceneState = {
  squareX: 50,
  lampOn: false,
  inscription: "",
  pulseCount: 0,
  wifiOn: true,
  bluetoothOn: false,
  volume: 50,
  brightness: 75,
};
