import { verifyToken, heartbeat, registerSession } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.headers.cookie || '';
  const match = cookie.match(/flightsim_token=([^;]+)/);
  if (!match) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const payload = await verifyToken(match[1]);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Try heartbeat first, if session expired try re-registering
  let result = heartbeat(payload.sid);
  if (!result.ok) {
    result = registerSession(payload.sid, payload.sub);
  }

  return res.status(result.ok ? 200 : 503).json(result);
}
