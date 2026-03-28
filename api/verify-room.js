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

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DAILY_DOMAIN']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  const { roomName, password } = req.body || {};

  if (!roomName || !password) {
    return res.status(400).json({ error: 'roomName and password are required' });
  }

  const { data, error } = await supabase
    .from('meeting_rooms')
    .select('daily_room_name, password')
    .eq('room_name', roomName)
    .single();

  // Use a generic error to avoid leaking whether the room name exists
  if (error || !data || data.password !== password) {
    return res.status(401).json({ error: 'Invalid room or password' });
  }

  const domain = process.env.DAILY_DOMAIN;
  return res.status(200).json({
    roomUrl: `https://${domain}.daily.co/${data.daily_room_name}`,
  });
}
