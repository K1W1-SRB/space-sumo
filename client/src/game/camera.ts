import * as THREE from "three";

export class GameCamera {
  camera: THREE.PerspectiveCamera;

  distance = 12; // fixed camera distance
  height = 3; // slight lift above player
  smoothPos = 0.12; // position smoothing
  smoothDir = 0.08; // direction smoothing

  // smooth forward direction (solves jerkiness!)
  private smoothedForward = new THREE.Vector3(1, 0, 0);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  update(
    playerPos: THREE.Vector3,
    planet: THREE.Mesh,
    velocity: THREE.Vector3
  ) {
    // Surface normal (planet center = origin)
    const up = playerPos.clone().normalize();

    // Compute NEW forward (from velocity or fallback)
    let desiredForward = velocity.clone().normalize();

    // If velocity is tiny, keep old forward (prevents jerky snapping)
    if (velocity.length() < 0.4 || !isFinite(desiredForward.length())) {
      desiredForward.copy(this.smoothedForward);
    }

    // Project onto tangent plane
    desiredForward = desiredForward.projectOnPlane(up).normalize();

    // Smooth the forward direction (this fixes jerkiness!)
    this.smoothedForward.lerp(desiredForward, this.smoothDir).normalize();

    // Compute desired camera position
    const desiredPos = playerPos
      .clone()
      .add(up.clone().multiplyScalar(this.height)) // lift
      .add(this.smoothedForward.clone().multiplyScalar(-this.distance)); // behind

    // Collision test with planet
    const dir = desiredPos.clone().sub(playerPos).normalize();
    const ray = new THREE.Raycaster(playerPos, dir);
    const hits = ray.intersectObject(planet, false);

    let finalPos = desiredPos.clone();
    if (hits.length > 0) {
      finalPos = playerPos
        .clone()
        .add(dir.multiplyScalar(hits[0].distance - 0.8));
    }

    // Smooth camera motion
    this.camera.position.lerp(finalPos, this.smoothPos);

    // Smooth look-at target
    const currentLook = new THREE.Vector3();
    this.camera.getWorldDirection(currentLook);

    const targetLook = playerPos.clone().sub(this.camera.position).normalize();
    const blendedLook = currentLook.lerp(targetLook, this.smoothDir);

    this.camera.lookAt(this.camera.position.clone().add(blendedLook));
  }

  get instance() {
    return this.camera;
  }
}
