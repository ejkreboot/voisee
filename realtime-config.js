export default function handler(req, res) {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
