export interface PlayerInput {
  thrust: [number, number, number];
  boost: boolean;
  push?: boolean;
}

export type PowerupType = "super_boost" | "mass_up" | "ghost";

export interface PlayerEffectState {
  type: PowerupType;
  until: number;
}

export interface PlayerState {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  effect: PlayerEffectState | null;
}
