import * as THREE from "three";
import { Planet } from "./planet";
console.warn("SceneBuilder constructed!", Math.random());
export class SceneBuilder {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  bgPlanets: THREE.Mesh[] = [];
  planet: Planet;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.addSky();
    this.addStars(180);
    this.addBackgroundPlanets();
    this.addLights();

    this.planet = new Planet(this.scene);
  }

  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    this.scene.add(ambient, directional);
  }

  addSky() {
    const geo = new THREE.SphereGeometry(500, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        topColor: { value: new THREE.Color("#0a0d1f") },
        midColor: { value: new THREE.Color("#131832") },
        bottomColor: { value: new THREE.Color("#1e2347") },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;

        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.6, h));
          col = mix(col, topColor, smoothstep(0.6, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
  }

  addStars(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      )
        .normalize()
        .multiplyScalar(300);

      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;

      size[i] = Math.random() * 3 + 1.5;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(size, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color("#b8c7ff") },
      },
      vertexShader: `
        attribute float size;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size;
        }
      `,
      fragmentShader: `
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.3, d);
          gl_FragColor = vec4(1.0,1.0,1.0,alpha);
        }
      `,
    });

    this.scene.add(new THREE.Points(geo, mat));
  }

  addBackgroundPlanets() {
    const createPlanet = (
      radius: number,
      color: string,
      pos: THREE.Vector3,
      speed: number
    ) => {
      const geo = new THREE.IcosahedronGeometry(radius, 1);
      const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData.rotationSpeed = speed;
      this.scene.add(mesh);
      this.bgPlanets.push(mesh);
    };

    createPlanet(10, "#c9b6ff", new THREE.Vector3(90, -10, -100), 0.015);
    createPlanet(8, "#ffd5a8", new THREE.Vector3(-80, -60, -20), 0.02);
    createPlanet(14, "#b0e0ff", new THREE.Vector3(-80, -20, -200), 0.01);
  }

  updateBackground(delta: number) {
    for (const p of this.bgPlanets) {
      p.rotation.y += delta * p.userData.rotationSpeed;
    }
  }
}
