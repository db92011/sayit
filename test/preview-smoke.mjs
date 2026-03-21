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
assert.match(html, /SayIt! \| Install the app/i, "Preview should render the install title");
assert.match(html, /This is the SayIt install surface on the app domain/i, "Preview should render the installer shell");
assert.match(html, /src="\/index\.js"/i, "Preview should reference the installer entry script");
assert.doesNotMatch(html, /id="teleprompter-overlay"/i, "Install page should not include the teleprompter overlay shell");
assert.doesNotMatch(html, /id="plusModal"/i, "Install page should not include the plus upsell modal shell");

const appHtml = await fetchText(resolveUrl("/app?preview=app-mobile"), "App preview HTML");
assert.match(appHtml, /window\.__SAYIT_PREVIEW_MODE__/i, "App preview should include preview bootstrapping");
assert.match(appHtml, /preview-app-mobile/i, "App preview should include mobile preview mode styling hooks");
assert.match(appHtml, /id="teleprompter-overlay"/i, "App preview should include the teleprompter shell");
assert.match(appHtml, /id="plusModal"/i, "App preview should include the plus upsell modal shell");

const css = await fetchText(resolveUrl("/app.css"), "App stylesheet");
assert.match(css, /\.counterBar\b/, "Stylesheet should include the paywall rail styles");
assert.match(css, /\.preview-app-mobile\b/, "Stylesheet should include mobile app preview styles");
assert.match(css, /\.teleprompter-overlay\b/, "Stylesheet should include teleprompter overlay styles");

const appEntry = await fetchText(resolveUrl("/app.js"), "App entry module");
assert.match(appEntry, /import "\.\/src\/main\.js"/, "App entry should load the main application module");

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
