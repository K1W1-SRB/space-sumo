import * as THREE from "three";
import { io } from "socket.io-client";

import { SceneBuilder } from "./game/scene-builder.js";
import { GameCamera } from "./game/camera";
import { Input } from "./game/input";
import { Player } from "./game/player";
import { PowerupSystem } from "./game/power-up";
import { EventHandlers } from "../src/net/events.js";
import { EVENTS } from "../../packages/shared/src/index.js";

enum ClientState {
  TITLE = "TITLE",
  CONNECTING = "CONNECTING",
  GAME = "GAME",
}

let STATE: ClientState = ClientState.TITLE;

/* UI */
const titleEl = document.getElementById("title-screen")!;
const infoEl = document.getElementById("info-screen")!;
const playBtn = document.getElementById("play-btn")!;
const infoBtn = document.getElementById("info-btn")!;
const mainBtn = document.getElementById("main-btn")!;
const gameContainer = document.getElementById("game-container")!;

/* SOCKET */
const socket = io("http://localhost:3000", {
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("Connected to server, entering GAME state");
  STATE = ClientState.GAME;
});

/* SCENE SETUP */
const builder = new SceneBuilder(gameContainer);
const scene = builder.scene;
const renderer = builder.renderer;

/* GAME OBJECTS */
const camera = new GameCamera();
const planet = builder.planet;
const input = new Input();

const players = new Map<string, Player>();
const powerups = new PowerupSystem(scene);
const events = new EventHandlers(socket, scene, players, powerups, planet);

/* UI EVENTS */
playBtn.onclick = () => {
  STATE = ClientState.CONNECTING;
  titleEl.style.display = "none";
  gameContainer.style.display = "block";
  socket.connect();
};

infoBtn.onclick = () => {
  titleEl.style.display = "none";
  infoEl.style.display = "flex";
};

mainBtn.onclick = () => {
  titleEl.style.display = "flex";
  infoEl.style.display = "none";
};

/* INPUT HANDLING */
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

  return { boost, push };
}

/* MAIN LOOP */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (STATE === ClientState.GAME) {
    planet.update(delta);
    builder.updateBackground(delta);
    powerups.update(delta, clock.elapsedTime);

    const myPlayer = events.myPlayer;
    const myVelocity = events.myVelocity;

    // Update all players (client animation + prediction)
    for (const p of players.values()) {
      p.update(delta);
    }

    if (myPlayer) {
      const { boost, push } = sendInput();

      // Local visual feedback
      if (boost) myPlayer.triggerJump();
      if (push) myPlayer.triggerPush();

      // Camera follows predicted position
      camera.update(myPlayer.mesh.position, planet.mesh, myVelocity);
    } else {
      camera.instance.position.set(0, 5, 15);
      camera.instance.lookAt(0, 0, 0);
    }
  }

  renderer.render(scene, camera.instance);
}

animate();
