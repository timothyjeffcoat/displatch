# AI Session Status Dashboard — Starter Prompt

> Use this prompt with Claude Code (or any AI coding assistant) to build your own version of a multi-project status dashboard. Customize the sections marked with `[CUSTOMIZE]` to fit your setup.

---

## What You're Building

A lightweight status dashboard that lets multiple AI coding sessions (across different projects and machines) report what they're working on. You open one browser tab and see the state of everything at a glance.

**The core idea:** Each AI session posts a short status update (what it did, what's next, any gotchas) to a central server. A browser dashboard shows the latest update per project in a card layout with color-coded statuses.

**Why this exists:** When you're running AI coding sessions across multiple projects and machines, you lose track of what's happening where. This gives you a single pane of glass.

---

## Prompt

Copy everything below this line and give it to your AI coding assistant:

---

Build me a project status dashboard server with the following requirements:

### Core Concept

- A central server that receives status updates via REST API
- A browser-based dashboard that displays the latest status per project
- Designed for a single developer running multiple AI coding sessions

### Requirements

**Server:**
- REST API with these endpoints:
  - `POST /update` — receive a status update (project name, status, current task, next action, notes, machine name)
  - `GET /projects` — return all projects with their most recent update
  - `GET /projects/:name/history` — return the last 20 updates for a project
  - `DELETE /projects/:name` — remove a project and its history
  - `GET /health` — simple health check for the dashboard connection indicator
- Auto-create a project the first time an update is posted for it (no pre-registration)
- Log every incoming update to stdout

**Statuses:**
- `me` — it's the human's turn (amber/yellow)
- `claude` — the AI is actively working (teal/green) `[CUSTOMIZE: rename to match your AI tool]`
- `blocked` — waiting on something external (red)
- `done` — complete (gray)

**Dashboard (browser UI):**
- Dark theme, monospace aesthetic — think terminal meets ops dashboard
- Responsive grid of project cards (2 columns wide, 1 on mobile)
- Each card shows: project name, status badge (colored pill), current task, next action, notes, machine name, relative timestamp
- Auto-refresh every 30 seconds via polling
- Pulse animation on cards updated in the last 2 minutes
- Click a card to see its full update history in a slide-out panel
- Click a status badge to manually post a quick update from the browser
- Connection indicator (green/red dot) in the header
- Live clock in the header
- "+ Add Project" button for manual entry

**Data storage:**
- `[CUSTOMIZE]` Use whatever database fits your stack. The reference implementation uses SQLite for zero-ops simplicity, but Postgres, a JSON file, or even Redis would work fine. The data model is simple: a projects table and an updates table.

### Tech Stack

`[CUSTOMIZE]` Pick whatever you're comfortable with. The reference implementation uses:
- Node.js + Express for the server
- SQLite (via better-sqlite3) for storage
- Vanilla HTML/CSS/JS for the frontend (no build step)
- PM2 for process management

But you could just as easily use:
- Python + FastAPI + SQLite
- Go + embedded database + templates
- Deno + Fresh + KV store
- Whatever you prefer — the API contract is what matters

### Network Access

`[CUSTOMIZE]` The reference implementation uses Tailscale for secure access across machines without auth. Alternatives:
- Run on localhost only (single machine)
- Put it behind a reverse proxy with basic auth
- Use Cloudflare Tunnel
- Use any VPN/mesh network

The key requirement: AI sessions on any of your machines can `curl` the server to post updates.

### AI Session Integration

This is the most important part. Each project needs a way to tell the AI coding session to post updates to the dashboard. The reference implementation uses a `CLAUDE.md` file (Claude Code reads this automatically), but adapt to your tool:

**What the AI session needs to know:**
1. The dashboard server URL
2. The project slug (identifier)
3. When to post updates (session start, task completion, blockers, session end)
4. The curl command format for posting

**Example instructions to include in your AI config file:**

```
Post status updates to the dashboard automatically:

When to post:
- At the START of a session after understanding what you'll work on (status: "claude")
- After completing a significant task (status: "claude")
- When you hit a blocker or need human input (status: "blocked" or "me")
- At the END of a session (status: "me" or "done")

How to post:
curl -s -X POST YOUR_SERVER_URL/update \
  -H "Content-Type: application/json" \
  -d '{"project":"PROJECT_SLUG","machine":"MACHINE_NAME","status":"STATUS","current_task":"WHAT_YOU_DID","next_action":"WHAT_IS_NEXT","note":"ANY_GOTCHAS"}'

Rules:
- current_task must describe the ACTUAL work done, not generic text
- next_action should be specific enough for someone to pick up where you left off
- note should capture gotchas, edge cases, or decisions that would otherwise be lost
```

### Helper Scripts (Optional)

- A shell script for quick CLI updates: `./update.sh <project> <status> <task> <next> [note]`
- An interactive end-of-session script that prompts for each field
- A setup script that adds the dashboard integration to any project directory

### Non-Goals

Keep it simple. Avoid:
- Authentication (use network-level access control instead)
- WebSockets (polling every 30s is fine for 1 user)
- Docker/containers (just run it directly)
- Build pipelines for the frontend
- Multi-user support

### What Success Looks Like

When you're done, you should be able to:
1. Start the server on one machine
2. Open the dashboard in a browser from any machine on your network
3. Start an AI coding session in any project
4. See that project appear on the dashboard with accurate, real-time status updates
5. Glance at the dashboard and know the state of every active project without context-switching

---

## Adapting This for Your Setup

| Decision | Options |
|---|---|
| **AI tool** | Claude Code (CLAUDE.md), Cursor (.cursorrules), Copilot, Aider, etc. |
| **Config file** | CLAUDE.md, .cursorrules, .aider.conf.yml, system prompt, etc. |
| **Server stack** | Node/Express, Python/FastAPI, Go, Deno, Ruby/Sinatra, etc. |
| **Database** | SQLite, PostgreSQL, JSON file, Redis, DynamoDB, etc. |
| **Network** | Tailscale, localhost, Cloudflare Tunnel, VPN, reverse proxy, etc. |
| **Process manager** | PM2, systemd, supervisord, screen/tmux, Docker, etc. |
| **Frontend** | Vanilla JS, React, Svelte, htmx, server-rendered templates, etc. |

The architecture is intentionally simple so you can swap any layer without affecting the others.
