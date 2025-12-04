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
        this.effects.set(id, { type, until: now + 10000 });
        break;

      case "mass_up":
        this.effects.set(id, { type, until: now + 10000 });
        break;

      case "ghost":
        this.effects.set(id, { type, until: now + 10000 });
        break;
    }
  }

  update() {
    const now = Date.now();

    for (const player of this.players.values()) {
      const { body, input } = player;

      // --- Gravity frame / basis ---
      const dirToCenter = this.planet.position.vsub(body.position);
      const gravityDir = dirToCenter.unit();
      const up = gravityDir.scale(-1);

      const east = new CANNON.Vec3(1, 0, 0);
      const north = new CANNON.Vec3(0, 0, 1);

      let right = up.cross(east);
      if (right.length() < 0.001) {
        right = up.cross(north);
      }
      right = right.unit();
      const forward = right.cross(up).unit();

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
            body.updateMassProperties();
          }
          if (effect.type === "ghost") {
            ghostActive = true;
            body.collisionResponse = false;
            body.collisionFilterMask = 0;
          }
          if (effect.type === "super_boost") {
            superBoostActive = true;
          }
        }
      }

      const [tx, , tz] = input.thrust;
      if (Math.abs(tx) > 0 || Math.abs(tz) > 0) {
        const moveDir = forward.scale(tz).vadd(right.scale(tx));
        const len = moveDir.length();
        if (len > 1e-4) moveDir.scale(1 / len, moveDir);

        const MOVE_FORCE = THRUST_FORCE * 0.35;
        body.applyForce(moveDir.scale(MOVE_FORCE), body.position);
      }

      if (input.boost) {
        input.boost = false;

        const power = BOOST_IMPULSE * (superBoostActive ? 2.5 : 1);
        body.applyImpulse(up.scale(power), body.position);

        (body as any)._justBoosted = true;

        console.log("BOOST impulse applied", player.id, body.velocity);
      }

      body.applyForce(gravityDir.scale(GRAVITY_STRENGTH), body.position);

      if (input.push) {
        input.push = false;

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

      if (!massUpActive && body.mass !== 1) {
        body.mass = 1;
        body.updateMassProperties();
      }
      if (!ghostActive) {
        body.collisionResponse = true;
        body.collisionFilterMask = 1;
      }

      body.velocity.scale(DAMPING, body.velocity);
    }
  }

  getStates(): PlayerState[] {
    return Array.from(this.players.values()).map(({ id, body, color }) => {
      const eff = this.effects.get(id);

      return {
        id,
        position: [body.position.x, body.position.y, body.position.z],
        velocity: [body.velocity.x, body.velocity.y, body.velocity.z],
        color,
        effect: eff
          ? {
              type: eff.type,
              until: eff.until,
            }
          : null,
      };
    });
  }
}
