// src/telemetry.js
export function createTelemetry({ getState }) {
    const sessionId =
      (crypto?.randomUUID?.() ?? `sess_${Date.now()}_${Math.random()}`).toString();
  
    const t0 = performance.now();
  
    const telemetry = {
      schema: "molecule-proto-telemetry-v1",
      sessionId,
      startedAtIso: new Date().toISOString(),
      events: [],
      samples: [],
    };
  
    function nowMs() {
      return Math.round(performance.now() - t0);
    }
  
    function event(type, data = {}) {
      telemetry.events.push({
        t: nowMs(),
        type,
        ...data,
      });
    }
  
    // cheap periodic snapshot (so you can plot later if you want)
    function sample() {
      const s = getState();
  
      telemetry.samples.push({
        t: nowMs(),
        atoms: s.atoms.length,
        bonds: s.bonds.length,
        fps: s.fps,
        moleculeCounts: { ...s.moleculeCounts },
      });
    }
  
    function downloadJson(filename = "telemetry.json") {
      const blob = new Blob([JSON.stringify(telemetry, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  
    function mountUi() {
      // Download button
      const btn = document.createElement("button");
      btn.textContent = "Download telemetry.json";
      btn.style.position = "fixed";
      btn.style.right = "12px";
      btn.style.top = "12px";
      btn.style.zIndex = "9999";
      btn.style.padding = "8px 10px";
      btn.style.fontFamily = "system-ui, sans-serif";
      btn.style.fontSize = "12px";
      btn.addEventListener("click", () => downloadJson());
      document.body.appendChild(btn);
  
      // tiny status line
      const hud = document.createElement("div");
      hud.style.position = "fixed";
      hud.style.right = "12px";
      hud.style.top = "48px";
      hud.style.zIndex = "9999";
      hud.style.padding = "6px 10px";
      hud.style.background = "rgba(0,0,0,0.55)";
      hud.style.color = "white";
      hud.style.borderRadius = "6px";
      hud.style.fontFamily = "monospace";
      hud.style.fontSize = "12px";
      document.body.appendChild(hud);
  
      return { btn, hud };
    }
  
    const ui = mountUi();
  
    function tickUi() {
      const s = getState();
      ui.hud.textContent = `telemetry: events=${telemetry.events.length} samples=${telemetry.samples.length} fps=${s.fps}`;
    }
  
    // auto sampling every 1s
    const sampleInterval = setInterval(() => sample(), 1000);
  
    // auto end event + final sample on tab close
    window.addEventListener("beforeunload", () => {
      try {
        sample();
        event("session_end");
      } catch {}
      clearInterval(sampleInterval);
    });
  
    // initial
    event("session_start");
  
    return {
      event,
      sample,
      tickUi,
      downloadJson,
      get data() {
        return telemetry;
      },
    };
  }
  