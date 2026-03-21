import test from "node:test";
import assert from "node:assert/strict";

import { TeleprompterController } from "../pages/src/teleprompter.js";
import { splitTeleprompterLines } from "../pages/src/rewrite-engine.js";

function makeClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    toggle(value, force) {
      if (force) {
        values.add(value);
        return true;
      }
      values.delete(value);
      return false;
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function makeScriptNode() {
  return {
    innerHTML: "",
    children: [],
    scrollTop: 0,
    clientHeight: 180,
    scrollHeight: 720,
    appendChild(node) {
      const items = Array.isArray(node.children) ? node.children : [node];
      for (const item of items) {
        item.offsetTop = this.children.length * 56;
        item.offsetHeight = 40;
        this.children.push(item);
      }
    },
  };
}

test("teleprompter renders placeholder when no lines exist", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = {
    createDocumentFragment() {
      return {
        children: [],
        appendChild(node) {
          this.children.push(node);
        },
      };
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: makeClassList(),
      };
    },
  };

  globalThis.window = {
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    const script = makeScriptNode();
    const controller = new TeleprompterController({
      container: {},
      script,
      highlightToggle: { checked: true },
    });

    controller.setLines([]);
    assert.match(script.innerHTML, /Generate a translated message/i);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("teleprompter loads lines and highlights the active line", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = {
    createDocumentFragment() {
      return {
        children: [],
        appendChild(node) {
          this.children.push(node);
        },
      };
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: makeClassList(),
      };
    },
  };

  globalThis.window = {
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    const script = makeScriptNode();
    const controller = new TeleprompterController({
      container: {},
      script,
      highlightToggle: { checked: true },
    });

    controller.setLines(["Line one", "Line two", "Line three"]);
    assert.equal(script.children.length, 4);
    assert.equal(controller.hasLines(), true);
    assert.equal(controller.canScroll(), true);

    script.scrollTop = 50;
    controller.updateHighlight();

    const activeCount = script.children.filter((line) => line.classList.contains("is-active")).length;
    assert.equal(activeCount, 1);

    controller.reset();
    assert.equal(script.scrollTop, 0);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("teleprompter start still runs for short content", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = {
    createDocumentFragment() {
      return {
        children: [],
        appendChild(node) {
          this.children.push(node);
        },
      };
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: makeClassList(),
      };
    },
  };

  globalThis.window = {
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    const script = makeScriptNode();
    script.clientHeight = 500;
    script.scrollHeight = 500;
    const controller = new TeleprompterController({
      container: {},
      script,
      highlightToggle: { checked: true },
    });

    controller.setLines(["Short line"]);
    assert.equal(controller.hasLines(), true);
    assert.equal(controller.canScroll(), true);
    assert.equal(controller.start(), true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("teleprompter slow speed still advances from the start position", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = {
    createDocumentFragment() {
      return {
        children: [],
        appendChild(node) {
          this.children.push(node);
        },
      };
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: makeClassList(),
      };
    },
  };

  globalThis.window = {
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    const script = makeScriptNode();
    script.clientHeight = 320;
    script.scrollHeight = 1200;
    const controller = new TeleprompterController({
      container: {},
      script,
      highlightToggle: { checked: true },
    });

    controller.setLines([
      "Line one with enough text to read comfortably.",
      "Line two with enough text to read comfortably.",
      "Line three with enough text to read comfortably.",
      "Line four with enough text to read comfortably.",
    ]);
    controller.setSpeed("slow");

    assert.equal(script.scrollTop, 0);
    assert.equal(controller.start(), true);

    controller.tick(1000);
    controller.tick(2000);

    assert.ok(script.scrollTop > 0);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("teleprompter lines do not keep dangling commas after clause splitting", () => {
  const lines = splitTeleprompterLines(
    "Tanya, I need more help with the dishes and kitchen cleanup, especially after we cook. When I end up handling it on my own after we cook, I feel worn down, and I do not want this turning into resentment between us."
  );

  assert.deepEqual(lines, [
    "Tanya, I need more help with the dishes and kitchen cleanup, especially after we cook.",
    "When I end up handling it on my own after we cook, I feel worn down.",
    "I do not want this turning into resentment between us.",
  ]);
});
