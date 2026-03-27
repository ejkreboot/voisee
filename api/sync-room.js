import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const roomName    = process.env.DAILY_ROOM_NAME;
  const dailyApiKey = process.env.DAILY_API_KEY;

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DAILY_ROOM_NAME', 'DAILY_API_KEY']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

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
      p => (p.room || p.room_name) === roomName
    );

    const count    = roomParticipants.length;
    const initials = roomParticipants.map(p => ((p.user_name || '?').charAt(0).toUpperCase()));

    // Reconcile DB to match actual Daily room state
    const { error } = await supabase
      .from('room_presence')
      .update({ participants: count, initials, updated_at: new Date().toISOString() })
      .eq('id', 'kiosk');

    if (error) throw new Error(`Supabase update failed: ${error.message}`);

    console.log(`sync-room: Daily reports ${count} participant(s) in "${roomName}":`, initials);
    return res.status(200).json({ participants: count, initials, synced: true });

  } catch (err) {
    console.error('sync-room error:', err);
    return res.status(500).json({ error: err.message });
  }
}
