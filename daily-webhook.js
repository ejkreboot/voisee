import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROOM_NAME = process.env.DAILY_ROOM_NAME;
const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is genuinely from Daily
  const signature = req.headers['x-daily-signature'];
  if (DAILY_WEBHOOK_SECRET && signature !== DAILY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { action, payload } = req.body;

  // Only care about our specific room
  if (payload?.room !== ROOM_NAME) {
    return res.status(200).json({ ignored: true });
  }

  const isJoin  = action === 'participant-joined';
  const isLeave = action === 'participant-left';

  if (!isJoin && !isLeave) {
    return res.status(200).json({ ignored: true });
  }

  try {
    if (isJoin) {
      // Increment — clamp at 0 just in case
      await supabase.rpc('increment_participants');
    } else {
      await supabase.rpc('decrement_participants');
    }

    return res.status(200).json({ ok: true, action });
  } catch (err) {
    console.error('Supabase update failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
