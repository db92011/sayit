import { createSpeechController } from "./speech.js";
import { TeleprompterController } from "./teleprompter.js";
import { requestTranslation } from "./translation-service.js";

const STORAGE_KEY = "sayit-draft-v5";
const SAYIT_PRO_ACTIVE_KEY = "sayit_pro_active";
const SAYIT_PRO_EMAIL_KEY = "sayit_pro_email";
const SAYIT_DEVICE_ID_KEY = "sayit_device_id";
const DEFAULT_AFTER_STATE = "Clear";

function safeTrim(value = "") {
  return String(value || "").trim();
}

function getDraftStorage() {
  try {
    if (window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {}

  return window.localStorage;
}

function stripTrailingSlashes(value = "") {
  return safeTrim(value).replace(/\/+$/, "");
}

function getConfiguredApiBase() {
  const globalBase = safeTrim(window.__SAYIT_API_BASE__);
  if (globalBase) return stripTrailingSlashes(globalBase);

  const meta = document.querySelector('meta[name="sayit-api-base"]');
  const metaBase = safeTrim(meta?.getAttribute("content"));
  if (metaBase) return stripTrailingSlashes(metaBase);

  return stripTrailingSlashes(window.location.origin || "");
}

const SAYIT_API_BASE = getConfiguredApiBase();
const SAYIT_PLAN_URL = `${SAYIT_API_BASE}/api/plan`;
const SAYIT_ACCESS_URL = `${SAYIT_API_BASE}/api/access`;
const SAYIT_REMOVE_OLDEST_URL = `${SAYIT_API_BASE}/api/devices/remove-oldest`;
const SAYIT_CHECKOUT_URL = `${SAYIT_API_BASE}/api/create-checkout-link`;
const draftStorage = getDraftStorage();

const form = document.querySelector("#intake-form");
const voicePreview = document.querySelector("#voice-preview");
const voiceStatusNode = document.querySelector("#voice-status");
const resultField = document.querySelector("#result");
const charCount = document.querySelector("#charCount");
const submitButton = document.querySelector("#translate-action");
const counterText = document.querySelector("#counterText");

const copyResultButton = document.querySelector("#copy-result");
const shareResultButton = document.querySelector("#share-result");
const saveProofButton = document.querySelector("#save-proof");
const includeAttributionInput = document.querySelector("#include-attribution");
const teleprompterCopyButton = document.querySelector("#copy-message");
const closeTeleprompterButton = document.querySelector("#close-teleprompter");
const openTeleprompterButton = document.querySelector("#open-teleprompter");
const teleprompterOverlay = document.querySelector("#teleprompter-overlay");
const teleprompterSummary = document.querySelector("#teleprompter-summary");
const teleprompterPlaybackButton = document.querySelector("#teleprompter-playback");
const teleprompterSpeedToggleButton = document.querySelector("#teleprompter-speed-toggle");
const teleprompterSpeedGroup = document.querySelector("#speed-group");

const plusModal = document.querySelector("#plusModal");
const plusModalCard = document.querySelector("#plusModal .modalCard");
const plusEmailInput = document.querySelector("#plusEmail");
const plusCancelButton = document.querySelector("#plusCancelBtn");
const plusContinueButton = document.querySelector("#plusContinueBtn");
const deviceLimitMessage = document.querySelector("#deviceLimitMsg");
const manageDevicesButton = document.querySelector("#manageDevicesLink");

const fields = {
  recipient: document.querySelector("#recipient"),
  relationship: document.querySelector("#relationship"),
  situation: document.querySelector("#situation"),
  message: document.querySelector("#message")
};

const afterStateInputs = Array.from(
  document.querySelectorAll('input[name="afterState"]')
);

let latestMessageText = "";
let latestProofInput = null;
let continueBusy = false;
let removeBusy = false;
let appLocked = false;
let serviceWorkerRefreshPending = false;
let teleprompterOpen = false;
let currentAccessState = null;

const teleprompter = new TeleprompterController({
  container: document.querySelector("#teleprompter"),
  script: document.querySelector("#teleprompter-script"),
  highlightToggle: document.querySelector("#highlight-toggle"),
  onStateChange: () => syncTeleprompterControls()
});

const speechController = createSpeechController({
  textarea: fields.message,
  statusNode: voiceStatusNode,
  startButton: document.querySelector("#voice-start"),
  stopButton: null,
  onTranscript(nextValue) {
    updateVoicePreview(nextValue, { fromVoice: true });
    persistDraft();
  }
});

function detectRuntimeMode() {
  const iosStandalone = window.navigator.standalone === true;
  const displayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayStandalone ? "standalone" : "browser";
}

function getSelectedAfterState() {
  const selected = afterStateInputs.find((input) => input.checked);
  return selected?.value || DEFAULT_AFTER_STATE;
}

function setSelectedAfterState(value = DEFAULT_AFTER_STATE) {
  const target = String(value || "").trim() || DEFAULT_AFTER_STATE;
  let matched = false;

  for (const input of afterStateInputs) {
    const isMatch = input.value === target;
    input.checked = isMatch;
    matched ||= isMatch;
  }

  if (!matched && afterStateInputs[0]) {
    afterStateInputs[0].checked = true;
  }
}

function refreshRuntimeModeUi() {
  const runtimeMode = detectRuntimeMode();
  const currentUrl = new URL(window.location.href);
  const installBanner = document.querySelector("[data-install-banner]");
  const browserInstallState =
    runtimeMode !== "standalone" && currentUrl.searchParams.get("source") === "pwa";

  document.documentElement.setAttribute(
    "data-standalone",
    runtimeMode === "standalone" ? "yes" : "no"
  );
  document.documentElement.setAttribute("data-native-app", "no");

  if (installBanner) {
    installBanner.hidden = !browserInstallState;
  }
}

function installServiceWorkerRefreshHandler() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "SAYIT_SW_ACTIVATED") return;
    if (serviceWorkerRefreshPending) return;

    serviceWorkerRefreshPending = true;

    if (teleprompterOpen) {
      closeTeleprompter();
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 80);
  });
}

function isLocalPreviewHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function setAppLocked(locked) {
  appLocked = Boolean(locked);
  document.body.classList.toggle("app-locked", appLocked);

  for (const field of Object.values(fields)) {
    if (field) field.disabled = appLocked;
  }

  if (submitButton) submitButton.disabled = appLocked;
  if (copyResultButton) copyResultButton.disabled = appLocked || !latestMessageText;
  if (openTeleprompterButton) openTeleprompterButton.disabled = appLocked || !latestMessageText;
}

function getOrCreateDeviceId() {
  const existing = String(localStorage.getItem(SAYIT_DEVICE_ID_KEY) || "").trim();
  if (existing) return existing;

  let nextId = "";
  try {
    if (window.crypto?.randomUUID) {
      nextId = `sayit_${window.crypto.randomUUID()}`;
    }
  } catch {}

  if (!nextId) {
    nextId = `sayit_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  localStorage.setItem(SAYIT_DEVICE_ID_KEY, nextId);
  return nextId;
}

function isSayItProActive() {
  return localStorage.getItem(SAYIT_PRO_ACTIVE_KEY) === "true";
}

function getSayItProEmail() {
  return String(localStorage.getItem(SAYIT_PRO_EMAIL_KEY) || "").trim().toLowerCase();
}

function setSayItProActive(email = "") {
  localStorage.setItem(SAYIT_PRO_ACTIVE_KEY, "true");
  if (email) localStorage.setItem(SAYIT_PRO_EMAIL_KEY, email);
  setAppLocked(false);
  refreshPlusUi();
}

function refreshPlusUi() {
  if (!counterText) return;
  if (isSayItProActive()) {
    counterText.textContent = "Registered";
    return;
  }

  if (currentAccessState?.access === "trial" && currentAccessState?.allowed) {
    const hours = Number(currentAccessState?.trialHours || 72);
    const expiresAt = String(currentAccessState?.expiresAt || "").trim();
    if (expiresAt) {
      const msLeft = new Date(expiresAt).getTime() - Date.now();
      const daysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      counterText.textContent = daysLeft > 1 ? `${daysLeft} days free` : "Free today";
      return;
    }
    counterText.textContent = `${Math.round(hours / 24)} days free`;
    return;
  }

  counterText.textContent = "";
}

function updatePlusModalCopy() {
  const titleNode = document.querySelector("#plusTitle");
  const subNode = plusModal?.querySelector(".modalSub");
  const continueLabel = plusContinueButton;

  if (!titleNode || !subNode || !continueLabel) return;

  if (currentAccessState?.access === "expired") {
    titleNode.textContent = "Your SayIt trial ended";
    subNode.textContent =
      "Use the same email to restore access or continue into SayIt Pro.";
    continueLabel.textContent = "Continue with email";
    return;
  }

  titleNode.textContent = "Start your free SayIt trial";
  subNode.textContent =
    "Use your email to start your 3-day trial now. That same email becomes your restore and login identity later.";
  continueLabel.textContent = "Start free trial";
}

function showPlusModal() {
  if (!plusModal) return;

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
  updatePlusModalCopy();

  window.setTimeout(() => {
    plusEmailInput?.focus();
  }, 30);
}

function hidePlusModal({ force = false } = {}) {
  if (!plusModal) return;
  if (!force && appLocked && !isSayItProActive()) return;

  plusModal.hidden = true;
  plusModal.setAttribute("hidden", "");
  plusModal.style.display = "none";
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function enforceAccessGate() {
  if (isLocalPreviewHost()) {
    setAppLocked(false);
    return;
  }

  const hasAccessIdentity = Boolean(getSayItProEmail());
  const accessAllowed = Boolean(currentAccessState?.allowed) || isSayItProActive();
  setAppLocked(!(hasAccessIdentity && accessAllowed));
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setDeviceMessage(html) {
  if (!deviceLimitMessage) return;
  deviceLimitMessage.innerHTML = html;
  deviceLimitMessage.style.display = "block";
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
    (body?.reason === "DEVICE_LIMIT_REACHED" ||
      body?.blockReason === "device_limit" ||
      body?.allowed === false)
  ) {
    return {
      plan: "plus",
      status: body?.status || "active",
      allowed: false,
      blocked: true,
      message: body?.message || "You've already used SayIt! Pro on 2 devices."
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

async function checkAccess(email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const deviceId = getOrCreateDeviceId();

  const response = await fetch(SAYIT_ACCESS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sayit-device": deviceId,
      ...(normalizedEmail ? { "x-sayit-email": normalizedEmail } : {})
    },
    body: JSON.stringify({
      email: normalizedEmail,
      device_id: deviceId
    })
  });

  const body = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    allowed: body?.allowed !== false,
    access: body?.access || "",
    status: body?.status || "",
    trialStarted: body?.trialStarted === true,
    startedAt: body?.startedAt || "",
    expiresAt: body?.expiresAt || "",
    trialHours: body?.trialHours || 0,
    message: body?.message || body?.error || "",
    body
  };
}

async function removeOldestDevice(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (removeBusy) {
    return { ok: false, message: "Please wait..." };
  }

  removeBusy = true;
  if (manageDevicesButton) manageDevicesButton.disabled = true;

  try {
    const deviceId = getOrCreateDeviceId();

    const response = await fetch(SAYIT_REMOVE_OLDEST_URL, {
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
    if (manageDevicesButton) manageDevicesButton.disabled = false;
  }
}

function showDeviceLimitUi(message, email) {
  const seatsLine = String(
    message || "You've hit the 2-device limit for this email."
  ).trim();

  setDeviceMessage(
    "<strong>Device limit reached</strong><br>" +
      escapeHtml(seatsLine) +
      "<br><br>To use SayIt! Pro on this device, remove your oldest device seat.<br>" +
      '<span style="opacity:.85;">This happens instantly here - no new screens.</span>'
  );

  if (!manageDevicesButton) return;

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
  const email = getSayItProEmail();

  if (!email) {
    currentAccessState = {
      ok: true,
      allowed: false,
      access: "missing_email",
      message: "Enter your email to start your 3-day SayIt! trial."
    };
    localStorage.removeItem(SAYIT_PRO_ACTIVE_KEY);
    refreshPlusUi();
    enforceAccessGate();
    if (!isLocalPreviewHost()) {
      showPlusModal();
      setDeviceMessage(
        "<strong>Start your 3-day trial</strong><br>Enter your email to begin. We’ll also use that same email as your restore login later."
      );
    }
    return;
  }

  try {
    const access = await checkAccess(email);
    currentAccessState = access;

    const subscribed =
      access.access === "subscription" ||
      access.access === "approved_email_pool" ||
      access.status === "active" ||
      access.status === "free_access";

    if (subscribed) {
      if (email) {
        setSayItProActive(email);
      } else {
        localStorage.setItem(SAYIT_PRO_ACTIVE_KEY, "true");
      }
      hidePlusModal();
      refreshPlusUi();
      return;
    }

    localStorage.removeItem(SAYIT_PRO_ACTIVE_KEY);

    if (access.allowed) {
      enforceAccessGate();
      hidePlusModal();
      refreshPlusUi();
      return;
    }

    refreshPlusUi();
    enforceAccessGate();
    if (!isLocalPreviewHost()) {
      showPlusModal();
      if (deviceLimitMessage) {
        if (access.access === "missing_email") {
          setDeviceMessage(
            "<strong>Start your 3-day trial</strong><br>Enter your email to begin. We’ll use that same address as your restore login later."
          );
        } else {
          const trialHours = Number(access?.trialHours || 72);
          setDeviceMessage(
            `<strong>Your free trial ended</strong><br>${escapeHtml(
              access.message || `Your ${trialHours}-hour access has ended.`
            )}<br><br>Use your email to restore a subscription or continue with Pro.`
          );
        }
      }
    }
  } catch {
    currentAccessState = null;
    setAppLocked(false);
    refreshPlusUi();
  }
}

function syncTrialStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const trial = params.get("trial");
  if (trial === "started") {
    refreshPlusUi();
  }
}

async function bootstrapAccess() {
  syncTrialStateFromUrl();
  await syncPlusFromServer();
}

async function handlePlusContinue() {
  const email = String(plusEmailInput?.value || "").trim().toLowerCase();

  if (email) localStorage.setItem(SAYIT_PRO_EMAIL_KEY, email);
  if (!email || continueBusy) return;

  continueBusy = true;
  if (plusContinueButton) plusContinueButton.disabled = true;

  try {
    resetDeviceLimitUi();

    const access = await checkAccess(email);
    currentAccessState = access;

    if (access.allowed) {
      if (
        access.access === "subscription" ||
        access.access === "approved_email_pool" ||
        access.status === "active" ||
        access.status === "free_access"
      ) {
        hidePlusModal();
        setSayItProActive(email);
        return;
      }

      localStorage.removeItem(SAYIT_PRO_ACTIVE_KEY);
      refreshPlusUi();
      enforceAccessGate();
      hidePlusModal();
      return;
    }

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
    if (plusContinueButton) plusContinueButton.disabled = false;
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
  voicePreview.textContent = showPreview
    ? "Voice draft captured. You can refine it here before you generate."
    : "";
  voicePreview.classList.toggle("has-content", showPreview);
}

function setTeleprompterSummary(text = "") {
  teleprompterSummary.textContent = text || "";
}

function setVoiceStatus(text = "") {
  if (voiceStatusNode) voiceStatusNode.textContent = text;
}

function setCopyButtonLabel(label) {
  if (copyResultButton) copyResultButton.textContent = label;
  if (teleprompterCopyButton) teleprompterCopyButton.textContent = label;
}

function getProductLedSessionId() {
  const key = "sayit_product_led_session";
  try {
    let existing = localStorage.getItem(key);
    if (existing) return existing;
    existing = window.crypto?.randomUUID?.() || `sayit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, existing);
    return existing;
  } catch {
    return `sayit_${Date.now()}`;
  }
}

function trackProductLedEvent(eventType, event = {}) {
  const payload = {
    session_id: getProductLedSessionId(),
    event_type: eventType,
    site_key: "circlethepeople",
    product_key: "sayit",
    page_slug: "sayit-app",
    event: {
      surface: "product_led_output",
      ...event
    }
  };

  try {
    fetch("https://help.circlethepeople.com/api/tracking/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: payload.session_id,
        site_key: payload.site_key,
        first_page_slug: payload.page_slug,
        referrer: document.referrer || null
      }),
      keepalive: true
    }).catch(() => {});

    fetch("https://help.circlethepeople.com/api/tracking/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

function captureProductLedProof(proof) {
  try {
    fetch("https://help.circlethepeople.com/api/product-led/proof", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_slug: "sayit",
        source: "sayit_app",
        surface: "product_led_output",
        before_text: proof.before,
        after_text: proof.after,
        attribution_enabled: proof.attribution,
        context: {
          relationship: proof.relationship || null,
          after_state: proof.afterState || null,
          surface: "sayit_app",
          attribution: proof.attribution
        }
      }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

function buildShareCard() {
  const before = safeTrim(latestProofInput?.message || latestProofInput?.situation || "");
  const after = safeTrim(latestMessageText);
  const lines = [
    "Before:",
    before,
    "",
    "After:",
    after
  ];

  if (includeAttributionInput?.checked) {
    lines.push("", "Made easier with SayIt: https://circlethepeople.com/sayit");
  }

  return lines.join("\n");
}

function saveProofDraft() {
  if (!latestMessageText || !latestProofInput) return null;
  const proof = {
    id: `sayit_proof_${Date.now()}`,
    product: "sayit",
    created_at: new Date().toISOString(),
    before: latestProofInput.message || latestProofInput.situation || "",
    after: latestMessageText,
    relationship: latestProofInput.relationship || "",
    afterState: latestProofInput.afterState || "",
    attribution: Boolean(includeAttributionInput?.checked)
  };

  try {
    const key = "sayit_proof_drafts";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(proof);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch {}

  return proof;
}

function setResultText(text = "") {
  const nextText = String(text || "");
  if (resultField) resultField.value = nextText;
  if (charCount) charCount.textContent = String(nextText.length);
}

function syncTeleprompterControls() {
  const hasLines = teleprompter.hasLines();
  const canScroll = teleprompter.canScroll();
  const isRunning = teleprompter.isRunning();

  if (copyResultButton) {
    copyResultButton.disabled = !latestMessageText;
    copyResultButton.classList.toggle("is-active", Boolean(latestMessageText));
  }

  if (shareResultButton) {
    shareResultButton.disabled = !latestMessageText;
    shareResultButton.classList.toggle("is-active", Boolean(latestMessageText));
  }

  if (saveProofButton) {
    saveProofButton.disabled = !latestMessageText;
    saveProofButton.classList.toggle("is-active", Boolean(latestMessageText));
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
  if (!teleprompterSpeedToggleButton || !teleprompterSpeedGroup) return;

  const isOpen = Boolean(open);
  teleprompterSpeedGroup.hidden = !isOpen;
  teleprompterSpeedToggleButton.setAttribute("aria-expanded", String(isOpen));
  teleprompterSpeedToggleButton.classList.toggle("is-active", isOpen);
}

function syncTeleprompterReadiness() {
  if (!openTeleprompterButton) return;

  const ready = Boolean(latestMessageText);
  openTeleprompterButton.hidden = !ready;
  openTeleprompterButton.disabled = !ready;
  openTeleprompterButton.textContent = "Teleprompter";

  syncTeleprompterControls();
}

function openTeleprompter({ autoStart = true } = {}) {
  if (!latestMessageText) return;

  teleprompterOpen = true;
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
  teleprompterOpen = false;
  setSpeedMenuOpen(false);
  teleprompterOverlay.hidden = true;
  teleprompterOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("teleprompter-open");
  syncTeleprompterControls();
}

function collectData() {
  const transcript = fields.message.value.trim();
  const situation = fields.situation.value.trim();

  return {
    recipient: fields.recipient.value.trim(),
    relationship: fields.relationship.value,
    situation,
    message: transcript || situation,
    intent: "auto",
    outcome: "",
    afterState: getSelectedAfterState()
  };
}

function clearOutputs() {
  closeTeleprompter();
  latestMessageText = "";
  latestProofInput = null;
  setResultText("");
  setCopyButtonLabel("Copy");
  setVoiceStatus("");
  setTeleprompterSummary("");
  teleprompter.setLines([]);
  syncTeleprompterReadiness();
}

function updateOutputs(translation, meta = {}) {
  latestMessageText =
    typeof translation === "string"
      ? translation
      : String(translation?.primary || "");

  setResultText(latestMessageText);
  latestProofInput = collectData();
  setCopyButtonLabel("Copy");
  setVoiceStatus("Your refined draft is ready below.");
  trackProductLedEvent("output_generated", {
    relationship: latestProofInput.relationship || null,
    after_state: latestProofInput.afterState || null,
    input_length: String(latestProofInput.message || "").length,
    output_length: latestMessageText.length,
    mode: meta.mode || meta.source || null
  });

  if (meta.mode === "openai") {
    setTeleprompterSummary("Ready to copy or open in teleprompter.");
  } else if (meta.source === "local" || meta.mode === "rule-based") {
    setTeleprompterSummary("Ready to copy or open in teleprompter.");
  } else {
    setTeleprompterSummary("Ready to copy or open in teleprompter.");
  }

  const teleprompterLines = Array.isArray(translation?.teleprompterLines)
    ? translation.teleprompterLines
    : latestMessageText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

  teleprompter.setLines(teleprompterLines);
  syncTeleprompterReadiness();
}

function setGeneratingState(isGenerating) {
  if (!submitButton) return;
  submitButton.disabled = isGenerating;
  submitButton.textContent = isGenerating ? "Refining..." : "Refine Draft";

  if (isGenerating) {
    setVoiceStatus("Working on it. Your refined draft will appear below.");
    setTeleprompterSummary("");
  }
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

    if (openTeleprompterOnComplete && latestMessageText) {
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
    message: fields.message.value.trim(),
    afterState: getSelectedAfterState()
  };

  draftStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateDraft() {
  const raw = draftStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const draft = JSON.parse(raw);

    for (const [key, field] of Object.entries(fields)) {
      if (field && typeof draft[key] === "string") {
        field.value = draft[key];
      }
    }

    if (typeof draft.afterState === "string") {
      setSelectedAfterState(draft.afterState);
    } else {
      setSelectedAfterState(DEFAULT_AFTER_STATE);
    }

    updateVoicePreview("");
    return true;
  } catch {
    return false;
  }
}

function resetForm() {
  speechController?.stop?.();
  form.reset();
  setSelectedAfterState(DEFAULT_AFTER_STATE);
  fields.message.value = "";
  updateVoicePreview("");
  clearOutputs();
  draftStorage.removeItem(STORAGE_KEY);
}

async function copyLatestMessage() {
  if (!latestMessageText) return;

  try {
    await navigator.clipboard.writeText(latestMessageText);
    setCopyButtonLabel("Copied");
    trackProductLedEvent("output_copied", {
      relationship: latestProofInput?.relationship || null,
      after_state: latestProofInput?.afterState || null
    });
    window.setTimeout(() => {
      setCopyButtonLabel("Copy");
    }, 1200);
  } catch {
    setCopyButtonLabel("Copy failed");
  }
}

async function shareLatestMessageCard() {
  if (!latestMessageText || !latestProofInput) {
    setTeleprompterSummary("Refine a draft first, then share the card.");
    return;
  }

  const text = buildShareCard();
  try {
    if (navigator.share) {
      await navigator.share({
        title: "SayIt before and after",
        text
      });
      setTeleprompterSummary("Shared.");
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setTeleprompterSummary("Share card copied.");
    } else {
      throw new Error("share-unavailable");
    }
    trackProductLedEvent("output_shared", {
      relationship: latestProofInput.relationship || null,
      after_state: latestProofInput.afterState || null,
      attribution: Boolean(includeAttributionInput?.checked)
    });
  } catch (error) {
    if (error?.name === "AbortError") return;
    setTeleprompterSummary("Could not share. Copy still works.");
  }
}

function saveLatestProofDraft() {
  const proof = saveProofDraft();
  if (!proof) {
    setTeleprompterSummary("Refine a draft first, then save the proof.");
    return;
  }

  setTeleprompterSummary("Proof saved on this device.");
  captureProductLedProof(proof);
  trackProductLedEvent("proof_saved", {
    relationship: proof.relationship || null,
    after_state: proof.afterState || null,
    attribution: proof.attribution
  });
}

clearOutputs();
syncPlusStateFromUrl();
refreshPlusUi();
refreshRuntimeModeUi();
installServiceWorkerRefreshHandler();
bootstrapAccess();

try {
  window.localStorage.removeItem("sayit-draft-v4");
} catch {}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistDraft();
  await generateTranslation({ openTeleprompterOnComplete: false });
});

form.addEventListener("input", persistDraft);
form.addEventListener("change", persistDraft);

fields.message?.addEventListener("input", async () => {
  if (!speechController?.isListening?.()) {
    return;
  }

  await speechController.stop();
  setVoiceStatus("Recording stopped because you edited the draft.");
});

document.querySelector("#reset-form")?.addEventListener("click", resetForm);
closeTeleprompterButton?.addEventListener("click", closeTeleprompter);

openTeleprompterButton?.addEventListener("click", () => {
  openTeleprompter({ autoStart: false });
});

plusCancelButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hidePlusModal({ force: true });
});
plusContinueButton?.addEventListener("click", handlePlusContinue);

teleprompterOverlay?.addEventListener("click", (event) => {
  if (event.target === teleprompterOverlay) {
    closeTeleprompter();
  }
});

plusModal?.addEventListener("click", (event) => {
  if (event.target === plusModal || (plusModalCard && !plusModalCard.contains(event.target))) {
    hidePlusModal({ force: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (plusModal && !plusModal.hidden) {
    if (event.key === "Escape") {
      hidePlusModal({ force: true });
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

shareResultButton?.addEventListener("click", () => {
  void shareLatestMessageCard();
});

saveProofButton?.addEventListener("click", saveLatestProofDraft);

teleprompterCopyButton?.addEventListener("click", () => {
  void copyLatestMessage();
});

document.querySelector("#voice-start")?.addEventListener("click", () => {
  void speechController?.start();
});

teleprompterSpeedToggleButton?.addEventListener("click", () => {
  if (teleprompterSpeedToggleButton.disabled) return;

  const nextOpen = teleprompterSpeedGroup?.hidden !== false;
  setSpeedMenuOpen(nextOpen);
});

teleprompterSpeedGroup?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-speed]");
  if (!button) return;

  document.querySelectorAll(".speed-button").forEach((node) => {
    node.classList.toggle("is-active", node === button);
  });

  teleprompter.setSpeed(button.dataset.speed);
  setSpeedMenuOpen(false);
});

teleprompterPlaybackButton?.addEventListener("click", () => {
  if (teleprompter.isRunning()) {
    teleprompter.pause();
    setTeleprompterSummary("Teleprompter paused. Tap Run when you're ready to continue.");
    syncTeleprompterControls();
    return;
  }

  if (!teleprompter.start()) {
    setTeleprompterSummary("Generate a draft first to open teleprompter.");
    syncTeleprompterControls();
    return;
  }

  setTeleprompterSummary("Teleprompter is ready. You can pause or change speed any time.");
  syncTeleprompterControls();
});

document.addEventListener("click", (event) => {
  if (!teleprompterSpeedGroup || teleprompterSpeedGroup.hidden) return;

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
