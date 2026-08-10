#!/usr/bin/env bash
#
# Extracts the findings ledger from a review comment body, printing the JSON array on success and
# failing when there is no well-formed block. This is the PR's entire finding history, and it
# survives only by being copied from each published review into the next, so both ends run this same
# script: the publish step to refuse a review that carries no readable ledger, and the next run to
# read it back.
#
# A review routinely quotes the marker while discussing the ledger — that is how the first version
# of this lost a real ledger, opening the range at a sentence and closing it at the true block's
# `-->` 44 lines later. Hence: anchored at line start, and the LAST block wins, which the guidelines
# guarantee is the real one by requiring it to end the file.
#
# Usage: review-ledger.sh <review-file>   # prints the ledger array, or exits non-zero
#        review-ledger.sh --self-check

set -euo pipefail

extract() {
  awk '
    { line[NR] = $0 }
    /^<!-- claude-pr-review-ledger/ { start = NR }
    END {
      if (!start) exit 1
      for (i = start + 1; i <= NR; i++) {
        if (line[i] ~ /^-->/) break
        print line[i]
      }
    }
  ' "$1" | jq -e 'if type == "array" then . else error("not an array") end'
}

self_check() {
  local failures=0 dir
  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' RETURN

  check() {
    local name=$1 body=$2 expected=$3 got
    printf '%s\n' "$body" > "$dir/review.md"
    got=$(extract "$dir/review.md" 2>/dev/null | jq -c . 2>/dev/null) || got='<fail>'
    if [ "$got" = "$expected" ]; then
      echo "  ok    $name"
    else
      echo "  FAIL  $name"
      echo "        expected $expected"
      echo "        got      $got"
      failures=$((failures + 1))
    fi
  }

  local block='<!-- claude-pr-review-ledger
[{"id":"1.1"}]
-->'

  check 'plain block' "$(printf '## Review\n\n%s' "$block")" '[{"id":"1.1"}]'
  # The case that actually lost a ledger: the marker appears in prose above the real block.
  check 'marker quoted in prose' \
    "$(printf 'add %s to the publish step\n\n%s' "grep -q '<!-- claude-pr-review-ledger'" "$block")" \
    '[{"id":"1.1"}]'
  # The guidelines open a line with the marker inside a fenced example, so anchoring alone is not enough.
  check 'marker at line start in an example' \
    "$(printf '```\n<!-- claude-pr-review-ledger\n[{"id":"x"}]\n-->\n```\n\n%s' "$block")" \
    '[{"id":"1.1"}]'
  check 'no block at all' '## Review with no ledger' '<fail>'
  check 'marker mentioned but no block' \
    "$(printf 'we should grep for %s here' "'<!-- claude-pr-review-ledger'")" '<fail>'
  check 'block is not an array' "$(printf '<!-- claude-pr-review-ledger\n{"id":"1.1"}\n-->')" '<fail>'
  check 'block is not JSON' "$(printf '<!-- claude-pr-review-ledger\nnot json\n-->')" '<fail>'
  check 'empty ledger is valid' "$(printf '<!-- claude-pr-review-ledger\n[]\n-->')" '[]'

  if [ "$failures" -gt 0 ]; then
    echo "$failures case(s) failed"
    exit 1
  fi
  echo "all cases passed"
}

case "${1:-}" in
  --self-check) self_check ;;
  '')
    echo 'usage: review-ledger.sh <review-file> | --self-check' >&2
    exit 1
    ;;
  *) extract "$1" ;;
esac
