const STRIPE_API_BASE = "https://api.stripe.com/v1";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function hasStripeBillingConfig(env) {
  const secretKeyPresent = Boolean(
    String(env?.STRIPE_SECRET_KEY || env?.Stripe_Secret_Key_SayIt || "").trim()
  );
  const priceIdPresent = Boolean(String(env?.SAYIT_STRIPE_PRICE_ID || "").trim());

  return secretKeyPresent && priceIdPresent;
}

function requireEnv(env, key) {
  const value = String(env?.[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireAnyEnv(env, keys) {
  for (const key of keys) {
    const value = String(env?.[key] || "").trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
}

function encodeForm(fields) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  return params;
}

async function stripeRequest(path, env, init = {}) {
  const config = getStripeConfig(env);
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.secretKey}`,
      ...(init.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Stripe request failed with status ${response.status}.`);
  }

  return body;
}

export function getStripeConfig(env) {
  return {
    secretKey: requireAnyEnv(env, ["STRIPE_SECRET_KEY", "Stripe_Secret_Key_SayIt"]),
    publishableKey: String(env?.STRIPE_PUBLISHABLE_KEY || "").trim(),
    priceId: requireEnv(env, "SAYIT_STRIPE_PRICE_ID"),
    directCheckoutUrl: String(env?.SAYIT_STRIPE_URL || "").trim(),
    appUrl: String(env?.SAYIT_APP_URL || "https://sayitapp.pages.dev").trim(),
    marketingUrl: String(env?.SAYIT_MARKETING_URL || "https://circlethepeople.com/sayit").trim()
  };
}

function subscriptionContainsSayItPrice(subscription, priceId) {
  const normalizedPriceId = String(priceId || "").trim();
  if (!normalizedPriceId) {
    return false;
  }

  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  return items.some((item) => String(item?.price?.id || "").trim() === normalizedPriceId);
}

export async function createHostedCheckoutSession(env, { email = "", source = "" } = {}) {
  const config = getStripeConfig(env);
  if (config.directCheckoutUrl) {
    return {
      checkoutUrl: config.directCheckoutUrl,
      checkoutSessionId: "direct_checkout_link"
    };
  }

  const successUrl = new URL(config.appUrl);
  successUrl.searchParams.set("sayit_pro", "success");
  if (email) {
    successUrl.searchParams.set("email", email);
  }

  const cancelUrl = new URL(config.appUrl);
  if (email) {
    cancelUrl.searchParams.set("email", email);
  }

  const form = encodeForm({
    mode: "subscription",
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    customer_email: email || undefined,
    "line_items[0][price]": config.priceId,
    "line_items[0][quantity]": 1,
    "metadata[product]": "sayit-pro",
    "metadata[source]": String(source || "sayit-app")
  });

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Stripe request failed with status ${response.status}.`);
  }

  if (!body?.url) {
    throw new Error("Stripe did not return a hosted checkout URL.");
  }

  return {
    checkoutUrl: body.url,
    checkoutSessionId: body.id
  };
}

export async function hasActiveSubscriptionByEmail(env, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { active: false, status: "none" };
  }

  const config = getStripeConfig(env);
  const customers = await stripeRequest(`/customers?email=${encodeURIComponent(normalizedEmail)}&limit=10`, env);
  const items = Array.isArray(customers?.data) ? customers.data : [];

  for (const customer of items) {
    const subscriptions = await stripeRequest(
      `/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`,
      env
    );
    const active = (Array.isArray(subscriptions?.data) ? subscriptions.data : []).find(
      (subscription) =>
        ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription?.status || "").trim()) &&
        subscriptionContainsSayItPrice(subscription, config.priceId)
    );

    if (active) {
      return {
        active: true,
        status: String(active.status || "active"),
        customerId: customer.id,
        subscriptionId: active.id
      };
    }
  }

  return { active: false, status: "none" };
}
