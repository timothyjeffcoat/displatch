# Dispatch

A lightweight multi-project status dashboard for tracking AI coding sessions across machines.

When you're running Claude Code (or any AI coding tool) across multiple projects and machines, you lose track of what's happening where. Dispatch gives you a single browser tab that shows the state of everything — what each session did, what's next, and any gotchas.

## How It Works

```
┌─────────────┐     curl POST /update     ┌──────────────┐     browser
│ Claude Code ├──────────────────────────►│              ├──────────────►  Dashboard
│ (laptop)    │                           │   Dispatch  │
└─────────────┘                           │   Server     │
┌─────────────┐     curl POST /update     │              │
│ Claude Code ├──────────────────────────►│  (SQLite)    │
│ (desktop)   │                           └──────────────┘
└─────────────┘
```

AI sessions post status updates automatically. You just open the dashboard and see:

- Which projects have active AI sessions
- What each session is working on right now
- What needs to happen next
- Any blockers or gotchas
- Which machine each session is running on

## Quick Start

### 1. Install & Run

```bash
git clone https://github.com/timothyjeffcoat/dispatch.git
cd dispatch
npm install
node server.js
```

Dashboard is now at **http://localhost:3131**

### 2. Keep It Alive with PM2

```bash
npm install -g pm2
pm2 start server.js --name dispatch
pm2 save
pm2 startup   # follow the printed command to enable on reboot
```

### 3. Access from Other Machines (Tailscale)

Install [Tailscale](https://tailscale.com/) on all your machines, then:

```bash
tailscale ip -4   # get your Tailscale IP, e.g. YOUR_TAILSCALE_IP
```

Dashboard is now at `http://<tailscale-ip>:3131` from any machine on your tailnet.

Set the URL as an env var on your other machines:

```bash
echo 'export DISPATCH_URL=http://<tailscale-ip>:3131' >> ~/.zshrc
source ~/.zshrc
```

> **Note:** On macOS with the App Store version of Tailscale, the CLI is at `/Applications/Tailscale.app/Contents/MacOS/Tailscale`. Add an alias: `alias tailscale="/Applications/Tailscale.app/Contents/MacOS/Tailscale"`

### 4. Add to Your Projects

Run the setup script from any project directory:

```bash
curl -fsSL https://raw.githubusercontent.com/timothyjeffcoat/dispatch/master/setup.sh | bash -s -- --url http://<tailscale-ip>:3131 --project my-project
```

This appends a Dispatch section to the project's `CLAUDE.md` (creating it if needed) without touching existing content. Every Claude Code session in that project will then post status updates automatically.

## Manual Updates

### Post from the command line

```bash
curl -s -X POST http://localhost:3131/update \
  -H "Content-Type: application/json" \
  -d '{
    "project": "my-project",
    "machine": "workstation",
    "status": "claude",
    "current_task": "Refactored auth middleware",
    "next_action": "Write tests for the new token flow",
    "note": "Old session tokens are incompatible"
  }'
```

### Post using the helper script

```bash
./scripts/post-update.sh my-project claude "Refactored auth" "Write tests" "Old tokens incompatible"
```

### Post from the dashboard

Click the status badge on any project card to open a quick update form.

## Statuses

| Status | Color | Meaning |
|--------|-------|---------|
| `me` | Amber | Human's turn — review, test, or continue |
| `claude` | Teal | AI is actively working |
| `blocked` | Red | Waiting on something external |
| `done` | Gray | Complete |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/update` | Post a status update (auto-creates project) |
| `GET` | `/projects` | All projects with latest update |
| `GET` | `/projects/:name/history` | Last 20 updates for a project |
| `DELETE` | `/projects/:name` | Remove a project and its history |
| `POST` | `/projects/:name/display-name` | Set a project's display name |
| `GET` | `/health` | Health check (`{ ok: true, uptime: N }`) |

### POST /update body

```json
{
  "project": "my-project",
  "machine": "workstation",
  "status": "claude",
  "current_task": "What was done or is being done",
  "next_action": "What needs to happen next",
  "note": "Gotchas or context"
}
```

`project` and `status` are required. Everything else is optional.

## Claude Code Hook (Optional)

Add a Stop hook as a fallback to catch sessions that exit without posting:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://<tailscale-ip>:3131/update -H 'Content-Type: application/json' -d '{\"project\":\"PROJECT_NAME\",\"machine\":\"'$(hostname)'\",\"status\":\"me\",\"current_task\":\"Claude session ended\",\"next_action\":\"Review and continue\"}'"
          }
        ]
      }
    ]
  }
}
```

The `CLAUDE.md` integration is better for accurate descriptions since Claude writes them with full session context. The hook is just a safety net.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **Database:** SQLite via better-sqlite3
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Process manager:** PM2

## Building Your Own Version

Want to build something similar with a different stack? See [PROMPT.md](PROMPT.md) for a generic, tool-agnostic starter prompt you can give to any AI coding assistant.

## License

MIT
