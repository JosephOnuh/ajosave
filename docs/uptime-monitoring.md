# Uptime Monitoring

Ajosave uses **UptimeRobot** (free tier) for uptime monitoring and the public status page.

## Status Page

🟢 **https://stats.uptimerobot.com/ajosave** *(update with your real public URL after setup)*

## Monitors

| Monitor Name | URL | Type | Interval |
|---|---|---|---|
| Ajosave App | `https://ajosave.app/` | HTTP(S) | 1 minute |
| Ajosave API Health | `https://ajosave.app/api/health` | HTTP(S) | 1 minute |

Both monitors expect HTTP `200` response.

## Setup Steps

### 1. Create UptimeRobot account
Sign up at https://uptimerobot.com (free tier supports 50 monitors, 1-minute checks, and a public status page).

### 2. Add monitors

For each row in the table above:
1. Click **+ Add New Monitor**
2. **Monitor Type:** HTTP(S)
3. **Friendly Name:** as shown above
4. **URL:** as shown above
5. **Monitoring Interval:** 1 minute
6. Click **Create Monitor**

### 3. Set up alerts

1. Go to **My Settings → Alert Contacts**
2. Add your **email** address (verified automatically)
3. To add **Slack**: choose *Slack* type, paste your Slack incoming webhook URL
4. On each monitor → **Edit** → check both alert contacts under *Alert When Down*

### 4. Create public status page

1. Go to **Status Pages → Create Status Page**
2. Add both monitors to the page
3. Enable **30-day uptime history**
4. Set a friendly URL slug (e.g., `ajosave`)
5. Publish and copy the URL (e.g., `https://stats.uptimerobot.com/ajosave`)
6. Update the `README.md` badge and Status section with the real URL

## Environment / Secrets

No secrets are stored in the repo. UptimeRobot is configured entirely in their dashboard.

If you need to automate monitor creation via the UptimeRobot API:

```bash
# Create a monitor (replace YOUR_API_KEY and URL)
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -d "api_key=YOUR_API_KEY" \
  -d "friendly_name=Ajosave+API+Health" \
  -d "url=https://ajosave.app/api/health" \
  -d "type=1" \
  -d "interval=60"
```

Store `UPTIMEROBOT_API_KEY` in your CI secrets if you automate this.
