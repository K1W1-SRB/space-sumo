import * as THREE from "three";
import { PLANET_RADIUS } from "../../../packages/shared/src/index.js";

export class Planet {
  mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, radius = PLANET_RADIUS) {
    const textureLoader = new THREE.TextureLoader();
    const baseColorTexture = textureLoader.load(
      "/textures/Rock_041_basecolor.jpg"
    );
    const roughnessTexture = textureLoader.load(
      "/textures/Rock_041_basecolor.jpg"
    );
    const normalTexture = textureLoader.load("/textures/Rock_041_normal.jpg");
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      map: baseColorTexture,
      roughnessMap: roughnessTexture,
      normalMap: normalTexture,
      emissive: 0x112244,
      metalness: 0.3,
      roughness: 0.8,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);
  }

  update(delta: number) {
    this.mesh.rotation.y += delta * 0.1;
  }
}
