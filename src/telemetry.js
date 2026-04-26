const SUPABASE_URL = "https://wezkyyksokbacubndhiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tPfESuI4tGwQy0EMPhwHUA_L31qYaqi";

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
    telemetry.events.push({ t: nowMs(), type, ...data });
  }

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

  // --- Supabase flush ---
  async function flushToSupabase() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/telemetry_events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          session_id: telemetry.sessionId,
          schema_version: telemetry.schema,
          started_at_iso: telemetry.startedAtIso,
          events: telemetry.events,
          samples: telemetry.samples,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn("[telemetry] flush failed:", err);
        updateHud("flush FAILED ✗");
      } else {
        updateHud(`flushed ✓ ${telemetry.events.length} events`);
      }
    } catch (e) {
      console.warn("[telemetry] flush error:", e);
    }
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

  // --- UI ---
  let hudEl;

  function updateHud(msg) {
    if (hudEl) hudEl.textContent = `telemetry: ${msg}`;
  }

  function mountUi() {
    const panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;right:12px;top:12px;z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:flex-end;";
  
    const btn = document.createElement("button");
    btn.textContent = "⬇ Download JSON";
    btn.style.cssText =
      "padding:6px 10px;font-family:system-ui,sans-serif;font-size:12px;cursor:pointer;border-radius:6px;border:1px solid #555;background:#222;color:white;";
    btn.addEventListener("click", () => downloadJson());
  
    const flushBtn = document.createElement("button");
    flushBtn.textContent = "☁ Flush to Supabase";
    flushBtn.style.cssText =
      "padding:6px 10px;font-family:system-ui,sans-serif;font-size:12px;cursor:pointer;border-radius:6px;border:none;background:#01696f;color:white;";
    flushBtn.addEventListener("click", () => flushToSupabase());
  
    hudEl = document.createElement("div");
    hudEl.style.cssText =
      "padding:4px 8px;background:rgba(0,0,0,0.55);color:white;border-radius:6px;font-family:monospace;font-size:11px;";
  
    panel.appendChild(btn);
    panel.appendChild(flushBtn);
    panel.appendChild(hudEl);
    document.body.appendChild(panel);
  
    return { btn, flushBtn, hud: hudEl };
  }
  const ui = mountUi();

  function tickUi() {
    const s = getState();
    updateHud(
      `events=${telemetry.events.length} samples=${telemetry.samples.length} fps=${s.fps}`
    );
  }

  const sampleInterval = setInterval(() => sample(), 1000);

  // Auto-flush + end event on tab close
  window.addEventListener("beforeunload", () => {
    try {
      sample();
      event("session_end");
      // sendBeacon for guaranteed delivery on tab close
      const payload = JSON.stringify({
        session_id: telemetry.sessionId,
        schema_version: telemetry.schema,
        started_at_iso: telemetry.startedAtIso,
        events: telemetry.events,
        samples: telemetry.samples,
      });
      navigator.sendBeacon(
        `${SUPABASE_URL}/rest/v1/telemetry_events`,
        new Blob(
          [payload],
          { type: "application/json" }
        )
      );
    } catch {}
    clearInterval(sampleInterval);
  });

  event("session_start");

  return {
    event,
    sample,
    tickUi,
    downloadJson,
    flushToSupabase,
    get data() { return telemetry; },
  };
}