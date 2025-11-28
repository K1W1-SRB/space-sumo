import * as THREE from "three";
import { PLAYER_RADIUS } from "../../../packages/shared/src/index.js";

export class Player {
  mesh: THREE.Group;

  // body parts
  private head!: THREE.Mesh;
  private body!: THREE.Mesh;

  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;

  private face!: THREE.Group;

  private time = 0;
  private isMoving = false;

  // NEW ANIMATION STATE
  private isJumping = false;
  private jumpTimer = 0;

  private isPushing = false;
  private pushTimer = 0;

  constructor(scene: THREE.Scene, color = "#4466ff") {
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    this.buildChibiLowPoly(color);
  }

  private flat(color: string) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
  }

  private buildChibiLowPoly(color: string) {
    const r = PLAYER_RADIUS;

    const skin = this.flat("#f5d2b3");
    const beltMat = this.flat(color);
    const clothMat = this.flat("#e3c5a3");
    const hairMat = this.flat("#3b2a28");
    const black = this.flat("#000000");

    const sumo = new THREE.Group();

    // ===== HEAD =====
    const headGeo = new THREE.SphereGeometry(r * 0.8, 8, 5);
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = r * 1.6;
    head.castShadow = head.receiveShadow = true;
    this.head = head;
    sumo.add(head);

    // ===== BUN =====
    const bunGeo = new THREE.SphereGeometry(r * 0.35, 6, 4);
    const bun = new THREE.Mesh(bunGeo, hairMat);
    bun.position.set(0, head.position.y + r * 0.55, 0);
    bun.castShadow = bun.receiveShadow = true;
    sumo.add(bun);

    // ===== BODY =====
    const bodyGeo = new THREE.SphereGeometry(r * 0.9, 8, 6);
    const body = new THREE.Mesh(bodyGeo, skin);
    body.scale.set(1.0, 0.75, 1.0);
    body.position.y = r * 0.8;
    body.castShadow = body.receiveShadow = true;
    this.body = body;
    sumo.add(body);

    // ===== BELT =====
    const beltGeo = new THREE.CylinderGeometry(r * 1.05, r * 1.05, r * 0.25, 8);
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.rotation.y = Math.PI / 2; // Correct orientation
    belt.position.y = r * 0.78;
    belt.castShadow = belt.receiveShadow = true;
    sumo.add(belt);

    // ===== FRONT CLOTH =====
    const clothGeo = new THREE.BoxGeometry(r * 0.45, r * 0.6, r * 0.15);
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0, r * 0.42, r * 0.95);
    cloth.castShadow = cloth.receiveShadow = true;
    sumo.add(cloth);

    // ===== LIMBS =====
    const armGeo = new THREE.CylinderGeometry(r * 0.18, r * 0.18, r * 0.65, 6);

    const leftArm = new THREE.Mesh(armGeo, skin);
    leftArm.position.set(r * 1.05, r * 1.0, 0);
    leftArm.rotation.set(0, 0, -0.7); // Improved resting pose
    this.leftArm = leftArm;
    sumo.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = -r * 1.05;
    rightArm.rotation.set(0, 0, 0.7);
    this.rightArm = rightArm;
    sumo.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(r * 0.25, r * 0.25, r * 0.7, 6);

    const leftLeg = new THREE.Mesh(legGeo, skin);
    leftLeg.position.set(r * 0.4, r * 0.25, 0);
    this.leftLeg = leftLeg;
    sumo.add(leftLeg);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = -r * 0.4;
    this.rightLeg = rightLeg;
    sumo.add(rightLeg);

    // ===== FACE (PARENTED TO HEAD) =====
    const face = new THREE.Group();

    // Local offsets relative to head
    face.position.set(0, 0.2, r * 0.78);

    const eyeGeo = new THREE.PlaneGeometry(r * 0.12, r * 0.12);
    const leftEye = new THREE.Mesh(eyeGeo, black);
    leftEye.position.set(-r * 0.28, 0.05, 0);
    face.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = r * 0.28;
    face.add(rightEye);

    const mouthGeo = new THREE.PlaneGeometry(r * 0.25, r * 0.08);
    const mouth = new THREE.Mesh(mouthGeo, black);
    mouth.position.set(0, -r * 0.15, 0);
    face.add(mouth);

    this.face = face;
    head.add(face); // IMPORTANT: face follows head perfectly

    sumo.position.y = PLAYER_RADIUS * 0.9;
    this.mesh.add(sumo);
  }

  static computeStableFrame(pos: THREE.Vector3) {
    const up = pos.clone().normalize();

    const EAST = new THREE.Vector3(1, 0, 0);
    const NORTH = new THREE.Vector3(0, 0, 1);

    let right = new THREE.Vector3().crossVectors(up, EAST);

    if (right.length() < 0.001) {
      right = new THREE.Vector3().crossVectors(up, NORTH);
    }

    right.normalize();

    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    return { forward, right, up };
  }

  // ===== API =====
  updatePosition(pos: [number, number, number]) {
    this.mesh.position.set(pos[0], pos[1], pos[2]);
  }

  // Triggered externally
  triggerJump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpTimer = 0;
    }
  }

  triggerPush() {
    if (!this.isPushing) {
      this.isPushing = true;
      this.pushTimer = 0;
    }
  }

  updateRotation(velocity: THREE.Vector3, planetPos: THREE.Vector3) {
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

    this.mesh.quaternion.slerp(target, 0.18);

    // tilt
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      this.mesh.quaternion
    );
    const sideSpeed = velocity.dot(right);
    const tilt = THREE.MathUtils.clamp(-sideSpeed * 0.025, -0.2, 0.2);

    const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      tilt
    );
    this.mesh.quaternion.multiply(tiltQuat);
  }

  updateAnimationFromVelocity(v: THREE.Vector3) {
    this.isMoving = v.length() > 0.4;
  }

  // ===== JUMP ANIMATION =====
  private updateJump(delta: number) {
    if (!this.isJumping) return;

    this.jumpTimer += delta;
    const t = this.jumpTimer;

    // 0–0.12: squat
    if (t < 0.12) {
      this.body.scale.set(1.1, 0.7, 1.1);
      this.head.position.y -= 0.12;
    }
    // 0.12–0.25: stretch upward
    else if (t < 0.25) {
      this.body.scale.set(0.95, 1.15, 0.95);
      this.head.position.y += 0.18;
    }
    // 0.25–0.5: airborne
    else if (t < 0.5) {
      this.body.scale.set(1, 1, 1);
    }
    // landing
    else {
      this.body.scale.set(1, 0.85, 1);
      this.head.position.y -= 0.05;

      if (t > 0.65) {
        this.body.scale.set(1, 1, 1);
        this.head.position.y = PLAYER_RADIUS * 1.6;
        this.isJumping = false;
      }
    }
  }

  // ===== PUSH ANIMATION =====
  private updatePush(delta: number) {
    if (!this.isPushing) return;

    this.pushTimer += delta;
    const t = this.pushTimer;

    if (t < 0.12) {
      // wind-up
      this.leftArm.rotation.x = -0.7;
      this.rightArm.rotation.x = -0.7;
    } else if (t < 0.25) {
      // thrust
      this.leftArm.rotation.x = 1.0;
      this.rightArm.rotation.x = 1.0;
    } else {
      // recover
      this.leftArm.rotation.x *= 0.6;
      this.rightArm.rotation.x *= 0.6;
    }

    if (t > 0.45) {
      this.isPushing = false;

      // return to idle pose
      this.leftArm.rotation.set(0, 0, -0.7);
      this.rightArm.rotation.set(0, 0, 0.7);
    }
  }

  update(delta: number) {
    this.time += delta;

    const speed = this.isMoving ? 1 : 0;
    const freq = 5 * speed;

    // Walk arms
    const armSwing = Math.sin(this.time * freq) * 0.4 * speed;
    this.leftArm.rotation.x = armSwing;
    this.rightArm.rotation.x = -armSwing;

    // Walk legs
    const legSwing = Math.sin(this.time * freq) * 0.35 * speed;
    this.leftLeg.rotation.x = -legSwing;
    this.rightLeg.rotation.x = legSwing;

    // Bob
    const bodyBob = this.isMoving ? Math.sin(this.time * freq * 0.5) * 0.05 : 0;
    this.body.position.y = PLAYER_RADIUS * 0.8 + bodyBob;

    const headBob = this.isMoving
      ? Math.sin(this.time * freq * 0.5 + 0.3) * 0.04
      : 0;
    this.head.position.y = PLAYER_RADIUS * 1.6 + headBob;

    // Trigger jump/push animations
    this.updateJump(delta);
    this.updatePush(delta);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          for (const mat of m.material) mat.dispose();
        } else if (m.material) (m.material as THREE.Material).dispose();
      }
    });
  }
}
