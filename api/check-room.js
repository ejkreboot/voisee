import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DAILY_DOMAIN']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  const { roomName } = req.query;
  if (!roomName) {
    return res.status(400).json({ error: 'roomName query parameter required' });
  }

  // Verify room exists and get its Daily.co room name
  const { data: room, error: roomError } = await supabase
    .from('meeting_rooms')
    .select('daily_room_name')
    .eq('room_name', roomName)
    .single();

  if (roomError || !room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Get current presence for this room (may not exist yet; default to 0)
  const { data: presence } = await supabase
    .from('room_presence')
    .select('participants, initials')
    .eq('id', roomName)
    .single();

  const domain = process.env.DAILY_DOMAIN;
  return res.status(200).json({
    participants: presence?.participants ?? 0,
    initials: presence?.initials ?? [],
    roomUrl: `https://${domain}.daily.co/${room.daily_room_name}`,
  });
}
