#!/usr/bin/env bash
#
# Reports what a Claude agent step cost, and warns when it ran over its budget. Only ever reports —
# `max_turns` is what actually holds spend down — so callers run it with `continue-on-error: true`.
#
# Usage: price-agent-run.sh <execution-file> <budget-usd> <label>

set -euo pipefail

execution_file=${1:-}
budget_usd=${2:-}
label=${3:-Agent run}

if [ -z "$execution_file" ] || [ ! -f "$execution_file" ]; then
  echo "no execution log to price"
  exit 0
fi

# Slurped and walked recursively so this works whether the log is a JSON array or the
# newline-delimited stream, and regardless of how deeply usage is nested. Claude Code reports its
# own total only on a clean finish, so a run cut short by the turn cap or the timeout falls through
# to the per-token sum. Rates are Opus-tier: $5/M in, $25/M out, $6.25/M cache write, $0.50/M cache
# read.
usd=$(jq -s -r '
  ([.. | objects | select(has("total_cost_usd")) | .total_cost_usd] | last) //
  ([.. | objects | select(has("cache_read_input_tokens"))]
    | (map(.input_tokens // 0) | add // 0) * 5
    + (map(.output_tokens // 0) | add // 0) * 25
    + (map(.cache_creation_input_tokens // 0) | add // 0) * 6.25
    + (map(.cache_read_input_tokens // 0) | add // 0) * 0.5
    | . / 1000000) // 0
' "$execution_file")

line=$(printf '%s cost $%.2f of its $%.2f budget.' "$label" "$usd" "$budget_usd")
echo "$line" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

# Passed in rather than interpolated into the program text, and coerced with +0 so a value awk would
# otherwise treat as a string is still compared as a number.
if awk -v u="$usd" -v b="$budget_usd" 'BEGIN { exit !(u + 0 > b + 0) }'; then
  echo "::warning::$line Lower max_turns, or raise the budget if the cap is too tight."
fi
