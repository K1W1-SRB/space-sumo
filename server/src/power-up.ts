import * as CANNON from "cannon-es";
import { randomUUID } from "crypto";

export type PowerupType = "super_boost" | "mass_up" | "ghost";

export interface Powerup {
  id: string;
  type: PowerupType;
  body: CANNON.Body;
}

export interface SpawnedPowerupPayload {
  id: string;
  type: PowerupType;
  position: [number, number, number];
}

export class PowerUpManager {
  powerups: Map<string, Powerup> = new Map();
  world: CANNON.World;

  constructor(world: CANNON.World) {
    this.world = world;
  }

  spawn(
    type: PowerupType,
    position: [number, number, number],
    radius = 0.4
  ): SpawnedPowerupPayload {
    const shape = new CANNON.Sphere(radius);

    const body = new CANNON.Body({
      mass: 0,
      shape,
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      collisionResponse: false,
    });

    this.world.addBody(body);

    const id = randomUUID();
    this.powerups.set(id, { id, type, body });

    return { id, type, position };
  }

  remove(id: string): void {
    const p = this.powerups.get(id);
    if (!p) return;

    this.world.removeBody(p.body);
    this.powerups.delete(id);
  }

  checkPlayerPickup(playerManager: any) {
    for (const player of playerManager.players.values()) {
      for (const pu of this.powerups.values()) {
        const dist = player.body.position.distanceTo(pu.body.position);
        if (dist < 1.5) {
          this.remove(pu.id);
          playerManager.grantPowerup(player.id, pu.type);
          return pu;
        }
      }
    }
    return null;
  }

  getState(): SpawnedPowerupPayload[] {
    return [...this.powerups.values()].map((p) => ({
      id: p.id,
      type: p.type,
      position: [p.body.position.x, p.body.position.y, p.body.position.z],
    }));
  }
}
