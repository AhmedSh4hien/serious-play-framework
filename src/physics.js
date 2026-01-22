import Matter from "matter-js";

export function createPhysics(canvas) {
  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  engine.gravity.scale = 0; // fully disable gravity

  const world = engine.world;

  // Keep your ground for now (harmless with gravity off, still can act as boundary)
  const ground = Matter.Bodies.rectangle(
    canvas.width / 2,
    canvas.height + 40,
    canvas.width,
    80,
    { isStatic: true }
  );
  Matter.World.add(world, ground);

  return { Matter, engine, world, ground };
}

export function handleResizePhysics(physics, canvas) {
  const { Matter, ground } = physics;

  // move floor to new bottom and keep it very wide
  Matter.Body.setPosition(ground, {
    x: canvas.width / 2,
    y: canvas.height + 40,
  });
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

    // carry over current motion
    Matter.Body.setVelocity(body, { x: a.vx, y: a.vy });

    Matter.World.add(world, body);
    a.body = body;
    a.state = "physical";
  }
}

export function ensureBondConstraints(physics, state) {
  const { Matter, world } = physics;
  const Constraint = Matter.Constraint;

  for (const bond of state.bonds) {
    const a = state.atoms[bond.aId];
    const b = state.atoms[bond.bId];
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
  const { Matter, engine } = physics;

  Matter.Engine.update(engine, 1000 / 60);

  for (const a of state.atoms) {
    if (!a.body) continue;

    // small random nudges to keep things alive (0 by default)
    const jitter = 0.0;
    Matter.Body.applyForce(a.body, a.body.position, {
      x: (Math.random() - 0.5) * jitter,
      y: (Math.random() - 0.5) * jitter,
    });

    a.x = a.body.position.x;
    a.y = a.body.position.y;
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
