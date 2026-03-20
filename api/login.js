import { createToken, registerSession, verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  const validUser = process.env.AUTH_USERNAME || 'pilot';
  const validPass = process.env.AUTH_PASSWORD || 'flyby';

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = await createToken(username);
  const payload = await verifyToken(token);

  // Register session and check concurrent limit
  const result = registerSession(payload.sid, username);
  if (!result.ok) {
    return res.status(503).json({ error: result.error, count: result.count });
  }

  // Set HTTP-only cookie
  res.setHeader('Set-Cookie', `flightsim_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.VERCEL ? '; Secure' : ''}`);

  return res.status(200).json({ ok: true, username, pilots: result.count });
}
