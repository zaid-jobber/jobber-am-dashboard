# AM Hub — local proxy

Serves the Hub's live data. All sources are self-serve (no IT/admin):
- **Weather** → OpenWeather (direct).
- **Gmail + Calendar** → through **your Zapier account**, which is already connected to Google. Two ways — pick one.

The app falls back to deep-links / mock if nothing's configured, so it never breaks.

```bash
cd server
cp .env.example .env      # fill in keys
npm install
npm start                 # http://localhost:3001
```
Then `cd ../am-hub && pnpm dev`. Tiles show "· live" once data flows.

## OpenWeather
Sign up at <https://openweathermap.org/api> → API keys → `OPENWEATHER_KEY`.

## Gmail + Calendar — Option A: Zapier MCP (preferred)
On-demand, live, nothing stored.
1. Go to <https://mcp.zapier.com> → create an MCP server.
2. Add actions: **Gmail → Find Email** (or "Find Many Emails") and **Google Calendar → Find Events**.
3. Copy the **server URL** (it contains your key) → `ZAPIER_MCP_URL`.
4. Start the proxy, then open <http://localhost:3001/api/mcp/tools> to see the exact
   action *tool names* your server exposes. Put them in `ZAPIER_MCP_GMAIL_TOOL` and
   `ZAPIER_MCP_CALENDAR_TOOL`, and restart.
   *(Tell me the tool names + a sample of `/api/gmail/threads` output and I'll finalize the field mapping.)*

## Gmail + Calendar — Option B: Storage by Zapier (fallback)
If you'd rather use Zaps: add a **Storage by Zapier** step (reveals your secret → `ZAPIER_SECRET`), then:
- **Gmail Zap:** New Email Matching Search → Storage *Push Value Onto List*, key `gmail`, value `{{From Name}}:::{{Subject}}:::{{Body Plain}}`, max 6.
- **Calendar Zap:** Event Start → Storage *Push Value Onto List*, key `calendar`, value `{{Event Begins}}:::{{Event Name}}:::busy`, max 8.

## Live Slack (Zapier, same bridge)
Build one Zap per channel you want in the Hub:
- **Trigger:** Slack → *New Message Posted to Channel* (e.g. `#announce-expansion`, `#war_room`, `#sales-critical`, `#announce-product_updates`).
- **Action:** Storage by Zapier → *Push Value Onto List*
  - Key: `slack`
  - Value: `{{Channel Name}}:::{{Message Text}}:::{{User Name}}:::{{Timestamp}}`
  - Max list size: `6`
The Hub colours #war_room/#sales-critical automatically and shows the live posts.

## Endpoints
`/api/health` · `/api/mcp/tools` · `/api/gmail/threads` · `/api/calendar/today` · `/api/slack` · `/api/weather` · `/api/salesforce/accounts`
