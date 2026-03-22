import {
  buildTranslation,
  cleanGeneratedDraft,
  isMetaLeadText,
  splitTeleprompterLines
} from "../../pages/src/rewrite-engine.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const OPENAI_TONE_GUIDANCE = {
  Clear: "Lead with the real point, keep the facts concrete, and make the ask easy to repeat back.",
  Respectful:
    "Protect the other person's dignity, remove contempt or score-settling language, and stay considerate without becoming vague.",
  Calm: "Lower the heat, strip out escalators and absolutes, and make the message sound steady enough to say out loud."
};
const OPENAI_RELATIONSHIP_GUIDANCE = {
  "Spouse or partner":
    "Sound warm, relational, and shared. Make it clear this is about teamwork and the relationship, not winning a case.",
  "Child or teenager":
    "Use simple steady language. Be caring, plain, and easy to understand without sounding shaming or patronizing.",
  Friend:
    "Sound candid but caring. Keep it human and direct without turning cold or overly formal.",
  Coworker:
    "Sound practical, collaborative, and easy to act on. Favor specifics over emotional framing.",
  "Boss or supervisor":
    "Sound concise, professional, and fact-based. Be respectful without burying the real issue or request.",
  "Employee or subordinate":
    "Sound clear, direct, and supportive. Name the issue plainly and make the next step easy to follow.",
  Customer:
    "Sound helpful, calm, and service-minded. Reduce friction and guide toward a practical next step.",
  Client:
    "Sound polished, dependable, and clear. Protect trust while still addressing the real point directly.",
  Stranger:
    "Keep it brief, respectful, and boundary-aware. Use plain language and avoid unnecessary detail.",
  "Online conversation":
    "Keep it concise, hard to misread, and non-reactive. Avoid sarcasm and make the core point obvious.",
  "Social media comment":
    "Keep it short, de-escalating, and pointed enough to land without dragging into a thread fight."
};
const DEFAULT_OPENAI_BEHAVIOR = [
  "You rewrite emotionally charged or messy drafts into language a real person can actually say or send.",
  "Preserve the user's core meaning, lower unnecessary heat, and keep the wording natural.",
  "Keep concrete facts, examples, and requests. Do not flatten specifics like dishes, cleanup, timing, texts, money, cooking, or repeated behaviors unless they are needlessly inflammatory.",
  "Start with the real point. Do not front-load the rewrite with throat-clearing lines like 'I care about us', 'Let me say this more clearly', 'I want to say this respectfully', 'What I mean is', or any other speech about the speech.",
  "Do not add meta commentary about the user's goal, tone, or desired feeling. Make it sound clear, respectful, and calm without explicitly explaining that intention.",
  "Adapt the wording to the selected relationship dynamic. A message to a spouse should not sound like a message to a boss, and a message to a child should not sound like a message to a customer.",
  "For spouse or partner messages, a brief heartfelt line is okay when it is grounded in the real issue, such as not wanting resentment to build or wanting the home to feel more like teamwork. Do not make that line a vague preamble.",
  "For spouse or partner messages, prefer neutral concrete phrasing like 'it ends up sitting in the sink and I usually handle it myself' over accusatory phrasing like 'you leave a mess' when both would communicate the same point.",
  "If the user provides a recipient name, use that name naturally near the start only when it helps the message land better.",
  "The final draft should usually be 3 to 5 sentences and should sound ready to say out loud.",
  "Teleprompter lines must be cut directly from the same final draft, in order, with no extra intro lines.",
  "Never sound robotic, therapy-scripted, or corporate unless the situation clearly calls for it.",
  "Output valid JSON only."
].join(" ");

function getOpenAiApiKey(env) {
  return String(env?.OPENAI_API_KEY || env?.OpenAi_SayIt_Secret_Key || "").trim();
}

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" ? payload : {};
}

function normalizeCategoryValue(value, fallback = "Not provided") {
  const cleaned = String(value || "").trim();
  return cleaned || fallback;
}

function buildPromptContext(payload) {
  const data = normalizePayload(payload);

  return {
    categories: {
      recipient: normalizeCategoryValue(data.recipient),
      relationship: normalizeCategoryValue(data.relationship),
      desiredTone: normalizeCategoryValue(data.afterState, "Clear")
    },
    userDraft: {
      message: normalizeCategoryValue(data.message),
      situation: normalizeCategoryValue(data.situation)
    }
  };
}

function getOpenAiBehavior(env) {
  const behavior = String(env?.OPENAI_BEHAVIOR || "").trim();
  return behavior || DEFAULT_OPENAI_BEHAVIOR;
}

function extractTextFromResponse(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  const output = Array.isArray(body?.output) ? body.output : [];
  const fragments = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const candidate =
        typeof part?.text === "string"
          ? part.text
          : typeof part?.value === "string"
          ? part.value
          : "";
      if (candidate.trim()) {
        fragments.push(candidate.trim());
      }
    }
  }

  return fragments.join("\n").trim();
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("OpenAI response was empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("OpenAI response did not contain valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeStringList(list, fallback) {
  if (!Array.isArray(list)) {
    return fallback;
  }

  const normalized = list.map((entry) => String(entry || "").trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeCardList(list, fallback, keys) {
  if (!Array.isArray(list)) {
    return fallback;
  }

  const normalized = list
    .map((entry) => {
      const next = {};
      for (const key of keys) {
        next[key] = String(entry?.[key] || "").trim();
      }
      return next;
    })
    .filter((entry) => keys.every((key) => entry[key]));

  return normalized.length > 0 ? normalized : fallback;
}

function mergeOpenAiTranslation(base, candidate) {
  const translation = candidate && typeof candidate === "object" ? candidate : {};
  const primary = cleanGeneratedDraft(String(translation.primary || ""));
  const detectedIntent =
    translation.detectedIntent &&
    typeof translation.detectedIntent === "object" &&
    String(translation.detectedIntent.id || "").trim() &&
    String(translation.detectedIntent.label || "").trim()
      ? {
          id: String(translation.detectedIntent.id).trim(),
          label: String(translation.detectedIntent.label).trim()
        }
      : base.detectedIntent;

  if (!primary) {
    throw new Error("OpenAI translation was missing a primary draft.");
  }

  const fallbackTeleprompterLines = splitTeleprompterLines(primary);
  const teleprompterLines = Array.isArray(translation.teleprompterLines)
    ? translation.teleprompterLines
        .map((line) => cleanGeneratedDraft(String(line || "")))
        .filter((line) => line && !isMetaLeadText(line))
        .filter(Boolean)
    : fallbackTeleprompterLines;

  return {
    ...base,
    ...translation,
    detectedIntent,
    intentLabel: String(translation.intentLabel || detectedIntent.label || base.intentLabel || "").trim(),
    primary,
    concise: cleanGeneratedDraft(String(translation.concise || base.concise || primary)),
    proof: String(translation.proof || base.proof || "").trim(),
    notes: normalizeStringList(translation.notes, base.notes),
    tones: normalizeStringList(translation.tones, base.tones),
    teleprompterLines: normalizeStringList(teleprompterLines, fallbackTeleprompterLines),
    summary: normalizeCardList(translation.summary, base.summary, ["label", "title", "body"]),
    conversationMap: normalizeCardList(translation.conversationMap, base.conversationMap, [
      "label",
      "value",
      "detail"
    ]),
    toneMap: normalizeCardList(translation.toneMap, base.toneMap, ["tone", "label", "action"]),
    diagnostics: {
      ...base.diagnostics,
      source: "openai"
    }
  };
}

function buildOpenAiPrompt(payload) {
  const context = buildPromptContext(payload);
  const selectedTone = context.categories.desiredTone;
  const relationship = context.categories.relationship;
  const selectedToneGuidance =
    OPENAI_TONE_GUIDANCE[selectedTone] || OPENAI_TONE_GUIDANCE.Clear;
  const relationshipGuidance =
    OPENAI_RELATIONSHIP_GUIDANCE[relationship] ||
    "Make the relationship dynamic noticeable in the wording, rhythm, and level of emotional detail.";
  return [
    "Create a translation payload for SayIt! using this exact JSON shape:",
    "{",
    '  "detectedIntent": { "id": "string", "label": "string" },',
    '  "primary": "string",',
    '  "concise": "string",',
    '  "tones": ["string", "string"],',
    '  "teleprompterLines": ["string", "string"]',
    "}",
    "Requirements:",
    "- Keep the user's meaning intact.",
    "- Make it calmer, clearer, and more effective.",
    "- Use simple, natural language.",
    "- primary must be the final rewritten message only.",
    "- Start directly with the actual point. Do not include preambles like 'I care about us', 'Let me say this more clearly', 'I want to say this respectfully', 'What I mean is', or any sentence that explains the tone before the point.",
    "- Preserve the user's concrete facts and examples unless removing one is necessary to reduce unnecessary heat.",
    "- Match the selected relationship dynamic and desired tone closely.",
    "- Every rewrite should feel clear, respectful, and calm overall, even while the selected desired tone is emphasized most strongly.",
    "- For spouse or partner messages, a brief warm line is welcome only if it feels grounded and specific, not vague or performative.",
    "- For spouse or partner messages, prefer neutral concrete phrasing over blame-heavy lines like 'you leave a mess' when a calmer version would still be truthful.",
    "- If recipient is provided, use the person's name naturally once near the start only if it helps.",
    "- tones may only use: clear, respectful, calm.",
    "- detectedIntent.id must be one of: explain, boundary, criticism, correction, frustration, help, clarify.",
    "- teleprompterLines must be short enough to read comfortably out loud and must be cut from the same final message in the same order.",
    "- Do not mention being an AI.",
    "- Return valid JSON only.",
    "",
    "Delivery guidance:",
    `- Clear: ${OPENAI_TONE_GUIDANCE.Clear}`,
    `- Respectful: ${OPENAI_TONE_GUIDANCE.Respectful}`,
    `- Calm: ${OPENAI_TONE_GUIDANCE.Calm}`,
    `- Selected desired tone: ${selectedTone}. Emphasize this one most strongly. ${selectedToneGuidance}`,
    "",
    "Relationship guidance:",
    `- ${relationship}: ${relationshipGuidance}`,
    "",
    "SayIt categories and user draft:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

async function requestOpenAiTranslation(payload, env) {
  const apiKey = getOpenAiApiKey(env);
  if (!apiKey) {
    throw new Error("OpenAI API key not configured.");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: String(env?.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL,
      instructions: getOpenAiBehavior(env),
      input: buildOpenAiPrompt(payload)
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `OpenAI request failed with status ${response.status}.`);
  }

  const text = extractTextFromResponse(body);
  return parseJsonObject(text);
}

async function translate(payload, env) {
  const normalizedPayload = normalizePayload(payload);
  const fallbackTranslation = buildTranslation(normalizedPayload);

  try {
    if (!getOpenAiApiKey(env)) {
      throw new Error("OpenAI API key not configured.");
    }

    const openAiTranslation = await requestOpenAiTranslation(normalizedPayload, env);
    const translation = mergeOpenAiTranslation(fallbackTranslation, openAiTranslation);

    return {
      translation,
      meta: {
        runtime: "cloudflare-pages-function",
        mode: "openai",
        model: String(env?.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL,
        providerConfigured: true,
        behaviorConfigured: Boolean(String(env?.OPENAI_BEHAVIOR || "").trim())
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "OpenAI unavailable.";
    const translation = {
      ...fallbackTranslation,
      diagnostics: {
        ...fallbackTranslation.diagnostics,
        source: "rule-based"
      }
    };

    return {
      translation,
      meta: {
        runtime: "cloudflare-pages-function",
        mode: "rule-based",
        providerConfigured: Boolean(getOpenAiApiKey(env)),
        behaviorConfigured: Boolean(String(env?.OPENAI_BEHAVIOR || "").trim()),
        fallbackReason: reason
      }
    };
  }
}

export function onRequestGet({ env }) {
  return json({
    ok: true,
    name: "SayIt! Translate API",
    mode: Boolean(getOpenAiApiKey(env)) ? "openai-or-rule-based-fallback" : "rule-based",
    runtime: "cloudflare-pages-function",
    providerConfigured: Boolean(getOpenAiApiKey(env)),
    behaviorConfigured: Boolean(String(env?.OPENAI_BEHAVIOR || "").trim()),
    model: String(env?.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL
  });
}

export async function onRequestPost({ request, env }) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid JSON payload."
      },
      { status: 400 }
    );
  }

  const result = await translate(payload, env);

  return json({
    ok: true,
    ...result
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS"
    }
  });
}
