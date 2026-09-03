#!/usr/bin/env bash
#
# Prints the sha the newest bot review recorded, from a stream of issue-comment JSON objects on
# stdin — the same stream `gh api --paginate --jq '.[]'` produces. Empty stdout means no review
# exists. `?` means a review comment exists but its marker has no readable sha — callers that
# ask "has this been reviewed?" must treat that as yes, or a hand-edited marker would look like
# a first review and overwrite seq=1. A non-zero exit means the input was unreadable.
#
# Author-filtered: a marker is a label anyone can type.
#
# Usage: review-latest.sh              # ndjson comments on stdin
#        review-latest.sh --self-check

set -euo pipefail

extract() {
  jq -rs '
    [.[] | select(.user.login == "github-actions[bot]" and .user.type == "Bot"
                  and (.body | startswith("<!-- claude-pr-review-bot:v1")))]
    | sort_by((.body | capture("seq=(?<n>[0-9]+)").n | tonumber) // 0)
    | if length == 0 then ""
      else (last.body | try capture("sha=(?<s>[0-9a-fA-F]+)").s // "?")
      end
  '
}

self_check() {
  local failures=0

  comment() {
    jq -nc --arg login "$1" --arg type "$2" --arg body "$3" \
      '{user:{login:$login,type:$type},body:$body}'
  }

  check() {
    local name=$1 input=$2 expected=$3 got
    got=$(printf '%s\n' "$input" | extract) || {
      echo "  FAIL  $name (extract exited $?)"
      failures=$((failures + 1))
      return
    }
    if [ "$got" = "$expected" ]; then
      echo "  ok    $name"
    else
      echo "  FAIL  $name"
      echo "        expected ${expected:-<empty>}"
      echo "        got      ${got:-<empty>}"
      failures=$((failures + 1))
    fi
  }

  check 'no comments' '' ''
  check 'marker without sha=' \
    "$(comment 'github-actions[bot]' Bot '<!-- claude-pr-review-bot:v1 seq=1 -->')" \
    '?'
  check 'several seqs out of order' \
    "$(printf '%s\n%s\n%s\n' \
      "$(comment 'github-actions[bot]' Bot '<!-- claude-pr-review-bot:v1 seq=2 sha=bbbbbbb -->')" \
      "$(comment 'github-actions[bot]' Bot '<!-- claude-pr-review-bot:v1 seq=1 sha=aaaaaaa -->')" \
      "$(comment 'github-actions[bot]' Bot '<!-- claude-pr-review-bot:v1 seq=3 sha=ccccccc -->')" \
    )" \
    'ccccccc'
  check 'non-bot forgery is ignored' \
    "$(printf '%s\n%s\n' \
      "$(comment evil User '<!-- claude-pr-review-bot:v1 seq=9 sha=deadbeef -->')" \
      "$(comment 'github-actions[bot]' Bot '<!-- claude-pr-review-bot:v1 seq=1 sha=aaaaaaaa -->')" \
    )" \
    'aaaaaaaa'

  if printf 'not json\n' | extract >/dev/null 2>&1; then
    echo '  FAIL  malformed input should exit non-zero'
    failures=$((failures + 1))
  else
    echo '  ok    malformed input exits non-zero'
  fi

  if [ "$failures" -gt 0 ]; then
    echo "$failures case(s) failed"
    exit 1
  fi
  echo "all cases passed"
}

case "${1:-}" in
  --self-check) self_check ;;
  '') extract ;;
  *)
    echo 'usage: review-latest.sh | review-latest.sh --self-check' >&2
    exit 1
    ;;
esac
