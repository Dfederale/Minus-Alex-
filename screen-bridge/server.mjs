import http from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.REFLEX_SCREEN_BRIDGE_PORT || 8790);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLICK_SCRIPT = path.join(__dirname, "click.ps1");
const DEVICE_SCRIPT = path.join(__dirname, "device.ps1");
const WINDOW_SCRIPT = path.join(__dirname, "window.ps1");
const WINDOW_CAPTURE_SCRIPT = path.join(__dirname, "window-capture.ps1");
const WINDOWS_SCRIPT = path.join(__dirname, "windows.ps1");
let bondedWindow = null;
const MONITORS_SCRIPT = path.join(__dirname, "monitors.ps1");

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin === "http://127.0.0.1:4174" || origin === "http://localhost:4174") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(req, res, status, body) {
  cors(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function finiteInt(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function runClick(x, y) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", CLICK_SCRIPT, String(x), String(y)],
      { windowsHide: true, timeout: 7000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "native click failed").trim()));
          return;
        }
        resolve((stdout || "").trim());
      },
    );
  });
}

function runDevice(action, value) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        DEVICE_SCRIPT,
        "-Action",
        action,
        "-Value",
        String(value),
      ],
      { windowsHide: true, timeout: 15000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "native device action failed").trim()));
          return;
        }
        resolve((stdout || "").trim());
      },
    );
  });
}

function runWindow(delayMs = 4000, hwnd = 0, action = "query") {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOW_SCRIPT,
        "-DelayMs",
        String(delayMs),
        "-Hwnd",
        String(hwnd),
        "-Action",
        String(action),
      ],
      { windowsHide: true, timeout: delayMs + 5000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "window selection failed").trim()));
          return;
        }
        try {
          resolve(JSON.parse((stdout || "").trim()));
        } catch {
          reject(new Error("window helper returned invalid JSON"));
        }
      },
    );
  });
}

function runWindowCapture(bounds) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOW_CAPTURE_SCRIPT,
        "-Left",
        String(bounds.left),
        "-Top",
        String(bounds.top),
        "-Width",
        String(bounds.width),
        "-Height",
        String(bounds.height),
      ],
      { windowsHide: true, timeout: 10000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "window capture failed").trim()));
          return;
        }
        const base64 = (stdout || "").trim();
        if (!base64) {
          reject(new Error("window capture returned no image"));
          return;
        }
        resolve(`data:image/png;base64,${base64}`);
      },
    );
  });
}
function runWindows() {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", WINDOWS_SCRIPT],
      { windowsHide: true, timeout: 7000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "window enumeration failed").trim()));
          return;
        }
        try {
          resolve(JSON.parse((stdout || "").trim()));
        } catch {
          reject(new Error("window enumeration returned invalid JSON"));
        }
      },
    );
  });
}
function runMonitors() {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", MONITORS_SCRIPT],
      { windowsHide: true, timeout: 7000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || "monitor enumeration failed").trim()));
          return;
        }
        try {
          resolve(JSON.parse((stdout || "").trim()));
        } catch {
          reject(new Error("monitor helper returned invalid JSON"));
        }
      },
    );
  });
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(req, res);
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(req, res, 200, {
        ok: true,
        service: "DINS REFLEX Screen Bridge",
        actions: ["left-click", "wifi", "bluetooth", "volume", "brightness"],
      });
    }

    if (req.method === "GET" && url.pathname === "/windows") {
      const result = await runWindows();
      return json(req, res, 200, { ok: true, ...result });
    }
    if (req.method === "GET" && url.pathname === "/monitor-preview") {
      const left = Number(url.searchParams.get("left"));
      const top = Number(url.searchParams.get("top"));
      const width = Number(url.searchParams.get("width"));
      const height = Number(url.searchParams.get("height"));

      if (
        ![left, top, width, height].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0 ||
        width > 16384 ||
        height > 16384
      ) {
        return json(req, res, 400, { ok: false, error: "invalid monitor geometry" });
      }

      const preview = await runWindowCapture({ left, top, width, height });
      return json(req, res, 200, { ok: true, preview, width, height });
    }
    if (req.method === "GET" && url.pathname === "/monitors") {
      const result = await runMonitors();
      return json(req, res, 200, { ok: true, ...result });
    }
    if (req.method === "POST" && url.pathname === "/bond-window") {
      const requestedHwnd = Number(url.searchParams.get("hwnd") || 0);
      const useSelectedWindow = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
      let reflexWindow = null;
      try {
        if (!useSelectedWindow) {
          reflexWindow = await runWindow(0, 0);
          await runWindow(0, Number(reflexWindow.hwnd), "hide");
        }
        const result = await runWindow(useSelectedWindow ? 0 : 4000, useSelectedWindow ? requestedHwnd : 0);
        bondedWindow = {
          hwnd: Number(result.hwnd),
          left: Number(result.left),
          top: Number(result.top),
          width: Number(result.width),
          height: Number(result.height),
          title: String(result.title || ""),
        };
        const preview = await runWindowCapture(bondedWindow);
        return json(req, res, 200, { ok: true, bonded: bondedWindow, preview });
      } finally {
        if (reflexWindow?.hwnd) {
          try { await runWindow(0, Number(reflexWindow.hwnd), "show"); } catch {}
        }
      }
    }
    if (req.method === "POST" && url.pathname === "/unbond-window") {
      bondedWindow = null;
      return json(req, res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/bond-window") {
      return json(req, res, 200, { ok: true, bonded: bondedWindow });
    }
    if (req.method === "POST" && url.pathname === "/window") {
      const body = await readJson(req);
      const requested = finiteInt(body.delayMs);
      const delayMs = requested === null ? 4000 : Math.max(1000, Math.min(10000, requested));
      const result = await runWindow(delayMs);
      return json(req, res, 200, { ok: true, ...result });
    }

    if (req.method === "POST" && url.pathname === "/click") {
      const body = await readJson(req);
      const x = finiteInt(body.x);
      const y = finiteInt(body.y);
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 64) : "mapped button";

      if (x === null || y === null || x < -32768 || y < -32768 || x > 65535 || y > 65535) {
        return json(req, res, 400, { ok: false, error: "invalid screen coordinates" });
      }

      if (bondedWindow) {
        const current = await runWindow(0, bondedWindow.hwnd);
        const same =
          Number(current.left) === bondedWindow.left &&
          Number(current.top) === bondedWindow.top &&
          Number(current.width) === bondedWindow.width &&
          Number(current.height) === bondedWindow.height;
        if (!same) {
          return json(req, res, 409, { ok: false, error: "Window changed. Rebond before execution." });
        }
      }

      await runClick(x, y);
      return json(req, res, 200, {
        ok: true,
        result: `screen click ${name} at ${x}, ${y}`,
      });
    }

    if (req.method === "POST" && url.pathname === "/device") {
      const body = await readJson(req);
      const action = typeof body.action === "string" ? body.action.trim() : "";

      if (!["wifi", "bluetooth", "volume", "brightness"].includes(action)) {
        return json(req, res, 400, { ok: false, error: "invalid device action" });
      }

      let value;
      if (action === "wifi" || action === "bluetooth") {
        if (typeof body.enabled !== "boolean") {
          return json(req, res, 400, { ok: false, error: "enabled must be boolean" });
        }
        value = body.enabled ? "on" : "off";
      } else {
        const level = finiteInt(body.value);
        if (level === null || level < 0 || level > 100) {
          return json(req, res, 400, { ok: false, error: "value must be 0..100" });
        }
        value = level;
      }

      const result = await runDevice(action, value);
      return json(req, res, 200, {
        ok: true,
        result: result || `device ${action} ${value}`,
      });
    }

    return json(req, res, 404, { ok: false, error: "not found" });
  } catch (error) {
    return json(req, res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "screen bridge error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[DINS] Screen Bridge listening at http://${HOST}:${PORT}`);
  console.log("[DINS] Native screen click plus bounded device controls. REFLEX First Touch remains the action gate.");
});
