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

  hasLines() {
    return this.lines.length > 0;
  }

  canScroll() {
    return this.hasLines() && this.getMaxScrollTop() > 2;
  }

  start() {
    if (!this.hasLines()) {
      return false;
    }

    const maxScrollTop = this.getMaxScrollTop();
    if (maxScrollTop <= 2) {
      this.updateHighlight();
      return false;
    }

    if (this.script.scrollTop >= maxScrollTop - 2) {
      this.reset();
    }

    if (this.running) {
      return true;
    }

    this.running = true;
    this.lastTimestamp = 0;
    this.updateHighlight();
    this.animationFrame = window.requestAnimationFrame(this.tick);
    return true;
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
    const maxScrollTop = this.getMaxScrollTop();
    const nextScrollTop = Math.min(this.script.scrollTop + SPEED_MAP[this.speed] * delta, maxScrollTop);
    this.script.scrollTop = nextScrollTop;
    this.updateHighlight();

    const reachedBottom = nextScrollTop >= maxScrollTop - 2;

    if (reachedBottom) {
      this.stop();
      return;
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  updateHighlight() {
    if (!this.highlightToggle.checked) {
      this.lines.forEach((line) => {
        line.classList.remove("is-active", "is-near", "is-far");
      });
      return;
    }

    const midpoint = this.script.scrollTop + this.script.clientHeight / 2;
    const nearThreshold = this.script.clientHeight * 0.24;
    const farThreshold = this.script.clientHeight * 0.4;
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

    this.lines.forEach((line) => {
      const lineMidpoint = line.offsetTop + line.offsetHeight / 2;
      const distance = Math.abs(midpoint - lineMidpoint);
      line.classList.toggle("is-active", line === activeLine);
      line.classList.toggle("is-near", line !== activeLine && distance <= nearThreshold);
      line.classList.toggle("is-far", distance > nearThreshold && distance <= farThreshold);
    });
  }

  getMaxScrollTop() {
    return Math.max(0, this.script.scrollHeight - this.script.clientHeight);
  }
}
