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
const infoBtn = document.getElementById("info-btn")!;
const mainBtn = document.getElementById("main-btn")!;
const gameContainer = document.getElementById("game-container")!;
const loginBtn = document.getElementById("login-btn")!;
const usernameDisplay = document.getElementById("username-display")!;
const openLobbyBtn = document.getElementById("open-lobby-btn")!;
const lobbyUI = document.getElementById("lobby-ui")!;
const createLobbyBtn = document.getElementById("create-lobby-btn")!;
const joinLobbyBtn = document.getElementById("join-lobby-btn")!;
const lobbyCodeInput = document.getElementById(
  "lobby-code-input"
) as HTMLInputElement;
const lobbyCodeDisplay = document.getElementById("lobby-code-display")!;
const startMatchBtn = document.getElementById("start-match-btn")!;
const lobbyBackBtn = document.getElementById("lobby-back-btn")!;

const socket = io("http://localhost:3000", {
  autoConnect: false,
});

function toast(msg: string) {
  const el = document.getElementById("toast")!;
  el.textContent = msg;
  el.style.opacity = "1";

  setTimeout(() => {
    el.style.opacity = "0";
  }, 2000);
}

type LobbyAction = { type: "create" } | { type: "join"; code: string };

let pendingLobbyAction: LobbyAction | null = null;
let currentLobbyCode: string | null = null;
let USERNAME: string | null = null;

socket.on("connect", () => {
  STATE = ClientState.CONNECTING;

  if (pendingLobbyAction) {
    if (pendingLobbyAction.type === "create") {
      socket.emit("LOBBY_CREATE");
    } else {
      socket.emit("LOBBY_JOIN", { code: pendingLobbyAction.code });
    }
  }
});

socket.on("LOBBY_CREATED", ({ code }) => {
  currentLobbyCode = code;
  toast(`Lobby created: ${code}`);
});

socket.on("LOBBY_STATE", (lobby) => {
  lobbyCodeDisplay.textContent = `Lobby Code: ${lobby.code}`;

  const amHost = lobby.hostId === socket.id;

  if (amHost && lobby.players.length >= 2) {
    startMatchBtn.style.display = "block";
  } else {
    startMatchBtn.style.display = "none";
  }
});

socket.on("LOBBY_JOINED", ({ code }) => {
  currentLobbyCode = code;
  toast(`Joined lobby: ${code}`);
});

socket.on("LOBBY_ERROR", ({ message }) => {
  toast(`Error: ${message}`);
});

socket.on("MATCH_STARTED", () => {
  console.log("MATCH_STARTED client");

  STATE = ClientState.GAME;

  lobbyUI.style.display = "none";
  startMatchBtn.style.display = "none";
  titleEl.style.display = "none";
  openLobbyBtn.style.display = "none";

  gameContainer.style.display = "block";
});

socket.on(EVENTS.ROUND_OVER, ({ winnerId }) => {
  STATE = ClientState.TITLE;
  console.log(STATE);

  const winScreen = document.getElementById("win-screen")!;
  const winText = document.getElementById("win-text")!;
  gameContainer.style.display = "none";
  winText.textContent = `Winner: ${winnerId}`;
  winScreen.style.display = "flex";
});

const builder = new SceneBuilder(gameContainer);
const scene = builder.scene;
const renderer = builder.renderer;

const camera = new GameCamera();
const planet = builder.planet;
const input = new Input();

const players = new Map<string, Player>();
const powerups = new PowerupSystem(scene);
const events = new EventHandlers(socket, scene, players, powerups, planet);

loginBtn.onclick = async () => {
  const name = prompt("Enter your OAuth display name:");

  if (!name) return;

  USERNAME = name.trim();
  usernameDisplay.textContent = `Logged in as: ${USERNAME}`;
};

infoBtn.onclick = () => {
  titleEl.style.display = "none";
  infoEl.style.display = "flex";
};

mainBtn.onclick = () => {
  titleEl.style.display = "flex";
  infoEl.style.display = "none";
};

openLobbyBtn.onclick = () => {
  openLobbyBtn.style.display = "none";
  lobbyUI.style.display = "flex";
};

lobbyBackBtn.onclick = () => {
  lobbyUI.style.display = "none";
  openLobbyBtn.style.display = "block";
};

createLobbyBtn.onclick = () => {
  if (!USERNAME) {
    alert("You must log in first!");
    return;
  }
  pendingLobbyAction = { type: "create" };

  STATE = ClientState.CONNECTING;
  gameContainer.style.display = "none";

  socket.auth = { username: USERNAME };
  socket.connect();
};

joinLobbyBtn.onclick = () => {
  if (!USERNAME) {
    alert("You must log in first!");
    return;
  }
  const code = lobbyCodeInput.value.trim().toUpperCase();

  if (!code || code.length < 3) {
    lobbyCodeInput.style.border = "2px solid #ff5555";
    return;
  }
  lobbyCodeInput.style.border = "none";

  pendingLobbyAction = { type: "join", code };

  STATE = ClientState.CONNECTING;
  gameContainer.style.display = "none";

  socket.auth = { username: USERNAME };
  socket.connect();
};

startMatchBtn.onclick = () => {
  socket.emit("MATCH_START");
};

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

    for (const p of players.values()) {
      p.update(delta);
    }

    if (myPlayer) {
      const { boost, push } = sendInput();

      if (boost) myPlayer.triggerJump();
      if (push) myPlayer.triggerPush();

      camera.update(myPlayer.mesh.position, planet.mesh, myVelocity);
    } else {
      camera.instance.position.set(0, 5, 15);
      camera.instance.lookAt(0, 0, 0);
    }
  }

  renderer.render(scene, camera.instance);
}

animate();
