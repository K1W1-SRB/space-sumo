import * as THREE from "three";

export class GameCamera {
  camera: THREE.PerspectiveCamera;
  offset: THREE.Vector3;
  smoothness: number;
  raycaster: THREE.Raycaster;
  orbitDistance: number;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.offset = new THREE.Vector3(0, 4, 10); // base offset above player
    this.smoothness = 0.08;
    this.raycaster = new THREE.Raycaster();
    this.orbitDistance = 15; // how far camera stays from planet center

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  update(playerPos: THREE.Vector3, planetMesh: THREE.Mesh) {
    // --- Find direction from planet center to player ---
    const planetCenter = new THREE.Vector3(0, 0, 0);
    const fromCenterToPlayer = playerPos.clone().sub(planetCenter).normalize();
    // Scale orbit distance slightly based on player distance from center
    this.orbitDistance = THREE.MathUtils.lerp(
      this.orbitDistance,
      15 + playerPos.length() * 0.1,
      0.05
    );

    // --- Place camera a fixed distance away in same direction ---
    const desiredPos = planetCenter
      .clone()
      .add(fromCenterToPlayer.clone().multiplyScalar(this.orbitDistance))
      .add(this.offset);

    // --- Collision check with planet ---
    const direction = desiredPos.clone().sub(playerPos).normalize();
    this.raycaster.set(playerPos, direction);
    const intersections = this.raycaster.intersectObject(planetMesh, false);

    let correctedPos = desiredPos.clone();
    if (intersections.length > 0) {
      const hit = intersections[0];
      correctedPos = playerPos
        .clone()
        .add(direction.multiplyScalar(hit.distance - 0.5)); // half-unit buffer
    }

    // --- Smoothly move camera to position ---
    this.camera.position.lerp(correctedPos, this.smoothness);

    // --- Always look at the player ---
    this.camera.lookAt(playerPos);
  }

  get instance() {
    return this.camera;
  }
}
