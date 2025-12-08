import * as THREE from "three";
import { PLANET_RADIUS } from "../../../packages/shared/src/index.js";

export class Planet {
  mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const radius = PLANET_RADIUS;

    const geo = new THREE.IcosahedronGeometry(radius, 2);

    const position = geo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);

      const dir = vertex.clone().normalize();

      const noise = Math.random() * 0.15 - 0.07;
      const stepped = Math.round(noise * 5) / 5;

      const newRadius = radius + stepped * radius * 0.3;

      vertex.copy(dir.multiplyScalar(newRadius));
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d1c5baff"),
      flatShading: true,
      bumpScale: 5,
      roughness: 1,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    scene.add(this.mesh);
  }

  update(delta: number) {}
}
