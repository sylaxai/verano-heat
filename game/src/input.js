// Keyboard + mouse input state for VERANO HEAT.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0; this.mouseDY = 0; this.mouseDown = false;
    this.justPressed = {};
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
  }
  down(code) { return !!this.keys[code]; }
  pressed(code) { return !!this.justPressed[code]; }
  endFrame() { this.justPressed = {}; this.mouseDX = 0; this.mouseDY = 0; }
}
