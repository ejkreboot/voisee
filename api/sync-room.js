import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const dailyApiKey = process.env.DAILY_API_KEY;

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DAILY_API_KEY']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  const { roomName } = req.query;
  if (!roomName) {
    return res.status(400).json({ error: 'roomName query parameter required' });
  }

  // Look up the Daily.co room name from meeting_rooms
  const { data: room, error: roomError } = await supabase
    .from('meeting_rooms')
    .select('daily_room_name')
    .eq('room_name', roomName)
    .single();

  if (roomError || !room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const dailyRoomName = room.daily_room_name;

  try {
    // Query Daily's presence API for live participants
    const dailyRes = await fetch('https://api.daily.co/v1/presence', {
      headers: { Authorization: `Bearer ${dailyApiKey}` },
    });

    if (!dailyRes.ok) {
      throw new Error(`Daily API responded ${dailyRes.status}: ${await dailyRes.text()}`);
    }

    const presence = await dailyRes.json();

    // Daily may use 'room' or 'room_name' depending on SDK version
    const roomParticipants = (presence.data || []).filter(
      p => (p.room || p.room_name) === dailyRoomName
    );

    const count    = roomParticipants.length;
    const initials = roomParticipants.map(p => ((p.user_name || '?').charAt(0).toUpperCase()));

    // Reconcile DB to match actual Daily room state (upsert so row is created if missing)
    const { error } = await supabase
      .from('room_presence')
      .upsert({ id: roomName, participants: count, initials, updated_at: new Date().toISOString() });

    if (error) throw new Error(`Supabase update failed: ${error.message}`);

    console.log(`sync-room: Daily reports ${count} participant(s) in "${dailyRoomName}":`, initials);
    return res.status(200).json({ participants: count, initials, synced: true });

  } catch (err) {
    console.error('sync-room error:', err);
    return res.status(500).json({ error: err.message });
  }
}
