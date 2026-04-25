# Voisee — Auth & Device Provisioning Architecture

## Overview

Voisee has two distinct actors with different auth needs:

- **Family members** — authenticated humans using the web/mobile app to make calls
- **Kiosk devices** — registered devices running the web app in kiosk mode, associated with a resident

These are handled separately and intentionally asymmetrically.

---

## Stack

- **Frontend:** Vanilla JS SPA, static files served from `./public`
- **Backend:** Vercel serverless functions in `./api` (Node.js runtime)
- **Auth:** Supabase Auth (email/password or magic link)
- **Video:** Daily.co WebRTC
- **Kiosk runtime:** FullyKiosk or FreeKiosk on Android, browser `localStorage` for persistence

---

## User Auth (Family Members)

### Client-side

Initialize a Supabase singleton:

```js
// supabase.js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

On app load, check session to decide what to render:

```js
const { data: { session } } = await supabase.auth.getSession()
if (!session) renderLogin()
else renderApp()
```

Listen for auth state changes:

```js
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') renderApp()
  if (event === 'SIGNED_OUT') renderLogin()
})
```

Sign in:

```js
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
```

Supabase stores the session (access + refresh tokens) in `localStorage` automatically.

### Calling Protected API Endpoints

Always pass the session token in the Authorization header:

```js
const { data: { session } } = await supabase.auth.getSession()

const res = await fetch('/api/generate-pairing-code', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
})
```

### Verifying Auth in Serverless Functions

Every protected endpoint does this:

```js
export default async function handler(req, res) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // safe to proceed
}
```

The `SUPABASE_SERVICE_ROLE_KEY` lives only in Vercel environment variables — never in client code.

---

## Device Provisioning (Kiosk Registration)

### Concept

The kiosk is not a user — it is a **registered device** associated with a **resident record**. Auth is done once at setup time via a human-entered pairing code. After that, the device authenticates automatically using a stored credential.

### First-Time Setup Flow

```
Family member dashboard (authenticated)
  → POST /api/generate-pairing-code
  → Server creates a pairing code (e.g. HAWK-4271) in DB
    - Tied to resident ID
    - One-time use
    - Expires in 15 minutes
  → Displays code to family member

Family member types code into kiosk app (one time)
  → POST /api/pair-device  { code: "HAWK-4271" }
  → Server validates code (not expired, not used)
  → Server generates a device credential (UUID or signed token)
  → Server stores credential in DB, associated with resident
  → Server burns the pairing code
  → Returns device credential in response

Kiosk app stores credential in localStorage
  → key: 'voisee_device_credential'
  → persists across sessions indefinitely
```

On every subsequent load, the kiosk checks `localStorage` for the credential. If present, it skips the pairing screen entirely.

### Re-pairing Trigger

If `localStorage` is cleared (factory reset, new device, browser data wipe), the credential is missing and the pairing screen is shown again. Family member generates a new code from the dashboard.

---

## Daily.co Token Flow

Daily tokens are **never generated on the client**. They are minted server-side using your Daily API key, which lives only in Vercel environment variables.

### Kiosk requesting a Daily token

```js
// Kiosk app
const credential = localStorage.getItem('voisee_device_credential')

const res = await fetch('/api/get-kiosk-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceCredential: credential })
})

const { token, roomUrl } = await res.json()
// join Daily room with token
```

### Server minting the token

```js
// /api/get-kiosk-token.js
export default async function handler(req, res) {
  const { deviceCredential } = req.body

  // Look up device in DB, get associated resident and room
  const device = await db.devices.findByCredential(deviceCredential)
  if (!device) return res.status(401).json({ error: 'Unknown device' })

  // Mint a Daily token scoped to this room
  const response = await fetch(`https://api.daily.co/v1/meeting-tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        room_name: device.roomName,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        is_owner: false
      }
    })
  })

  const { token } = await response.json()
  res.json({ token, roomUrl: `https://your-domain.daily.co/${device.roomName}` })
}
```

### Caller (family member) requesting a Daily token

Same pattern but authenticated via Supabase session instead of device credential. Server verifies the user is authorized to call that resident's room before minting.

---

## API Endpoints Summary

| Endpoint | Auth method | Purpose |
|---|---|---|
| `POST /api/generate-pairing-code` | Supabase user token | Family member generates a code for their resident |
| `POST /api/pair-device` | Pairing code (one-time) | Kiosk exchanges code for device credential |
| `POST /api/get-kiosk-token` | Device credential | Kiosk gets a Daily token to receive calls |
| `POST /api/get-caller-token` | Supabase user token | Family member gets a Daily token to place a call |

---

## Security Properties

| Threat | Mitigation |
|---|---|
| Guessing a pairing code | Short expiry (15 min), one-time use, rate limiting |
| Stolen device credential | Revocable server-side; triggers re-pairing |
| Unauthorized caller joining room | Daily token only minted for authenticated, authorized users |
| Daily API key exposure | Lives only in Vercel env vars, never reaches client |
| Supabase service role key exposure | Same — server only |
| Kiosk localStorage access | Acceptable risk on a physically controlled, kiosk-mode device |

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | Client + Server | Supabase project URL |
| `SUPABASE_ANON_KEY` | Client | Safe for browser, RLS-restricted |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS — never expose to client |
| `DAILY_API_KEY` | Server only | Mints Daily meeting tokens |

---

## vercel.json

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

Note: The first rewrite is redundant (Vercel routes `/api/*` automatically) but harmless. Static files are served from `./public`.