import * as CANNON from "cannon-es";

export const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, 0, 0), // no linear gravity, we’ll add spherical gravity
});

export function addPlayer(id: string) {
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(1),
    position: new CANNON.Vec3(
      Math.random() * 10,
      Math.random() * 10,
      Math.random() * 10
    ),
  });
  world.addBody(body);
  return body;
}
