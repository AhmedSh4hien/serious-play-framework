import * as PIXI from 'pixi.js';
import { LEVELS } from './levelsConfig.js';
import { shuffle } from './recycling.js';

export const BIN_DEFS = [
  { id: 'battery',   label: 'Battery',         color: 0xe74c3c },
  { id: 'plastic',   label: 'Plastic / Glass', color: 0x3498db },
  { id: 'metal',     label: 'Rare Metals',     color: 0xf39c12 },
  { id: 'pcb',       label: 'Circuit Board',   color: 0x2ecc71 },
  { id: 'hazardous', label: 'Hazardous',       color: 0x9b59b6 },
];

const SPAWN_INTERVAL_MS = 2500; // new component every 2.5s

export function initBins(app, state) {
  state.bins.forEach(b => app.stage.removeChild(b.container));
  state.bins = [];

  const W = app.screen.width;
  const H = app.screen.height;
  const binW = 110;
  const binH = 90;
  const padding = 12;
  const totalW = BIN_DEFS.length * (binW + padding) - padding;
  const startX = (W - totalW) / 2;
  const binY = H - binH - 16;

  BIN_DEFS.forEach((def, i) => {
    const container = new PIXI.Container();
    container.x = startX + i * (binW + padding);
    container.y = binY;

    const bg = new PIXI.Graphics();
    bg.beginFill(def.color, 0.25);
    bg.lineStyle(2, def.color, 1);
    bg.drawRoundedRect(0, 0, binW, binH, 8);
    bg.endFill();
    container.addChild(bg);

    const label = new PIXI.Text(def.label, {
      fontSize: 11, fill: 0xffffff, align: 'center',
      wordWrap: true, wordWrapWidth: binW - 8,
    });
    label.anchor.set(0.5, 0.5);
    label.x = binW / 2;
    label.y = binH / 2;
    container.addChild(label);

    app.stage.addChild(container);
    state.bins.push({ id: def.id, color: def.color, container, bg,
      x: container.x, y: container.y, w: binW, h: binH });
  });
}

export function initComponents(app, state, telemetry) {
  // Clear all active components
  for (const c of state.components) app.stage.removeChild(c.container);
  state.components = [];

  if (state._spawnTimer) {
    clearInterval(state._spawnTimer);
    state._spawnTimer = null;
  }

  const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
  // Infinite queue — repeat the level components shuffled
  state.componentQueue = shuffle([
    ...level.components, ...level.components, ...level.components,
    ...level.components, ...level.components,
  ]);
  state.score = 0;
  state.sortedTotal = 0;

  // Spawn first one immediately, then on interval
  spawnNext(app, state, telemetry);
  state._spawnTimer = setInterval(() => {
    if (state.session.phase !== 'simulation') {
      clearInterval(state._spawnTimer);
      return;
    }
    spawnNext(app, state, telemetry);
  }, SPAWN_INTERVAL_MS);
}

// ─── Spawn a single component into the pile ───────────────────────────────────

function spawnNext(app, state, telemetry) {
  if (state.session.phase !== 'simulation') return;
  if (state.componentQueue.length === 0) {
    // refill queue
    const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
    state.componentQueue = shuffle([...level.components, ...level.components]);
  }

  const def = state.componentQueue.shift();
  const W = app.screen.width;
  const H = app.screen.height;
  const binAreaTop = H - 106; // above bins

  // Spread components randomly in the upper 60% of the screen
  const originX = 80 + Math.random() * (W - 160);
  const originY = 60 + Math.random() * (binAreaTop * 0.6);

  const container = new PIXI.Container();
  container.x = originX;
  container.y = -60; // start above screen
  container.interactive = true;
  container.cursor = 'grab';

  const box = new PIXI.Graphics();
  box.beginFill(def.color, 0.9);
  box.lineStyle(2, 0xffffff, 0.4);
  box.drawRoundedRect(-55, -28, 110, 56, 10);
  box.endFill();
  container.addChild(box);

  const label = new PIXI.Text(def.label, {
    fontSize: 12, fontWeight: 'bold', fill: 0xffffff,
    align: 'center', wordWrap: true, wordWrapWidth: 100,
  });
  label.anchor.set(0.5, 0.5);
  container.addChild(label);

  // Animate drop-in
  const targetY = originY;
  const dropSpeed = 18;
  const dropTicker = app.ticker.add(() => {
    if (container.y < targetY) {
      container.y = Math.min(container.y + dropSpeed, targetY);
    } else {
      app.ticker.remove(dropTicker);
    }
  });

  // Drag
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  container.on('pointerdown', (e) => {
    if (state.session.phase !== 'simulation') return;
    dragging = true;
    container.cursor = 'grabbing';
    const pos = e.data.getLocalPosition(app.stage);
    dragOffsetX = pos.x - container.x;
    dragOffsetY = pos.y - container.y;
    app.stage.setChildIndex(container, app.stage.children.length - 1);
    telemetry.event('component_pickup', {
      componentId: def.id,
      levelIndex: state.session.currentLevelIndex,
    });
  });

  app.stage.on('pointermove', (e) => {
    if (!dragging) return;
    const pos = e.data.getLocalPosition(app.stage);
    container.x = pos.x - dragOffsetX;
    container.y = pos.y - dragOffsetY;
  });

  function onDrop() {
    if (!dragging) return;
    dragging = false;
    container.cursor = 'grab';

    const hit = getHitBin(state, container.x, container.y);

    if (!hit) {
      // Snap back to pile position
      container.x = originX;
      container.y = originY;
      return;
    }

    const correct = hit.id === def.binId;
    state.sortedTotal++;

    if (correct) {
      // Remove from screen and pile
      app.stage.removeChild(container);
      state.components = state.components.filter(c => c.container !== container);
      state.score++;
      flashBin(hit, 0x00ff00);
      showPopup(app, hit.x + hit.w / 2, hit.y, '+1', 0x00ff88);
    } else {
      // Snap back — stays in the pile
      container.x = originX;
      container.y = originY;
      flashBin(hit, 0xff3333);
      showPopup(app, container.x, container.y - 30, '✗', 0xff4444);
    }

    telemetry.event('component_sorted', {
      componentId: def.id, binId: hit.id, correct,
      score: state.score, total: state.sortedTotal,
      levelIndex: state.session.currentLevelIndex,
    });

    state._onUiChange?.();
  }

  container.on('pointerup', onDrop);
  container.on('pointerupoutside', onDrop);

  app.stage.addChild(container);
  state.components.push({ id: def.id, binId: def.binId, container, originX, originY });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHitBin(state, x, y) {
  for (const bin of state.bins) {
    if (x >= bin.x && x <= bin.x + bin.w &&
        y >= bin.y && y <= bin.y + bin.h) return bin;
  }
  return null;
}

function flashBin(bin, color) {
  bin.bg.tint = color;
  setTimeout(() => { bin.bg.tint = 0xffffff; }, 350);
}

function showPopup(app, x, y, text, color) {
  const t = new PIXI.Text(text, { fontSize: 22, fontWeight: 'bold', fill: color });
  t.anchor.set(0.5);
  t.x = x;
  t.y = y;
  app.stage.addChild(t);
  let tick = 0;
  const id = app.ticker.add(() => {
    t.y -= 1.5;
    t.alpha -= 0.03;
    tick++;
    if (tick > 30) { app.stage.removeChild(t); app.ticker.remove(id); }
  });
}

export function resetWorld(app, state, telemetry) {
  if (state._spawnTimer) {
    clearInterval(state._spawnTimer);
    state._spawnTimer = null;
  }
  for (const c of (state.components ?? [])) app.stage.removeChild(c.container);
  state.components = [];
  initBins(app, state);
  initComponents(app, state, telemetry);
}