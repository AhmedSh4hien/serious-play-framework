import Matter from "matter-js";

export function createPhysics(canvas) {
  const engine = Matter.Engine.create()
  engine.gravity.x = 0
  engine.gravity.y = 0
  engine.gravity.scale = 0

  const world = engine.world

  const wallThickness = 80
  const walls = {
    floor: Matter.Bodies.rectangle(
      canvas.width / 2, canvas.height + wallThickness / 2,
      canvas.width + wallThickness * 2, wallThickness,
      { isStatic: true }
    ),
    ceiling: Matter.Bodies.rectangle(
      canvas.width / 2, -wallThickness / 2,
      canvas.width + wallThickness * 2, wallThickness,
      { isStatic: true }
    ),
    left: Matter.Bodies.rectangle(
      -wallThickness / 2, canvas.height / 2,
      wallThickness, canvas.height + wallThickness * 2,
      { isStatic: true }
    ),
    right: Matter.Bodies.rectangle(
      canvas.width + wallThickness / 2, canvas.height / 2,
      wallThickness, canvas.height + wallThickness * 2,
      { isStatic: true }
    ),
  }

  Matter.World.add(world, Object.values(walls))

  return { Matter, engine, world, walls }
}


export function handleResizePhysics(physics, canvas) {
  const { Matter, walls } = physics
  const t = 80

  Matter.Body.setPosition(walls.floor,   { x: canvas.width / 2, y: canvas.height + t / 2 })
  Matter.Body.setPosition(walls.ceiling, { x: canvas.width / 2, y: -t / 2 })
  Matter.Body.setPosition(walls.left,    { x: -t / 2, y: canvas.height / 2 })
  Matter.Body.setPosition(walls.right,   { x: canvas.width + t / 2, y: canvas.height / 2 })
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
  const { Matter, engine, world } = physics
  Matter.Engine.update(engine, 1000 / 60)

  const margin = 300

  for (let i = state.atoms.length - 1; i >= 0; i--) {
    const a = state.atoms[i]
    if (!a.body) continue

    a.x = a.body.position.x
    a.y = a.body.position.y

    const out =
      a.x < -margin || a.x > window.innerWidth + margin ||
      a.y < -margin || a.y > window.innerHeight + margin

    if (out) {
      // remove any bond constraints referencing this atom
      for (let j = state.bonds.length - 1; j >= 0; j--) {
        const bond = state.bonds[j]
        if (bond.aId === a.id || bond.bId === a.id) {
          if (bond.constraint) Matter.World.remove(world, bond.constraint)
          state.bonds.splice(j, 1)
        }
      }

      Matter.World.remove(world, a.body)
      state.atomById.delete(a.id)
      state.atoms.splice(i, 1)
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

  const bodyToAtom = new Map();
  for (const a of state.atoms) {
    if (a.body) bodyToAtom.set(a.body.id, a);
  }
  state._bodyToAtom = bodyToAtom;

  Matter.Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const a = bodyToAtom.get(pair.bodyA.id);
      const b = bodyToAtom.get(pair.bodyB.id);
      if (!a || !b) continue;
      onBond(a, b);
    }
  });
}
