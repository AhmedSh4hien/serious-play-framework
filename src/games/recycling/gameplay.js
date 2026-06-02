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

const SPAWN_INTERVAL_MS = 2500;
const COMPONENT_IDS = ['battery','screen','pcb','casing','camera','speaker','sim','battery_ic'];
const TEXTURES = {};

export async function preloadAssets() {
  await Promise.all(
    COMPONENT_IDS.map(id =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          TEXTURES[id] = PIXI.Texture.from(img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Asset not found for "${id}", using fallback.`);
          resolve();
        };
        img.src = `${import.meta.env.BASE_URL}assets/recycling/${id}.png`;
      })
    )
  );
}

export function initBins(app, state) {
  state.bins.forEach(b => app.stage.removeChild(b.container));
  state.bins = [];

  const W = app.screen.width;
  const H = app.screen.height;
  const binW = 110, binH = 90, padding = 12;
  const totalW = BIN_DEFS.length * (binW + padding) - padding;
  const startX = (W - totalW) / 2;
  const binY = H - binH - 16;

  BIN_DEFS.forEach((def, i) => {
    const container = new PIXI.Container();
    container.x = startX + i * (binW + padding);
    container.y = binY;

    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, binW, binH, 8);
    bg.fill({ color: def.color, alpha: 0.25 });
    bg.stroke({ color: def.color, alpha: 1, width: 2 });
    container.addChild(bg);

    const label = new PIXI.Text({
      text: def.label,
      style: {
        fontSize: 11, fill: 0xffffff, align: 'center',
        wordWrap: true, wordWrapWidth: binW - 8,
      }
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
  for (const c of state.components) app.stage.removeChild(c.container);
  state.components = [];

  if (state._spawnTimer) {
    clearInterval(state._spawnTimer);
    state._spawnTimer = null;
  }

  const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
  state.componentQueue = shuffle([
    ...level.components, ...level.components, ...level.components,
    ...level.components, ...level.components,
  ]);
  state.score = 0;
  state.sortedTotal = 0;

  spawnNext(app, state, telemetry);
  state._spawnTimer = setInterval(() => {
    if (state.session.phase !== 'simulation') {
      clearInterval(state._spawnTimer);
      return;
    }
    spawnNext(app, state, telemetry);
  }, SPAWN_INTERVAL_MS);
}

function spawnNext(app, state, telemetry) {
  if (state.session.phase !== 'simulation') return;
  if (state.componentQueue.length === 0) {
    const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
    state.componentQueue = shuffle([...level.components, ...level.components]);
  }

  const def = state.componentQueue.shift();
  const W = app.screen.width;
  const H = app.screen.height;
  const binAreaTop = H - 106;

  const originX = 80 + Math.random() * (W - 160);
  const originY = 60 + Math.random() * (binAreaTop * 0.6);

  const container = new PIXI.Container();
  container.x = originX;
  container.y = -60;
  container.eventMode = 'static';
  container.cursor = 'grab';

  const texture = TEXTURES[def.id];
  if (texture) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = 80;
    sprite.height = 80;
    container.addChild(sprite);
  } else {
    const box = new PIXI.Graphics();
    box.roundRect(-55, -28, 110, 56, 10);
    box.fill({ color: def.color, alpha: 0.9 });
    box.stroke({ color: 0xffffff, alpha: 0.4, width: 2 });
    container.addChild(box);
  }

  const label = new PIXI.Text({
    text: def.label,
    style: {
      fontSize: 11, fontWeight: 'bold', fill: 0xffffff,
      align: 'center', wordWrap: true, wordWrapWidth: 100,
      dropShadow: { distance: 2, alpha: 0.8 },
    }
  });
  label.anchor.set(0.5, 0);
  label.y = 44;
  container.addChild(label);

  // Drop-in animation
  const targetY = originY;
  const dropSpeed = 18;
  const dropTicker = app.ticker.add(() => {
    if (container.y < targetY) {
      container.y = Math.min(container.y + dropSpeed, targetY);
    } else {
      app.ticker.remove(dropTicker);
    }
  });

  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  container.on('pointerdown', (e) => {
    if (state.session.phase !== 'simulation') return;
    dragging = true;
    container.cursor = 'grabbing';
    const pos = e.getLocalPosition(app.stage);
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
    const pos = e.getLocalPosition(app.stage);
    container.x = pos.x - dragOffsetX;
    container.y = pos.y - dragOffsetY;
  });

  function onDrop() {
    if (!dragging) return;
    dragging = false;
    container.cursor = 'grab';

    const hit = getHitBin(state, container.x, container.y);
    if (!hit) {
      container.x = originX;
      container.y = originY;
      return;
    }

    const correct = hit.id === def.binId;
    state.sortedTotal++;

    if (correct) {
      app.stage.removeChild(container);
      state.components = state.components.filter(c => c.container !== container);
      state.score++;
      flashBin(hit, 0x00ff00);
      showPopup(app, hit.x + hit.w / 2, hit.y, '+1', 0x00ff88);
    } else {
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
  const t = new PIXI.Text({ text, style: { fontSize: 22, fontWeight: 'bold', fill: color } });
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