export default async function handler(req, res) {
  const apiKey = process.env.DAILY_API_KEY;
  const roomName = process.env.DAILY_ROOM_NAME;

  if (!apiKey || !roomName) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const response = await fetch(
      `https://api.daily.co/v1/rooms/${roomName}/presence`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Daily API error' });
    }

    const data = await response.json();
    const participantCount = data.total_count ?? 0;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      participants: participantCount,
      roomUrl: `https://${process.env.DAILY_DOMAIN}.daily.co/${roomName}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
