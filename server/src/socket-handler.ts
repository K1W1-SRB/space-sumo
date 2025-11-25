import { Server } from "socket.io";
import { PlayerManager } from "./player-manager.js";
import { createWorld } from "./physics-world.js";
import { EVENTS } from "../../packages/shared/src/index.js";
import { Planet } from "./planet.js";

export const world = createWorld();
export const planet = new Planet(world);
export const playerManager = new PlayerManager(world, planet);

export function initSockets(io: Server) {
  io.on("connection", (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);
    const color = randomColor();
    playerManager.addPlayer(socket.id, color);

    socket.on(EVENTS.INPUT, (input) => {
      playerManager.applyInput(socket.id, input);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Player disconnected: ${socket.id}`);
      playerManager.removePlayer(socket.id);
    });
  });
}

function randomColor() {
  const colors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44"];
  return colors[Math.floor(Math.random() * colors.length)];
}
