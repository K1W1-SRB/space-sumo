import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  initSockets,
  world,
  planet,
  playerManager,
  powerUpManager,
} from "./socket-handler.js";
import { startGameLoops } from "./game-loop.js";

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const httpServer = createServer(app);

app.get("/", (req, res) => {
  res.send("Space Sumo Server Running");
});

export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initSockets(io);
startGameLoops(io, { world, planet, playerManager, powerUpManager });

httpServer.listen(3000, () =>
  console.log("🚀 Multiplayer server running on port 3000")
);
