import { createSpeechController } from "./speech.js";
import { TeleprompterController } from "./teleprompter.js";
import { requestTranslation } from "./translation-service.js";

const STORAGE_KEY = "sayit-draft-v4";
const SAYIT_PRO_ACTIVE_KEY = "sayit_pro_active";
const SAYIT_PRO_EMAIL_KEY = "sayit_pro_email";
const SAYIT_DEVICE_ID_KEY = "sayit_device_id";

function safeTrim(value = "") {
  return String(value || "").trim();
}

function stripTrailingSlashes(value = "") {
  return safeTrim(value).replace(/\/+$/, "");
}

function getConfiguredApiBase() {
  const globalBase = safeTrim(window.__SAYIT_API_BASE__);
  if (globalBase) {
    return stripTrailingSlashes(globalBase);
  }

  const meta = document.querySelector('meta[name="sayit-api-base"]');
  const metaBase = safeTrim(meta?.getAttribute("content"));
  if (metaBase) {
    return stripTrailingSlashes(metaBase);
  }

  return stripTrailingSlashes(window.location.origin || "");
}

const SAYIT_API_BASE = getConfiguredApiBase();
const SAYIT_PLAN_URL = `${SAYIT_API_BASE}/api/plan`;
const SAYIT_REMOVE_OLDEST_URL = `${SAYIT_API_BASE}/api/devices/remove-oldest`;
const SAYIT_CHECKOUT_URL = `${SAYIT_API_BASE}/api/create-checkout-link`;

const form = document.querySelector("#intake-form");
const voicePreview = document.querySelector("#voice-preview");
const copyResultButton = document.querySelector("#copy-result");
const teleprompterCopyButton = document.querySelector("#copy-message");
const closeTeleprompterButton = document.querySelector("#close-teleprompter");
const openTeleprompterButton = document.querySelector("#open-teleprompter");
const teleprompterOverlay = document.querySelector("#teleprompter-overlay");
const teleprompterSummary = document.querySelector("#teleprompter-summary");
const teleprompterPlaybackButton = document.querySelector("#teleprompter-playback");
const teleprompterSpeedToggleButton = document.querySelector("#teleprompter-speed-toggle");
const teleprompterSpeedGroup = document.querySelector("#speed-group");
const resultField = document.querySelector("#result");
const charCount = document.querySelector("#charCount");
const submitButton = document.querySelector("#translate-action");
const plusModal = document.querySelector("#plusModal");
const plusModalCard = document.querySelector("#plusModal .modalCard");
const plusEmailInput = document.querySelector("#plusEmail");
const plusCancelButton = document.querySelector("#plusCancelBtn");
const plusContinueButton = document.querySelector("#plusContinueBtn");
const counterText = document.querySelector("#counterText");
const deviceLimitMessage = document.querySelector("#deviceLimitMsg");
const manageDevicesButton = document.querySelector("#manageDevicesLink");

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
  highlightToggle: document.querySelector("#highlight-toggle"),
  onStateChange: () => syncTeleprompterControls()
});

const voiceStatusNode = document.querySelector("#voice-status");

let latestMessageText = "";
let continueBusy = false;
let removeBusy = false;
let appLocked = false;

function detectRuntimeMode() {
  const isNativeApp =
    window.Capacitor?.isNativePlatform?.() === true ||
    /Capacitor/i.test(window.navigator.userAgent || "");
  if (isNativeApp) {
    return "native";
  }

  const iosStandalone = window.navigator.standalone === true;
  const displayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayStandalone ? "standalone" : "browser";
}

function refreshRuntimeModeUi() {
  const runtimeMode = detectRuntimeMode();
  document.documentElement.setAttribute("data-standalone", runtimeMode === "standalone" ? "yes" : "no");
  document.documentElement.setAttribute("data-native-app", runtimeMode === "native" ? "yes" : "no");
}

function isLocalPreviewHost() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function setAppLocked(locked) {
  appLocked = Boolean(locked);
  document.body.classList.toggle("app-locked", appLocked);

  for (const field of Object.values(fields)) {
    if (field) {
      field.disabled = appLocked;
    }
  }

  if (submitButton) {
    submitButton.disabled = appLocked;
  }

  if (copyResultButton) {
    copyResultButton.disabled = appLocked || !latestMessageText;
  }

  if (openTeleprompterButton) {
    openTeleprompterButton.disabled = appLocked || !latestMessageText;
  }
}

function getOrCreateDeviceId() {
  const existing = String(window.localStorage.getItem(SAYIT_DEVICE_ID_KEY) || "").trim();
  if (existing) {
    return existing;
  }

  let nextId = "";
  try {
    if (window.crypto?.randomUUID) {
      nextId = `sayit_${window.crypto.randomUUID()}`;
    }
  } catch {}

  if (!nextId) {
    nextId = `sayit_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  window.localStorage.setItem(SAYIT_DEVICE_ID_KEY, nextId);
  return nextId;
}

function isSayItProActive() {
  return window.localStorage.getItem(SAYIT_PRO_ACTIVE_KEY) === "true";
}

function getSayItProEmail() {
  return String(window.localStorage.getItem(SAYIT_PRO_EMAIL_KEY) || "").trim().toLowerCase();
}

function setSayItProActive(email = "") {
  window.localStorage.setItem(SAYIT_PRO_ACTIVE_KEY, "true");
  if (email) {
    window.localStorage.setItem(SAYIT_PRO_EMAIL_KEY, email);
  }
  setAppLocked(false);
  refreshPlusUi();
}

function refreshPlusUi() {
  if (!counterText) {
    return;
  }

  counterText.textContent = isSayItProActive() ? "Registered" : "";
}

function showPlusModal() {
  if (!plusModal) {
    return;
  }

  plusModal.hidden = false;
  plusModal.removeAttribute("hidden");
  plusModal.style.display = "flex";
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  const saved = getSayItProEmail();
  if (plusEmailInput && saved && !plusEmailInput.value) {
    plusEmailInput.value = saved;
  }

  resetDeviceLimitUi();

  window.setTimeout(() => {
    plusEmailInput?.focus();
  }, 30);
}

function enforceAccessGate() {
  const unlocked = isSayItProActive();
  setAppLocked(!unlocked);

  if (!unlocked && !isLocalPreviewHost()) {
    showPlusModal();
  }
}

function hidePlusModal() {
  if (!plusModal) {
    return;
  }

  if (appLocked && !isSayItProActive()) {
    return;
  }

  plusModal.hidden = true;
  plusModal.setAttribute("hidden", "");
  plusModal.style.display = "none";
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function resetDeviceLimitUi() {
  if (deviceLimitMessage) {
    deviceLimitMessage.style.display = "none";
    deviceLimitMessage.textContent = "";
    deviceLimitMessage.innerHTML = "";
  }

  if (manageDevicesButton) {
    manageDevicesButton.style.display = "none";
    manageDevicesButton.disabled = false;
    manageDevicesButton.onclick = null;
  }
}

function setDeviceMessage(html) {
  if (!deviceLimitMessage) {
    return;
  }

  deviceLimitMessage.innerHTML = html;
  deviceLimitMessage.style.display = "block";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function checkPlan(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { plan: "free", status: "none", allowed: true };
  }

  const deviceId = getOrCreateDeviceId();
  const response = await fetch(SAYIT_PLAN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sayit-device": deviceId,
      "x-sayit-email": normalizedEmail
    },
    body: JSON.stringify({
      email: normalizedEmail,
      device_id: deviceId
    })
  });

  const body = await response.json().catch(() => ({}));
  if (
    response.status === 403 &&
    (body?.reason === "DEVICE_LIMIT_REACHED" || body?.blockReason === "device_limit" || body?.allowed === false)
  ) {
    return {
      plan: "plus",
      status: body?.status || "active",
      allowed: false,
      blocked: true,
      message: body?.message || "You've already used SayIt! Pro on 2 devices.",
      seatsUsed: body?.seatsUsed,
      seatsMax: body?.seatsMax
    };
  }

  if (!response.ok) {
    throw new Error(body?.error || "Unable to check your SayIt! Pro status right now.");
  }

  return {
    plan: body?.plan === "plus" ? "plus" : "free",
    status: body?.status || "none",
    allowed: body?.allowed !== false
  };
}

async function removeOldestDevice(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (removeBusy) {
    return { ok: false, message: "Please wait..." };
  }

  removeBusy = true;
  if (manageDevicesButton) {
    manageDevicesButton.disabled = true;
  }

  try {
    const response = await fetch(SAYIT_REMOVE_OLDEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sayit-device": getOrCreateDeviceId(),
        "x-sayit-email": normalizedEmail
      },
      body: JSON.stringify({
        email: normalizedEmail,
        device_id: getOrCreateDeviceId()
      })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        message: body?.message || "Couldn't remove a device. Try again."
      };
    }

    return {
      ok: true,
      message: body?.message || "Oldest device removed."
    };
  } catch {
    return {
      ok: false,
      message: "Network issue. Try again."
    };
  } finally {
    removeBusy = false;
    if (manageDevicesButton) {
      manageDevicesButton.disabled = false;
    }
  }
}

function showDeviceLimitUi(message, email) {
  const seatsLine = String(message || "You've hit the 2-device limit for this email.").trim();
  setDeviceMessage(
    "<strong>Device limit reached</strong><br>" +
      escapeHtml(seatsLine) +
      "<br><br>To use SayIt! Pro on this device, remove your oldest device seat.<br>" +
      '<span style="opacity:.85;">This happens instantly here - no new screens.</span>'
  );

  if (!manageDevicesButton) {
    return;
  }

  manageDevicesButton.style.display = "inline-flex";
  manageDevicesButton.textContent = "Remove your oldest device";
  manageDevicesButton.onclick = async (event) => {
    event.preventDefault();
    setDeviceMessage("<strong>Device limit reached</strong><br>Removing your oldest device...");
    const result = await removeOldestDevice(email);

    if (!result.ok) {
      setDeviceMessage(`<strong>Device limit reached</strong><br>${escapeHtml(result.message)}`);
      return;
    }

    setDeviceMessage("<strong>Device limit reached</strong><br>Oldest device removed. Unlocking this device...");
    try {
      const nextPlan = await checkPlan(email);
      if (nextPlan.plan === "plus" && nextPlan.allowed !== false) {
        hidePlusModal();
        setSayItProActive(email);
        return;
      }
      showDeviceLimitUi(nextPlan.message || "Still blocked. Try once more.", email);
    } catch (error) {
      setDeviceMessage(
        `<strong>Device limit reached</strong><br>${escapeHtml(
          error instanceof Error ? error.message : "Unable to unlock right now."
        )}`
      );
    }
  };
}

async function goToStripeCheckout(email) {
  const response = await fetch(SAYIT_CHECKOUT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      source: "sayit-app-modal"
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok || !body?.checkoutUrl) {
    throw new Error(body?.error || "Unable to start SayIt! Pro checkout right now.");
  }

  window.location.href = body.checkoutUrl;
}

async function syncPlusFromServer() {
  if (!isSayItProActive()) {
    return;
  }

  const email = getSayItProEmail();
  if (!email) {
    window.localStorage.removeItem(SAYIT_PRO_ACTIVE_KEY);
    refreshPlusUi();
    return;
  }

  try {
    const plan = await checkPlan(email);
    if (plan.plan !== "plus") {
      window.localStorage.removeItem(SAYIT_PRO_ACTIVE_KEY);
      refreshPlusUi();
    }
  } catch {}
}

async function handlePlusContinue() {
  const email = String(plusEmailInput?.value || "").trim().toLowerCase();

  if (email) {
    window.localStorage.setItem(SAYIT_PRO_EMAIL_KEY, email);
  }

  if (!email || continueBusy) {
    return;
  }

  continueBusy = true;
  if (plusContinueButton) {
    plusContinueButton.disabled = true;
  }

  try {
    resetDeviceLimitUi();

    const plan = await checkPlan(email);
    if (plan.blocked) {
      showDeviceLimitUi(plan.message, email);
      return;
    }

    if (plan.plan === "plus") {
      hidePlusModal();
      setSayItProActive(email);
      return;
    }

    await goToStripeCheckout(email);
  } catch (error) {
    setDeviceMessage(
      `<strong>SayIt! Pro</strong><br>${escapeHtml(
        error instanceof Error ? error.message : "Unable to continue right now."
      )}`
    );
  } finally {
    continueBusy = false;
    if (plusContinueButton) {
      plusContinueButton.disabled = false;
    }
  }
}

function syncPlusStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("sayit_pro") || params.get("subscription") || params.get("signup");
  const email = String(params.get("email") || "").trim().toLowerCase();

  if (state === "active" || state === "success") {
    setSayItProActive(email);
  }
}

function updateVoicePreview(text = "", { fromVoice = false } = {}) {
  const nextText = String(text || "").trim();
  const showPreview = fromVoice && Boolean(nextText);
  voicePreview.textContent = showPreview ? "Voice draft captured. You can refine it before you generate." : "";
  voicePreview.classList.toggle("has-content", showPreview);
}

function setTeleprompterSummary(text = "") {
  teleprompterSummary.textContent = text || "";
}

function setVoiceStatus(text) {
  if (voiceStatusNode) {
    voiceStatusNode.textContent = text;
  }
}

function setCopyButtonLabel(label) {
  if (copyResultButton) {
    copyResultButton.textContent = label;
  }
  if (teleprompterCopyButton) {
    teleprompterCopyButton.textContent = label;
  }
}

function setResultText(text = "") {
  const nextText = String(text || "");
  if (resultField) {
    resultField.value = nextText;
  }
  if (charCount) {
    charCount.textContent = String(nextText.length);
  }
}

function syncTeleprompterControls() {
  const hasLines = teleprompter.hasLines();
  const canScroll = teleprompter.canScroll();
  const isRunning = teleprompter.isRunning();

  if (copyResultButton) {
    copyResultButton.disabled = !latestMessageText;
    copyResultButton.classList.toggle("is-active", Boolean(latestMessageText));
  }
  if (teleprompterCopyButton) {
    teleprompterCopyButton.disabled = !latestMessageText;
    teleprompterCopyButton.classList.toggle("is-active", Boolean(latestMessageText));
  }

  if (teleprompterPlaybackButton) {
    teleprompterPlaybackButton.disabled = !hasLines;
    teleprompterPlaybackButton.classList.toggle("is-active", isRunning);

    if (!hasLines) {
      teleprompterPlaybackButton.textContent = "Run";
    } else if (!canScroll) {
      teleprompterPlaybackButton.textContent = "Read";
    } else {
      teleprompterPlaybackButton.textContent = isRunning ? "Pause" : "Run";
    }
  }

  if (teleprompterSpeedToggleButton) {
    const label = teleprompter.speed.charAt(0).toUpperCase() + teleprompter.speed.slice(1);
    teleprompterSpeedToggleButton.textContent = `Speed: ${label}`;
    teleprompterSpeedToggleButton.disabled = !hasLines;
  }
}

function setSpeedMenuOpen(open) {
  if (!teleprompterSpeedToggleButton || !teleprompterSpeedGroup) {
    return;
  }

  const isOpen = Boolean(open);
  teleprompterSpeedGroup.hidden = !isOpen;
  teleprompterSpeedToggleButton.setAttribute("aria-expanded", String(isOpen));
  teleprompterSpeedToggleButton.classList.toggle("is-active", isOpen);
}

function syncTeleprompterReadiness() {
  if (!openTeleprompterButton) {
    return;
  }

  const ready = Boolean(latestMessageText);
  openTeleprompterButton.hidden = !ready;
  openTeleprompterButton.disabled = !ready;
  openTeleprompterButton.textContent = "Teleprompter";
  syncTeleprompterControls();
}

function openTeleprompter({ autoStart = true } = {}) {
  if (!latestMessageText) {
    return;
  }

  teleprompterOverlay.hidden = false;
  teleprompterOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("teleprompter-open");

  const afterLayout = () => {
    teleprompter.reset();
    syncTeleprompterControls();
    if (autoStart && teleprompter.start()) {
      setTeleprompterSummary("Teleprompter is live. You can pause or change speed any time.");
      syncTeleprompterControls();
      return;
    }

    if (teleprompter.hasLines()) {
      setTeleprompterSummary("Your message is ready. Tap Run when you want it to start scrolling.");
    }
    syncTeleprompterControls();
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(afterLayout);
  });
}

function closeTeleprompter() {
  teleprompter.pause();
  setSpeedMenuOpen(false);
  teleprompterOverlay.hidden = true;
  teleprompterOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("teleprompter-open");
  syncTeleprompterControls();
}

function collectData() {
  const transcript = fields.message.value.trim();
  const situation = fields.situation.value.trim();
  const afterState = fields.afterState.value;

  return {
    recipient: fields.recipient.value.trim(),
    relationship: fields.relationship.value,
    situation,
    message: transcript || situation,
    intent: fields.intent.value,
    outcome: "",
    afterState
  };
}

function clearOutputs() {
  closeTeleprompter();
  latestMessageText = "";
  setResultText("");
  setCopyButtonLabel("Copy");
  setTeleprompterSummary("");
  teleprompter.setLines([]);
  syncTeleprompterReadiness();
}

function updateOutputs(translation, meta = {}) {
  latestMessageText = translation?.primary || "";
  setResultText(latestMessageText);
  setCopyButtonLabel("Copy");

  if (meta.mode === "openai") {
    setTeleprompterSummary();
    setVoiceStatus("");
  } else if (meta.source === "local" || meta.mode === "rule-based") {
    setTeleprompterSummary("");
    setVoiceStatus("");
  } else {
    setTeleprompterSummary();
  }

  teleprompter.setLines(translation?.teleprompterLines || []);
  syncTeleprompterReadiness();
}

function setGeneratingState(isGenerating) {
  submitButton.disabled = isGenerating;
  submitButton.textContent = isGenerating ? "Working..." : "Generate";
}

async function generateTranslation({ openTeleprompterOnComplete = false } = {}) {
  if (speechController?.isListening?.()) {
    await speechController.stop();
  }

  const payload = collectData();

  if (!payload.message) {
    clearOutputs();
    return null;
  }

  setGeneratingState(true);

  try {
    const result = await requestTranslation(payload);
    updateOutputs(result.translation, result.meta);
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

    updateVoicePreview("");
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

async function copyLatestMessage() {
  if (!latestMessageText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latestMessageText);
    setCopyButtonLabel("Copied");
    window.setTimeout(() => {
      setCopyButtonLabel("Copy");
    }, 1200);
  } catch {
    setCopyButtonLabel("Copy failed");
  }
}

clearOutputs();
syncPlusStateFromUrl();
refreshPlusUi();
refreshRuntimeModeUi();
syncPlusFromServer();
enforceAccessGate();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistDraft();
  await generateTranslation({ openTeleprompterOnComplete: false });
});

form.addEventListener("input", () => {
  persistDraft();
});

form.addEventListener("change", () => {
  persistDraft();
});

document.querySelector("#reset-form").addEventListener("click", resetForm);
closeTeleprompterButton.addEventListener("click", closeTeleprompter);
openTeleprompterButton?.addEventListener("click", () => {
  openTeleprompter({ autoStart: false });
});
plusCancelButton?.addEventListener("click", () => {
  hidePlusModal();
});
plusContinueButton?.addEventListener("click", () => {
  handlePlusContinue();
});

teleprompterOverlay.addEventListener("click", (event) => {
  if (event.target === teleprompterOverlay) {
    closeTeleprompter();
  }
});

plusModal?.addEventListener("click", (event) => {
  if (event.target === plusModal || (plusModalCard && !plusModalCard.contains(event.target))) {
    hidePlusModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (plusModal && !plusModal.hidden) {
    if (event.key === "Escape") {
      hidePlusModal();
      return;
    }

    if (event.key === "Enter" && event.target === plusEmailInput) {
      event.preventDefault();
      handlePlusContinue();
      return;
    }
  }

  if (event.key === "Escape" && !teleprompterOverlay.hidden) {
    closeTeleprompter();
  }
});

copyResultButton?.addEventListener("click", () => {
  void copyLatestMessage();
});

teleprompterCopyButton?.addEventListener("click", () => {
  void copyLatestMessage();
});

const speechController = createSpeechController({
  textarea: fields.message,
  statusNode: document.querySelector("#voice-status"),
  startButton: document.querySelector("#voice-start"),
  stopButton: null,
  onTranscript(nextValue) {
    updateVoicePreview(nextValue, { fromVoice: true });
    persistDraft();
  }
});

document.querySelector("#voice-start").addEventListener("click", () => {
  void speechController?.start();
});

teleprompterSpeedToggleButton?.addEventListener("click", () => {
  if (teleprompterSpeedToggleButton.disabled) {
    return;
  }

  const nextOpen = teleprompterSpeedGroup?.hidden !== false;
  setSpeedMenuOpen(nextOpen);
});

teleprompterSpeedGroup?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-speed]");
  if (!button) {
    return;
  }

  document.querySelectorAll(".speed-button").forEach((node) => {
    node.classList.toggle("is-active", node === button);
  });
  teleprompter.setSpeed(button.dataset.speed);
  setSpeedMenuOpen(false);
});

teleprompterPlaybackButton?.addEventListener("click", () => {
  if (teleprompter.isRunning()) {
    teleprompter.pause();
    setTeleprompterSummary("Teleprompter paused. Tap Run when you want to keep going.");
    syncTeleprompterControls();
    return;
  }

  if (!teleprompter.start()) {
    setTeleprompterSummary("Generate a message first to load teleprompter mode.");
    syncTeleprompterControls();
    return;
  }
  setTeleprompterSummary("Teleprompter is live. You can pause or change speed any time.");
  syncTeleprompterControls();
});

document.addEventListener("click", (event) => {
  if (!teleprompterSpeedGroup || teleprompterSpeedGroup.hidden) {
    return;
  }

  const insideSpeedControl = event.target.closest(".teleprompter-speed-control");
  if (!insideSpeedControl) {
    setSpeedMenuOpen(false);
  }
});

if (!hydrateDraft()) {
  resetForm();
}

syncTeleprompterControls();

window.addEventListener("pageshow", refreshRuntimeModeUi);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshRuntimeModeUi();
  }
});
