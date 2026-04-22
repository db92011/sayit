import { corsHeaders, json, options } from "../_lib/response.js";
import { allowSeatForDevice, ensureTrialAccess, getSeatLimit, getTrialHours } from "../_lib/sayit-plan.js";
import { hasApprovedFreeEmail } from "../_lib/free-access.js";
import { hasActiveSubscriptionByEmail } from "../_lib/stripe.js";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeDeviceId(value = "") {
  return String(value || "").trim();
}

export function onRequestOptions() {
  return options();
}

const FREE_ACCESS_ENV_KEY = "SAYIT_FREE_ACCESS_EMAILS";

export async function onRequestPost({ request, env }) {
  let payload = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const email = normalizeEmail(payload?.email || request.headers.get("x-sayit-email"));
  const deviceId = normalizeDeviceId(payload?.device_id || request.headers.get("x-sayit-device"));

  if (!deviceId) {
    return json(
      {
        ok: false,
        allowed: false,
        error: "Missing device id."
      },
      {
        status: 400,
        headers: corsHeaders()
      }
    );
  }

  if (!email) {
    return json(
      {
        ok: true,
        allowed: false,
        access: "missing_email",
        message: "Enter your email to start your 3-day SayIt! trial."
      },
      { headers: corsHeaders() }
    );
  }

  try {
    if (hasApprovedFreeEmail(env, FREE_ACCESS_ENV_KEY, email)) {
      const seatState = await allowSeatForDevice(env?.SAYIT_DB, email, deviceId);
      if (!seatState.allowed) {
        return json(
          {
            ok: false,
            allowed: false,
            reason: "DEVICE_LIMIT_REACHED",
            blockReason: "device_limit",
            access: "approved_email_pool",
            message: seatState.message,
            seatsUsed: seatState.seatsUsed,
            seatsMax: seatState.seatsMax || getSeatLimit()
          },
          {
            status: 403,
            headers: corsHeaders()
          }
        );
      }

      return json(
        {
          ok: true,
          allowed: true,
          access: "approved_email_pool",
          status: "free_access",
          seatsUsed: seatState.seatsUsed,
          seatsMax: seatState.seatsMax || getSeatLimit()
        },
        { headers: corsHeaders() }
      );
    }

    const plan = await hasActiveSubscriptionByEmail(env, email);
    if (plan.active) {
      const seatState = await allowSeatForDevice(env?.SAYIT_DB, email, deviceId);
      if (!seatState.allowed) {
        return json(
          {
            ok: false,
            allowed: false,
            reason: "DEVICE_LIMIT_REACHED",
            blockReason: "device_limit",
            access: "subscription",
            message: seatState.message,
            seatsUsed: seatState.seatsUsed,
            seatsMax: seatState.seatsMax || getSeatLimit()
          },
          {
            status: 403,
            headers: corsHeaders()
          }
        );
      }

      return json(
        {
          ok: true,
          allowed: true,
          access: "subscription",
          status: plan.status || "active",
          seatsUsed: seatState.seatsUsed,
          seatsMax: seatState.seatsMax || getSeatLimit()
        },
        { headers: corsHeaders() }
      );
    }

    const trialState = await ensureTrialAccess(env?.SAYIT_DB, email, deviceId);
    if (!trialState.allowed) {
      return json(
        {
          ok: false,
          allowed: false,
          access: "expired",
          message: `Your ${getTrialHours()}-hour access has ended. Subscribe to keep using SayIt!.`,
          startedAt: trialState.startedAt || "",
          expiresAt: trialState.expiresAt || "",
          trialHours: getTrialHours()
        },
        {
          status: 402,
          headers: corsHeaders()
        }
      );
    }

    return json(
      {
        ok: true,
        allowed: true,
        access: "trial",
        trialStarted: trialState.trialStarted === true,
        startedAt: trialState.startedAt || "",
        expiresAt: trialState.expiresAt || "",
        trialHours: getTrialHours()
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    return json(
      {
        ok: false,
        allowed: false,
        error: error instanceof Error ? error.message : "Unable to check access."
      },
      {
        status: 500,
        headers: corsHeaders()
      }
    );
  }
}
