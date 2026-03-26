import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROOM_NAME = process.env.DAILY_ROOM_NAME;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Respond 200 immediately — Daily requires a fast response on registration
  res.status(200).json({ ok: true });

  const action = req.body?.type ?? req.body?.action;
  const room   = req.body?.payload?.room;

  const isJoin  = action === 'participant.joined';
  const isLeave = action === 'participant.left';

  if (!isJoin && !isLeave) return;
  if (room !== ROOM_NAME) return;

  try {
    if (isJoin) {
      await supabase.rpc('increment_participants');
    } else {
      await supabase.rpc('decrement_participants');
    }
  } catch (err) {
    console.error('Supabase update failed:', err);
  }
}