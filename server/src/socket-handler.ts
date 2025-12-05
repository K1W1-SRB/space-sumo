import { Server, Socket } from "socket.io";
import { PlayerManager } from "./player-manager.js";
import { createWorld } from "./physics-world.js";
import { PowerUpManager } from "./power-up.js";
import { EVENTS } from "../../packages/shared/src/index.js";
import { Planet } from "./planet.js";

export const world = createWorld();
export const planet = new Planet(world);
export const playerManager = new PlayerManager(world, planet);
export const powerUpManager = new PowerUpManager(world);

// ---- LOBBY TYPES / STATE ----

type Lobby = {
  code: string;
  hostId: string; // socket.id of host
  players: Set<string>; // socket.id of players
};

const lobbies = new Map<string, Lobby>();

function generateLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getLobbyForSocket(socketId: string): Lobby | undefined {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(socketId)) return lobby;
  }
  return undefined;
}

function broadcastLobbyState(io: Server, lobby: Lobby) {
  const payload = {
    code: lobby.code,
    hostId: lobby.hostId,
    players: Array.from(lobby.players).map((id) => {
      const s = io.sockets.sockets.get(id) as Socket | undefined;
      const username = (s?.data as any)?.username ?? id;
      return { id, username };
    }),
  };

  io.to(lobby.code).emit("LOBBY_STATE", payload);
}

// ---- SOCKET SETUP ----

export function initSockets(io: Server) {
  io.on("connection", (socket) => {
    const username = (socket.data as any)?.username as string | undefined;
    console.log(
      `✅ Player connected: ${socket.id}${username ? ` (${username})` : ""}`
    );

    const color = randomColor();
    // NOTE: we still use socket.id for physics/player ids.
    playerManager.addPlayer(socket.id, color);

    // Immediately send current powerup state
    io.emit("POWERUP_STATE", powerUpManager.getState());

    // ---- LOBBY EVENTS ----

    socket.on("LOBBY_CREATE", () => {
      // If already in a lobby, leave it first
      const existing = getLobbyForSocket(socket.id);
      if (existing) {
        existing.players.delete(socket.id);
        socket.leave(existing.code);
        if (existing.players.size === 0) {
          lobbies.delete(existing.code);
        } else {
          broadcastLobbyState(io, existing);
        }
      }

      const code = generateLobbyCode();
      const lobby: Lobby = {
        code,
        hostId: socket.id,
        players: new Set([socket.id]),
      };
      lobbies.set(code, lobby);

      socket.join(code);
      socket.emit("LOBBY_CREATED", { code });
      broadcastLobbyState(io, lobby);

      console.log(`🎮 Lobby created: ${code} by ${socket.id}`);
    });

    socket.on("LOBBY_JOIN", (payload: any) => {
      const rawCode = payload?.code;
      if (!rawCode || typeof rawCode !== "string") {
        socket.emit("LOBBY_ERROR", { message: "Invalid lobby code" });
        return;
      }

      const code = rawCode.trim().toUpperCase();
      const lobby = lobbies.get(code);

      if (!lobby) {
        socket.emit("LOBBY_ERROR", { message: "Lobby not found" });
        return;
      }

      // leave old lobby if present
      const existing = getLobbyForSocket(socket.id);
      if (existing && existing.code !== code) {
        existing.players.delete(socket.id);
        socket.leave(existing.code);
        if (existing.players.size === 0) {
          lobbies.delete(existing.code);
        } else {
          broadcastLobbyState(io, existing);
        }
      }

      lobby.players.add(socket.id);
      socket.join(code);
      socket.emit("LOBBY_JOINED", { code });
      broadcastLobbyState(io, lobby);

      console.log(`👥 ${socket.id} joined lobby ${code}`);
    });

    socket.on("LOBBY_LEAVE", () => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) return;

      lobby.players.delete(socket.id);
      socket.leave(lobby.code);
      console.log(`👋 ${socket.id} left lobby ${lobby.code}`);

      if (lobby.players.size === 0) {
        lobbies.delete(lobby.code);
      } else {
        broadcastLobbyState(io, lobby);
      }

      socket.emit("LOBBY_LEFT", { code: lobby.code });
    });

    // ---- GAME INPUT ----

    socket.on(EVENTS.INPUT, (input) => {
      playerManager.applyInput(socket.id, input);
    });

    // ---- DISCONNECT ----

    socket.on("disconnect", () => {
      console.log(`❌ Player disconnected: ${socket.id}`);
      playerManager.removePlayer(socket.id);

      const lobby = getLobbyForSocket(socket.id);
      if (lobby) {
        lobby.players.delete(socket.id);
        socket.leave(lobby.code);

        if (lobby.players.size === 0) {
          lobbies.delete(lobby.code);
        } else {
          broadcastLobbyState(io, lobby);
        }
      }
    });
  });
}

function randomColor() {
  const colors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44"];
  return colors[Math.floor(Math.random() * colors.length)];
}
