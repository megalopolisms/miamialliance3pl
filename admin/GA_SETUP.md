# Miami3PL GA4 API Setup — One-Time Configuration

## Status: PENDING ACTIVATION (2 steps required)

### Step 1: Enable APIs in Google Cloud Console

Click these two links (logged in as the Firebase project owner):

1. **Enable Google Analytics Data API:**
   https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl

2. **Enable Google Analytics Admin API:**
   https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=miamialliance3pl

Just click "ENABLE" on each page. Takes 5 seconds each.

### Step 2: Add Service Account to GA4

1. Go to https://analytics.google.com
2. Click **Admin** (gear icon, bottom left)
3. In the Property column, click **Property Access Management**
4. Click the **+** button → **Add users**
5. Enter this email:
   ```
   firebase-adminsdk-fbsvc@miamialliance3pl.iam.gserviceaccount.com
   ```
6. Set role to **Viewer**
7. Uncheck "Notify new users by email"
8. Click **Add**

### Step 3: Test

```bash
cd /Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin
python3 ga_client.py setup
```

### Alternative: Skip Admin API (Shortcut)

If you only want to enable the Data API (Step 1.1) and skip property discovery:

1. Go to GA4 → Admin → Property Settings
2. Copy the **Property ID** (a numeric number like `123456789`)
3. Run:
   ```bash
   echo 'YOUR_NUMERIC_PROPERTY_ID' > /Users/yuri/Dropbox/mcp-servers/MCP-51-miami3pl/project/admin/.ga_property_id
   ```
4. Then only the Data API needs to be enabled (Step 1.1)

---

## After Setup

Symbio can freely pull analytics data:

```bash
python3 ga_client.py today          # Today's visitors
python3 ga_client.py overview       # 30-day summary
python3 ga_client.py visitors 7     # Daily breakdown (7 days)
python3 ga_client.py realtime       # Who's on the site RIGHT NOW
python3 ga_client.py report         # Full report
```

Or via the `/ga` command in Claude Code.
