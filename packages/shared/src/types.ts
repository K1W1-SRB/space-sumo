export interface PlayerInput {
  /** Tangent thrust: [right, up(ignored), forward] */
  thrust: [number, number, number];
  boost: boolean;
  push?: boolean;
}

export interface PlayerState {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
}
