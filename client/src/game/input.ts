export class Input {
  keys: Record<string, boolean>;

  constructor() {
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
      e: false,
    };
    window.addEventListener("keydown", (e) => this.handleKey(e, true));
    window.addEventListener("keyup", (e) => this.handleKey(e, false));
  }

  private handleKey(event: KeyboardEvent, isPressed: boolean) {
    let key = event.key.toLowerCase();
    if (key === " ") key = "space";
    if (this.keys[key] !== undefined) {
      this.keys[key] = isPressed;
    }
  }

  isPressed(key: string): boolean {
    return this.keys[key] || false;
  }
}
