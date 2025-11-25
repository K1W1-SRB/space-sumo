export const EVENTS = {
  INPUT: "input",
  STATE: "state",
  ELIMINATED: "eliminated", // server -> clients: player removed
  ROUND_OVER: "round-over", // optional: only one left
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
