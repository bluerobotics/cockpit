#!/usr/bin/env bash
#
# Leftover `/review` count for a PR, shared by everyone who cannot push. Each PR starts with one.
# A maintainer's `/allow-extra-reviews` banks more, and each leftover `/review` spends one.
# The ledger is the bot comments this workflow already posts, same as a `/resolve`, so a run that
# dies after banking still leaves the spend on the thread.
#
# Author-filtered: a marker is a label anyone can type. The record bodies are written here so the
# workflow and the self-check post the same bytes.
#
# Usage: review-quota.sh remaining          # ndjson comments on stdin; prints a non-negative integer
#        review-quota.sh record grant <n>   # prints a grant marker (jq -n, so stdin is unused)
#        review-quota.sh record consume     # prints a consume marker
#        review-quota.sh --self-check

set -euo pipefail

INITIAL=1

print_record() {
  printf '<!-- claude-pr-review-quota:v1\n'
  case "${1-}" in
    grant)
      jq -nc --argjson n "${2:?}" '{op:"grant",n:$n}'
      ;;
    consume)
      printf '{"op":"consume"}\n'
      ;;
    *)
      echo 'usage: review-quota.sh record grant <n> | record consume' >&2
      exit 1
      ;;
  esac
  printf -- '-->\n'
}

remaining() {
  jq -rs --argjson initial "$INITIAL" '
    [.[] | select(.user.login == "github-actions[bot]" and .user.type == "Bot"
                  and (.body | startswith("<!-- claude-pr-review-quota:v1")))
     | (.body | capture("(?s)^<!-- claude-pr-review-quota:v1\n(?<j>.*?)\n-->") | .j | fromjson)? // empty]
    | ($initial
       + ([.[] | select(.op == "grant") | (.n | numbers)] | add // 0)
       - ([.[] | select(.op == "consume")] | length))
    | if . < 0 then 0 else . end
  '
}

self_check() {
  local failures=0

  comment() {
    jq -nc --arg login "$1" --arg type "$2" --arg body "$3" \
      '{user:{login:$login,type:$type},body:$body}'
  }

  record() {
    comment 'github-actions[bot]' Bot "$(print_record "$@")"
  }

  check() {
    local name=$1 input=$2 expected=$3 got
    got=$(printf '%s\n' "$input" | remaining) || {
      echo "  FAIL  $name (remaining exited $?)"
      failures=$((failures + 1))
      return
    }
    if [ "$got" = "$expected" ]; then
      echo "  ok    $name"
    else
      echo "  FAIL  $name"
      echo "        expected $expected"
      echo "        got      $got"
      failures=$((failures + 1))
    fi
  }

  check 'no comments is the initial leftover' '' 1
  check 'one spend' "$(record consume)" 0
  check 'spent then granted the default 3' \
    "$(printf '%s\n%s\n' "$(record consume)" "$(record grant 3)")" \
    3
  check 'grant smaller than the default' \
    "$(printf '%s\n%s\n' "$(record consume)" "$(record grant 1)")" \
    1
  check 'grant of 0 changes nothing' \
    "$(printf '%s\n%s\n' "$(record consume)" "$(record grant 0)")" \
    0
  check 'unused leftover plus a grant' "$(record grant 3)" 4
  check 'two spends without a grant floor at 0' \
    "$(printf '%s\n%s\n' "$(record consume)" "$(record consume)")" \
    0
  check 'non-bot forgery is ignored' \
    "$(printf '%s\n%s\n' \
      "$(comment evil User '<!-- claude-pr-review-quota:v1
{"op":"grant","n":99}
-->')" \
      "$(record consume)")" \
    0

  grant_body=$(print_record grant 3)
  case $grant_body in
    $'<!-- claude-pr-review-quota:v1\n{"op":"grant","n":3}\n-->')
      echo '  ok    record grant uses jq -n'
      ;;
    *)
      echo '  FAIL  record grant uses jq -n'
      echo "        got $(printf '%q' "$grant_body")"
      failures=$((failures + 1))
      ;;
  esac

  if printf 'not json\n' | remaining >/dev/null 2>&1; then
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
  --self-check)
    self_check
    ;;
  remaining)
    remaining
    ;;
  record)
    shift
    print_record "$@"
    ;;
  *)
    echo 'usage: review-quota.sh remaining | record grant <n> | record consume | --self-check' >&2
    exit 1
    ;;
esac
