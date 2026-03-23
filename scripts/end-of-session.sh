#!/bin/bash
# Run at the end of a Claude Code session to log what happened

DISPATCH_URL="${DISPATCH_URL:-http://localhost:3131}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

"$SCRIPT_DIR/post-update.sh" "$PROJECT" "$STATUS" "$CURRENT" "$NEXT" "$NOTE"
