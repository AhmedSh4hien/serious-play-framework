const SUPABASE_URL = "https://wezkyyksokbacubndhiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tPfESuI4tGwQy0EMPhwHUA_L31qYaqi";

export function createTelemetry({ getState, onFlush }) {
  const sessionId = (
    crypto?.randomUUID?.() ?? `sess_${Date.now()}_${Math.random()}`
  ).toString();

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

  let flushed = false;

  async function flushToSupabase() {
    if (flushed) return;
    flushed = true;

    event("session_end", {
      durationMs: nowMs(),
      totalEvents: telemetry.events.length + 1,
    });
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/telemetry_events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=minimal",
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
        onFlush?.({ success: false, error: err });
      } else {
        console.info(`[telemetry] flushed ${telemetry.events.length} events`);
        onFlush?.({ success: true, eventCount: telemetry.events.length });
      }
    } catch (e) {
      console.warn("[telemetry] flush error:", e);
      onFlush?.({ success: false, error: e });
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

  const sampleInterval = setInterval(() => sample(), 1000);

  window.addEventListener("beforeunload", () => {
    if (flushed) return;
    try {
      sample();
      event("session_end");
      const payload = JSON.stringify({
        session_id: telemetry.sessionId,
        schema_version: telemetry.schema,
        started_at_iso: telemetry.startedAtIso,
        events: telemetry.events,
        samples: telemetry.samples,
      });
      navigator.sendBeacon(
        `${SUPABASE_URL}/rest/v1/telemetry_events`,
        new Blob([payload], { type: "application/json" })
      );
    } catch {}
    clearInterval(sampleInterval);
  });

  event("session_start");

  return {
    event,
    sample,
    downloadJson,
    flushToSupabase,
    get data() {
      return telemetry;
    },
  };
}
