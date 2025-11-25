import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLAYER_RADIUS } from "../../../packages/shared/src/index.js";

export class Player {
  mesh: THREE.Group; // a group to hold the loaded model
  color: string;
  model?: THREE.Object3D; // reference to loaded 3D model for disposal

  // --- Animation stuff ---
  mixer?: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction> = {};
  currentAction?: string;
  idleActionName?: string;
  moveActionName?: string;

  constructor(scene: THREE.Scene, color = "#ff4444") {
    this.color = color;
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // --- Load GLB model ---
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const characterTexture = textureLoader.load(
      "/textures/character/texture-d.png"
    );
    characterTexture.flipY = false;
    characterTexture.colorSpace = THREE.SRGBColorSpace;

    loader.load(
      "models/character-d.glb",
      (gltf) => {
        this.model = gltf.scene;

        // scale
        this.model.scale.set(
          PLAYER_RADIUS * 1,
          PLAYER_RADIUS * 1,
          PLAYER_RADIUS * 1
        );

        // IMPORTANT: don't randomly flip forward; let animations define it
        this.model.rotation.y = 0;

        // texture and shadows
        this.model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const mat = new THREE.MeshStandardMaterial({
              map: characterTexture,
              metalness: 0.0,
              roughness: 0.8,
            });
            mesh.material = mat;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        this.mesh.add(this.model);

        // --- Setup animations ---
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);

          gltf.animations.forEach((clip, index) => {
            const name = clip.name || `clip_${index}`;
            const action = this.mixer!.clipAction(clip);
            action.enabled = true;
            action.clampWhenFinished = false;
            action.loop = THREE.LoopRepeat;
            this.actions[name] = action;
          });

          const names = Object.keys(this.actions);

          // pick idle and move clips by name heuristics
          this.idleActionName = names.find((n) => /idle/i.test(n)) || names[0];

          this.moveActionName =
            names.find((n) => /(run|walk|move)/i.test(n)) ||
            this.idleActionName;

          // start in idle
          if (this.idleActionName) {
            this.playAction(this.idleActionName, 0);
          }
        }
      },
      undefined,
      (err) => {
        console.error("❌ Error loading player model:", err);
        // fallback sphere if load fails
        const geom = new THREE.SphereGeometry(PLAYER_RADIUS, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: this.color });
        const fallback = new THREE.Mesh(geom, mat);
        this.mesh.add(fallback);
      }
    );
  }

  // --- Core transforms from server state ---

  updatePosition(pos: [number, number, number]) {
    this.mesh.position.set(pos[0], pos[1], pos[2]);
  }

  updateRotation(velocity: THREE.Vector3, planetPos: THREE.Vector3) {
    if (!this.mesh) return;

    const up = this.mesh.position.clone().sub(planetPos).normalize();

    const upQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      up
    );

    const horiz = velocity.clone().projectOnPlane(up);
    let yawQuat = new THREE.Quaternion();

    if (horiz.lengthSq() > 0.0001) {
      const forward = horiz.normalize();
      const m = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        forward,
        up
      );
      yawQuat.setFromRotationMatrix(m);
    }

    const target = new THREE.Quaternion();
    target.multiplyQuaternions(upQuat, yawQuat);

    this.mesh.quaternion.slerp(target, 0.2);

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      this.mesh.quaternion
    );
    const sideSpeed = velocity.dot(right);

    const tilt = THREE.MathUtils.clamp(-sideSpeed * 0.03, -0.25, 0.25);
    const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      tilt
    );

    this.mesh.quaternion.multiply(tiltQuat);
  }

  private playAction(name: string, fade: number = 0.2) {
    if (!this.mixer) return;
    if (this.currentAction === name) return;

    const next = this.actions[name];
    if (!next) return;

    const current = this.currentAction
      ? this.actions[this.currentAction]
      : undefined;

    if (current) {
      current.fadeOut(fade);
    }

    next.reset().fadeIn(fade).play();
    this.currentAction = name;
  }

  updateAnimationFromVelocity(velocity: THREE.Vector3) {
    if (!this.mixer) return;

    const speed = velocity.length();
    const moveThreshold = 0.5;

    let target: string | undefined;
    if (speed > moveThreshold) {
      target = this.moveActionName || this.idleActionName;
    } else {
      target = this.idleActionName;
    }

    if (target) {
      this.playAction(target);
    }
  }

  // tick mixer every frame
  update(delta: number) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model as any);
    }
    if (this.model) {
      this.model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            (mesh.material as THREE.Material)?.dispose();
          }
        }
      });
    }
  }
}
