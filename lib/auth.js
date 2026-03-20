import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'flightsim-dev-secret-change-me');
const ALG = 'HS256';

export async function createToken(username) {
  return new SignJWT({ sub: username, sid: crypto.randomUUID() })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// ─── In-memory session store (works within a single serverless instance) ───
// For production with >5 users, upgrade to Vercel KV
const sessions = new Map(); // sid -> { username, lastHeartbeat }
const MAX_CONCURRENT = 5;
const SESSION_TTL = 90_000; // 90s without heartbeat = expired

function pruneExpired() {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now - s.lastHeartbeat > SESSION_TTL) {
      sessions.delete(sid);
    }
  }
}

export function registerSession(sid, username) {
  pruneExpired();
  // If this session already exists, just refresh it
  if (sessions.has(sid)) {
    sessions.get(sid).lastHeartbeat = Date.now();
    return { ok: true, count: sessions.size };
  }
  // Check concurrent limit
  if (sessions.size >= MAX_CONCURRENT) {
    return { ok: false, count: sessions.size, error: 'Server full — max 5 simultaneous pilots' };
  }
  sessions.set(sid, { username, lastHeartbeat: Date.now() });
  return { ok: true, count: sessions.size };
}

export function heartbeat(sid) {
  pruneExpired();
  if (sessions.has(sid)) {
    sessions.get(sid).lastHeartbeat = Date.now();
    return { ok: true, count: sessions.size };
  }
  return { ok: false, count: sessions.size, error: 'Session expired' };
}

export function removeSession(sid) {
  sessions.delete(sid);
  pruneExpired();
  return { ok: true, count: sessions.size };
}

export function getSessionCount() {
  pruneExpired();
  return sessions.size;
}
