# DINS REFLEX — Amazon MCP

REFLEX exposes a localhost MCP server for the Amazon Alexa+ contest:

```text
http://127.0.0.1:8787/mcp
```

Protocol version:

```text
2025-11-25
```

The MCP server publishes **eight tools**. Calls do not directly mutate REFLEX or click the desktop. They queue a proposal and First Touch decides PASS or HALT.

```text
Alexa+ / MCP → proposal → First Touch → PASS / HALT
```

Published tools:

```text
chamber.toggle_lamp
chamber.move_square
chamber.set_inscription
device.set_wifi
device.set_bluetooth
device.set_volume
device.set_brightness
screen.activate_hook
```

The four `device.*` tools operate on the host laptop through the localhost native bridge. They remain available regardless of what is visible in Screen Map, and First Touch must PASS before execution.

`screen.activate_hook` resolves only a name that was explicitly mapped in First Sight. An executable mapping must come from an **Entire Screen** capture. It becomes a MANUAL First Touch proposal and, after PASS, the local Screen Bridge sends one left click to that saved screen position.

Run:

```text
START-REFLEX.cmd
START-AMAZON-MCP.cmd
```

Health:

```text
http://127.0.0.1:8787/health
http://127.0.0.1:8790/health
```
