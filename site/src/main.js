import { buildTranslation } from "./rewrite-engine.js";
import { createSpeechController } from "./speech.js";
import { TeleprompterController } from "./teleprompter.js";
import { requestTranslation } from "./translation-service.js";

const STORAGE_KEY = "sayit-draft-v1";
const DEFAULT_TONES = ["calm", "clear"];
const TONES = ["calm", "friendly", "professional", "direct", "confident", "funny", "gentle", "clear"];

const SAMPLE_DATA = {
  recipient: "My manager",
  relationship: "Boss or supervisor",
  situation: "Feedback got tense in a meeting and I want to reset without sounding defensive.",
  message:
    "I felt like you threw me under the bus in front of everybody and now I am really annoyed because it made me look careless when I had already flagged the issue earlier.",
  intent: "auto",
  outcome: "Be taken seriously",
  barrier: "Power dynamic",
  beforeState: "Too emotional",
  afterState: "Respectful",
  proof: "The conversation stays calm and we agree on the next step.",
  tones: ["calm", "professional", "clear"]
};

const form = document.querySelector("#intake-form");
const toneGroup = document.querySelector("#tone-group");
const saveStatus = document.querySelector("#save-status");
const intentBadge = document.querySelector("#intent-badge");
const engineBadge = document.querySelector("#engine-badge");
const summaryGrid = document.querySelector("#summary-grid");
const conversationMap = document.querySelector("#conversation-map");
const toneMap = document.querySelector("#tone-map");
const primaryOutput = document.querySelector("#primary-output");
const shortOutput = document.querySelector("#short-output");
const notesOutput = document.querySelector("#notes-output");
const copyPrimaryButton = document.querySelector("#copy-primary");
const submitButton = form.querySelector('button[type="submit"]');

const fields = {
  recipient: document.querySelector("#recipient"),
  relationship: document.querySelector("#relationship"),
  situation: document.querySelector("#situation"),
  message: document.querySelector("#message"),
  intent: document.querySelector("#intent"),
  outcome: document.querySelector("#outcome"),
  barrier: document.querySelector("#barrier"),
  beforeState: document.querySelector("#before-state"),
  afterState: document.querySelector("#after-state"),
  proof: document.querySelector("#proof")
};

const teleprompter = new TeleprompterController({
  container: document.querySelector("#teleprompter"),
  script: document.querySelector("#teleprompter-script"),
  highlightToggle: document.querySelector("#highlight-toggle")
});

let selectedTones = [...DEFAULT_TONES];

function renderToneButtons() {
  toneGroup.innerHTML = "";

  for (const tone of TONES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${selectedTones.includes(tone) ? " is-active" : ""}`;
    button.dataset.tone = tone;
    button.textContent = tone;
    button.addEventListener("click", () => {
      if (selectedTones.includes(tone)) {
        selectedTones = selectedTones.filter((item) => item !== tone);
      } else {
        selectedTones = [...selectedTones, tone].slice(-3);
      }

      if (selectedTones.length === 0) {
        selectedTones = [...DEFAULT_TONES];
      }

      persistDraft();
      renderToneButtons();
    });
    toneGroup.appendChild(button);
  }
}

function collectData() {
  return {
    recipient: fields.recipient.value.trim(),
    relationship: fields.relationship.value,
    situation: fields.situation.value.trim(),
    message: fields.message.value.trim(),
    intent: fields.intent.value,
    outcome: fields.outcome.value,
    barrier: fields.barrier.value,
    beforeState: fields.beforeState.value,
    afterState: fields.afterState.value,
    proof: fields.proof.value.trim(),
    tones: selectedTones
  };
}

function renderSummary(cards) {
  summaryGrid.innerHTML = "";

  for (const card of cards) {
    const article = document.createElement("article");
    article.className = "summary-card";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = card.label;

    const title = document.createElement("strong");
    title.textContent = card.title;

    const body = document.createElement("p");
    body.textContent = card.body;

    article.append(label, title, body);
    summaryGrid.appendChild(article);
  }
}

function renderNotes(notes, proof) {
  notesOutput.innerHTML = "";

  const items = [...notes, proof].filter(Boolean);
  for (const note of items) {
    const li = document.createElement("li");
    li.textContent = note;
    notesOutput.appendChild(li);
  }
}

function renderDetailList(node, items) {
  node.innerHTML = "";

  for (const item of items) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${item.label}:`;
    li.appendChild(strong);
    li.append(` ${item.value}`);

    if (item.detail) {
      const span = document.createElement("span");
      span.textContent = item.detail;
      li.appendChild(span);
    }

    node.appendChild(li);
  }
}

function updateOutputs(translation) {
  intentBadge.textContent = `Detected intent: ${translation.intentLabel}`;
  primaryOutput.classList.remove("empty-state");
  primaryOutput.textContent = translation.primary;
  shortOutput.textContent = translation.concise;
  renderSummary(translation.summary);
  renderNotes(translation.notes, translation.proof);
  renderDetailList(conversationMap, translation.conversationMap || []);
  renderDetailList(
    toneMap,
    (translation.toneMap || []).map((item) => ({
      label: item.label,
      value: item.action
    }))
  );
  teleprompter.setLines(translation.teleprompterLines);
}

function setGeneratingState(isGenerating) {
  submitButton.disabled = isGenerating;
  submitButton.textContent = isGenerating ? "Translating..." : "Translate my message";

  if (isGenerating) {
    engineBadge.textContent = "Generating translation...";
    engineBadge.classList.remove("is-fallback");
  }
}

function updateEngineBadge(meta = {}) {
  if (meta.source === "api") {
    engineBadge.textContent = `Powered by ${meta.label}`;
    engineBadge.classList.remove("is-fallback");
    return;
  }

  engineBadge.textContent = meta.reason ? `${meta.label}: ${meta.reason}` : meta.label || "Local engine";
  engineBadge.classList.add("is-fallback");
}

async function generateTranslation() {
  const payload = collectData();

  if (!payload.message) {
    const translation = buildTranslation(payload);
    updateOutputs(translation);
    updateEngineBadge({
      source: "local",
      label: "Waiting for a message"
    });
    return translation;
  }

  setGeneratingState(true);

  try {
    const result = await requestTranslation(payload);
    updateEngineBadge(result.meta);
    updateOutputs(result.translation);
    return result.translation;
  } finally {
    setGeneratingState(false);
  }
}

function persistDraft() {
  const payload = {
    ...collectData(),
    tones: selectedTones
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  saveStatus.textContent = "Draft saved locally";
}

function hydrateDraft() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const draft = JSON.parse(raw);
    for (const [key, field] of Object.entries(fields)) {
      if (draft[key] && field) {
        field.value = draft[key];
      }
    }

    if (Array.isArray(draft.tones) && draft.tones.length > 0) {
      selectedTones = draft.tones.slice(0, 3);
    }

    renderToneButtons();
    if (draft.message) {
      generateTranslation();
    }
    return true;
  } catch {
    return false;
  }
}

function applySample() {
  for (const [key, field] of Object.entries(fields)) {
    if (field && key in SAMPLE_DATA) {
      field.value = SAMPLE_DATA[key];
    }
  }

  selectedTones = [...SAMPLE_DATA.tones];
  renderToneButtons();
  persistDraft();
  generateTranslation();
}

function resetForm() {
  form.reset();
  selectedTones = [...DEFAULT_TONES];
  renderToneButtons();
  window.localStorage.removeItem(STORAGE_KEY);
  saveStatus.textContent = "Draft cleared";
  intentBadge.textContent = "Intent waiting for input";
  primaryOutput.textContent = "Complete the intake, then generate a draft.";
  primaryOutput.classList.add("empty-state");
  shortOutput.textContent = "Your condensed version will appear here.";
  notesOutput.innerHTML = "<li>Choose a tone and outcome to shape the coaching notes.</li>";
  conversationMap.innerHTML = "<li>Generate a translation to map the conversation shape.</li>";
  toneMap.innerHTML = "<li>Choose up to three tones to see how the rewrite is being steered.</li>";
  summaryGrid.innerHTML = "";
  engineBadge.textContent = "Waiting for translation";
  engineBadge.classList.remove("is-fallback");
  teleprompter.setLines([]);
}

renderToneButtons();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistDraft();
  generateTranslation().catch(() => {
    updateEngineBadge({
      source: "local",
      label: "Local engine fallback",
      reason: "Unexpected error."
    });
  });
});

form.addEventListener("input", () => {
  saveStatus.textContent = "Saving changes...";
  persistDraft();
});

document.querySelector("#load-sample").addEventListener("click", applySample);
document.querySelector("#reset-form").addEventListener("click", resetForm);

copyPrimaryButton.addEventListener("click", async () => {
  if (!primaryOutput.textContent || primaryOutput.classList.contains("empty-state")) {
    return;
  }

  try {
    await navigator.clipboard.writeText(primaryOutput.textContent);
    copyPrimaryButton.textContent = "Copied";
    window.setTimeout(() => {
      copyPrimaryButton.textContent = "Copy";
    }, 1200);
  } catch {
    copyPrimaryButton.textContent = "Copy failed";
  }
});

const speechController = createSpeechController({
  textarea: fields.message,
  statusNode: document.querySelector("#voice-status"),
  startButton: document.querySelector("#voice-start"),
  stopButton: document.querySelector("#voice-stop"),
  onTranscript() {
    persistDraft();
  }
});

document.querySelector("#voice-start").addEventListener("click", () => {
  speechController?.start();
});

document.querySelector("#voice-stop").addEventListener("click", () => {
  speechController?.stop();
});

document.querySelector("#highlight-toggle").addEventListener("change", () => {
  teleprompter.updateHighlight();
});

document.querySelector("#speed-group").addEventListener("click", (event) => {
  const button = event.target.closest("[data-speed]");
  if (!button) {
    return;
  }

  document.querySelectorAll(".speed-button").forEach((node) => {
    node.classList.toggle("is-active", node === button);
  });
  teleprompter.setSpeed(button.dataset.speed);
});

document.querySelector("#teleprompter-start").addEventListener("click", () => {
  teleprompter.start();
});

document.querySelector("#teleprompter-pause").addEventListener("click", () => {
  teleprompter.pause();
});

document.querySelector("#teleprompter-reset").addEventListener("click", () => {
  teleprompter.reset();
});

if (!hydrateDraft()) {
  applySample();
}
