# DINS REFLEX

**Digital Intelligence Neuromorphic Systems**

REFLEX is a compact agent playground with one visible rule:

> **The agent may propose. First Touch decides.**

The Amazon contest path is deliberately easy to read:

```text
Alexa+ / MCP → First Touch → PASS / HALT → Action / Blocked
```

## What is in this build

- **Amazon Alexa+ / MCP** on `http://127.0.0.1:8787/mcp`
- **Resident playground** using local Ollama / `qwen2.5:0.5b`
- **First Hearing:** microphone → Resident conversation, with optional spoken Resident replies
- **First Sight contest view:** Words, Objects, Faces, and named screen buttons
- **Screen Map:** link an entire screen, keep a live preview or capture a frozen frame, draw a real visible button, then move, resize, rename, delete, save/load its map, and keep normalized geometry
- **First Touch:** mapped screen clicks and agent/device actions still stop at PASS / HALT
- **Native host controls:** Wi-Fi, Bluetooth, Volume, and Brightness through the localhost bridge
- **Visible result popups and event log** so action consequences return to the visible field

The four device controls operate on the **host laptop**. Resident requests still pass through First Touch before the localhost native bridge executes them.

The Screen Map is a separate path. It maps a button that actually appears on a captured display and, after First Touch PASS, can send a left click to that saved screen position through a tiny localhost-only bridge.

## Start

Double-click:

```text
START-REFLEX.cmd
START-AMAZON-MCP.cmd
```

`START-REFLEX.cmd` starts the registered elevated Screen Bridge task on port `8790` when needed. Run `scripts\setup-native-bridge.ps1` once as Administrator on each machine or after moving the project.

REFLEX UI:

```text
http://127.0.0.1:4174/
```

Amazon MCP:

```text
http://127.0.0.1:8787/mcp
```

Screen Bridge health:

```text
http://127.0.0.1:8790/health
```

## Published MCP tools

| Tool | What it proposes |
|---|---|
| `chamber.toggle_lamp` | toggle lamp |
| `chamber.move_square` | move square left/right |
| `chamber.set_inscription` | set inscription text |
| `device.set_wifi` | set host Wi-Fi on/off |
| `device.set_bluetooth` | set host Bluetooth on/off |
| `device.set_volume` | set host volume 0-100 |
| `device.set_brightness` | set host brightness 0-100 |
| `screen.activate_hook` | activate one explicitly mapped named screen button |

## First Sight Screen Map

The contest build keeps the richer First Sight architecture deliberately small:

```text
LINK SCREEN → LIVE / CAPTURE FRAME → DRAW → MOVE / RESIZE / RENAME → SAVE MAP → FIRST TOUCH
```

A mapped button stores its normalized center and box size together with the captured source dimensions and creation metadata. Existing boxes can be dragged to move, resized from four corner handles, renamed, deleted, and saved/loaded as a stable First Sight map. The Resident sees the name rather than being taught raw click coordinates.

For an actual host click, map from **Entire Screen** in the browser share picker. A window or tab can still be previewed and mapped, but REFLEX will not execute that mapping because browser capture does not expose the operating-system window origin needed to translate it safely to desktop coordinates.

Real screen clicks are left-click-only and are forced through **MANUAL First Touch**. PASS sends the click through the localhost bridge. HALT sends nothing.

## Native device controls and Screen Map are separate

```text
Native controls: device.set_wifi / bluetooth / volume / brightness
Screen hand: captured real button → named screen hook → First Touch → native left click
```

This separation is intentional. A Wi-Fi tool does not require a Wi-Fi button to be visible on screen, and drawing a screen box does not secretly bind it to one of the native device controls.

## Principle

```text
Sight is not Touch.
Capability is not permission.
Understanding is not execution.
```

## Resident three-layer memory

The contest Resident keeps a deliberately small local memory stack: recent conversation, recent First Touch events, and compact continuity snapshots of the REFLEX state. The memory survives a browser refresh through localStorage, while execution remains separate: remembered context can shape a proposal, but First Touch still owns PASS or HALT.


## First Hearing and speech

The public voice path is deliberately small:

```text
human voice → First Hearing → Resident + 3-layer memory → speech out
```

First Hearing is conversation input only. It does not call MCP tools, does not PASS/HALT First Touch, and does not activate mapped screen buttons. When REFLEX speaks, microphone recognition is stopped before playback and may resume afterward in Conversation mode, preventing a simple self-listening loop. Typed Resident conversation remains available when browser speech recognition is unavailable.
