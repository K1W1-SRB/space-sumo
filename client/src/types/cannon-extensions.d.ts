import * as CANNON from "cannon-es";

declare module "cannon-es" {
  interface Body {
    _justBoosted?: boolean;
  }
}
