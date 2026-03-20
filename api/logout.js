import { verifyToken, removeSession } from '../lib/auth.js';

export default async function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/flightsim_token=([^;]+)/);

  if (match) {
    const payload = await verifyToken(match[1]);
    if (payload) removeSession(payload.sid);
  }

  res.setHeader('Set-Cookie', 'flightsim_token=; Path=/; Max-Age=0');
  return res.status(200).json({ ok: true });
}
