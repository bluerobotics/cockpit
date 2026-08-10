#!/usr/bin/env bash
#
# Reads the slash command out of a PR comment: which command it is, and for `/resolve` the finding
# ids and reason. This is the authoritative gate — a workflow `if:` cannot see past the first line of
# a body, so it only pre-filters, and this decides whether a run happens.
#
# The ids are taken only from the leading run of them: a reason is free text and routinely cites
# another finding ("same reasoning as 6.3"), which a scan of the whole line would silently close.
#
# Reads COMMENT_BODY, COMMENT_AUTHOR and COMMENT_URL from the environment rather than taking the body
# as an argument, so a comment can never reach a shell as code.
#
# Usage: review-command.sh --command          # prints `command=review|resolve|none` for GITHUB_OUTPUT
#        review-command.sh <output-file>      # writes the /resolve payload, or `{}`
#        review-command.sh --self-check

set -euo pipefail

# Native expansions rather than `printf | head -1 | tr`: under `pipefail` a body larger than the pipe
# buffer makes printf exit 141 when head closes the pipe, which would take the whole step with it.
first_line_of() {
  local line=${1-}
  line=${line%%$'\n'*}
  printf '%s' "${line%$'\r'}"
}

# Anchored on both ends: `(?:$|\s)` stops `/resolved 6.1 yesterday` from spending a run and closing
# 6.1, and the id group stops the scan before the reason starts.
parse() {
  jq -n --arg l "$1" --arg by "${2-}" --arg url "${3-}" '
    (($l | capture("^/resolve(?:$|\\s+)(?<args>.*)$") | .args) // "") as $args
    | (($args | capture("^(?<ids>(?:[0-9]+\\.[0-9]+[\\s,]*)+)(?<rest>.*)$")) // null) as $m
    | {
        ids: (if $m then ($m.ids | [scan("[0-9]+\\.[0-9]+")]) else [] end),
        reason: ((if $m then $m.rest else $args end) | sub("^[\\s,]+";"") | sub("\\s+$";"")),
        by: $by,
        url: $url
      }'
}

command_of() {
  case $(first_line_of "${1-}") in
    '/review' | '/review '*) echo review ;;
    '/resolve' | '/resolve '*) echo resolve ;;
    *) echo none ;;
  esac
}

# Drives the script's real entry points, so the command gate is covered and not just the parse.
self_check() {
  local failures=0 tmp
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' RETURN

  check_command() {
    local body=$1 expected=$2 got
    got=$(COMMENT_BODY=$body "$0" --command)
    if [ "$got" = "command=$expected" ]; then
      echo "  ok    [command] ${body//$'\n'/\\n}"
    else
      echo "  FAIL  [command] ${body//$'\n'/\\n}"
      echo "        expected command=$expected, got $got"
      failures=$((failures + 1))
    fi
  }

  check_resolve() {
    local body=$1 expected=$2 got
    COMMENT_BODY=$body COMMENT_AUTHOR=u COMMENT_URL=U "$0" "$tmp" > /dev/null
    got=$(jq -c 'if has("ids") then {ids,reason} else . end' "$tmp")
    if [ "$got" = "$expected" ]; then
      echo "  ok    [resolve] ${body//$'\n'/\\n}"
    else
      echo "  FAIL  [resolve] ${body//$'\n'/\\n}"
      echo "        expected $expected"
      echo "        got      $got"
      failures=$((failures + 1))
    fi
  }

  # A command is the first token of the first line. The bodies that broke when this lived in the
  # workflow `if:` — trailing newline, and command-then-context — are the first two here.
  check_command '/review' review
  check_command $'/review\n' review
  check_command $'/review\n\npushed the fixes' review
  check_command $'/review\r\nCRLF from the web UI' review
  check_command '/review please' review
  check_command '/resolve 1.1 fine by me' resolve
  check_command $'/resolve\n' resolve
  check_command '/reviewing this now' none
  check_command '/resolved 6.1 yesterday' none
  check_command 'just a normal comment' none
  check_command '' none

  check_resolve '/resolve 1.1 accepted the scoping argument' \
    '{"ids":["1.1"],"reason":"accepted the scoping argument"}'
  check_resolve '/resolve 6.1, 6.3 both deliberate' \
    '{"ids":["6.1","6.3"],"reason":"both deliberate"}'
  check_resolve '/resolve 8.1' '{"ids":["8.1"],"reason":""}'
  # The reason cites a sibling finding, which must stay in the text and out of `ids`.
  check_resolve '/resolve 6.1 same reasoning as 6.3, which we already settled' \
    '{"ids":["6.1"],"reason":"same reasoning as 6.3, which we already settled"}'
  check_resolve '/resolve 1.1 vuetify 3.5 already handles this' \
    '{"ids":["1.1"],"reason":"vuetify 3.5 already handles this"}'
  check_resolve '/resolve no id at all' '{"ids":[],"reason":"no id at all"}'
  check_resolve $'/resolve 1.1 fine\nsecond line ignored' \
    '{"ids":["1.1"],"reason":"fine"}'
  check_resolve '/resolved 6.1 yesterday, see below' '{}'
  check_resolve '/review' '{}'
  # Shell metacharacters stay data: the body never reaches a shell, only jq --arg.
  check_resolve '/resolve 1.1 $(whoami) `id` && rm -rf /' \
    '{"ids":["1.1"],"reason":"$(whoami) `id` && rm -rf /"}'

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
  --command)
    echo "command=$(command_of "${COMMENT_BODY-}")"
    ;;
  '')
    echo 'usage: review-command.sh --command | <output-file> | --self-check' >&2
    exit 1
    ;;
  *)
    output=$1
    first_line=$(first_line_of "${COMMENT_BODY-}")
    if [ "$(command_of "${COMMENT_BODY-}")" = resolve ]; then
      parse "$first_line" "${COMMENT_AUTHOR-}" "${COMMENT_URL-}" > "$output"
    else
      echo '{}' > "$output"
    fi
    jq -c . "$output"
    ;;
esac
