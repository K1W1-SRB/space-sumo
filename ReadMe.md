# 3D Web Game

A fast-paced multiplayer 3D browser game where players run around a small planet, use physics-based movement, push opponents off the world, activate power-ups, and battle to be the last one standing. Includes real-time lobbies, OAuth login, animated models, and a full client/server architecture.

---

## Features

- 3D gameplay built with Three.js
- Real-time multiplayer with Socket.IO
- Physics simulation using Cannon.js
- OAuth login (no database required)
- Create/join lobbies via code
- Host-controlled match start
- Round system with win screens
- Boost, push, and power-up mechanics
- NestJS backend with a custom game loop
- Next.js frontend
- Docker Compose setup

---

## Tech Stack

### Frontend

- Next.js
- Three.js
- Cannon.js
- Socket.IO Client
- TypeScript

### Backend

- NestJS (WebSocket Gateway)
- TypeScript
- Custom physics/game-loop
- Docker Compose

---

## How to Run

### 1. Clone the Project

```bash
git clone <repo-url>
cd <project-folder>
```

```bash
yarn install
```

```bash
cd server
yarn dev
```

```bash
cd client
yarn vite
```

### Gameplay

- Move with WASD
- Boost with Space
- Push with E
- Stay on the planet, knock others off
- Lobbies allow players to create/join via code
- Host starts the match
