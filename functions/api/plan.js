import { corsHeaders, json, options } from "../_lib/response.js";
import { allowSeatForDevice, getSeatLimit } from "../_lib/sayit-plan.js";
import { hasApprovedFreeEmail } from "../_lib/free-access.js";
import { hasActiveSubscriptionByEmail, hasStripeBillingConfig } from "../_lib/stripe.js";

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

  if (!email) {
    return json(
      {
        ok: true,
        plan: "free",
        status: "none",
        allowed: true
      },
      { headers: corsHeaders() }
    );
  }

  if (hasApprovedFreeEmail(env, FREE_ACCESS_ENV_KEY, email)) {
    const seatState = await allowSeatForDevice(env?.SAYIT_DB, email, deviceId);
    if (!seatState.allowed) {
      return json(
        {
          ok: false,
          plan: "plus",
          status: "free_access",
          allowed: false,
          reason: "DEVICE_LIMIT_REACHED",
          blockReason: "device_limit",
          message: seatState.message,
          seatsUsed: seatState.seatsUsed,
          seatsMax: seatState.seatsMax || getSeatLimit(),
          accessSource: "approved_email_pool"
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
        plan: "plus",
        status: "free_access",
        allowed: true,
        seatsUsed: seatState.seatsUsed,
        seatsMax: seatState.seatsMax || getSeatLimit(),
        accessSource: "approved_email_pool"
      },
      { headers: corsHeaders() }
    );
  }

  if (!hasStripeBillingConfig(env)) {
    return json(
      {
        ok: true,
        plan: "free",
        status: "billing_unavailable",
        allowed: true,
        billingConfigured: false
      },
      { headers: corsHeaders() }
    );
  }

  try {
    const plan = await hasActiveSubscriptionByEmail(env, email);
    if (!plan.active) {
      return json(
        {
          ok: true,
          plan: "free",
          status: plan.status || "none",
          allowed: true
        },
        { headers: corsHeaders() }
      );
    }

    const seatState = await allowSeatForDevice(env?.SAYIT_DB, email, deviceId);
    if (!seatState.allowed) {
      return json(
        {
          ok: false,
          plan: "plus",
          status: plan.status || "active",
          allowed: false,
          reason: "DEVICE_LIMIT_REACHED",
          blockReason: "device_limit",
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
        plan: "plus",
        status: plan.status || "active",
        allowed: true,
        seatsUsed: seatState.seatsUsed,
        seatsMax: seatState.seatsMax || getSeatLimit()
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to check plan."
      },
      {
        status: 500,
        headers: corsHeaders()
      }
    );
  }
}
