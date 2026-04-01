import Matter from "matter-js";

export function createPhysics(canvas) {
  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  engine.gravity.scale = 0;

  const world = engine.world;

  const wallThickness = 80;
  const walls = {
    floor: Matter.Bodies.rectangle(
      canvas.width / 2,
      canvas.height + wallThickness / 2,
      canvas.width + wallThickness * 2,
      wallThickness,
      { isStatic: true }
    ),
    ceiling: Matter.Bodies.rectangle(
      canvas.width / 2,
      -wallThickness / 2,
      canvas.width + wallThickness * 2,
      wallThickness,
      { isStatic: true }
    ),
    left: Matter.Bodies.rectangle(
      -wallThickness / 2,
      canvas.height / 2,
      wallThickness,
      canvas.height + wallThickness * 2,
      { isStatic: true }
    ),
    right: Matter.Bodies.rectangle(
      canvas.width + wallThickness / 2,
      canvas.height / 2,
      wallThickness,
      canvas.height + wallThickness * 2,
      { isStatic: true }
    ),
  };

  Matter.World.add(world, Object.values(walls));

  return { Matter, engine, world, walls };
}

export function handleResizePhysics(physics, canvas) {
  const { Matter, world, walls } = physics;
  const t = 80;

  for (const wall of Object.values(walls)) {
    Matter.World.remove(world, wall);
  }

  walls.floor = Matter.Bodies.rectangle(
    canvas.width / 2,
    canvas.height + t / 2,
    canvas.width + t * 2,
    t,
    { isStatic: true }
  );

  walls.ceiling = Matter.Bodies.rectangle(
    canvas.width / 2,
    -t / 2,
    canvas.width + t * 2,
    t,
    { isStatic: true }
  );

  walls.left = Matter.Bodies.rectangle(
    -t / 2,
    canvas.height / 2,
    t,
    canvas.height + t * 2,
    { isStatic: true }
  );

  walls.right = Matter.Bodies.rectangle(
    canvas.width + t / 2,
    canvas.height / 2,
    t,
    canvas.height + t * 2,
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

export function updatePhysical(physics, state, canvas) {
  const { Matter, engine, world } = physics;
  Matter.Engine.update(engine, 1000 / 60);

  const margin = 40;

  for (let i = state.atoms.length - 1; i >= 0; i--) {
    const a = state.atoms[i];
    if (!a.body) continue;

    a.x = a.body.position.x;
    a.y = a.body.position.y;

    const out =
      a.x < -margin ||
      a.x > canvas.width + margin ||
      a.y < -margin ||
      a.y > canvas.height + margin;

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
  const { Matter, world, engine, walls } = physics;

  Matter.World.clear(world, false);
  Matter.Engine.clear(engine);

  if (walls) {
    const wallList = Object.values(walls).filter(Boolean);
    Matter.World.add(world, wallList);
  }
}
