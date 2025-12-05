export const PHYSICS_HZ = 60;
export const NET_HZ = 20;

export const PLANET_RADIUS = 5;
export const PLAYER_RADIUS = 0.5;

export const GRAVITY_STRENGTH = 20;
export const THRUST_FORCE = 65;
export const DAMPING = 0.92;
export const BOOST_IMPULSE = 10;

export const OUTZONE_RADIUS = PLANET_RADIUS + 10;

export const PUSH_STIFFNESS = 200;
export const PUSH_DAMPING = 6;
export const BOOST_PUSH_MULT = 2;

export const PUSH_ABILITY_RADIUS = 4.0;
export const PUSH_ABILITY_IMPULSE = 65;
export const PUSH_ABILITY_COOLDOWN_MS = 600;

export enum GameState {
  TITLE = "TITLE",
  CONNECTING = "CONNECTING",
  GAME = "GAME",
  ROUND_OVER = "ROUND_OVER",
}
