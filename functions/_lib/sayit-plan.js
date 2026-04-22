const SEAT_LIMIT = 2;
const TRIAL_HOURS = 72;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function normalizeDeviceId(deviceId = "") {
  return String(deviceId || "").trim();
}

export function getSeatLimit() {
  return SEAT_LIMIT;
}

export function getTrialHours() {
  return TRIAL_HOURS;
}

function getTrialExpiryIso(startedAt = "") {
  const started = new Date(String(startedAt || ""));
  if (Number.isNaN(started.getTime())) {
    return "";
  }

  return new Date(started.getTime() + TRIAL_HOURS * 60 * 60 * 1000).toISOString();
}

function isTrialActive(startedAt = "", now = Date.now()) {
  const expiryIso = getTrialExpiryIso(startedAt);
  if (!expiryIso) {
    return false;
  }

  const expiresAt = new Date(expiryIso).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export async function ensureSeatTables(db) {
  if (!db) {
    return false;
  }

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS sayit_device_seats (email TEXT NOT NULL, device_id TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY (email, device_id))"
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_sayit_device_seats_email_created_at ON sayit_device_seats(email, created_at)"
    )
    .run();

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS sayit_trial_access (email TEXT NOT NULL PRIMARY KEY, device_id TEXT NOT NULL, started_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)"
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_sayit_trial_access_device_id ON sayit_trial_access(device_id)"
    )
    .run();

  return true;
}

export async function getTrialForEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!db || !normalizedEmail) {
    return null;
  }

  await ensureSeatTables(db);
  const result = await db
    .prepare(
      `SELECT email, device_id, started_at, last_seen_at
       FROM sayit_trial_access
       WHERE email = ?`
    )
    .bind(normalizedEmail)
    .first();

  return result || null;
}

export async function ensureTrialAccess(db, email, deviceId) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!db || !normalizedEmail || !normalizedDeviceId) {
    return {
      allowed: false,
      trialStarted: false,
      trialActive: false,
      trialHours: TRIAL_HOURS
    };
  }

  await ensureSeatTables(db);

  const existing = await getTrialForEmail(db, normalizedEmail);
  const timestamp = nowIso();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO sayit_trial_access (email, device_id, started_at, last_seen_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(normalizedEmail, normalizedDeviceId, timestamp, timestamp)
      .run();

    return {
      allowed: true,
      trialStarted: true,
      trialActive: true,
      startedAt: timestamp,
      expiresAt: getTrialExpiryIso(timestamp),
      trialHours: TRIAL_HOURS
    };
  }

  await db
    .prepare(
      `UPDATE sayit_trial_access
       SET device_id = ?, last_seen_at = ?
       WHERE email = ?`
    )
    .bind(normalizedDeviceId, timestamp, normalizedEmail)
    .run();

  const active = isTrialActive(existing.started_at);
  return {
    allowed: active,
    trialStarted: false,
    trialActive: active,
    startedAt: existing.started_at,
    expiresAt: getTrialExpiryIso(existing.started_at),
    trialHours: TRIAL_HOURS
  };
}

export async function getSeatsForEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!db || !normalizedEmail) {
    return [];
  }

  const result = await db
    .prepare(
      `SELECT email, device_id, created_at, last_seen_at
       FROM sayit_device_seats
       WHERE email = ?
       ORDER BY created_at ASC, last_seen_at ASC`
    )
    .bind(normalizedEmail)
    .all();

  return Array.isArray(result?.results) ? result.results : [];
}

export async function allowSeatForDevice(db, email, deviceId) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  if (!db || !normalizedEmail || !normalizedDeviceId) {
    return {
      allowed: true,
      seatsUsed: 0,
      seatsMax: SEAT_LIMIT
    };
  }

  await ensureSeatTables(db);
  const seats = await getSeatsForEmail(db, normalizedEmail);
  const existingSeat = seats.find((seat) => seat.device_id === normalizedDeviceId);
  const timestamp = nowIso();

  if (existingSeat) {
    await db
      .prepare(
        `UPDATE sayit_device_seats
         SET last_seen_at = ?
         WHERE email = ? AND device_id = ?`
      )
      .bind(timestamp, normalizedEmail, normalizedDeviceId)
      .run();

    return {
      allowed: true,
      seatsUsed: seats.length,
      seatsMax: SEAT_LIMIT
    };
  }

  if (seats.length >= SEAT_LIMIT) {
    return {
      allowed: false,
      seatsUsed: seats.length,
      seatsMax: SEAT_LIMIT,
      message: `You've already used SayIt! Pro on ${SEAT_LIMIT} devices.`
    };
  }

  await db
    .prepare(
      `INSERT INTO sayit_device_seats (email, device_id, created_at, last_seen_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(normalizedEmail, normalizedDeviceId, timestamp, timestamp)
    .run();

  return {
    allowed: true,
    seatsUsed: seats.length + 1,
    seatsMax: SEAT_LIMIT
  };
}

export async function removeOldestSeat(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!db || !normalizedEmail) {
    return {
      ok: false,
      message: "Seat storage is not configured."
    };
  }

  await ensureSeatTables(db);
  const seats = await getSeatsForEmail(db, normalizedEmail);
  const oldestSeat = seats[0];

  if (!oldestSeat) {
    return {
      ok: false,
      message: "No saved devices were found for that email."
    };
  }

  await db
    .prepare(
      `DELETE FROM sayit_device_seats
       WHERE email = ? AND device_id = ?`
    )
    .bind(normalizedEmail, oldestSeat.device_id)
    .run();

  return {
    ok: true,
    message: "Oldest device removed."
  };
}
