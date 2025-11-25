import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { initSockets, world, planet, playerManager } from "./socket-handler.js";
import { startGameLoops } from "./game-loop.js";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

initSockets(io);
startGameLoops(io, { world, planet, playerManager });

httpServer.listen(3000, () =>
  console.log("🚀 Multiplayer server running on port 3000")
);
