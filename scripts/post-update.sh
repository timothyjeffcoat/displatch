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

# Use jq for safe JSON construction (no injection via special chars)
JSON=$(jq -n \
  --arg p "$PROJECT" \
  --arg s "$STATUS" \
  --arg m "$MACHINE" \
  --arg c "$CURRENT" \
  --arg n "$NEXT" \
  --arg note "$NOTE" \
  '{project:$p, status:$s, machine:$m, current_task:$c, next_action:$n, note:$note}')

curl -s -X POST "$DISPATCH_URL/update" \
  -H "Content-Type: application/json" \
  -d "$JSON"

echo ""
echo "Dispatch updated: $PROJECT → $STATUS"
