# AM Hub — how to run

An internal Expansion Account Manager dashboard (React + Vite front-end, small
Node/Express proxy). Runs locally today; built to deploy behind one internal URL.

## Quickest way to see it (one process)

Requires **Node 20+** and **pnpm** (`npm i -g pnpm`).

```bash
# 1. install deps
cd am-hub && pnpm install
cd ../server && pnpm install

# 2. build the front-end
cd ../am-hub && pnpm build

# 3. run the server (serves the app + API on one port)
cd ../server && node index.js
```

Then open **http://localhost:3001** — first run shows onboarding.

> Dev mode (hot reload) instead: `cd am-hub && pnpm dev` (port 5173) with the
> server running separately on 3001.

## Configuration (`server/.env`)

Live tiles read from this file; everything degrades gracefully (mock data /
templates) when a key is missing. See `server/.env.example` for the full list.
Already wired: OpenWeather, Slack tile (via Zapier), Slack-canvas promos hooks.
Pending: Salesforce Connected App creds (`SF_*`), OpenAI billing.

## Notes
- Each AM's setup (targets, time off, layout, journal) is saved server-side under
  `server/data/state/` and survives cache clears.
- "Reset & restart" (Settings → Layout & resets) wipes everything back to onboarding.
- Salesforce data is mock until the Connected App is provisioned — no code change
  needed once `SF_*` exist in `.env`.
