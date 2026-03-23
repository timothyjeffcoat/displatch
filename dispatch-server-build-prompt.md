# Dispatch Server — Claude Code Build Prompt

## Project Overview

Build a lightweight multi-project dispatch dashboard server called **Dispatch**. It runs on a local Ubuntu machine accessible via Tailscale, lets multiple Claude Code sessions post status updates from any machine on the network, and displays a live dashboard in the browser showing the state of all active projects.

This is a solo developer tool — no auth required (Tailscale handles network access control).

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Database**: SQLite via `better-sqlite3` (single file, zero ops)
- **Frontend**: Vanilla HTML/CSS/JS — no build step, served as static files from `/public`
- **Process manager**: PM2 (for keeping it alive on the Ubuntu workstation)

---

## Directory Structure

```
dispatch/
├── server.js              # Express app entry point
├── db.js                  # SQLite setup and queries
├── package.json
├── .env                   # PORT (default 3131)
├── dispatch.db            # SQLite DB (auto-created)
├── public/
│   ├── index.html         # Dashboard UI
│   ├── style.css          # Styles
│   └── app.js             # Frontend JS (polling + updates)
└── scripts/
    ├── post-update.sh      # Curl helper script for Claude Code hooks
    └── end-of-session.sh  # Convenience script to run at session end
```

---

## Database Schema

### `projects` table
```sql
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,           -- e.g. "helios", "northstar", "boxcar"
  display_name TEXT,                   -- e.g. "Helios", "Northstar Nav"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `updates` table
```sql
CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  machine TEXT,                        -- e.g. "workstation", "laptop"
  status TEXT NOT NULL,                -- "me" | "claude" | "blocked" | "done"
  current_task TEXT,                   -- what is being worked on right now
  next_action TEXT,                    -- what needs to happen next
  note TEXT,                           -- any extra context / gotchas
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name)
);
```

The dashboard shows only the **most recent update per project**.

---

## API Endpoints

### POST /update
Post a status update from a Claude Code session.

**Request body (JSON):**
```json
{
  "project": "helios",
  "machine": "workstation",
  "status": "claude",
  "current_task": "Rewrote buyer association lookup query",
  "next_action": "Test with 801 number, check Twilio logs",
  "note": "Watch out for the double-text edge case on re-registration"
}
```

- `project` — required. Auto-creates the project row if it doesn't exist.
- `status` — required. Must be one of: `me`, `claude`, `blocked`, `done`
- All other fields optional but encouraged.

**Response:**
```json
{ "ok": true, "id": 42 }
```

### GET /projects
Returns all projects with their latest update.

**Response:**
```json
[
  {
    "name": "helios",
    "display_name": "Helios",
    "latest": {
      "machine": "workstation",
      "status": "claude",
      "current_task": "...",
      "next_action": "...",
      "note": "...",
      "posted_at": "2026-03-23T14:32:00Z"
    }
  }
]
```

### GET /projects/:name/history
Returns last 20 updates for a specific project, newest first.

### DELETE /projects/:name
Removes a project and all its updates.

### POST /projects/:name/display-name
Update the display name of a project.

**Request body:**
```json
{ "display_name": "Northstar Nav" }
```

---

## Frontend Dashboard (`public/index.html`)

### Visual Design

Dark industrial aesthetic. Think terminal meets ops dashboard.

- **Background**: near-black (`#0e0e10`)
- **Card surface**: dark gray (`#18181b`)
- **Accent colors by status**:
  - `me` → amber/yellow — it's your turn
  - `claude` → teal/green — Claude is working
  - `blocked` → red/coral — waiting on something external
  - `done` → gray — complete
- **Font**: `'JetBrains Mono', 'Fira Code', monospace` for the status badges and timestamps; clean sans-serif for headings
- **Status badge**: pill shape, colored background, white text — very prominent, top-right of each card

### Layout

Grid of project cards, responsive (2 cols on wide, 1 col on narrow). Each card shows:

```
┌─────────────────────────────────────┐
│ HELIOS                  [CLAUDE ●] │
│ ─────────────────────────────────── │
│ Doing: Rewrote buyer lookup query   │
│ Next:  Test with 801 number         │
│ Note:  Watch double-text edge case  │
│                                     │
│ workstation · 14 minutes ago        │
└─────────────────────────────────────┘
```

### Header

- Title: "DISPATCH" in large mono font
- Subtitle: "Project Status Board"
- Live clock (updates every second)
- "Last synced" timestamp
- Button: "+ Add Project" (opens a small inline form)

### Behavior

- **Auto-refresh every 30 seconds** via `setInterval` polling `GET /projects`
- **Visual pulse animation** on any card that was updated in the last 2 minutes
- **Click a card** to expand it and show the full update history for that project (calls `GET /projects/:name/history`)
- **Inline edit**: click the status badge on a card to manually change status (opens a small popover form for quick human-entered updates without needing curl)
- **Relative timestamps**: "2 minutes ago", "1 hour ago", etc. — recalculate on every refresh
- **Connection indicator** in the header: green dot if last poll succeeded, red if server unreachable

---

## Helper Scripts

### `scripts/post-update.sh`

```bash
#!/bin/bash
# Usage: ./scripts/post-update.sh <project> <status> <current_task> <next_action> [note]
# Statuses: me | claude | blocked | done

DISPATCH_URL="${DISPATCH_URL:-http://localhost:3131}"

PROJECT="$1"
STATUS="$2"
CURRENT="$3"
NEXT="$4"
NOTE="${5:-}"
MACHINE=$(hostname)

curl -s -X POST "$DISPATCH_URL/update" \
  -H "Content-Type: application/json" \
  -d "{
    \"project\": \"$PROJECT\",
    \"machine\": \"$MACHINE\",
    \"status\": \"$STATUS\",
    \"current_task\": \"$CURRENT\",
    \"next_action\": \"$NEXT\",
    \"note\": \"$NOTE\"
  }"

echo ""
echo "✓ Dispatch updated: $PROJECT → $STATUS"
```

### `scripts/end-of-session.sh`

Interactive script. Run it at the end of a Claude Code session:

```bash
#!/bin/bash
# Run at the end of a Claude Code session to log what happened

DISPATCH_URL="${DISPATCH_URL:-http://localhost:3131}"

echo "=== End of Session — Dispatch Update ==="
read -p "Project name: " PROJECT
echo "Status: (1) me  (2) claude  (3) blocked  (4) done"
read -p "Choice [1-4]: " STATUS_CHOICE
case $STATUS_CHOICE in
  1) STATUS="me" ;;
  2) STATUS="claude" ;;
  3) STATUS="blocked" ;;
  4) STATUS="done" ;;
  *) STATUS="me" ;;
esac
read -p "What was just done: " CURRENT
read -p "What's next: " NEXT
read -p "Any gotchas or notes (optional): " NOTE

./scripts/post-update.sh "$PROJECT" "$STATUS" "$CURRENT" "$NEXT" "$NOTE"
```

---

## Claude Code Hook Integration (optional, documented in README)

Add this to a project's `.claude/settings.json` to auto-post when Claude Code stops:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST ${DISPATCH_URL:-http://YOUR_TAILSCALE_IP:3131}/update -H 'Content-Type: application/json' -d '{\"project\":\"PROJECT_NAME\",\"machine\":\"'$(hostname)'\",\"status\":\"me\",\"current_task\":\"Claude session ended\",\"next_action\":\"Review and continue\"}'"
          }
        ]
      }
    ]
  }
}
```

---

## README sections to include

1. **Installation** — `npm install`, `node server.js`, then PM2 setup
2. **Tailscale access** — find your Tailscale IP with `tailscale ip -4`, set `DISPATCH_URL=http://<tailscale-ip>:3131` as an env var on both machines
3. **Quick update** — one-liner curl example
4. **Shell alias** — suggest adding `alias dispatch="~/dispatch/scripts/end-of-session.sh"` to `.bashrc`
5. **Claude Code hooks** — copy-paste hook config with placeholder replacement instructions
6. **PM2 setup** — `pm2 start server.js --name dispatch && pm2 save && pm2 startup`

---

## Non-Goals (keep it simple)

- No authentication (Tailscale handles this)
- No WebSockets (polling every 30s is fine for this use case)
- No Docker (runs directly on Ubuntu)
- No multi-user support
- No external database
- No build pipeline for frontend

---

## Implementation Notes

- Use `better-sqlite3` (synchronous, perfect for this low-concurrency use case — no async/await needed in DB layer)
- Auto-upsert project on `POST /update` — never require pre-registering a project
- All timestamps stored as UTC ISO strings, displayed as relative time in frontend
- Server should log every incoming update to stdout with timestamp and project name
- Include a `GET /health` endpoint that returns `{ ok: true, uptime: <seconds> }` for the connection indicator
