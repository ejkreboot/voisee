import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const domain   = process.env.DAILY_DOMAIN;
  const roomName = process.env.DAILY_ROOM_NAME;

  const missing = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','DAILY_DOMAIN','DAILY_ROOM_NAME']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('room_presence')
    .select('participants, initials')
    .eq('id', 'kiosk')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    participants: data.participants,
    initials: data.initials || [],
    roomUrl: `https://${domain}.daily.co/${roomName}`,
  });
}
