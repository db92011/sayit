import { buildTranslation } from "../../site/src/rewrite-engine.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_OPENAI_BEHAVIOR = [
  "You rewrite emotionally charged or messy drafts into calm, clear, human communication.",
  "Preserve the user's core meaning, lower unnecessary heat, and keep the wording natural.",
  "Never sound robotic, therapy-scripted, or corporate unless the situation clearly calls for it.",
  "Output valid JSON only."
].join(" ");

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

function mergeOpenAiTranslation(base, candidate) {
  const translation = candidate && typeof candidate === "object" ? candidate : {};
  const primary = String(translation.primary || "").trim();

  if (!primary) {
    throw new Error("OpenAI translation was missing a primary draft.");
  }

  return {
    ...base,
    ...translation,
    primary,
    concise: String(translation.concise || base.concise || primary).trim(),
    teleprompterLines:
      Array.isArray(translation.teleprompterLines) && translation.teleprompterLines.length
        ? translation.teleprompterLines.map((line) => String(line).trim()).filter(Boolean)
        : base.teleprompterLines,
    summary:
      Array.isArray(translation.summary) && translation.summary.length
        ? translation.summary.map((line) => String(line).trim()).filter(Boolean)
        : base.summary,
    conversationMap:
      Array.isArray(translation.conversationMap) && translation.conversationMap.length
        ? translation.conversationMap.map((line) => String(line).trim()).filter(Boolean)
        : base.conversationMap,
    toneMap:
      Array.isArray(translation.toneMap) && translation.toneMap.length
        ? translation.toneMap.map((entry) => ({
            label: String(entry?.label || "").trim(),
            action: String(entry?.action || "").trim()
          }))
        : base.toneMap,
    deliveryNotes:
      Array.isArray(translation.deliveryNotes) && translation.deliveryNotes.length
        ? translation.deliveryNotes.map((line) => String(line).trim()).filter(Boolean)
        : base.deliveryNotes,
    diagnostics: {
      ...base.diagnostics,
      source: "openai"
    }
  };
}

function buildOpenAiPrompt(payload) {
  const data = normalizePayload(payload);
  return [
    "Create a translation payload for SayIt! using this exact JSON shape:",
    "{",
    '  "primary": "string",',
    '  "concise": "string",',
    '  "summary": ["string", "string", "string"],',
    '  "conversationMap": ["string", "string", "string", "string"],',
    '  "toneMap": [{"label":"string","action":"string"}],',
    '  "deliveryNotes": ["string", "string", "string"],',
    '  "teleprompterLines": ["string", "string"]',
    "}",
    "Requirements:",
    "- Keep the user's meaning intact.",
    "- Make it calmer, clearer, and more effective.",
    "- Use simple, natural language.",
    "- Do not mention being an AI.",
    "- Keep summary to 3 bullets and conversationMap to 4 bullets.",
    "- Return valid JSON only.",
    "",
    "User context:",
    JSON.stringify(data, null, 2)
  ].join("\n");
}

async function requestOpenAiTranslation(payload, env) {
  const apiKey = String(env?.OPENAI_API_KEY || "").trim();
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
    if (!env?.OPENAI_API_KEY) {
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
        providerConfigured: Boolean(env?.OPENAI_API_KEY),
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
    mode: Boolean(env?.OPENAI_API_KEY) ? "openai-or-rule-based-fallback" : "rule-based",
    runtime: "cloudflare-pages-function",
    providerConfigured: Boolean(env?.OPENAI_API_KEY),
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
