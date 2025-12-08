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
import { lobbies } from "./socket-handler.js";

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

  playerManager.onEliminate = (id: string) => {
    io.emit(EVENTS.ELIMINATED, { id });
  };

  let lastPowerupSpawnAt = 0;
  const POWERUP_SPAWN_INTERVAL_MS = 8000;
  const MAX_POWERUPS = 3;

  setInterval(() => {
    playerManager.update();

    world.step(physicsDt);

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

      if (dist > OUTZONE_RADIUS) {
        toEliminate.push(id);
        continue;
      }

      const FEET_OFFSET = PLAYER_RADIUS * 0.6;
      const target = planetR + PLAYER_RADIUS - FEET_OFFSET;

      const distError = dist - target;

      const DIST_EPS = 0.02;

      if (distError < -DIST_EPS) {
        const n = rel.scale(1 / dist);
        body.position = planet.body.position.vadd(n.scale(target));

        const radialVel = body.velocity.dot(n);
        if (radialVel < 0) {
          const vn = n.scale(radialVel);
          body.velocity.vsub(vn, body.velocity);
        }
      }
    }

    for (const id of toEliminate) {
      playerManager.eliminate(id);
    }

    for (const lobby of lobbies.values()) {
      if (!lobby.matchRunning) continue;

      // Alive = players still in the physics system AND belonging to the lobby
      const alive = Array.from(lobby.players).filter((id) =>
        playerManager.players.has(id)
      );

      // Not enough players = someone won
      if (alive.length <= 1) {
        const winnerId = alive[0] ?? null;

        io.to(lobby.code).emit(EVENTS.ROUND_OVER, { winnerId });
        console.log(`🏆 ROUND OVER in Lobby ${lobby.code}:`, winnerId);

        lobby.matchRunning = false;
      }
    }

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

    if (powerUpManager) {
      const collected = powerUpManager.checkPlayerPickup(playerManager);
      if (collected) {
        io.emit("POWERUP_TAKEN", { id: collected.id });
      }
    }
  }, Math.round(1000 / PHYSICS_HZ));

  setInterval(() => {
    const states = playerManager.getStates();
    io.emit(EVENTS.STATE, states);

    if (powerUpManager && typeof powerUpManager.getState === "function") {
      const pState = powerUpManager.getState();
      io.emit("POWERUP_STATE", pState);
    }
  }, Math.round(1000 / NET_HZ));
}
