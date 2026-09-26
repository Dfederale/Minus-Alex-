export type InputSource = "agent" | "voice" | "visual";

export type Channel = "WEBMCP" | "VISUAL" | "UNRESOLVED";

export type GateDecision = "PENDING" | "PASS" | "UNRESOLVED" | "ERROR";

export type ExecutableAction =
  | { type: "move_square"; direction: "left" | "right" }
  | { type: "toggle_lamp" }
  | { type: "set_inscription"; text: string }
  | { type: "pulse" }
  | { type: "set_wifi"; enabled: boolean }
  | { type: "set_bluetooth"; enabled: boolean }
  | { type: "set_volume"; value: number }
  | { type: "set_brightness"; value: number }
  | { type: "screen_click"; x: number; y: number; name: string };

export type SceneState = {
  squareX: number;
  lampOn: boolean;
  inscription: string;
  pulseCount: number;
  wifiOn: boolean;
  bluetoothOn: boolean;
  volume: number;
  brightness: number;
};

export type WebMcpToolName =
  | "chamber.move_square"
  | "chamber.toggle_lamp"
  | "chamber.set_inscription"
  | "chamber.pulse"
  | "device.set_wifi"
  | "device.set_bluetooth"
  | "device.set_volume"
  | "device.set_brightness"
  | "screen.activate_hook";

export type ToolArgs = {
  direction?: "left" | "right";
  text?: string;
  enabled?: boolean;
  value?: number;
  name?: string;
};

export type WebMcpTool = {
  name: WebMcpToolName;
  title: string;
  description: string;
  target: SightId;
  inputSchema: Record<string, unknown>;
};

export type SightId =
  | "lamp"
  | "slider"
  | "inscription"
  | "pulse"
  | "wifi"
  | "bluetooth"
  | "volume"
  | "brightness"
  | "screen_hook";

export type Sighting = {
  id: SightId;
  label: string;
  kind: "control" | "field" | "actuator" | "device" | "hook";
  state: string;
  published: boolean;
  toolName: WebMcpToolName | null;
};

export type GenesisRegion = {
  id: SightId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

/** Legacy field kept only so Payload 12 hooks still deserialize safely. */
export type HookBinding =
  | { tool: "chamber.toggle_lamp"; args: Record<string, never> }
  | { tool: "device.set_wifi"; args: { enabled: boolean } }
  | { tool: "device.set_bluetooth"; args: { enabled: boolean } }
  | { tool: "device.set_volume"; args: { value: number } };

export type ScreenHook = {
  id: string;
  name: string;
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  displaySurface?: string;
  nativeBounds?: { left: number; top: number; width: number; height: number };
  previewMapped?: boolean;
  binding: HookBinding | null;
  createdAt: number;
};

export type ActionProposal = {
  id: string;
  source: InputSource;
  intent: string;
  target: SightId | "—";
  channel: Channel;
  method: string;
  coordinates: { x: number; y: number } | null;
  action: ExecutableAction | null;
  unresolvedReason?: string;
};

export type LogEntry = {
  id: string;
  ts: number;
  source: InputSource | "gate";
  intent: string;
  target: string;
  method: string;
  channel: Channel;
  coordinates: string;
  gate: GateDecision;
  result: string;
};

export type ProbePhase = "idle" | "travel" | "strike";

export type ProbeState = {
  x: number;
  y: number;
  phase: ProbePhase;
};

export type NoticeState = {
  id: string;
  text: string;
};

export type ArmingMode = "auto" | "manual";

export type RouteTab = "structured" | "visual" | "voice";
