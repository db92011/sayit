import test from "node:test";
import assert from "node:assert/strict";

import { buildTranslation, detectIntent } from "../site/src/rewrite-engine.js";
import { onRequestGet, onRequestPost } from "../functions/api/translate.js";

test("detectIntent prioritizes boundary language", () => {
  const result = detectIntent({
    message: "I need this to stop and going forward I cannot keep doing extra weekend work.",
    situation: "I am trying to set a boundary with my boss."
  });

  assert.equal(result.id, "boundary");
});

test("buildTranslation creates a primary draft, concise draft, and teleprompter lines", () => {
  const translation = buildTranslation({
    recipient: "My coworker",
    relationship: "Coworker",
    situation: "We are stuck in a misunderstanding.",
    message: "You keep assuming I ignored your note, but I actually replied and sent the draft yesterday.",
    intent: "auto",
    outcome: "Be understood clearly",
    barrier: "Misunderstanding",
    beforeState: "Too blunt",
    afterState: "Clear",
    proof: "",
    tones: ["clear", "direct"]
  });

  assert.match(translation.primary, /I want|Let me|I hear/i);
  assert.ok(translation.concise.length > 30);
  assert.ok(Array.isArray(translation.teleprompterLines));
  assert.ok(translation.teleprompterLines.length >= 2);
  assert.equal(translation.summary.length, 3);
  assert.equal(translation.conversationMap.length, 4);
  assert.equal(translation.toneMap.length, 2);
  assert.match(translation.diagnostics.intensityLabel, /Low|Medium|High/);
});

test("translation API returns server metadata and translation payload", async () => {
  const response = await onRequestPost({
    request: new Request("http://localhost/api/translate", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        recipient: "My partner",
        relationship: "Spouse or partner",
        situation: "A disagreement is starting.",
        message: "I want us to stop snapping at each other and reset this calmly.",
        intent: "auto",
        outcome: "Avoid an argument",
        barrier: "Different emotional state",
        beforeState: "Too emotional",
        afterState: "Calm",
        proof: "",
        tones: ["calm", "gentle", "clear"]
      })
    }),
    env: {}
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.meta.runtime, "cloudflare-pages-function");
  assert.match(body.translation.primary, /I want|Let me|I hear/i);
});

test("translation API health route returns configuration state", async () => {
  const response = await onRequestGet({
    env: {
      OPENAI_API_KEY: "configured"
    }
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.providerConfigured, true);
});
