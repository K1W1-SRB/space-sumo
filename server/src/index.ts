import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // your Vite dev URL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Player connected:", socket.id);
});

httpServer.listen(3000, () => console.log("🚀 Server running on :3000"));
