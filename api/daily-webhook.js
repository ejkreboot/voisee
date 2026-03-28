import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action    = req.body?.type ?? req.body?.action;
  const dailyRoom = req.body?.payload?.room;
  const userName  = req.body?.payload?.participant?.user_name || '';
  const initial   = userName.charAt(0).toUpperCase() || '?';

  console.log('Daily webhook received:', JSON.stringify({ action, dailyRoom, userName, initial }));

  const isJoin  = action === 'participant.joined';
  const isLeave = action === 'participant.left';

  if (!isJoin && !isLeave) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  if (!dailyRoom) {
    console.log('No room in webhook payload, ignoring');
    return res.status(200).json({ ok: true, ignored: true });
  }

  // Look up which meeting_room this Daily.co room belongs to
  const { data: meeting, error: meetingError } = await supabase
    .from('meeting_rooms')
    .select('room_name')
    .eq('daily_room_name', dailyRoom)
    .single();

  if (meetingError || !meeting) {
    console.log(`Daily room "${dailyRoom}" not found in meeting_rooms, ignoring`);
    return res.status(200).json({ ok: true, ignored: true });
  }

  const roomName = meeting.room_name;

  try {
    if (isJoin) {
      await supabase.rpc('add_participant', { p_room: roomName, p_initial: initial });
      console.log(`Added participant ${initial} to room "${roomName}"`);
    } else {
      await supabase.rpc('remove_participant', { p_room: roomName, p_initial: initial });
      console.log(`Removed participant ${initial} from room "${roomName}"`);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Supabase update failed:', err);
    return res.status(500).json({ error: 'Supabase update failed' });
  }
}