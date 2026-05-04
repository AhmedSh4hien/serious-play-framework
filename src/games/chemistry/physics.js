import Matter from "matter-js";

export function createPhysics(canvas) {
  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  engine.gravity.scale = 0;

  const world = engine.world;

  const physics = {
    Matter,
    engine,
    world,
    walls: {},
    width: canvas.clientWidth || 800,
    height: canvas.clientHeight || 600,
  };

  handleResizePhysics(physics, {
    width: physics.width,
    height: physics.height,
  });

  return physics;
}

export function handleResizePhysics(physics, size) {
  const { Matter, world, walls } = physics;
  const t = 150;
  const w = size.width;
  const h = size.height;

  physics.width = w;
  physics.height = h;

  for (const wall of Object.values(walls)) {
    if (wall) Matter.World.remove(world, wall);
  }

  walls.floor = Matter.Bodies.rectangle(
    w / 2,
    h + t / 2,
    w + t * 2,
    t,
    { isStatic: true }
  );

  walls.ceiling = Matter.Bodies.rectangle(
    w / 2,
    -t / 2,
    w + t * 2,
    t,
    { isStatic: true }
  );

  walls.left = Matter.Bodies.rectangle(
    -t / 2,
    h / 2,
    t,
    h + t * 2,
    { isStatic: true }
  );

  walls.right = Matter.Bodies.rectangle(
    w + t / 2,
    h / 2,
    t,
    h + t * 2,
    { isStatic: true }
  );

  Matter.World.add(world, Object.values(walls));
}

export function convertToPhysical(physics, state) {
  const { Matter, world } = physics;

  for (const a of state.atoms) {
    if (a.state !== "toPhysical") continue;
    if (a.body) continue;

    const body = Matter.Bodies.circle(a.x, a.y, a.radius, {
      frictionAir: 0,
      restitution: 0.6,
    });

    Matter.Body.setVelocity(body, { x: a.vx, y: a.vy });
    Matter.World.add(world, body);

    a.body = body;
    a.state = "physical";

    if (state._bodyToAtom) state._bodyToAtom.set(body.id, a);
  }
}

export function ensureBondConstraints(physics, state) {
  const { Matter, world } = physics;
  const Constraint = Matter.Constraint;

  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;
    if (!a.body || !b.body) continue;
    if (bond.constraint) continue;

    bond.constraint = Constraint.create({
      bodyA: a.body,
      bodyB: b.body,
      length: 30,
      stiffness: 0.9,
      damping: 0.2,
    });

    Matter.World.add(world, bond.constraint);
  }
}

export function updatePhysical(physics, state) {
  const { Matter, engine, world, width, height } = physics;
  Matter.Engine.update(engine, 1000 / 60);

  const MAX_SPEED = 25;
  for (const a of state.atoms) {
    if (!a.body) continue;
    const vx = a.body.velocity.x;
    const vy = a.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      Matter.Body.setVelocity(a.body, {
        x: vx * scale,
        y: vy * scale,
      });
    }
  }

  const margin = 200;

  for (let i = state.atoms.length - 1; i >= 0; i--) {
    const a = state.atoms[i];
    if (!a.body) continue;

    a.x = a.body.position.x;
    a.y = a.body.position.y;

    const out =
      a.x < -margin ||
      a.x > width + margin ||
      a.y < -margin ||
      a.y > height + margin;

    if (out) {
      for (let j = state.bonds.length - 1; j >= 0; j--) {
        const bond = state.bonds[j];
        if (bond.aId === a.id || bond.bId === a.id) {
          const otherId = bond.aId === a.id ? bond.bId : bond.aId;
          const other = state.atomById.get(otherId);

          if (bond.constraint) Matter.World.remove(world, bond.constraint);

          if (other) {
            other.currentBonds = Math.max(0, other.currentBonds - 1);
          }

          state.bonds.splice(j, 1);
        }
      }

      if (a.body && state._bodyToAtom) {
        state._bodyToAtom.delete(a.body.id);
      }

      Matter.World.remove(world, a.body);
      state.atomById.delete(a.id);
      state.atoms.splice(i, 1);
    }
  }
}

export function createBondConstraint(physics, a, b) {
  const { Matter, world } = physics;
  const Constraint = Matter.Constraint;

  const constraint = Constraint.create({
    bodyA: a.body,
    bodyB: b.body,
    length: 30,
    stiffness: 0.9,
    damping: 0.2,
  });

  Matter.World.add(world, constraint);
  return constraint;
}

export function installCollisionBonding(physics, state, _chemistry, onBond) {
  const { Matter, engine } = physics;

  if (!state._bodyToAtom) {
    state._bodyToAtom = new Map();
  }

  Matter.Events.on(engine, "collisionStart", (event) => {
    const bodyToAtom = state._bodyToAtom;

    for (const pair of event.pairs) {
      const a = bodyToAtom.get(pair.bodyA.id);
      const b = bodyToAtom.get(pair.bodyB.id);
      if (!a || !b) continue;
      onBond(a, b);
    }
  });
}

export function resetPhysicsWorld(physics) {
  const { Matter, world, engine } = physics;

  Matter.World.clear(world, false);
  Matter.Engine.clear(engine);

  handleResizePhysics(physics, {
    width: physics.width,
    height: physics.height,
  });
}