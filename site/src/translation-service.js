import { buildTranslation } from "./rewrite-engine.js";

const API_ENDPOINT = "/api/translate";
const API_TIMEOUT_MS = 4000;

function buildFallback(payload, reason) {
  return {
    translation: buildTranslation(payload),
    meta: {
      source: "local",
      label: "Local engine fallback",
      reason
    }
  };
}

export async function requestTranslation(payload) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Translation request failed with status ${response.status}.`);
    }

    const body = await response.json();
    if (!body?.translation) {
      throw new Error("Translation response was missing a payload.");
    }

    return {
      translation: body.translation,
      meta: {
        source: "api",
        label: "Pages Function API",
        runtime: body.meta?.runtime || "unknown",
        mode: body.meta?.mode || "rule-based"
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Request failed.";
    return buildFallback(payload, reason);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
