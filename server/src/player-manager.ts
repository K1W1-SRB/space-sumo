import * as CANNON from "cannon-es";
import {
  PlayerInput,
  PlayerState,
  THRUST_FORCE,
  GRAVITY_STRENGTH,
  BOOST_IMPULSE,
  PLAYER_RADIUS,
  PUSH_ABILITY_RADIUS,
  PUSH_ABILITY_IMPULSE,
  PUSH_ABILITY_COOLDOWN_MS,
  DAMPING,
} from "../../packages/shared/src/index.js";
import { PowerupType } from "./power-up.js";

interface PlayerEffect {
  type: PowerupType;
  until: number;
}

interface Player {
  id: string;
  body: CANNON.Body;
  color: string;
  input: PlayerInput;
  lastPushAt: number;
}

export class PlayerManager {
  players: Map<string, Player> = new Map();
  planet: CANNON.Body;
  effects: Map<string, PlayerEffect> = new Map();
  onEliminate?: (id: string) => void;

  constructor(private world: CANNON.World, planet: { body: CANNON.Body }) {
    this.planet = planet.body;
  }

  addPlayer(id: string, color: string) {
    const shape = new CANNON.Sphere(PLAYER_RADIUS);
    const body = new CANNON.Body({
      mass: 1,
      shape,
      position: new CANNON.Vec3(Math.random() * 4, 6, Math.random() * 4),
    });
    body.linearDamping = 0.02;
    body.angularDamping = 0.1;
    this.world.addBody(body);

    this.players.set(id, {
      id,
      body,
      color,
      input: { thrust: [0, 0, 0], boost: false, push: false },
      lastPushAt: 0,
    });
  }

  eliminate(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    this.world.removeBody(p.body);
    this.players.delete(id);
    if (this.onEliminate) this.onEliminate(id);
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (player) {
      this.world.removeBody(player.body);
      this.players.delete(id);
    }
  }

  /**
   * Network → server input.
   * - Thrust is continuous: always overwritten.
   * - Boost/push are one-shot: we only set them when true, never overwrite with false.
   */
  applyInput(id: string, input: PlayerInput) {
    const player = this.players.get(id);
    if (!player) return;

    // continuous
    player.input.thrust = input.thrust;

    if (input.boost) {
      player.input.boost = true;
    }
    if (input.push) {
      player.input.push = true;
    }
  }

  grantPowerup(id: string, type: PowerupType) {
    const now = Date.now();

    switch (type) {
      case "super_boost":
        this.effects.set(id, { type, until: now + 3000 });
        break;

      case "mass_up":
        this.effects.set(id, { type, until: now + 5000 });
        break;

      case "ghost":
        this.effects.set(id, { type, until: now + 1000 });
        break;
    }
  }

  update() {
    const now = Date.now();

    for (const player of this.players.values()) {
      const { body, input } = player;

      // --- Gravity towards planet center ---
      const dirToCenter = this.planet.position.vsub(body.position);
      const gravityDir = dirToCenter.unit();

      // --- Tangent frame (movement along surface) ---
      const up = gravityDir.scale(-1); // player local up (away from planet)

      const east = new CANNON.Vec3(1, 0, 0);
      const north = new CANNON.Vec3(0, 0, 1);

      let right = up.cross(east);
      if (right.length() < 0.001) {
        right = up.cross(north);
      }
      right = right.unit();

      const forward = right.cross(up).unit();

      // --- Resolve active powerup flags for this tick ---
      const effect = this.effects.get(player.id);
      let massUpActive = false;
      let ghostActive = false;
      let superBoostActive = false;

      if (effect) {
        if (now > effect.until) {
          this.effects.delete(player.id);
        } else {
          if (effect.type === "mass_up") {
            massUpActive = true;
            body.mass = 2;
          }
          if (effect.type === "ghost") {
            ghostActive = true;
            body.collisionResponse = false;
          }
          if (effect.type === "super_boost") {
            superBoostActive = true;
          }
        }
      }

      // --- Input thrust (WASD) ---
      const [tx, , tz] = input.thrust;
      const hasInput = Math.abs(tx) > 0 || Math.abs(tz) > 0;

      if (hasInput) {
        // build movement direction in tangent space
        const moveDir = forward.scale(tz).vadd(right.scale(tx));

        // normalize so diagonals aren't faster
        const len = moveDir.length();
        if (len > 1e-4) {
          moveDir.scale(1 / len, moveDir);
        }

        const MOVE_FORCE = THRUST_FORCE * 0.35;
        body.applyForce(moveDir.scale(MOVE_FORCE), body.position);
      }

      // --- Boost (space, one-shot, latched) ---
      let justBoosted = false;

      if (player.input.boost) {
        player.input.boost = false; // consume

        const up = gravityDir.scale(-1); // correct upward/outward direction
        const power = BOOST_IMPULSE * (superBoostActive ? 3 : 1);

        body.applyImpulse(up.scale(power), body.position);

        justBoosted = true;
      }

      body.applyForce(gravityDir.scale(GRAVITY_STRENGTH), body.position);

      if (justBoosted) {
        // Reduce gravity for 2 frames after boost
        body.applyForce(
          gravityDir.scale(-GRAVITY_STRENGTH * 0.6),
          body.position
        );
      }

      // --- Active Push (E, one-shot, latched) ---
      if (player.input.push) {
        player.input.push = false; // consume

        if (now - player.lastPushAt >= PUSH_ABILITY_COOLDOWN_MS) {
          player.lastPushAt = now;

          const origin = body.position;
          const victims: CANNON.Body[] = [];

          for (const other of this.players.values()) {
            if (other.id === player.id) continue;

            const d = other.body.position.distanceTo(origin);
            if (d <= PUSH_ABILITY_RADIUS && d > 1e-6) {
              victims.push(other.body);
            }
          }

          for (const obody of victims) {
            const dir = obody.position.vsub(origin).unit();
            obody.applyImpulse(dir.scale(PUSH_ABILITY_IMPULSE), obody.position);
          }

          if (victims.length > 0) {
            const avg = new CANNON.Vec3(0, 0, 0);
            for (const obody of victims) {
              avg.vadd(obody.position.vsub(origin).unit(), avg);
            }
            avg.scale(1 / victims.length, avg);
            body.applyImpulse(
              avg.scale(-PUSH_ABILITY_IMPULSE * 0.25),
              body.position
            );
          }
        }
      }

      // --- Reset per-tick overrides if effect not active ---
      if (!massUpActive) body.mass = 1;
      if (!ghostActive) body.collisionResponse = true;

      // --- Tangential damping + max speed clamp ---
      const vel = body.velocity;
      const speed = vel.length();
      if (speed > 1e-3) {
        const BASE_MAX_SPEED = 12;

        const maxSpeed = justBoosted ? Infinity : BASE_MAX_SPEED;
        justBoosted = true;

        if (speed > maxSpeed) {
          vel.scale(maxSpeed / speed, vel);
        }

        if (!justBoosted) {
          vel.scale(DAMPING, vel);
        }
      }
    }
  }

  getStates(): PlayerState[] {
    // IMPORTANT: do NOT mutate velocity here. Just read it.
    return Array.from(this.players.values()).map(({ id, body, color }) => ({
      id,
      position: [body.position.x, body.position.y, body.position.z],
      velocity: [body.velocity.x, body.velocity.y, body.velocity.z],
      color,
    }));
  }
}
