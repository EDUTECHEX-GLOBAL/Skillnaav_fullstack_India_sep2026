/**
 * Pyodide WebAssembly Worker for 100+ Concurrent Students
 * Executes Python 3 natively in the client browser with 0 server load,
 * 0 network latency, and 0 external API rate limits.
 */

// Load Pyodide from official jsDelivr CDN
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide = null;
let isInitializing = false;
let initPromise = null;

async function initPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
      // Setup stdout and stderr capture
      await pyodide.runPythonAsync(`
import sys
import io

class OutputCapture(io.StringIO):
    def __init__(self):
        super().__init__()
    def get_output(self):
        return self.getvalue()

stdout_capture = OutputCapture()
stderr_capture = OutputCapture()
sys.stdout = stdout_capture
sys.stderr = stderr_capture
`);
      self.postMessage({ type: "READY" });
      return pyodide;
    } catch (err) {
      self.postMessage({ type: "INIT_ERROR", error: err.message });
      throw err;
    }
  })();

  return initPromise;
}

// Start preloading immediately in background
initPyodide();

self.onmessage = async (event) => {
  const { id, code, stdin } = event.data || {};
  if (!id) return;

  try {
    const py = await initPyodide();

    // Reset capture buffers
    await py.runPythonAsync(`
stdout_capture.truncate(0)
stdout_capture.seek(0)
stderr_capture.truncate(0)
stderr_capture.seek(0)
`);

    // Feed stdin if provided
    if (stdin) {
      await py.runPythonAsync(`
import sys
import io
sys.stdin = io.StringIO(${JSON.stringify(String(stdin))})
`);
    }

    // Execute student's Python code
    let evalResult;
    try {
      evalResult = await py.runPythonAsync(code);
    } catch (execErr) {
      // Execution runtime or syntax error
      self.postMessage({
        id,
        success: true,
        runner: "Pyodide WASM (Client Sandbox)",
        stdout: "",
        stderr: execErr.message || String(execErr),
        compileError: "",
        exitCode: 1,
      });
      return;
    }

    // Retrieve captured stdout and stderr
    const stdout = await py.runPythonAsync("stdout_capture.get_output()");
    const stderr = await py.runPythonAsync("stderr_capture.get_output()");

    let finalOut = stdout || "";
    if (!finalOut && evalResult !== undefined && evalResult !== null) {
      finalOut = String(evalResult);
    }

    self.postMessage({
      id,
      success: true,
      runner: "Pyodide WASM (Client Sandbox)",
      stdout: finalOut,
      stderr: stderr || "",
      compileError: "",
      exitCode: 0,
    });
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err.message || "Pyodide execution failed",
    });
  }
};

