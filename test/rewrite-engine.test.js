import test from "node:test";
import assert from "node:assert/strict";

import { buildTranslation, detectIntent } from "../pages/src/rewrite-engine.js";
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

  assert.match(translation.primary, /misunderstanding|replied|sent the draft/i);
  assert.doesNotMatch(translation.primary, /let me say this more clearly|i care about us/i);
  assert.ok(translation.concise.length > 30);
  assert.ok(Array.isArray(translation.teleprompterLines));
  assert.ok(translation.teleprompterLines.length >= 2);
  assert.equal(translation.summary.length, 3);
  assert.equal(translation.conversationMap.length, 4);
  assert.ok(translation.toneMap.length >= 2);
  assert.match(translation.diagnostics.intensityLabel, /Low|Medium|High/);
});

test("buildTranslation treats after-state as delivery style instead of outcome text", () => {
  const translation = buildTranslation({
    recipient: "Tanya",
    relationship: "Spouse or partner",
    situation: "A small test message.",
    message: "I am tired of doing the dishes alone.",
    intent: "auto",
    outcome: "",
    afterState: "Funny",
    tones: []
  });

  assert.doesNotMatch(translation.primary, /What I want from this conversation is simple: funny\./i);
  assert.doesNotMatch(translation.primary, /feel funny instead of reactive/i);
  assert.match(translation.primary, /^Tanya,/i);
  assert.match(translation.primary, /dishes start acting like permanent residents|apparently employed by the sink/i);
  assert.doesNotMatch(translation.primary, /I care about us, so I want to say this with love and respect\./i);
});

test("buildTranslation rewrites heated cleanup drafts instead of echoing them back", () => {
  const translation = buildTranslation({
    relationship: "Spouse or partner",
    situation: "",
    message:
      "Hi hi honey I just wanna say that I've been doing the dishes for years and it really getting annoying that I have to do what I'm doing now and then get down there and finish up the mess that you've created and I don't want to do this anymore if you can just give me a little hand that would be really helpful.",
    intent: "auto",
    outcome: "",
    afterState: "Kind"
  });

  assert.match(translation.primary, /dishes|kitchen cleanup|split/i);
  assert.doesNotMatch(translation.primary, /mess that you've created|hi hi honey|doing the dishes for years/i);
  assert.ok(translation.teleprompterLines.every((line) => !/mess that you've created/i.test(line)));
});

test("buildTranslation uses the provided recipient name near the start", () => {
  const translation = buildTranslation({
    recipient: "Tanya",
    relationship: "Spouse or partner",
    message: "I need more help with the dishes.",
    afterState: "Respectful"
  });

  assert.match(translation.primary, /^Tanya,/i);
  assert.match(translation.concise, /^Tanya,/i);
});

test("buildTranslation expands short spouse drafts with warmth", () => {
  const translation = buildTranslation({
    recipient: "Tanya",
    relationship: "Spouse or partner",
    message: "Need help with dishes.",
    afterState: "Respectful"
  });

  assert.match(translation.primary, /dishes|cleanup|help/i);
  assert.doesNotMatch(translation.primary, /i care about us|let me say this more clearly/i);
  assert.match(translation.primary, /dishes|cleanup/i);
  assert.match(translation.primary, /I know you do a lot too, and I appreciate what you do handle\./i);
});

test("buildTranslation expands short boss drafts with professionalism", () => {
  const translation = buildTranslation({
    recipient: "Mara",
    relationship: "Boss or supervisor",
    message: "Need clarity on deadlines.",
    afterState: "Confident"
  });

  assert.match(translation.primary, /timing|change going forward|next step/i);
  assert.match(translation.primary, /^Mara,/i);
  assert.match(translation.primary, /I appreciate the work you are doing and the pressure you are carrying\./i);
});

test("buildTranslation keeps concrete cleanup details from a typed draft", () => {
  const translation = buildTranslation({
    relationship: "Spouse or partner",
    message:
      "I have been having issues with doing the dishes this whole time and I wish that you would help me out I've been working hard and the dishes are piling up in the sink dirty every time you cook you leave a mess I would like to have you work with me on this",
    situation: "",
    intent: "auto",
    outcome: "",
    afterState: "Easy to understand"
  });

  assert.match(translation.primary, /dishes|cleanup|sink|cook/i);
  assert.match(
    translation.primary,
    /help me out|work with me|share the dishes and kitchen cleanup|share the dishes and cleanup|help with the dishes and kitchen cleanup/i
  );
  assert.doesNotMatch(translation.primary, /I need some support, and I want to ask for it clearly\./i);
});

test("buildTranslation keeps spouse cleanup context about work and appreciation", () => {
  const translation = buildTranslation({
    relationship: "Spouse or partner",
    message:
      "Hey honey I am sick of cleaning the dishes all the time. I work all day and come home to dishes on the counters and kitchen mess still waiting for me. I feel taken for granted and not appreciated.",
    afterState: "Respectful"
  });

  assert.match(translation.primary, /come home from work|after a full day|when I get home/i);
  assert.match(translation.primary, /taken for granted|not very appreciated|unappreciated/i);
  assert.match(translation.primary, /dishes|counters|kitchen/i);
  assert.match(translation.primary, /I know you do a lot too, and I appreciate what you do handle\./i);
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
  assert.doesNotMatch(body.translation.primary, /let me say this more clearly|i care about us/i);
  assert.match(body.translation.primary, /stop snapping|reset/i);
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
    assert.equal(body.meta.timeoutMs, 1800);
    assert.match(authHeader, /Bearer configured-key/);
    assert.match(String(requestBody?.input || ""), /"relationship": "Boss or supervisor"/);
    assert.match(String(requestBody?.input || ""), /"desiredTone": "Clear"/);
    assert.match(
      String(requestBody?.input || ""),
      /Selected desired tone: Clear\. Emphasize this one most strongly\./
    );
    assert.match(
      String(requestBody?.input || ""),
      /Boss or supervisor: Sound concise, professional, and fact-based\./
    );
    assert.match(
      String(requestBody?.input || ""),
      /include one brief grounded line that acknowledges the other person's effort, work, role, or what they do handle/i
    );
    assert.equal(body.translation.detectedIntent.id, "clarify");
    assert.equal(
      body.translation.primary,
      "I want to reset this calmly. I appreciate the work you are doing and the pressure you are carrying."
    );
    assert.deepEqual(body.translation.teleprompterLines, [
      "I want to reset this calmly.",
      "I appreciate the work you are doing and the pressure you are carrying."
    ]);
    assert.equal(body.translation.summary.length, 3);
    assert.equal(body.translation.conversationMap.length, 4);
    assert.equal(body.translation.notes.length, 3);
    assert.equal(body.translation.toneMap[0].tone, "calm");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation API falls back quickly when OpenAI times out", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });

  try {
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
          message: "I want us to stop snapping and reset this calmly.",
          intent: "clarify",
          outcome: "Clear",
          afterState: "Clear"
        })
      }),
      env: {
        OPENAI_API_KEY: "configured-key",
        OPENAI_TIMEOUT_MS: "25"
      }
    });

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.meta.mode, "rule-based");
    assert.equal(body.meta.timeoutMs, 500);
    assert.match(body.meta.fallbackReason, /timed out after 500ms/i);
    assert.equal(body.translation.diagnostics.source, "rule-based");
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
