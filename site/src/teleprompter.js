const SPEED_MAP = {
  slow: 24,
  medium: 42,
  fast: 64
};

export class TeleprompterController {
  constructor({ container, script, highlightToggle }) {
    this.container = container;
    this.script = script;
    this.highlightToggle = highlightToggle;
    this.lines = [];
    this.speed = "slow";
    this.animationFrame = null;
    this.running = false;
    this.lastTimestamp = 0;
  }

  setLines(lines) {
    this.stop();
    this.script.innerHTML = "";
    this.lines = [];

    if (!lines || lines.length === 0) {
      this.script.innerHTML =
        '<p class="teleprompter-placeholder">Generate a translated message to load teleprompter mode.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const line of lines) {
      const node = document.createElement("p");
      node.className = "teleprompter-line";
      node.textContent = line;
      fragment.appendChild(node);
      this.lines.push(node);
    }

    this.script.appendChild(fragment);
    this.reset();
  }

  setSpeed(speed) {
    if (SPEED_MAP[speed]) {
      this.speed = speed;
    }
  }

  start() {
    if (this.running || this.lines.length === 0) {
      return;
    }

    this.running = true;
    this.lastTimestamp = 0;
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  pause() {
    this.stop();
  }

  reset() {
    this.stop();
    this.script.scrollTop = 0;
    this.updateHighlight();
  }

  stop() {
    this.running = false;
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  tick = (timestamp) => {
    if (!this.running) {
      return;
    }

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    const delta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.script.scrollTop += SPEED_MAP[this.speed] * delta;
    this.updateHighlight();

    const reachedBottom =
      this.script.scrollTop + this.script.clientHeight >= this.script.scrollHeight - 4;

    if (reachedBottom) {
      this.stop();
      return;
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  updateHighlight() {
    if (!this.highlightToggle.checked) {
      this.lines.forEach((line) => line.classList.remove("is-active"));
      return;
    }

    const midpoint = this.script.scrollTop + this.script.clientHeight / 2;
    let activeLine = null;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (const line of this.lines) {
      const lineMidpoint = line.offsetTop + line.offsetHeight / 2;
      const distance = Math.abs(midpoint - lineMidpoint);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        activeLine = line;
      }
    }

    this.lines.forEach((line) => line.classList.toggle("is-active", line === activeLine));
  }
}
