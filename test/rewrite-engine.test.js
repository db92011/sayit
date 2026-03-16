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

test("buildTranslation treats after-state as delivery style instead of outcome text", () => {
  const translation = buildTranslation({
    recipient: "My partner",
    relationship: "Spouse or partner",
    situation: "A small test message.",
    message: "Testing one, two, three.",
    intent: "auto",
    outcome: "",
    afterState: "Funny",
    tones: ["gentle"]
  });

  assert.doesNotMatch(translation.primary, /What I want from this conversation is simple: funny\./i);
  assert.match(translation.primary, /feel funny instead of reactive/i);
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

test("translation API returns normalized OpenAI translation when configured", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  let authHeader = "";

  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    authHeader =
      typeof init.headers?.get === "function"
        ? String(init.headers.get("authorization") || "")
        : String(init.headers?.authorization || "");
    requestBody = JSON.parse(String(init.body || "{}"));

    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            detectedIntent: {
              id: "clarify",
              label: "Clarify something"
            },
            intentLabel: "Clarify something",
            summary: [
              { label: "Audience", title: "My partner", body: "Dynamic: Spouse or partner." },
              { label: "Moment", title: "Clear", body: "A disagreement is starting." },
              { label: "Barrier", title: "Emotion", body: "Keep the pace steady." }
            ],
            primary: "I care about us, and I want to reset this calmly.",
            concise: "I want to reset this calmly.",
            proof: "Success looks like a calmer conversation.",
            notes: ["Slow down.", "Stay specific.", "Keep your tone warm."],
            tones: ["calm", "clear"],
            toneMap: [
              { tone: "calm", label: "Calm", action: "Reduce heat." },
              { tone: "clear", label: "Clear", action: "Keep the ask easy to follow." }
            ],
            conversationMap: [
              { label: "Audience", value: "My partner", detail: "Dynamic: Spouse or partner." },
              { label: "Intent", value: "Clarify something", detail: "Target outcome: Clear." },
              { label: "Friction", value: "Emotion", detail: "Keep the pace steady." },
              { label: "Reframe", value: "Clear", detail: "The rewrite is steering toward clear." }
            ],
            teleprompterLines: ["I care about us.", "I want to reset this calmly."]
          })
        };
      }
    };
  };

  try {
    const response = await onRequestPost({
      request: new Request("http://localhost/api/translate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          recipient: "My partner",
          relationship: "Boss or supervisor",
          situation: "A disagreement is starting.",
          message: "I want us to stop snapping and reset this calmly.",
          intent: "clarify",
          outcome: "Clear",
          afterState: "Clear"
        })
      }),
      env: {
        OPENAI_API_KEY: "configured-key"
      }
    });

    const body = await response.json();
    assert.equal(body.meta.mode, "openai");
    assert.match(authHeader, /Bearer configured-key/);
    assert.match(String(requestBody?.input || ""), /"relationship": "Boss or supervisor"/);
    assert.match(String(requestBody?.input || ""), /"afterState": "Clear"/);
    assert.equal(body.translation.detectedIntent.id, "clarify");
    assert.equal(body.translation.summary.length, 3);
    assert.equal(body.translation.conversationMap.length, 4);
    assert.equal(body.translation.notes.length, 3);
    assert.equal(body.translation.toneMap[0].tone, "calm");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
