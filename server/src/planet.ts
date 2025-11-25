import * as CANNON from "cannon-es";

export class Planet {
  body: CANNON.Body;

  constructor(world: CANNON.World, radius = 5) {
    const shape = new CANNON.Sphere(radius);
    this.body = new CANNON.Body({
      mass: 0,
      shape,
      position: new CANNON.Vec3(0, 0, 0),
    });
    world.addBody(this.body);
  }
}
