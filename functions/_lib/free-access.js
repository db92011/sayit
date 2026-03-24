function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function parseList(value = "") {
  return String(value || "")
    .split(/[\n,;]/)
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

export function getApprovedFreeEmails(env, envKey = "") {
  const key = String(envKey || "").trim();
  if (!key) return new Set();
  return new Set(parseList(env?.[key] || ""));
}

export function hasApprovedFreeEmail(env, envKey = "", email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return getApprovedFreeEmails(env, envKey).has(normalizedEmail);
}
