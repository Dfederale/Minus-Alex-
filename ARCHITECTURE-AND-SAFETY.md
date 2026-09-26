# REFLEX Architecture

REFLEX keeps one execution boundary visible:

```text
AGENT / SIGHT / VOICE / SCREEN MAP
                ↓
            FIRST TOUCH
            PASS | HALT
                ↓
              ACTION
```

The Amazon route is:

```text
Alexa+ / MCP → REFLEX proposal → First Touch → action only after PASS
```

## Contest First Sight

The public contest build exposes a deliberately small sensory surface:

```text
WORDS + OBJECTS + FACES + NAMED SCREEN BUTTONS
```

Screen Map can link a shared display, show it live, or freeze a captured frame. A user drags a rectangle around a real onscreen button and gives it a name. REFLEX stores normalized geometry and source dimensions. The model operates on the name; coordinate resolution stays inside the execution path.

Only mappings made from an **Entire Screen** capture may become host clicks. Browser window/tab capture lacks the operating-system origin required to translate its internal coordinates to desktop coordinates, so those mappings remain non-executable.

## Native host controls

The contest exposes bounded native host controls for:

```text
Wi-Fi ON / OFF
Bluetooth ON / OFF
Volume 0–100
Brightness 0–100
```

These are real host operating-system controls. They remain named tools even when no corresponding control is visible in Screen Map, and First Touch must PASS before execution.

## Native Screen Bridge

Actual mapped screen clicking is a separate path:

```text
captured real button → named hook → First Touch → PASS → localhost Screen Bridge → one left click
```

The bridge binds to `127.0.0.1:8790`, exposes health, bounded device-control endpoints, and the mapped left-click endpoint. REFLEX calls execution only after First Touch PASS. Real screen hooks force MANUAL arm so a mapped host click cannot auto-pass.

HALT sends no click.

## Result popups

After native actions, REFLEX shows the result back on screen. This closes a small visible perception loop:

```text
proposal → First Touch → action → visible result → First Sight
```

## Core principle

```text
Sight is not Touch.
Capability is not permission.
Understanding is not execution.
```


## Public conversation path

```text
Human / Alexa voice
        ↓
   First Hearing
        ↓
Resident + 3-layer memory
   ↙             ↘
speech out      First Sight
                   ↓
              First Touch
                   ↓
                 Screen
```

The contest voice layer is deliberately narrow. First Hearing publishes a human utterance into Resident conversation. Simple speech output speaks the Resident reply. Neither path owns execution authority. Tool proposals still use the existing agent path and real actions still stop at First Touch. Speech playback stops microphone recognition before audio is emitted, so REFLEX does not immediately re-transcribe its own voice.
