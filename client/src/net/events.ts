// src/game/EventHandlers.ts

import { Socket } from "socket.io-client";
import * as THREE from "three";
import { Player } from "../game/player";
import { Planet } from "../game/planet";
import { PowerupSystem } from "../game/power-up.js";
import { EVENTS, PlayerState } from "../../../packages/shared/src/index.js";

export class EventHandlers {
  private socket: Socket;
  private scene: THREE.Scene;
  private players: Map<string, Player>;
  private powerups: PowerupSystem;
  private planet: Planet;

  public myPlayer: Player | null = null;
  public myVelocity = new THREE.Vector3();

  constructor(
    socket: Socket,
    scene: THREE.Scene,
    players: Map<string, Player>,
    powerups: PowerupSystem,
    planet: Planet
  ) {
    this.socket = socket;
    this.scene = scene;
    this.players = players;
    this.powerups = powerups;
    this.planet = planet;

    this.registerEvents();
  }

  private registerEvents() {
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id);

      this.myPlayer = null;
    });

    this.socket.on("POWERUP_SPAWN", (data) => {
      this.powerups.spawn(data.id, data.type, data.position);
    });

    this.socket.on("POWERUP_TAKEN", (data) => {
      this.powerups.remove(data.id);
    });

    this.socket.on("POWERUP_STATE", (list) => {
      this.powerups.syncState(list);
    });

    this.socket.on(EVENTS.STATE, (states: PlayerState[]) => {
      if (!this.socket.id) return;

      const present = new Set<string>();

      for (const s of states) {
        let player = this.players.get(s.id);

        if (!player) {
          player = new Player(this.scene, s.color);
          this.players.set(s.id, player);
        }

        const vel = new THREE.Vector3(...s.velocity);
        player.setServerState(s.position, vel);
        player.updateRotation(vel, this.planet.mesh.position);
        player.updateAnimationFromVelocity(vel);
        player.applyEffect(s.effect);

        if (s.id === this.socket.id) {
          this.myPlayer = player;
          this.myVelocity.copy(vel);
        }

        present.add(s.id);
      }

      for (const id of Array.from(this.players.keys())) {
        if (!present.has(id)) {
          const p = this.players.get(id);
          if (p) p.dispose(this.scene);
          this.players.delete(id);

          if (id === this.socket.id) {
            this.myPlayer = null;
          }
        }
      }
    });

    this.socket.on(EVENTS.ELIMINATED, ({ id }) => {
      const p = this.players.get(id);
      if (p) {
        p.dispose(this.scene);
        this.players.delete(id);
      }

      if (id === this.socket.id) {
        this.myPlayer = null;
      }
    });
  }
}
