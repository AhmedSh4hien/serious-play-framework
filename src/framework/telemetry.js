const SUPABASE_URL = "https://wezkyyksokbacubndhiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tPfESuI4tGwQy0EMPhwHUA_L31qYaqi";

const QUEUE_KEY = "telemetry_queue";

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
  catch { /* storage full — drop silently */ }
}

async function postPayload(payload, keepalive = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/telemetry_events`, {
    method: "POST",
    keepalive,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function drainQueue() {
  const queue = loadQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const payload of queue) {
    try { await postPayload(payload); }
    catch { remaining.push(payload); }
  }
  saveQueue(remaining);
  if (queue.length !== remaining.length)
    console.info(`[telemetry] drained ${queue.length - remaining.length} queued session(s)`);
}


export function createTelemetry({ getState, gameId, onFlush }) {
  // attempt to send anything that failed in a previous session
  drainQueue();

  const sessionId = (
    crypto?.randomUUID?.() ?? `sess_${Date.now()}_${Math.random()}`
  ).toString();

  const t0 = performance.now();

  const telemetry = {
    schema: "serious-play-framework-v1",
    sessionId,
    gameId: gameId ?? "unknown",
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
    const session = s.session ?? {};
    const targets = session.goal?.targets ?? [];
    const counts = session.createdItemCounts ?? {};
    const targetsComplete = targets.filter((t) => {
      const key = t.molecule ?? t.binId ?? t.id;
      return (counts[key] ?? 0) >= (t.targetCount ?? t.count ?? 1);
    }).length;

    telemetry.samples.push({
      t: nowMs(),
      fps: s.fps ?? 0,
      phase: session.phase ?? null,
      targetsComplete,
      targetsTotal: targets.length,
      ...(s.telemetrySample ?? {}),
    });
  }

  function buildPayload() {
    return {
      session_id: telemetry.sessionId,
      schema_version: telemetry.schema,
      started_at_iso: telemetry.startedAtIso,
      game_id: telemetry.gameId,
      events: telemetry.events,
      samples: telemetry.samples,
    };
  }

  let flushed = false;

  async function flushToSupabase() {
    if (flushed) return;
    flushed = true;

    event("session_end", {
      durationMs: nowMs(),
      totalEvents: telemetry.events.length + 1,
    });

    const payload = buildPayload();

    try {
      await postPayload(payload);
      console.info(`[telemetry] flushed ${telemetry.events.length} events`);
      onFlush?.({ success: true, eventCount: telemetry.events.length });
    } catch (e) {
      console.warn("[telemetry] flush failed, queuing locally:", e.message ?? e);
      const q = loadQueue();
      q.push(payload);
      saveQueue(q);
      flushed = false; // allow manual retry
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
    clearInterval(sampleInterval);
    if (flushed) return;
    flushed = true;
    sample();
    event("session_end_unload");

    const payload = buildPayload();

    // best-effort live send
    fetch(`${SUPABASE_URL}/rest/v1/telemetry_events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // keepalive fetch failed — queue for next session
      const q = loadQueue();
      q.push(payload);
      saveQueue(q);
    });
  });

  return {
    event,
    sample,
    downloadJson,
    flushToSupabase,
    get data() { return telemetry; },
  };
}