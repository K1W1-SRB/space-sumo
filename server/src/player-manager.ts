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
} from "../../packages/shared/src/index.js";

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

  update() {
    // iterate full player objects so we can touch lastPushAt, id, etc.
    for (const player of this.players.values()) {
      const { body, input } = player;

      // --- Gravity ---
      const dirToCenter = this.planet.position.vsub(body.position);
      const gravityDir = dirToCenter.unit();
      body.applyForce(gravityDir.scale(GRAVITY_STRENGTH), body.position);

      // --- Tangent frame ---
      const up = gravityDir.scale(-1); // outward normal
      // choose a non-parallel axis (your original used Z; keep it)
      const arbitrary = new CANNON.Vec3(0, 0, 1);
      if (Math.abs(up.dot(arbitrary)) > 0.9) arbitrary.set(1, 0, 0);

      const right = up.cross(arbitrary).unit();
      const forward = right.cross(up).unit();

      // --- Input thrust ---
      const [tx, , tz] = input.thrust;
      const moveDir = forward.scale(tz).vadd(right.scale(tx));
      body.applyForce(moveDir.scale(THRUST_FORCE), body.position);

      // --- Boost ---
      if (input.boost) {
        body.applyImpulse(gravityDir.scale(-BOOST_IMPULSE), body.position);
      }

      // --- Active Push (E): shove nearby opponents away, with small self recoil ---
      if (input.push) {
        const now = Date.now();
        if (now - player.lastPushAt >= PUSH_ABILITY_COOLDOWN_MS) {
          player.lastPushAt = now;

          const origin = body.position;
          const victims: CANNON.Body[] = [];

          // collect nearby opponents within radius
          for (const other of this.players.values()) {
            if (other.id === player.id) continue;
            const d = other.body.position.distanceTo(origin);
            if (d <= PUSH_ABILITY_RADIUS && d > 1e-6) {
              victims.push(other.body);
            }
          }

          // apply impulses to victims
          for (const obody of victims) {
            const dir = obody.position.vsub(origin).unit(); // from me -> them
            obody.applyImpulse(dir.scale(PUSH_ABILITY_IMPULSE), obody.position);
          }

          // tiny recoil on self so it feels punchy (opposite average shove)
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
    }
  }

  getStates(): PlayerState[] {
    return Array.from(this.players.values()).map(({ id, body, color }) => ({
      id,
      position: [body.position.x, body.position.y, body.position.z],
      velocity: [body.velocity.x, body.velocity.y, body.velocity.z],
      color,
    }));
  }
}
