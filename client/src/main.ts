import { GameCamera } from "./game/camera";
import { Planet } from "./game/planet";
import { Player } from "./game/player";
import { Input } from "./game/input";
import * as THREE from "three";
import { io } from "socket.io-client";
import { EVENTS, PlayerState } from "../../packages/shared/src/index.js";

enum ClientState {
  TITLE = "TITLE",
  CONNECTING = "CONNECTING",
  GAME = "GAME",
}

let STATE: ClientState = ClientState.TITLE;

// Title Screen
const titleEl = document.getElementById("title-screen")!;
const playBtn = document.getElementById("play-btn")!;
const canvasContainer = document.getElementById("game-container")!;
playBtn.onclick = () => {
  STATE = ClientState.CONNECTING;
  titleEl.style.display = "none";
  canvasContainer.style.display = "block";

  socket.connect();
};

// SOCKET SETUP (starts disconnected)

const socket = io("http://localhost:3000", {
  autoConnect: false,
});

// SCENE + CAMERA + RENDERER

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);

// stars
const starsGeo = new THREE.BufferGeometry();
const starCount = 1500;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 200;
}
for (let i = 0; i < starCount; i++) {
  const i3 = i * 3;

  // softer distribution
  starPositions[i3 + 0] = (Math.random() - 0.5) * 300;
  starPositions[i3 + 1] = (Math.random() - 0.5) * 300;
  starPositions[i3 + 2] = (Math.random() - 0.5) * 300;

  // pastel color seeds
  const pastel = new THREE.Color();
  pastel.setHSL(
    0.6 + Math.random() * 0.1, // blue-purple
    0.4, // soft saturation
    0.8 + Math.random() * 0.1 // lightness
  );

  starColors[i3 + 0] = pastel.r;
  starColors[i3 + 1] = pastel.g;
  starColors[i3 + 2] = pastel.b;
}

starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
starsGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

const starMaterial = new THREE.PointsMaterial({
  size: 0.6,
  transparent: true,
  opacity: 0.8,
  vertexColors: true,
});

const stars = new THREE.Points(starsGeo, starMaterial);
scene.add(stars);

// camera + renderer
const camera = new GameCamera();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
canvasContainer.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const ambient = new THREE.AmbientLight(0xffffff, 0.4);
const directional = new THREE.DirectionalLight(0xffffff, 1);
directional.position.set(5, 10, 7);
scene.add(ambient, directional);

/* ============================================================
    GAME OBJECTS
============================================================ */
const planet = new Planet(scene);
const input = new Input();

const players = new Map<string, Player>();
let myPlayer: Player | null = null;

/* ============================================================
    SOCKET EVENTS
============================================================ */
socket.on("connect", () => {
  STATE = ClientState.GAME;
});

socket.on(EVENTS.STATE, (states: PlayerState[]) => {
  if (STATE !== ClientState.GAME) return;

  const present = new Set<string>();

  for (const s of states) {
    let player = players.get(s.id);
    if (!player) {
      player = new Player(scene, s.color);
      players.set(s.id, player);
      if (s.id === socket.id) myPlayer = player;
    }

    const vel = new THREE.Vector3(...s.velocity);

    player.updateRotation(vel, planet.mesh.position);
    player.updateAnimationFromVelocity(vel);
    player.updatePosition(s.position);

    present.add(s.id);
  }

  for (const id of Array.from(players.keys())) {
    if (!present.has(id)) {
      players.get(id)!.dispose(scene);
      players.delete(id);
      if (id === socket.id) myPlayer = null;
    }
  }
});

socket.on(EVENTS.ELIMINATED, ({ id }) => {
  const p = players.get(id);
  if (p) {
    p.dispose(scene);
    players.delete(id);
  }
  if (id === socket.id) myPlayer = null;
});

/* ============================================================
    INPUT SEND
============================================================ */
let lastSpace = false;
let lastE = false;

function sendInput() {
  const thrust: [number, number, number] = [
    (input.isPressed("d") ? 1 : 0) - (input.isPressed("a") ? 1 : 0),
    0,
    (input.isPressed("s") ? 1 : 0) - (input.isPressed("w") ? 1 : 0),
  ];

  const spaceNow = input.isPressed("space");
  const boost = spaceNow && !lastSpace;
  lastSpace = spaceNow;

  const eNow = input.isPressed("e");
  const push = eNow && !lastE;
  lastE = eNow;

  socket.emit(EVENTS.INPUT, { thrust, boost, push });
}

/* ============================================================
    GAME LOOP
============================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (STATE === ClientState.GAME) {
    planet.update(delta);

    for (const p of players.values()) p.update(delta);

    if (myPlayer) {
      sendInput();
      camera.update(myPlayer.mesh.position, planet.mesh);
    } else {
      camera.instance.position.set(0, 5, 15);
      camera.instance.lookAt(0, 0, 0);
    }
  }

  renderer.render(scene, camera.instance);
}

animate();
