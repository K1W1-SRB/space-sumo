import * as THREE from "three";

export class GameCamera {
  camera: THREE.PerspectiveCamera;

  distance = 12;
  height = 3;
  smoothPos = 0.12;
  smoothDir = 0.08;

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
    const up = playerPos.clone().normalize();

    let desiredForward = velocity.clone().normalize();

    if (velocity.length() < 0.4 || !isFinite(desiredForward.length())) {
      desiredForward.copy(this.smoothedForward);
    }

    desiredForward = desiredForward.projectOnPlane(up).normalize();

    this.smoothedForward.lerp(desiredForward, this.smoothDir).normalize();

    const desiredPos = playerPos
      .clone()
      .add(up.clone().multiplyScalar(this.height))
      .add(this.smoothedForward.clone().multiplyScalar(-this.distance));

    const dir = desiredPos.clone().sub(playerPos).normalize();
    const ray = new THREE.Raycaster(playerPos, dir);
    const hits = ray.intersectObject(planet, false);

    let finalPos = desiredPos.clone();
    if (hits.length > 0) {
      finalPos = playerPos
        .clone()
        .add(dir.multiplyScalar(hits[0].distance - 0.8));
    }

    this.camera.position.lerp(finalPos, this.smoothPos);

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
