import test from "node:test";
import assert from "node:assert/strict";

import { createSpeechController } from "../site/src/speech.js";

test("speech controller disables controls when recognition is unavailable", () => {
  const originalWindow = globalThis.window;

  globalThis.window = {};

  try {
    const statusNode = { textContent: "" };
    const startButton = { disabled: false };
    const stopButton = { disabled: false };

    const controller = createSpeechController({
      textarea: { value: "" },
      statusNode,
      startButton,
      stopButton,
      onTranscript() {},
    });

    assert.equal(controller, null);
    assert.equal(startButton.disabled, true);
    assert.equal(stopButton.disabled, true);
    assert.match(statusNode.textContent, /not supported/i);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("speech controller prefers a native speech plugin when available", async () => {
  const originalWindow = globalThis.window;
  const events = [];

  globalThis.window = {
    Capacitor: {
      Plugins: {
        SpeechRecognition: {
          async available() {
            return { available: true };
          },
          async checkPermissions() {
            return { speechRecognition: "granted" };
          },
          async requestPermissions() {
            return { speechRecognition: "granted" };
          },
          async addListener(name, callback) {
            events.push(name);
            if (name === "partialResults") {
              callback({ matches: ["native transcript"] });
            }
            return {
              async remove() {}
            };
          },
          async start() {
            return { matches: ["native transcript"] };
          },
          async stop() {}
        }
      }
    }
  };

  try {
    const statusNode = { textContent: "" };
    const startButton = { disabled: false };
    const stopButton = { disabled: false };
    const textarea = { value: "" };

    const controller = createSpeechController({
      textarea,
      statusNode,
      startButton,
      stopButton,
      onTranscript() {}
    });

    assert.ok(controller);
    assert.match(statusNode.textContent, /device microphone/i);

    await controller.start();

    assert.equal(textarea.value, "native transcript");
    assert.equal(startButton.disabled, true);
    assert.equal(stopButton.disabled, false);
    assert.deepEqual(events, ["partialResults", "listeningState"]);
  } finally {
    globalThis.window = originalWindow;
  }
});
