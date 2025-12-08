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

io.use((socket, next) => {
  const auth = socket.handshake.auth as any;
  const rawUsername = auth?.username;

  if (!rawUsername || typeof rawUsername !== "string") {
    return next(new Error("USERNAME_REQUIRED"));
  }

  const username = rawUsername.trim();
  if (!username) {
    return next(new Error("USERNAME_REQUIRED"));
  }

  // store on socket for later use
  (socket.data as any).username = username;
  next();
});

initSockets(io);
startGameLoops(io, { world, planet, playerManager, powerUpManager });

httpServer.listen(3000, () =>
  console.log("🚀 Multiplayer server running on port 3000")
);
