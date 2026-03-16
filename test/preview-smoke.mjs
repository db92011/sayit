import assert from "node:assert/strict";

const previewUrl = String(process.env.PREVIEW_URL || "").trim().replace(/\/+$/, "");

if (!previewUrl) {
  console.error("PREVIEW_URL is required for preview smoke tests.");
  process.exit(1);
}

function resolveUrl(pathname = "") {
  return new URL(pathname, `${previewUrl}/`).toString();
}

async function fetchText(url, label) {
  const response = await fetch(url, { redirect: "follow" });
  assert.equal(response.ok, true, `${label} should return 200`);
  return await response.text();
}

async function fetchJson(url, init, label) {
  const response = await fetch(url, init);
  assert.equal(response.ok, true, `${label} should return 200`);
  return await response.json();
}

const html = await fetchText(resolveUrl("/"), "Preview HTML");
assert.match(html, /SayIt! \| Communication Translator/i, "Preview should render the SayIt title");
assert.match(html, /Communication translator \+ teleprompter/i, "Preview should render the branded hero copy");
assert.match(html, /src="\.\/src\/main\.js"/i, "Preview should reference the application entry script");
assert.match(html, /id="teleprompter-overlay"/i, "Preview should include the teleprompter overlay shell");

const mobilePreviewHtml = await fetchText(resolveUrl("/?preview=app-mobile"), "Mobile app preview HTML");
assert.match(mobilePreviewHtml, /window\.__SAYIT_PREVIEW_MODE__/i, "Mobile app preview should include preview bootstrapping");
assert.match(mobilePreviewHtml, /id="open-teleprompter"/i, "Mobile app preview should include the teleprompter launcher");

const css = await fetchText(resolveUrl("/styles.css"), "Stylesheet");
assert.match(css, /\.hero\b/, "Stylesheet should include hero styles");
assert.match(css, /\.preview-app-mobile\b/, "Stylesheet should include mobile app preview styles");
assert.match(css, /\.teleprompter-overlay\b/, "Stylesheet should include teleprompter overlay styles");

const js = await fetchText(resolveUrl("/src/main.js"), "Main application module");
assert.match(js, /generateTranslation|TeleprompterController/, "Main module should include the app bootstrap");

const health = await fetchJson(resolveUrl("/api/translate"), {}, "Translation API health");
assert.equal(health.ok, true, "Translation API health should report ok");
assert.equal(health.runtime, "cloudflare-pages-function", "Translation API health should report Pages runtime");

const translation = await fetchJson(
  resolveUrl("/api/translate"),
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipient: "My manager",
      relationship: "Boss or supervisor",
      situation: "Feedback got tense in a meeting and I want to reset without sounding defensive.",
      message: "I want to reset this calmly and explain what happened without sounding defensive.",
      intent: "auto",
      outcome: "Be understood clearly",
      barrier: "Power dynamic",
      beforeState: "Too emotional",
      afterState: "Clear",
      proof: "",
      tones: ["calm", "clear"],
    }),
  },
  "Translation API POST"
);

assert.equal(translation.ok, true, "Translation API POST should report ok");
assert.match(translation.translation?.primary || "", /I want|Let me|I hear/i, "Translation API should return a usable draft");

console.log(`Preview smoke passed for ${previewUrl}`);
