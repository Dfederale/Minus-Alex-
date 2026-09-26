# Minus Alex

**Digital Intelligence Neuromorphic Systems (DINS)**  
**Local-first voice, vision and desktop interaction demo for the Amazon Alexa+ / MCP contest.**

> The agent may propose. First Touch decides.

Minus Alex brings together First Hearing, First Sight, First Touch, a local Resident and an MCP bridge. The demo accepts typed or spoken instructions, recognizes explicitly saved on-screen targets and routes proposed actions through a visible execution boundary. It is designed to demonstrate these components working together on modest hardware rather than requiring a large hosted AI service for every interaction.

The underlying application and source directories retain some historical **REFLEX** identifiers. Those internal names are intentional; the presented application is **Minus Alex**.

## What this build demonstrates

- **First Hearing:** browser microphone input, one-shot listening and Conversation mode. Spoken instructions reach the Resident, and spoken replies pause recognition to reduce self-listening. Conversation mode can recover from ordinary `no-speech` events.
- **Local Resident:** Ollama with `qwen2.5:0.5b`, recent conversation, First Touch events and compact continuity snapshots. Explicit commands for several demonstrated actions have direct routing; other conversation uses the local model.
- **First Sight:** contest panels for Words, Objects and Faces, plus the Screen Map for capturing and naming real on-screen targets.
- **Dual-screen Screen Map:** choose a physical monitor, preview or capture it, draw named button regions, move or resize them, and save or load maps. The tested build supports mapped clicks on both the primary and second monitor.
- **Bonded windows:** bond a desktop window to its captured preview and saved screen perspective, then target its mapped buttons. Native geometry is supplied by the local Screen Bridge.
- **First Touch:** one visible execution boundary for proposed actions. **AUTO ARM** executes eligible actions after its checks; **MANUAL ARM** holds a proposal until **Pass** or **Cancel pending**. Unresolved or rejected actions do not become native clicks.
- **Voice-to-touch:** explicit spoken commands such as `click <saved button name>` can resolve a named mapped target and request its click through First Touch. Typing works too.
- **Native device controls:** Wi-Fi, Bluetooth, volume and brightness on the Windows host through the localhost bridge, subject to hardware support and permissions.
- **Chamber playground:** lamp, moving square, inscription and pulse actuator, with visible outcomes and an event log.

This is a local Windows-oriented contest/demo build. Actual screen interaction requires its native Screen Bridge and user-granted permissions. Browser speech recognition support varies by browser and environment; typed Resident conversation remains available.

## Architecture

```text
Alexa+ / MCP -----------\
Typed input ------------+--> Resident / action proposal --> First Touch --> action or blocked
First Hearing ----------/                                  |
First Sight --> named Screen Map hooks --------------------+
                                                           |
                                                           +--> Chamber / host device controls
                                                           +--> localhost Screen Bridge --> native click
```

**Sight is not Touch. Capability is not permission. Understanding is not execution.**

The Resident may use saved hook names, but it is not taught to bypass First Touch with raw clicks. **AUTO ARM and MANUAL ARM are different execution policies**, not different sets of permissions for the microphone.

## Requirements

- Windows machine for the native Screen Bridge and host device controls.
- Node.js and npm compatible with the locked dependencies in `package-lock.json`.
- A supported desktop browser; First Hearing requires browser speech recognition and speech synthesis.
- Optional for local Resident conversation: [Ollama](https://ollama.com/) with the model `qwen2.5:0.5b` available locally.
- Administrator approval for the one-time native bridge setup where required.

The GitHub repository does **not** include `node_modules`, Ollama model files, runtime data, local state or repair archives.

## Start on Windows

From a fresh checkout, install the project dependencies:

```cmd
npm.cmd ci
```

If you want the local Resident, start Ollama and make the expected model available:

```cmd
ollama pull qwen2.5:0.5b
```

For native screen and host controls, run the one-time bridge setup as Administrator, following `INSTALL.md`:

```powershell
.\scripts\setup-native-bridge.ps1
```

Then use the supplied launchers:

```text
START-REFLEX.cmd
START-AMAZON-MCP.cmd
```

The internal launcher name `START-REFLEX.cmd` is retained for compatibility. A separate `START-SCREEN-BRIDGE.cmd` is available if needed by your setup.

| Local service | Address |
| --- | --- |
| Minus Alex UI | `http://127.0.0.1:4174/` |
| Amazon MCP | `http://127.0.0.1:8787/mcp` |
| Screen Bridge health | `http://127.0.0.1:8790/health` |
| Ollama, when installed | `http://127.0.0.1:11434/` |

To verify the frontend production bundle:

```cmd
npm.cmd run build
```

## Available tool routes

The application tool registry includes these action names. Availability to a particular connected MCP client depends on the bridge and its advertised tools.

| Tool | Requested action |
| --- | --- |
| `chamber.toggle_lamp` | Toggle the lamp |
| `chamber.move_square` | Move the square left or right |
| `chamber.set_inscription` | Change the inscription |
| `chamber.pulse` | Activate the pulse actuator |
| `device.set_wifi` | Set host Wi-Fi on/off |
| `device.set_bluetooth` | Set host Bluetooth on/off |
| `device.set_volume` | Set host volume, 0-100 |
| `device.set_brightness` | Set host brightness, 0-100 |
| `screen.activate_hook` | Request one explicitly saved named screen target |

Only an eligible, accepted action proceeds through the selected First Touch mode. Native capabilities depend on the local Windows machine and bridge.

## Mapping and voice control

Choose the physical screen or bond a window in **Screen Map**. Preview or capture its content, draw a box over a visible button and save a meaningful name. The map records normalized geometry and native bounds where available. You can move, resize, rename, remove and save or load target maps.

For example, a saved screen target called `Submit` can be invoked by typing or saying `click Submit`. Explicit saved-name commands take the direct hook route; a missing or ambiguous target must not be replaced with an arbitrary click. With AUTO ARM selected, eligible proposals can execute after checks; MANUAL ARM holds the proposal for review.

Do not use a mapping to approve security dialogs or perform irreversible actions without reviewing the selected target and execution mode. Native clicks act on the real Windows desktop.

## Project boundaries

This repository is a selected contest/demo build, not the complete original WhisperShell research archive. The original project history, private experiments, other organs and large local dependencies are not included. We will document research origins and acknowledgements separately without exposing unrelated private work.

No license is included yet. Repository visibility alone does not grant permission to reuse or redistribute its code.

## More information

- `INSTALL.md` for setup details.
- `AMAZON-MCP-README.md` for the MCP bridge.
- `ARCHITECTURE-AND-SAFETY.md` for execution boundaries.
