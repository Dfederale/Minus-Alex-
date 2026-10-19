import readline from 'node:readline';

const BASE = 'http://127.0.0.1:8787';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'YOU > ' });
let nextId = 1;
async function get(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function rpc(method, params = {}) {
  const r = await fetch(BASE + '/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Mcp-Protocol-Version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}
async function call(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  for (const item of result?.content ?? []) if (item.type === 'text') console.log(item.text);
  if (result?.isError) console.log('Action rejected by MCP.');
  if (result?.structuredContent?.status) console.log('Status:', result.structuredContent.status);
}
function help() {
  console.log(`\nCommands:
  health              Check MCP server
  tools               List MCP tools
  pending             Show proposals waiting for First Touch
  click BUTTON NAME   Queue a mapped screen button by its exact name
  hooks               Explain how to inspect live button names
  lamp                Queue lamp toggle
  left / right        Queue chamber square move
  inscription TEXT    Queue chamber inscription
  help                Show commands
  exit                Close tester

No device volume, brightness, Wi-Fi or Bluetooth commands are enabled here.
All actions are proposals. First Touch owns execution.\n`);
}
console.log('\nMINUS ALEX | MCP TESTER (SAFE)\nMCP: ' + BASE + '/mcp');
help();
try {
  const h = await get('/health');
  console.log(`MCP ONLINE | ${h.toolCount} tools | ${h.pending} pending`);
} catch (e) {
  console.log('MCP is not responding:', e.message);
  console.log('Start your existing Minus Alex starter first.');
}
rl.prompt();
rl.on('line', async line => {
  const input = line.trim();
  if (!input) { rl.prompt(); return; }
  try {
    if (/^(exit|quit)$/i.test(input)) { rl.close(); return; }
    if (/^help$/i.test(input)) help();
    else if (/^health$/i.test(input)) console.log(JSON.stringify(await get('/health'), null, 2));
    else if (/^tools$/i.test(input)) {
      const result = await rpc('tools/list');
      for (const t of result.tools ?? []) console.log(`  ${t.name} - ${t.description}`);
    } else if (/^pending$/i.test(input)) console.log(JSON.stringify(await get('/reflex/proposals'), null, 2));
    else if (/^hooks$/i.test(input)) {
      console.log('In the open Minus Alex browser page, press F12, open Console, and enter:');
      console.log('window.REFLEX_AI?.snapshot().hooks.filter(h => h.mapped).map(h => h.name)');
      console.log('Then use: click EXACT BUTTON NAME');
    } else if (/^(?:click|press|tap|activate)\s+(.+)$/i.test(input)) {
      const name = input.match(/^(?:click|press|tap|activate)\s+(.+)$/i)[1].trim();
      if (!name || name.length > 64) console.log('Button name must be 1 to 64 characters.');
      else await call('screen.activate_hook', { name });
    } else if (/^lamp$/i.test(input)) await call('chamber.toggle_lamp', {});
    else if (/^(left|right)$/i.test(input)) await call('chamber.move_square', { direction: input.toLowerCase() });
    else if (/^inscription\s+(.+)$/i.test(input)) await call('chamber.set_inscription', { text: input.slice(12).trim().slice(0,18) });
    else console.log('Unknown command. Type help. No action taken.');
  } catch (e) { console.log('ERROR:', e.message); }
  rl.prompt();
});
rl.on('close', () => console.log('Tester closed.'));
