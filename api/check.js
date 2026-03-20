import { verifyToken, heartbeat, registerSession } from '../lib/auth.js';

// Check if current cookie is authenticated (used by sim page on load)
export default async function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/flightsim_token=([^;]+)/);
  if (!match) {
    return res.status(401).json({ ok: false });
  }

  const payload = await verifyToken(match[1]);
  if (!payload) {
    return res.status(401).json({ ok: false });
  }

  // Re-register session if needed
  let result = heartbeat(payload.sid);
  if (!result.ok) {
    result = registerSession(payload.sid, payload.sub);
  }

  return res.status(200).json({ ok: true, username: payload.sub, pilots: result.count });
}
