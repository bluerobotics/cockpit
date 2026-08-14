#!/usr/bin/env bash
#
# Downloads the complexity report that the CI workflow measured for this PR head, so the reviewer
# reads numbers instead of tallying `&&` and `case` by eye across a function it cannot lint.
#
# The two workflows are independent: the reviewer runs on `pull_request_target` and must never check
# out head code, while CI runs on `pull_request` and already builds it safely. So the report crosses
# between runs as an artifact, and on a freshly opened PR both start together and this has to wait for
# the CI job. On a `/review` re-review CI finished long ago and the first poll hits.
#
# A miss is not an error, and this always exits 0. The guidelines tell the reviewer to raise no
# complexity findings when the report is absent, which fails in the safe direction: a review missing
# one check beats a review carrying a number nobody computed. Failing the step instead would withhold
# an otherwise good review over an advisory section.
#
# Usage: fetch-complexity-report.sh <repo> <head-sha> <out-file> <max-wait-seconds>
#        fetch-complexity-report.sh --self-check

set -euo pipefail

ARTIFACT=complexity-report

fetch() {
  local repo=$1 head_sha=$2 out=$3 max_wait=$4
  local deadline=$((SECONDS + max_wait)) run_id status dir
  local extra_poll_done=0

  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' RETURN

  while :; do
    local saw_run=0 all_done=1
    # A branch pushed to this repository gets a `push` run alongside the `pull_request` one, at the same
    # head SHA and in an arbitrary order, and only the latter holds the job that measures. Re-runs and
    # cancelled runs stack up more, so every candidate is tried rather than only the newest.
    while IFS=$'\t' read -r run_id status; do
      [ -n "$run_id" ] || continue
      saw_run=1
      [ "$status" = completed ] || all_done=0
      gh run download "$run_id" --repo "$repo" --name "$ARTIFACT" --dir "$dir" >/dev/null 2>&1 || continue
      if [ -s "$dir/$ARTIFACT.json" ]; then
        cp "$dir/$ARTIFACT.json" "$out"
        echo "Complexity report for ${head_sha:0:7} downloaded from CI run $run_id."
        return 0
      fi
    done < <(gh run list --repo "$repo" --workflow ci.yml --commit "$head_sha" --event pull_request \
      --limit 20 --json databaseId,status --jq '.[] | [.databaseId, .status] | @tsv' 2>/dev/null || true)

    # A finished run that never uploaded the report will never grow one, so one more poll covers the
    # listing lag and then we stop rather than burning the reviewer's wait budget.
    if [ "$saw_run" -eq 1 ] && [ "$all_done" -eq 1 ]; then
      if [ "$extra_poll_done" -eq 1 ]; then
        echo "::warning::No complexity report for ${head_sha:0:7}: every pull_request run for this head has finished without one. The reviewer will skip the complexity checks for this round."
        return 0
      fi
      extra_poll_done=1
    elif [ "$SECONDS" -ge "$deadline" ]; then
      echo "::warning::No complexity report for ${head_sha:0:7} after ${max_wait}s. The reviewer will skip the complexity checks for this round."
      return 0
    fi
    sleep "${COMPLEXITY_FETCH_POLL_SECONDS:-20}"
  done
}

self_check() {
  local failures=0 dir
  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' RETURN

  # A stub `gh` on PATH, so the poll loop is exercised without a network or a real run.
  mkdir -p "$dir/bin"
  cat > "$dir/bin/gh" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *"run list"*)
    [ -n "${STUB_LIST_LOG:-}" ] && echo list >> "$STUB_LIST_LOG"
    if [ "${STUB_HAS_RUN:-1}" = 1 ]; then
      for id in ${STUB_RUN_IDS:-4242}; do
        printf '%s\t%s\n' "$id" "${STUB_RUN_STATUS:-in_progress}"
      done
    fi
    ;;
  *"run download"*)
    [ "${STUB_HAS_ARTIFACT:-1}" = 1 ] || exit 1
    # Only one run carries the artifact, so a candidate list has to walk past the others.
    [ "$3" = 4242 ] || exit 1
    for arg in "$@"; do
      [ "${prev:-}" = "--dir" ] && printf '{"head":"abc"}' > "$arg/complexity-report.json"
      prev=$arg
    done
    ;;
esac
STUB
  chmod +x "$dir/bin/gh"

  check() {
    local name=$1 expected=$2 out="$dir/out.json" rc=0
    rm -f "$out"
    [ -n "${STUB_LIST_LOG:-}" ] && rm -f "$STUB_LIST_LOG"
    ( PATH="$dir/bin:$PATH" fetch owner/repo abc1234567 "$out" 0 >/dev/null 2>&1 ) || rc=$?
    local got="exit=$rc"
    [ -s "$out" ] && got="$got,file=yes" || got="$got,file=no"
    if [ -n "${STUB_LIST_LOG:-}" ]; then
      local lists=0
      [ -f "$STUB_LIST_LOG" ] && lists=$(wc -l < "$STUB_LIST_LOG" | tr -d ' ')
      got="$got,lists=$lists"
    fi
    if [ "$got" = "$expected" ]; then
      echo "  ok    $name"
    else
      echo "  FAIL  $name"
      echo "        expected $expected"
      echo "        got      $got"
      failures=$((failures + 1))
    fi
  }

  COMPLEXITY_FETCH_POLL_SECONDS=0
  export COMPLEXITY_FETCH_POLL_SECONDS

  check 'report present' 'exit=0,file=yes'
  STUB_RUN_IDS='1111 4242 2222' check 'the run holding the artifact is not the newest' 'exit=0,file=yes'
  STUB_HAS_ARTIFACT=0 check 'run exists but no artifact yet' 'exit=0,file=no'
  STUB_HAS_ARTIFACT=0 STUB_RUN_STATUS=completed STUB_LIST_LOG="$dir/lists" \
    check 'every run finished without an artifact' 'exit=0,file=no,lists=2'
  STUB_HAS_RUN=0 check 'no CI run for this commit' 'exit=0,file=no'

  if [ "$failures" -gt 0 ]; then
    echo "$failures case(s) failed"
    exit 1
  fi
  echo "all cases passed"
}

case "${1:-}" in
  --self-check) self_check ;;
  '')
    echo 'usage: fetch-complexity-report.sh <repo> <head-sha> <out-file> <max-wait-seconds> | --self-check' >&2
    exit 1
    ;;
  *)
    [ "$#" -eq 4 ] || { echo 'usage: fetch-complexity-report.sh <repo> <head-sha> <out-file> <max-wait-seconds>' >&2; exit 1; }
    fetch "$1" "$2" "$3" "$4"
    ;;
esac
