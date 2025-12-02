export const PHYSICS_HZ = 60; // simulation rate
export const NET_HZ = 20; // state broadcast rate

export const PLANET_RADIUS = 5;
export const PLAYER_RADIUS = 0.5;

export const GRAVITY_STRENGTH = 20; // toward planet center (N per kg-ish)
export const THRUST_FORCE = 65; // tangent thrust
export const DAMPING = 0.92;
export const BOOST_IMPULSE = 1000; // instant impulse away from planet

export const OUTZONE_RADIUS = PLANET_RADIUS + 25;

export const PUSH_STIFFNESS = 200; // how hard players shove apart
export const PUSH_DAMPING = 6; // resists “jitter” on contact
export const BOOST_PUSH_MULT = 2; // shove is stronger if someone is boosting

export const PUSH_ABILITY_RADIUS = 4.0; // meters around the player
export const PUSH_ABILITY_IMPULSE = 65; // how hard others get shoved
export const PUSH_ABILITY_COOLDOWN_MS = 600; // cooldown per player

export enum GameState {
  TITLE = "TITLE",
  CONNECTING = "CONNECTING",
  GAME = "GAME",
}
