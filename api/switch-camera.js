import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DAILY_API_KEY']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  const { roomName, password } = req.body || {};

  if (!roomName || !password) {
    return res.status(400).json({ error: 'roomName and password are required' });
  }

  // Verify password — generic error to avoid leaking whether the room name exists
  const { data, error } = await supabase
    .from('meeting_rooms')
    .select('daily_room_name, password')
    .eq('room_name', roomName)
    .single();

  if (error || !data || data.password !== password) {
    return res.status(401).json({ error: 'Invalid room or password' });
  }

  try {
    const dailyRes = await fetch(
      `https://api.daily.co/v1/rooms/${encodeURIComponent(data.daily_room_name)}/send-app-message`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { type: 'switch-camera' }, recipients: 'all' }),
      }
    );

    if (!dailyRes.ok) {
      const text = await dailyRes.text();
      throw new Error(`Daily API responded ${dailyRes.status}: ${text}`);
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('switch-camera error:', err);
    return res.status(500).json({ error: err.message });
  }
}
