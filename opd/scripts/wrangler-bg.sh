#!/usr/bin/env bash
# Run wrangler in background; poll log every POLL_SEC until DONE or MAX_WAIT_SEC.
# Avoids silent-hang: always prints progress timestamps.
set -euo pipefail
CMD=("$@")
LOG="${WRANGLER_BG_LOG:-/tmp/wrangler-bg.log}"
POLL_SEC="${WRANGLER_POLL_SEC:-10}"
MAX_WAIT_SEC="${WRANGLER_MAX_WAIT_SEC:-360}"

: > "$LOG"
echo "[$(date -u +%H:%M:%S)] starting: ${CMD[*]}"
"${CMD[@]}" >"$LOG" 2>&1 &
PID=$!
echo "[$(date -u +%H:%M:%S)] pid=$PID log=$LOG"

elapsed=0
last_size=0
while kill -0 "$PID" 2>/dev/null; do
  sleep "$POLL_SEC"
  elapsed=$((elapsed + POLL_SEC))
  size=$(wc -c <"$LOG" | tr -d ' ')
  if [[ "$size" -gt "$last_size" ]]; then
    echo "[$(date -u +%H:%M:%S)] +$((size - last_size)) bytes (total ${size}, ${elapsed}s)"
    tail -3 "$LOG" | sed 's/^/  /'
    last_size=$size
  else
    echo "[$(date -u +%H:%M:%S)] no output yet (${elapsed}s / ${MAX_WAIT_SEC}s max)"
  fi
  if [[ "$elapsed" -ge "$MAX_WAIT_SEC" ]]; then
    echo "[$(date -u +%H:%M:%S)] TIMEOUT — killing pid $PID"
    kill "$PID" 2>/dev/null || true
    exit 124
  fi
done
wait "$PID" || EC=$?
echo "[$(date -u +%H:%M:%S)] finished exit=${EC:-0}"
cat "$LOG"
exit "${EC:-0}"
