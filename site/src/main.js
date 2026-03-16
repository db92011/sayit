import { createSpeechController } from "./speech.js";
import { TeleprompterController } from "./teleprompter.js";
import { requestTranslation } from "./translation-service.js";

const STORAGE_KEY = "sayit-draft-v2";

const form = document.querySelector("#intake-form");
const voicePreview = document.querySelector("#voice-preview");
const copyMessageButton = document.querySelector("#copy-message");
const closeTeleprompterButton = document.querySelector("#close-teleprompter");
const teleprompterOverlay = document.querySelector("#teleprompter-overlay");
const teleprompterSummary = document.querySelector("#teleprompter-summary");
const submitButton = document.querySelector("#translate-action");

const fields = {
  recipient: document.querySelector("#recipient"),
  relationship: document.querySelector("#relationship"),
  situation: document.querySelector("#situation"),
  message: document.querySelector("#message"),
  intent: document.querySelector("#intent"),
  afterState: document.querySelector("#after-state")
};

const teleprompter = new TeleprompterController({
  container: document.querySelector("#teleprompter"),
  script: document.querySelector("#teleprompter-script"),
  highlightToggle: document.querySelector("#highlight-toggle")
});

let latestMessageText = "";

function updateVoicePreview(text = "") {
  voicePreview.textContent = text || "Your spoken draft will show up here as you talk.";
}

function setTeleprompterSummary(text = "") {
  teleprompterSummary.textContent =
    text ||
    "Once you push Let's do this, teleprompter will pop up. You can read from it directly by saying, \"I want to read from some notes,\" or \"This was important, so I wrote some notes.\" Or you can copy and paste it into a message or email.";
}

function setCopyButtonLabel(label) {
  copyMessageButton.textContent = label;
}

function openTeleprompter() {
  if (!latestMessageText) {
    return;
  }

  teleprompterOverlay.hidden = false;
  teleprompterOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("teleprompter-open");
}

function closeTeleprompter() {
  teleprompter.pause();
  teleprompterOverlay.hidden = true;
  teleprompterOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("teleprompter-open");
}

function collectData() {
  const transcript = fields.message.value.trim();
  const situation = fields.situation.value.trim();

  return {
    recipient: fields.recipient.value.trim(),
    relationship: fields.relationship.value,
    situation,
    message: transcript || situation,
    intent: fields.intent.value,
    outcome: fields.afterState.value,
    afterState: fields.afterState.value
  };
}

function clearOutputs() {
  closeTeleprompter();
  latestMessageText = "";
  copyMessageButton.disabled = true;
  setCopyButtonLabel("Copy message");
  setTeleprompterSummary("");
  teleprompter.setLines([]);
}

function updateOutputs(translation) {
  latestMessageText = translation?.primary || "";
  copyMessageButton.disabled = !latestMessageText;
  setCopyButtonLabel("Copy message");
  setTeleprompterSummary();
  teleprompter.setLines(translation?.teleprompterLines || []);
}

function setGeneratingState(isGenerating) {
  submitButton.disabled = isGenerating;
  submitButton.textContent = isGenerating ? "Working..." : "Let's do this";
}

async function generateTranslation({ openTeleprompterOnComplete = false } = {}) {
  const payload = collectData();

  if (!payload.message) {
    clearOutputs();
    return null;
  }

  setGeneratingState(true);

  try {
    const result = await requestTranslation(payload);
    updateOutputs(result.translation);
    if (openTeleprompterOnComplete && result?.translation?.primary) {
      openTeleprompter();
    }
    return result.translation;
  } finally {
    setGeneratingState(false);
  }
}

function persistDraft() {
  const payload = {
    ...collectData(),
    message: fields.message.value.trim()
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateDraft() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const draft = JSON.parse(raw);
    for (const [key, field] of Object.entries(fields)) {
      if (field && typeof draft[key] === "string") {
        field.value = draft[key];
      }
    }

    updateVoicePreview(draft.message || "");

    if ((draft.message || "").trim() || (draft.situation || "").trim()) {
      generateTranslation();
    }

    return true;
  } catch {
    return false;
  }
}

function resetForm() {
  speechController?.stop();
  form.reset();
  fields.message.value = "";
  updateVoicePreview("");
  clearOutputs();
  window.localStorage.removeItem(STORAGE_KEY);
}

clearOutputs();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  persistDraft();
  generateTranslation({ openTeleprompterOnComplete: true });
});

form.addEventListener("input", () => {
  persistDraft();
});

form.addEventListener("change", () => {
  persistDraft();
});

document.querySelector("#reset-form").addEventListener("click", resetForm);
closeTeleprompterButton.addEventListener("click", closeTeleprompter);

teleprompterOverlay.addEventListener("click", (event) => {
  if (event.target === teleprompterOverlay) {
    closeTeleprompter();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !teleprompterOverlay.hidden) {
    closeTeleprompter();
  }
});

copyMessageButton.addEventListener("click", async () => {
  if (!latestMessageText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latestMessageText);
    setCopyButtonLabel("Copied");
    window.setTimeout(() => {
      setCopyButtonLabel("Copy message");
    }, 1200);
  } catch {
    setCopyButtonLabel("Copy failed");
  }
});

const speechController = createSpeechController({
  textarea: fields.message,
  statusNode: document.querySelector("#voice-status"),
  startButton: document.querySelector("#voice-start"),
  stopButton: document.querySelector("#voice-stop"),
  onTranscript(nextValue) {
    updateVoicePreview(nextValue);
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
  resetForm();
}
