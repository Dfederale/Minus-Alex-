import type { SceneState, SightId, Sighting } from "./types";
import { isPublishedTarget } from "./webmcp";

const ORDER: SightId[] = [
  "lamp",
  "slider",
  "inscription",
  "pulse",
  "wifi",
  "bluetooth",
  "volume",
  "brightness",
  "screen_hook",
];

const META: Record<SightId, { label: string; kind: Sighting["kind"] }> = {
  lamp: { label: "Lamp", kind: "control" },
  slider: { label: "Square rail", kind: "control" },
  inscription: { label: "Inscription plate", kind: "field" },
  pulse: { label: "Pulse actuator", kind: "actuator" },
  wifi: { label: "Wi-Fi", kind: "device" },
  bluetooth: { label: "Bluetooth", kind: "device" },
  volume: { label: "Volume", kind: "device" },
  brightness: { label: "Brightness", kind: "device" },
  screen_hook: { label: "Named screen button", kind: "hook" },
};

function liveState(id: SightId, scene: SceneState): string {
  switch (id) {
    case "lamp":
      return scene.lampOn ? "on" : "off";
    case "slider":
      return `x=${Math.round(scene.squareX)}`;
    case "inscription":
      return scene.inscription.length > 0 ? scene.inscription : "empty";
    case "pulse":
      return `count=${scene.pulseCount}`;
    case "wifi":
      return scene.wifiOn ? "on" : "off";
    case "bluetooth":
      return scene.bluetoothOn ? "on" : "off";
    case "volume":
      return `${scene.volume}%`;
    case "brightness":
      return `${scene.brightness}%`;
    case "screen_hook":
      return "configured";
  }
}

function toolNameFor(id: SightId): Sighting["toolName"] {
  switch (id) {
    case "lamp":
      return "chamber.toggle_lamp";
    case "slider":
      return "chamber.move_square";
    case "inscription":
      return "chamber.set_inscription";
    case "wifi":
      return "device.set_wifi";
    case "bluetooth":
      return "device.set_bluetooth";
    case "volume":
      return "device.set_volume";
    case "brightness":
      return "device.set_brightness";
    case "screen_hook":
      return "screen.activate_hook";
    case "pulse":
      return null;
  }
}

/**
 * First Sight — observes the visible chamber and names what is there.
 * Sight is not Touch: this module never mutates the page.
 */
export function observeChamber(root: HTMLElement | null, scene: SceneState): Sighting[] {
  if (!root) return [];
  const found = new Set<SightId>();
  root.querySelectorAll<HTMLElement>("[data-sight]").forEach((node) => {
    const id = node.dataset.sight as SightId | undefined;
    if (id && META[id]) found.add(id);
  });
  return ORDER.filter((id) => found.has(id)).map((id) => ({
    id,
    label: META[id].label,
    kind: META[id].kind,
    state: liveState(id, scene),
    published: isPublishedTarget(id),
    toolName: isPublishedTarget(id) ? toolNameFor(id) : null,
  }));
}

export function sightingById(sightings: Sighting[], id: SightId): Sighting | undefined {
  return sightings.find((item) => item.id === id);
}
