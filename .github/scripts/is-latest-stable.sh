#!/usr/bin/env bash
#
# Whether <ref> is the latest stable version among the tags on stdin. A stable tag is
# `vX.Y.Z` (optional `v` / `refs/tags/`) with no pre-release suffix. Hyphenated tags
# are ignored, so a 1.18 patch still wins while 1.19 is only in beta.
#
# Usage: is-latest-stable.sh <ref>     # tags on stdin, one per line
#        is-latest-stable.sh --self-check

set -euo pipefail

strip_ref() {
  local s=$1
  s=${s%$'\r'}
  s=${s#refs/tags/}
  s=${s#v}
  printf '%s' "$s"
}

is_stable() {
  [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

is_latest() {
  local current latest
  current=$(strip_ref "$1")
  if ! is_stable "$current"; then
    echo false
    return
  fi

  # Include $current so an empty tag list (first release) still answers true.
  latest=$(
    {
      printf '%s\n' "$current"
      grep -E '^(refs/tags/)?v?[0-9]+\.[0-9]+\.[0-9]+$' || true
    } | sed -E 's|^(refs/tags/)?v||' | sort -V | tail -1
  )

  if [ "$current" = "$latest" ]; then
    echo true
  else
    echo false
  fi
}

self_check() {
  local failures=0

  check() {
    local name=$1 ref=$2 tags=$3 expected=$4 got
    got=$(printf '%s\n' "$tags" | "$0" "$ref") || {
      echo "  FAIL  $name (exited $?)"
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

  check 'new latest stable' 'refs/tags/v1.19.0' $'v1.18.4\nv1.18.5' true
  check 'older patch after a newer stable' 'refs/tags/v1.18.5' $'v1.18.4\nv1.19.0' false
  check 'older patch after 1.19.1' 'v1.18.5' $'v1.18.4\nv1.19.1' false
  check 'patch during a beta cycle' 'refs/tags/v1.18.5' $'v1.18.4\nv1.19.0-beta.1\nv1.19.0-beta.2' true
  check 'only this stable tag' 'v1.18.5' '' true
  check 're-tag of the current latest' 'refs/tags/v1.19.0' $'v1.18.5\nv1.19.0' true
  check 'already latest among mixed tags' 'v1.18.4' $'v1.17.1\nv1.18.4\nv1.19.0-beta.1' true
  check 'beta itself is not latest-stable' 'refs/tags/v1.19.0-beta.1' $'v1.18.5' false
  check 'master is not a stable tag' 'refs/heads/master' $'v1.18.5' false
  check 'numeric, not lexicographic' 'v1.9.0' $'v1.9.0\nv1.10.0' false
  check 'v-less tags still compare' '1.18.5' $'1.18.4\n1.19.0-rc.1' true

  if [ "$failures" -gt 0 ]; then
    echo "$failures case(s) failed"
    exit 1
  fi
  echo 'all cases passed'
}

case "${1:-}" in
  --self-check) self_check ;;
  '')
    echo 'usage: is-latest-stable.sh <ref> | is-latest-stable.sh --self-check' >&2
    exit 1
    ;;
  *) is_latest "$1" ;;
esac
