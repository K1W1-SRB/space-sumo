import * as THREE from "three";

export type ClientPowerupType = "super_boost" | "mass_up" | "ghost";

export class PowerupSystem {
  private scene: THREE.Scene;
  private geo: THREE.OctahedronGeometry;
  private materials: Record<ClientPowerupType, THREE.Material>;
  private powerups: Map<string, THREE.Mesh> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.geo = new THREE.OctahedronGeometry(0.5);

    this.materials = {
      super_boost: new THREE.MeshStandardMaterial({
        color: "#ff9933",
        emissive: "#ff6600",
        emissiveIntensity: 0.6,
      }),
      mass_up: new THREE.MeshStandardMaterial({
        color: "#bb55ff",
        emissive: "#8822ff",
        emissiveIntensity: 0.6,
      }),
      ghost: new THREE.MeshStandardMaterial({
        color: "#00e0ff",
        emissive: "#0090ff",
        emissiveIntensity: 0.6,
      }),
    };
  }

  spawn(
    id: string,
    type: ClientPowerupType,
    position: [number, number, number]
  ) {
    if (this.powerups.has(id)) return;

    const mesh = new THREE.Mesh(this.geo, this.materials[type]);
    mesh.position.set(...position);
    mesh.userData.spin = Math.random() * 0.02 + 0.01;

    this.powerups.set(id, mesh);
    this.scene.add(mesh);
  }

  remove(id: string) {
    const mesh = this.powerups.get(id);
    if (!mesh) return;

    this.scene.remove(mesh);
    this.powerups.delete(id);
  }

  syncState(
    list: {
      id: string;
      type: ClientPowerupType;
      position: [number, number, number];
    }[]
  ) {
    const active = new Set(list.map((p) => p.id));

    // Create or update
    for (const pu of list) {
      if (!this.powerups.has(pu.id)) {
        this.spawn(pu.id, pu.type, pu.position);
      } else {
        this.powerups.get(pu.id)!.position.set(...pu.position);
      }
    }

    // Remove old ones
    for (const id of this.powerups.keys()) {
      if (!active.has(id)) {
        this.remove(id);
      }
    }
  }

  update(delta: number, elapsed: number) {
    for (const mesh of this.powerups.values()) {
      mesh.rotation.y += mesh.userData.spin;
      mesh.position.y += Math.sin(elapsed * 2) * 0.002;
    }
  }
}
