export const EVENTS = {
  INPUT: "input",
  STATE: "state",
  ELIMINATED: "eliminated",
  ROUND_OVER: "round-over",
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
