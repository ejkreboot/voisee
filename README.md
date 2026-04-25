# Voisee

A browser-based video calling tool designed for families to stay connected with elderly relatives. Family members call from any browser; the resident end runs as a kiosk (auto-answer, no interaction required).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Daily.co Setup](#dailyco-setup)
- [Deployment (Vercel)](#deployment-vercel)
- [API Reference](#api-reference)
- [Kiosk Device Setup](#kiosk-device-setup)

---

## Architecture Overview

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS SPA, static files in `./public` |
| API | Vercel serverless functions (Node.js), in `./api` |
| Auth | Supabase Auth (email/password or magic link) |
| Database | Supabase Postgres |
| Video | Daily.co WebRTC |
| Kiosk runtime | FullyKiosk or FreeKiosk (Android) |

Two actors exist with intentionally different auth flows:

- **Family members** — authenticated via Supabase session tokens
- **Kiosk devices** — registered once via a human-entered pairing code; subsequently authenticate using a stored device credential in `localStorage`

Daily.co meeting tokens are always minted server-side. The `DAILY_API_KEY` is never exposed to the client.

See [architecture.md](architecture.md) for the full auth and provisioning design.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- A [Supabase](https://supabase.com/) project
- A [Daily.co](https://www.daily.co/) account with at least one room created

---

## Environment Variables

These must be set both locally (in `.env` or Vercel dev environment) and in the Vercel project settings for production.

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only — never expose to client) |
| `DAILY_API_KEY` | Daily.co API key (server-side only) |
| `DAILY_DOMAIN` | Your Daily.co domain, e.g. `yourname.daily.co` |

For local development, create a `.env` file at the project root:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DAILY_API_KEY=...
DAILY_DOMAIN=yourname.daily.co
```

> **Security note:** Never commit `.env` to source control. Add it to `.gitignore`.

---

## Local Development

```bash
npm install
vercel dev
```

The Vercel CLI serves the static frontend from `./public` and the serverless functions from `./api` locally, matching the production routing defined in `vercel.json`.

The app is available at `http://localhost:3000` by default.

---

## Database Setup (Supabase)

Run the SQL in `supabase-setup.sql` against your Supabase project once, before first use:

1. Open the [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Paste the contents of `supabase-setup.sql` and run it

This creates:

- **`meeting_rooms`** — defines valid rooms, their passwords, and their corresponding Daily.co room names
- **`room_presence`** — live participant tracking (Realtime-enabled)
- Stored functions `add_participant` / `remove_participant` used by the Daily.co webhook

After running the SQL, add at least one room via the Table Editor or SQL:

```sql
insert into meeting_rooms (room_name, password, daily_room_name)
values ('home', 'your-password', 'your-daily-room-name');
```

---

## Daily.co Setup

1. Create a room in your [Daily.co dashboard](https://dashboard.daily.co/)
2. Note the room name and configure it in the `meeting_rooms` table (see above)
3. Configure a webhook in the Daily.co dashboard pointing to:
   ```
   https://your-vercel-deployment.vercel.app/api/daily-webhook
   ```
   Enable the `participant.joined` and `participant.left` events. This keeps `room_presence` in sync.

---

## Deployment (Vercel)

```bash
vercel --prod
```

On first run, the CLI will prompt you to link or create a Vercel project. After that, set all required environment variables in **Vercel Project Settings → Environment Variables**.

Routing is configured in `vercel.json`:
- `/api/*` → serverless functions in `./api`
- All other paths → static files in `./public`

---

## API Reference

All endpoints are Vercel serverless functions in `./api`.

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `GET /api/check-room` | GET | None | Validates a room name and returns its Daily.co room name. Query param: `roomName` |
| `POST /api/verify-room` | POST | None | Verifies a room name + password combination |
| `POST /api/sync-room` | POST | None | Syncs room presence state |
| `GET /api/realtime-config` | GET | None | Returns Supabase Realtime config for the client |
| `POST /api/switch-camera` | POST | None | Signals a camera switch for a participant |
| `POST /api/daily-webhook` | POST | Daily.co webhook | Handles `participant.joined` / `participant.left` events from Daily.co to update `room_presence` |

Protected endpoints (requiring Supabase user token or device credential) are described in [architecture.md](architecture.md).

---

## Kiosk Device Setup

Kiosk mode targets Android tablets running [FullyKiosk](https://www.fully-kiosk.com/) or [FreeKiosk](https://www.freekiosk.app/). The kiosk browser loads the app URL and persists the device credential in `localStorage`.

**First-time pairing:**

1. An authenticated family member generates a pairing code from the dashboard (`POST /api/generate-pairing-code`)
2. The code (e.g. `HAWK-4271`) is entered once into the kiosk app
3. The kiosk exchanges the code for a device credential (`POST /api/pair-device`), which is stored in `localStorage` under `voisee_device_credential`
4. On every subsequent load, the kiosk uses the stored credential automatically — no further setup needed

**Re-pairing:** If `localStorage` is cleared (factory reset, new device), the pairing screen is shown again. Generate a new code from the family member dashboard.

See [architecture.md](architecture.md) for the full token flow.
