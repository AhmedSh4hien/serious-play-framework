import * as PIXI from 'pixi.js';
import { LEVELS } from './levelsConfig.js';

// ─── Bin definitions (layout computed at init time) ───────────────────────────

export const BIN_DEFS = [
  { id: 'battery',   label: 'Battery',         color: 0xe74c3c },
  { id: 'plastic',   label: 'Plastic / Glass', color: 0x3498db },
  { id: 'metal',     label: 'Rare Metals',     color: 0xf39c12 },
  { id: 'pcb',       label: 'Circuit Board',   color: 0x2ecc71 },
  { id: 'hazardous', label: 'Hazardous',       color: 0x9b59b6 },
];

// ─── Init bins ────────────────────────────────────────────────────────────────

export function initBins(app, state) {
  // clear old
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

    // background box
    const bg = new PIXI.Graphics();
    bg.beginFill(def.color, 0.25);
    bg.lineStyle(2, def.color, 1);
    bg.drawRoundedRect(0, 0, binW, binH, 8);
    bg.endFill();
    container.addChild(bg);

    // label
    const label = new PIXI.Text(def.label, {
      fontSize: 11,
      fill: 0xffffff,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: binW - 8,
    });
    label.anchor.set(0.5, 0.5);
    label.x = binW / 2;
    label.y = binH / 2;
    container.addChild(label);

    app.stage.addChild(container);

    state.bins.push({
      id: def.id,
      color: def.color,
      container,
      bg,
      x: container.x,
      y: container.y,
      w: binW,
      h: binH,
    });
  });
}

// ─── Init components ──────────────────────────────────────────────────────────

export function initComponents(app, state, telemetry) {
  // clear old sprites
  state.components.forEach(c => app.stage.removeChild(c.sprite));
  state.components = [];
  state.correctDrops = {};

  const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
  const W = app.screen.width;
  const H = app.screen.height;
  const usableH = H * 0.65; // keep components in upper 65%

  level.components.forEach((def, i) => {
    const cols = Math.min(level.components.length, 4);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = W / cols;
    const cellH = usableH / Math.ceil(level.components.length / cols);

    const cx = cellW * col + cellW / 2;
    const cy = 60 + cellH * row + cellH / 2;

    const container = new PIXI.Container();
    container.x = cx;
    container.y = cy;
    container.interactive = true;
    container.cursor = 'grab';

    // box
    const box = new PIXI.Graphics();
    box.beginFill(def.color, 0.9);
    box.lineStyle(2, 0xffffff, 0.4);
    box.drawRoundedRect(-50, -28, 100, 56, 8);
    box.endFill();
    container.addChild(box);

    // label
    const label = new PIXI.Text(def.label, {
      fontSize: 12,
      fill: 0xffffff,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 92,
    });
    label.anchor.set(0.5, 0.5);
    container.addChild(label);

    // drag state
    let dragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let originX = cx;
    let originY = cy;

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

    container.on('pointerup', () => onDrop());
    container.on('pointerupoutside', () => onDrop());

    function onDrop() {
      if (!dragging) return;
      dragging = false;
      container.cursor = 'grab';

      const hit = getHitBin(state, container.x, container.y);

      if (!hit) {
        // snap back
        container.x = originX;
        container.y = originY;
        return;
      }

      if (hit.id === def.binId) {
        // correct
        container.interactive = false;
        container.cursor = 'default';
        container.x = hit.x + hit.w / 2;
        container.y = hit.y + hit.h / 2;

        // green flash on bin
        hit.bg.tint = 0x00ff00;
        setTimeout(() => { hit.bg.tint = 0xffffff; }, 400);

        state.correctDrops[hit.id] = (state.correctDrops[hit.id] || 0) + 1;

        telemetry.event('component_sorted', {
          componentId: def.id,
          binId: hit.id,
          correct: true,
          levelIndex: state.session.currentLevelIndex,
        });

        checkGoal(state, telemetry);
      } else {
        // wrong bin — snap back
        container.x = originX;
        container.y = originY;

        // red flash on bin
        hit.bg.tint = 0xff0000;
        setTimeout(() => { hit.bg.tint = 0xffffff; }, 400);

        telemetry.event('component_sorted', {
          componentId: def.id,
          binId: hit.id,
          correct: false,
          levelIndex: state.session.currentLevelIndex,
        });
      }
    }

    app.stage.addChild(container);
    state.components.push({ id: def.id, binId: def.binId, sprite: container });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHitBin(state, x, y) {
  for (const bin of state.bins) {
    if (
      x >= bin.x && x <= bin.x + bin.w &&
      y >= bin.y && y <= bin.y + bin.h
    ) return bin;
  }
  return null;
}

function checkGoal(state, telemetry) {
  const targets = state.session.goal.targets || [];
  const allDone = targets.every(t =>
    (state.correctDrops[t.binId] || 0) >= t.targetCount
  );

  if (allDone && !state.session.goal.completed) {
    state.session.goal.completed = true;
    state.session.goal.completedAtMs = performance.now();

    telemetry.event('goal_completed', {
      levelIndex: state.session.currentLevelIndex,
      correctDrops: { ...state.correctDrops },
    });
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetWorld(app, state, telemetry) {
  initBins(app, state);
  initComponents(app, state, telemetry);
}