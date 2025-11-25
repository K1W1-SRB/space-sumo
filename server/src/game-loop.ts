import type { Server } from "socket.io";
import * as CANNON from "cannon-es";
import {
  EVENTS,
  PHYSICS_HZ,
  NET_HZ,
  PLANET_RADIUS,
  PLAYER_RADIUS,
  PUSH_STIFFNESS,
  PUSH_DAMPING,
  BOOST_PUSH_MULT,
  OUTZONE_RADIUS, // ← NEW
} from "../../packages/shared/src/index.js";
import {
  playerManager as pm,
  world as w,
  planet as p,
} from "./socket-handler.js";

export function startGameLoops(
  io: Server,
  deps = { world: w, planet: p, playerManager: pm }
) {
  const { world, planet, playerManager } = deps;

  // --- Physics loop (fixed timestep) ---
  const physicsDt = 1 / PHYSICS_HZ;
  setInterval(() => {
    playerManager.update();

    // --- Sumo push: springy separation when players overlap (before step) ---
    const playersArr = Array.from(playerManager.players.values());
    for (let i = 0; i < playersArr.length; i++) {
      for (let j = i + 1; j < playersArr.length; j++) {
        const A = playersArr[i];
        const B = playersArr[j];
        const a = A.body,
          b = B.body;

        // radii (they're spheres)
        const ra = (a.shapes[0] as CANNON.Sphere).radius ?? PLAYER_RADIUS;
        const rb = (b.shapes[0] as CANNON.Sphere).radius ?? PLAYER_RADIUS;
        const minDist = ra + rb;

        const delta = b.position.vsub(a.position);
        const dist = delta.length();
        if (dist <= 1e-6) continue; // avoid NaN on identical positions

        if (dist < minDist) {
          // normal from A->B
          const n = delta.scale(1 / dist);
          const penetration = minDist - dist;

          // relative velocity along normal (for damping)
          const relVel = b.velocity.vsub(a.velocity);
          const relAlongN = relVel.dot(n);

          // base shove: spring + damping
          let mag = PUSH_STIFFNESS * penetration + PUSH_DAMPING * relAlongN;

          // boost makes the shove spicier if either pressed boost this tick
          const boosting =
            A.input?.boost || B.input?.boost ? BOOST_PUSH_MULT : 1;
          mag *= boosting;

          // split opposite impulses (equal & opposite)
          const impulse = n.scale(mag * 0.5);
          a.applyImpulse(impulse.scale(-1), a.position);
          b.applyImpulse(impulse, b.position);
        }
      }
    }

    world.step(physicsDt);

    // --- Clamp to planet surface using actual radii ---
    const planetR =
      (planet.body.shapes[0] as CANNON.Sphere).radius ?? PLANET_RADIUS;
    for (const { body } of playerManager.players.values()) {
      const playerR = (body.shapes[0] as CANNON.Sphere).radius ?? PLAYER_RADIUS;
      const surfaceDist = planetR + playerR;
      const dist = body.position.distanceTo(planet.body.position);
      if (dist < surfaceDist) {
        const correctionDir = body.position.vsub(planet.body.position).unit();
        const correction = correctionDir.scale(surfaceDist - dist);
        body.position.vadd(correction, body.position);
        body.velocity.scale(0.5, body.velocity);
      }
    }

    // --- Eliminate players outside the outzone & announce ---
    let changed = false;
    for (const [id, { body }] of Array.from(playerManager.players.entries())) {
      const dist = body.position.distanceTo(planet.body.position);
      if (dist > OUTZONE_RADIUS) {
        playerManager.removePlayer(id); // remove from simulation
        io.emit(EVENTS.ELIMINATED, { id }); // notify clients
        changed = true;
      }
    }

    // --- Optional: end round if only one player remains ---
    if (changed && playerManager.players.size === 1) {
      const [winnerId] = playerManager.players.keys();
      if (winnerId) io.emit(EVENTS.ROUND_OVER, { winnerId });
    }
  }, Math.round(1000 / PHYSICS_HZ));

  // --- Network loop (decoupled) ---
  setInterval(() => {
    const states = playerManager.getStates();
    io.emit(EVENTS.STATE, states);
  }, Math.round(1000 / NET_HZ));
}
