#!/bin/bash
#
# Dispatch Integration Setup
#
# Run this from any project directory to add Dispatch status updates to that project.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/timothyjeffcoat/dispatch/master/setup.sh | bash
#   OR
#   curl -fsSL https://raw.githubusercontent.com/timothyjeffcoat/dispatch/master/setup.sh | bash -s -- --url http://YOUR_DISPATCH_IP:3131 --project my-project
#

set -e

# Parse arguments
DISPATCH_URL=""
PROJECT_SLUG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --url) DISPATCH_URL="$2"; shift 2 ;;
    --project) PROJECT_SLUG="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Detect project slug from directory name if not provided
if [ -z "$PROJECT_SLUG" ]; then
  PROJECT_SLUG=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/-/g')
fi

# Validate project slug
if ! echo "$PROJECT_SLUG" | grep -qE '^[a-z0-9][a-z0-9._-]{0,99}$'; then
  echo "Error: Invalid project slug '$PROJECT_SLUG'. Must be alphanumeric with hyphens/dots."
  exit 1
fi

# Prompt for Dispatch URL if not provided
if [ -z "$DISPATCH_URL" ]; then
  read -p "Dispatch server URL (e.g. http://YOUR_IP:3131): " DISPATCH_URL
fi

# Strip trailing slash
DISPATCH_URL="${DISPATCH_URL%/}"

echo ""
echo "========================================"
echo "  Dispatch Integration Setup"
echo "========================================"
echo ""
echo "  Project:  $PROJECT_SLUG"
echo "  Server:   $DISPATCH_URL"
echo "  Dir:      $(pwd)"
echo ""

# Test connection
echo -n "Testing connection... "
if curl -sf "$DISPATCH_URL/health" > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  echo "  Could not reach $DISPATCH_URL/health"
  echo "  Make sure the Dispatch server is running and the URL is correct."
  exit 1
fi

# Build the CLAUDE.md dispatch block
DISPATCH_BLOCK="## Dispatch Updates

This project is tracked on the Dispatch board. You MUST post status updates automatically — do not wait for the user to ask.

**When to post:**
- At the START of a session after understanding what you'll work on (status: \`claude\`)
- After completing a significant task or milestone (status: \`claude\`)
- When you hit a blocker or need human input (status: \`blocked\` or \`me\`)
- At the END of a session or when you finish all work (status: \`me\` or \`done\`)

**How to post:**
\`\`\`bash
curl -s -X POST ${DISPATCH_URL}/update \\\\
  -H \"Content-Type: application/json\" \\\\
  -d \"{\\\\\"project\\\\\":\\\\\"${PROJECT_SLUG}\\\\\",\\\\\"machine\\\\\":\\\\\"\\\$(hostname)\\\\\",\\\\\"status\\\\\":\\\\\"STATUS\\\\\",\\\\\"current_task\\\\\":\\\\\"WHAT_YOU_DID_OR_ARE_DOING\\\\\",\\\\\"next_action\\\\\":\\\\\"WHAT_NEEDS_TO_HAPPEN_NEXT\\\\\",\\\\\"note\\\\\":\\\\\"ANY_GOTCHAS_OR_CONTEXT\\\\\"}\"
\`\`\`

**Rules:**
- \`current_task\` must describe the ACTUAL work, not generic text like \"Claude session ended\"
- \`next_action\` should be specific enough that someone picking this up knows exactly what to do
- \`note\` should capture gotchas, edge cases, or decisions made — things that would be lost otherwise
- Statuses: \`claude\` (AI working), \`me\` (needs human), \`blocked\` (waiting on external), \`done\` (complete)"

# Add to CLAUDE.md
if [ -f "CLAUDE.md" ]; then
  if grep -q "## Dispatch Updates" CLAUDE.md; then
    echo "Dispatch section already exists in CLAUDE.md — skipping."
  else
    echo "" >> CLAUDE.md
    echo "" >> CLAUDE.md
    echo "$DISPATCH_BLOCK" >> CLAUDE.md
    echo "Appended Dispatch section to existing CLAUDE.md"
  fi
else
  echo "# $(basename "$(pwd)")" > CLAUDE.md
  echo "" >> CLAUDE.md
  echo "$DISPATCH_BLOCK" >> CLAUDE.md
  echo "Created CLAUDE.md with Dispatch section"
fi

# Post initial update using jq for safe JSON
if command -v jq > /dev/null 2>&1; then
  JSON=$(jq -n \
    --arg p "$PROJECT_SLUG" \
    --arg m "$(hostname)" \
    '{project:$p, machine:$m, status:"me", current_task:"Dispatch integration set up", next_action:"Start working — Claude Code will now post updates automatically", note:""}')
  curl -s -X POST "$DISPATCH_URL/update" \
    -H "Content-Type: application/json" \
    -d "$JSON" > /dev/null
else
  curl -s -X POST "$DISPATCH_URL/update" \
    -H "Content-Type: application/json" \
    -d "{\"project\":\"$PROJECT_SLUG\",\"machine\":\"$(hostname)\",\"status\":\"me\",\"current_task\":\"Dispatch integration set up\",\"next_action\":\"Start working\",\"note\":\"\"}" > /dev/null
fi

echo "Posted initial status to Dispatch"
echo ""
echo "========================================"
echo "  Done! Next Claude Code session in"
echo "  this project will auto-post updates."
echo "========================================"
echo ""
