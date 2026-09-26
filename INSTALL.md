# REFLEX — install

Standalone Vite app for the DINS REFLEX contest build.

## Windows (PowerShell or cmd)

```bat
cd REFLEX
npm install
npm run typecheck
npm run dev
```

Use `START-REFLEX.cmd` for the contest run. It opens `http://127.0.0.1:4174/`, starts Ollama when available, and checks the local model automatically.

Chrome native WebMCP (optional): `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. Without the flag, the in-page polyfill still registers the same three tools on `document.modelContext`.

## macOS / Linux

```sh
cd REFLEX
npm install
npm run typecheck
npm run dev
```

## Production build (any static host)

```bat
npm run build
```

Upload the `dist` folder.

Then run the three checks in `VERIFY.md`.
