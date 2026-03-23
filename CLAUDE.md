# Dispatch

Lightweight multi-project status dashboard. Node.js + Express 5 + SQLite + vanilla frontend.

## Dispatch Updates

This project is tracked on the Dispatch board. You MUST post status updates automatically — do not wait for the user to ask.

**When to post:**
- At the START of a session after understanding what you'll work on (status: `claude`)
- After completing a significant task or milestone (status: `claude`)
- When you hit a blocker or need human input (status: `blocked` or `me`)
- At the END of a session or when you finish all work (status: `me` or `done`)

**How to post:**
```bash
curl -s -X POST http://YOUR_DISPATCH_IP:3131/update \
  -H "Content-Type: application/json" \
  -d "{\"project\":\"dispatch\",\"machine\":\"$(hostname)\",\"status\":\"STATUS\",\"current_task\":\"WHAT_YOU_DID_OR_ARE_DOING\",\"next_action\":\"WHAT_NEEDS_TO_HAPPEN_NEXT\",\"note\":\"ANY_GOTCHAS_OR_CONTEXT\"}"
```

**Rules:**
- `current_task` must describe the ACTUAL work, not generic text like "Claude session ended"
- `next_action` should be specific enough that someone picking this up knows exactly what to do
- `note` should capture gotchas, edge cases, or decisions made — things that would be lost otherwise
- Statuses: `claude` (AI working), `me` (needs human), `blocked` (waiting on external), `done` (complete)
