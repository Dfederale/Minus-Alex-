MINUS ALEX MCP TESTER - SAFE EDITION

1. Start Minus Alex using your EXISTING working starter.
2. Open the Minus Alex UI at http://127.0.0.1:4174 and keep it open.
3. Double-click OPEN-MCP-TESTER.cmd.
4. Type 'tools', 'health', or 'click test'.

Button names must match a saved mapped hook in the live UI.
To inspect live names, press F12 in the Minus Alex browser, select Console,
and paste:
window.REFLEX_AI?.snapshot().hooks.filter(h => h.mapped).map(h => h.name)

Then type 'click BUTTON NAME' in the tester.

This tester does NOT automatically discover hooks: the current standalone
MCP server has no read-only hooks endpoint. It does NOT change any existing
project files. Calls queue MCP proposals; First Touch decides execution.

The tester does not expose volume, brightness, Wi-Fi, or Bluetooth commands.
