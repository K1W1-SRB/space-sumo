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

  applyInput(id: string, input: PlayerInput) {
    const player = this.players.get(id);
    if (player) player.input = input;
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
    for (const player of this.players.values()) {
      const { body, input } = player;

      // --- Gravity towards planet center ---
      const dirToCenter = this.planet.position.vsub(body.position);
      const gravityDir = dirToCenter.unit();
      body.applyForce(gravityDir.scale(GRAVITY_STRENGTH), body.position);

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

        // SCALE DOWN THRUST HERE – this is what was too spicy
        const MOVE_FORCE = THRUST_FORCE * 0.35; // try 0.25–0.4 range
        body.applyForce(moveDir.scale(MOVE_FORCE), body.position);
      }

      // --- Boost (space) ---
      if (input.boost) {
        body.applyImpulse(gravityDir.scale(-BOOST_IMPULSE), body.position);
      }

      // --- Powerup effects ---
      const effect = this.effects.get(player.id);
      if (effect) {
        if (Date.now() > effect.until) {
          this.effects.delete(player.id);
        } else {
          if (effect.type === "mass_up") {
            body.mass = 2;
          }
          if (effect.type === "ghost") {
            body.collisionResponse = false;
          }
          if (effect.type === "super_boost" && input.boost) {
            body.applyImpulse(
              gravityDir.scale(-BOOST_IMPULSE * 3),
              body.position
            );
          }
        }
      }

      // reset per-tick overrides
      body.mass = 1;
      body.collisionResponse = true;

      // --- Active Push (E) ---
      if (input.push) {
        const now = Date.now();
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
            const dir = obody.position.vsub(origin).unit(); // from me -> them
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

      // --- Tangential damping + max speed clamp ---
      const vel = body.velocity;
      const speed = vel.length();
      if (speed > 1e-3) {
        const MAX_SPEED = 12; // tune this if you want slower/faster overall

        if (speed > MAX_SPEED) {
          vel.scale(MAX_SPEED / speed, vel);
        }

        const DAMPING = 0.9; // 0.85 = sticky, 0.95 = slippy
        vel.scale(DAMPING, vel);
      }
    }
  }

  getStates(): PlayerState[] {
    return Array.from(this.players.values()).map(({ id, body, color }) => ({
      id,
      position: [body.position.x, body.position.y, body.position.z],
      velocity: [
        (body.velocity.x *= DAMPING),
        (body.velocity.y *= DAMPING),
        (body.velocity.z *= DAMPING),
      ],
      color,
    }));
  }
}
