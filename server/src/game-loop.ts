import type { Server } from "socket.io";
import * as CANNON from "cannon-es";
import {
  EVENTS,
  PHYSICS_HZ,
  NET_HZ,
  PLANET_RADIUS,
  PLAYER_RADIUS,
  OUTZONE_RADIUS,
} from "../../packages/shared/src/index.js";
import { PlayerManager } from "./player-manager.js";

/**
 * Start all server-side loops:
 *  - physics integration
 *  - powerup spawning & pickup
 *  - state broadcasting
 */
export function startGameLoops(
  io: Server,
  deps: {
    world: CANNON.World;
    planet: { body: CANNON.Body };
    playerManager: PlayerManager;
    powerUpManager: any;
  }
) {
  const { world, planet, playerManager, powerUpManager } = deps;

  const physicsDt = 1 / PHYSICS_HZ;

  // Hook elimination -> broadcast to clients
  playerManager.onEliminate = (id: string) => {
    io.emit(EVENTS.ELIMINATED, { id });
  };

  // Powerup spawn control
  let lastPowerupSpawnAt = 0;
  const POWERUP_SPAWN_INTERVAL_MS = 8000;
  const MAX_POWERUPS = 3;

  // ============================================================
  // PHYSICS + GAME LOOP
  // ============================================================
  setInterval(() => {
    // 1) Apply input / gravity / abilities
    playerManager.update();

    // 2) Step physics
    world.step(physicsDt);

    // 3) Keep players on planet surface & eliminate out-of-bounds
    const planetShape = planet.body.shapes[0] as CANNON.Sphere;
    const planetR = planetShape?.radius ?? PLANET_RADIUS;

    const toEliminate: string[] = [];

    for (const [id, p] of playerManager.players.entries()) {
      const body = p.body;

      const rel = body.position.vsub(planet.body.position);
      let dist = rel.length();

      if (dist === 0) {
        rel.set(0, 1, 0);
        dist = 1;
      }

      // Kill if too far away
      if (dist > OUTZONE_RADIUS) {
        toEliminate.push(id);
        continue;
      }

      // --- Surface clamping (bounce-free, boost-friendly) ---
      const FEET_OFFSET = PLAYER_RADIUS * 0.6;
      const target = planetR + PLAYER_RADIUS - FEET_OFFSET;

      // Distance error: negative = inside planet, positive = above surface
      const distError = dist - target;

      // Only clamp when the player is actually INSIDE the surface
      // (distError < -EPS). When above or roughly on surface → no clamp.
      const DIST_EPS = 0.02;

      if (distError < -DIST_EPS) {
        // Inside the planet -> push back out to the surface
        const n = rel.scale(1 / dist); // outward normal
        body.position = planet.body.position.vadd(n.scale(target));

        // Remove ONLY inward radial velocity (so they don't keep sinking)
        const radialVel = body.velocity.dot(n);
        if (radialVel < 0) {
          const vn = n.scale(radialVel);
          body.velocity.vsub(vn, body.velocity);
        }
      }
      // If distError >= -DIST_EPS:
      // - equal or slightly below: do nothing (small numerical noise)
      // - >= 0: exactly on or above surface (jump/boost/airborne) → no clamp
    }

    for (const id of toEliminate) {
      playerManager.eliminate(id);
    }

    // 4) Powerup spawning
    const now = Date.now();
    if (
      powerUpManager &&
      powerUpManager.powerups &&
      powerUpManager.powerups.size < MAX_POWERUPS &&
      now - lastPowerupSpawnAt >= POWERUP_SPAWN_INTERVAL_MS
    ) {
      lastPowerupSpawnAt = now;

      const types = ["super_boost", "mass_up", "ghost"] as const;
      const type = types[Math.floor(Math.random() * types.length)];

      const angle = Math.random() * Math.PI * 2;
      const radius = planetR + 1;

      const pos: [number, number, number] = [
        Math.cos(angle) * radius,
        (Math.random() * 2 - 1) * radius * 0.2,
        Math.sin(angle) * radius,
      ];

      const pu = powerUpManager.spawn(type, pos);
      io.emit("POWERUP_SPAWN", pu);
    }

    // 5) Powerup pickups
    if (powerUpManager) {
      const collected = powerUpManager.checkPlayerPickup(playerManager);
      if (collected) {
        io.emit("POWERUP_TAKEN", { id: collected.id });
      }
    }
  }, Math.round(1000 / PHYSICS_HZ));

  // ============================================================
  // NETWORK LOOP (STATE BROADCAST)
  // ============================================================
  setInterval(() => {
    const states = playerManager.getStates();
    io.emit(EVENTS.STATE, states);

    if (powerUpManager && typeof powerUpManager.getState === "function") {
      const pState = powerUpManager.getState();
      io.emit("POWERUP_STATE", pState);
    }
  }, Math.round(1000 / NET_HZ));
}
