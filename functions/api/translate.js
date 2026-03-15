import { buildTranslation } from "../../site/src/rewrite-engine.js";

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

async function translate(payload, env) {
  const translation = buildTranslation(normalizePayload(payload));

  return {
    translation,
    meta: {
      runtime: "cloudflare-pages-function",
      mode: "rule-based",
      providerConfigured: Boolean(env?.OPENAI_API_KEY)
    }
  };
}

export function onRequestGet({ env }) {
  return json({
    ok: true,
    name: "SayIt! Translate API",
    mode: "rule-based",
    runtime: "cloudflare-pages-function",
    providerConfigured: Boolean(env?.OPENAI_API_KEY)
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
