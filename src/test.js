import Matter from "matter-js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Atom
const atoms = [];
const atomCount = 500;

for (let i = 0; i < atomCount; i++) {
  atoms.push({
    id: i,
    state: "floating", // later can be "physical"
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: 8,
    color: "#4fd5ff",
    body: null, // reserved for Matter
  });
}

// Matter
const engine = Matter.Engine.create();
engine.gravity.y = 1;
const world = engine.world;

// store a reference to the ground so atoms have something to land on
const ground = Matter.Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight + 40,
  window.innerWidth,
  80,
  { isStatic: true }
);
Matter.World.add(world, ground);

handleResize();

function updateFloating(dt) {
  for (const a of atoms) {
    if (a.state !== "floating") continue;

    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // bounce on edges
    if (a.x < a.radius || a.x > canvas.width - a.radius) a.vx *= -1;
    if (a.y < a.radius || a.y > canvas.height - a.radius) a.vy *= -1;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const a of atoms) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
  }

  if (fps >= 50) ctx.fillStyle = "#00ff00";
  else if (fps >= 30) ctx.fillStyle = "#ffff00";
  else ctx.fillStyle = "#ff0000";

  ctx.font = "14px monospace";
  ctx.fillText(`FPS: ${fps}`, 10, 20);

  ctx.fillStyle = "#000000";
  ctx.fillText(`Atoms: ${atoms.length}`, 10, 40);
}

let lastTime = performance.now();

let fps = 0;
let framesThisSecond = 0;
let lastFpsUpdate = performance.now();

let isRightMouseDown = false;
let mouseX = 0;
let mouseY = 0;

function loop(t) {
  const dt = (t - lastTime) * 0.1;
  lastTime = t;

  if (isRightMouseDown) {
    spawnAtomAt(mouseX, mouseY);
  }

  // FPS calculation
  framesThisSecond++;
  if (t - lastFpsUpdate >= 1000) {
    fps = framesThisSecond;
    framesThisSecond = 0;
    lastFpsUpdate = t;
  }

  updateFloating(dt);
  handleFloatingCollisions();
  convertToPhysical();
  updatePhysical();

  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function handleFloatingCollisions() {
  const threshold = 2; // overlap threshold

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.state !== "floating") continue;

    for (let j = i + 1; j < atoms.length; j++) {
      const b = atoms[j];
      if (b.state !== "floating") continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const r = a.radius + b.radius;

      if (dist2 < (r + threshold) * (r + threshold)) {
        // mark them as 'ready' to become physical
        a.state = "toPhysical";
        b.state = "toPhysical";
        a.color = "#ffcc4f";
        b.color = "#ffcc4f";
      }
    }
  }
}

function convertToPhysical() {
  for (const a of atoms) {
    if (a.state !== "toPhysical") continue;

    // create a circular body at the atom's current position
    const body = Matter.Bodies.circle(a.x, a.y, a.radius);

    Matter.World.add(world, body);

    a.body = body;
    a.state = "physical";
    a.color = "#ff6666"; // optional: new color for physical atoms
  }
}

function updatePhysical() {
  // step physics
  Matter.Engine.update(engine, 1000 / 60);

  // sync positions from Matter bodies back into atoms
  for (const a of atoms) {
    if (a.state !== "physical" || !a.body) continue;

    a.x = a.body.position.x;
    a.y = a.body.position.y;
  }
}

//mouse hold listeners
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  if (e.button === 0) {
    // left click: single spawn
    spawnAtomAt(mouseX, mouseY);
  } else if (e.button === 2) {
    // right button: hold to spawn
    isRightMouseDown = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2) {
    isRightMouseDown = false;
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

//disable default right button
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", handleResize);

function spawnAtomAt(x, y) {
  const atom = {
    id: atoms.length,
    state: "floating",
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: 8,
    color: "#4fd5ff",
    body: null,
  };
  atoms.push(atom);
}

function handleResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // move floor to new bottom and keep it very wide
  Matter.Body.setPosition(ground, {
    x: window.innerWidth / 2,
    y: window.innerHeight + 40,
  });
}
