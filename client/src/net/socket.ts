import { io } from "socket.io-client";
import { EVENTS, PlayerState } from "../../../packages/shared/src/index.js";

export const socket = io("http://localhost:3000");

type StateHandler = (states: PlayerState[]) => void;
type EliminatedHandler = (id: string) => void;
type RoundOverHandler = (winnerId: string) => void;

let onState: StateHandler | null = null;
let onEliminated: EliminatedHandler | null = null;
let onRoundOver: RoundOverHandler | null = null;

export function setStateHandler(fn: StateHandler) {
  onState = fn;
}
export function setEliminatedHandler(fn: EliminatedHandler) {
  onEliminated = fn;
}
export function setRoundOverHandler(fn: RoundOverHandler) {
  onRoundOver = fn;
}

socket.on("connect", () => {
  console.log("✅ Connected to server:", socket.id);
});

// ✅ use the shared constant
socket.on(EVENTS.STATE, (states: PlayerState[]) => {
  if (onState) onState(states);
});

socket.on(EVENTS.ELIMINATED, ({ id }) => {
  if (onEliminated) onEliminated(id);
});

socket.on(EVENTS.ROUND_OVER, ({ winnerId }) => {
  if (onRoundOver) onRoundOver(winnerId);
});
