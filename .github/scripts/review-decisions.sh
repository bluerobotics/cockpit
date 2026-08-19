#!/usr/bin/env bash
#
# Puts every disputed finding to a vote in a comment of its own, and reads the answer back off that
# comment's reactions. A dispute used to be a checkbox block in the review body, which nothing could
# act on: a tick records no author, so the block was reprinted every round for the life of the PR and
# only a `/resolve` ever closed anything. A reaction names who left it, so the same one click becomes
# evidence a later run can apply.
#
# Only a reactor with push access counts, which is the authority `/resolve` already runs on. An even
# split, or no vote that counts, decides nothing and leaves the finding as the review judged it — a
# dispute stays open until someone entitled to settle it does.
#
# Usage: review-decisions.sh post <ledger-file>   # one comment per disputed finding, per argument
#        review-decisions.sh read <output-file> <ledger-file> [comments-file]
#                                                 # [{id, url, gated, verdict, up, down}] per live vote,
#                                                 # off <comments-file> when the caller already has it
#        review-decisions.sh --self-check
#
# Reads REPO and PR_NUMBER from the environment, and needs a token with `issues: write`.

set -euo pipefail

MARKER='<!-- claude-pr-review-decision:v1 id='

# The whole decision rule, in one expression so `--self-check` exercises what the workflow runs.
# Deduplicated by login: what is being counted is maintainers, not clicks, and one maintainer who
# reacted both ways has said nothing.
TALLY='
  [.[] | select(.permission == "admin" or .permission == "write")]
  | ([.[] | select(.content == "+1") | .login] | unique) as $up
  | ([.[] | select(.content == "-1") | .login] | unique) as $down
  | { up: $up,
      down: $down,
      verdict: (if ($up | length) > ($down | length) then "accept"
                elif ($down | length) > ($up | length) then "reject"
                elif ($up | length) > 0 then "tie"
                else "pending" end) }
'

# Which findings are votable at all. Written once because both ends have to admit exactly the same
# ones: a dispute either end refuses is a vote asked for and never counted, or counted and never
# asked for. A dispute with no argument to accept is a question no tally can answer, so it stays open
# and is put again next round.
VOTABLE='select(.status == "disputed" and (.author_argument // "") != "")'

# The ids a comment can be asked under: votable, and shaped like a finding because the id goes into
# the marker the reader parses back.
VOTABLE_IDS='[.[] | '"$VOTABLE"' | select(.id | test("^[0-9]+\\.[0-9]+$")) | .id] | unique'

# And the disputes that leaves out. The review has already told the reader a ballot is on the thread,
# so a refusal is named in the log rather than leaving them to hunt for a comment nobody posted.
UNVOTABLE_IDS='([.[] | select(.status == "disputed") | .id] | unique) - ('"$VOTABLE_IDS"')'

# A finding gets a comment of its own per argument, so only the newest of them is a live vote: the
# reactions on an earlier one answered an argument nobody is being asked about any more.
NEWEST='[group_by(.finding)[] | max_by(.comment)]'

# And only while it answers the argument the ledger is still showing. An argument that was accepted or
# refused leaves the ledger, so the comment that asked about it stops counting: without this, a later
# click on a settled comment would close the finding on an argument nobody can read any more.
LIVE='[.[] | select(.arg == ($live[.finding] // null))]'

# Author-filtered like every other marker in this pipeline: a marker is a label anyone can type, and a
# forged decision comment would put a finding id of the forger's choosing in front of the voters.
# A body whose line 1 is not the marker produces no object at all and drops out of the array.
# Streamed and slurped because `--paginate` runs `--jq` once per page.
# Takes the comments off a file when the caller already has them, and the filter runs either way so
# the marker and the author check stay in one place whatever the source is.
open_votes() {
  local source=${1:-}
  if [ -n "$source" ]; then
    jq -c '.[]' "$source"
  else
    gh api "repos/$REPO/issues/$PR_NUMBER/comments" --paginate --jq '.[]'
  fi \
    | jq -s '[.[]
        | select(.user.login == "github-actions[bot]" and .user.type == "Bot")
        | (.body | capture("^<!-- claude-pr-review-decision:v1 id=(?<f>[0-9]+\\.[0-9]+) arg=(?<a>[0-9]+) -->")) as $m
        | { comment: .id, url: .html_url, finding: $m.f, arg: $m.a }]'
}

# `admin`/`write` is the bar `/resolve` clears. The endpoint answers `none` for an outsider, so a
# failure is the token rather than the user, and it is reported instead of silently discarding a vote.
permission_of() {
  local level
  level=$(gh api "repos/$REPO/collaborators/$1/permission" --jq '.permission' 2>/dev/null) || level=unknown
  [ "$level" != unknown ] \
    || echo "::warning::could not read $1's permission on $REPO; their reaction is not counted" >&2
  printf '%s' "$level"
}

post() {
  local ledger=$1 have ids unvotable finding title argument arg comment body

  # The ledger is on disk and the comment thread is a paginated fetch, so the overwhelmingly common
  # round — nothing disputed — is answered before spending the round trip.
  ids=$(jq -r "$VOTABLE_IDS"' | .[]' "$ledger")
  unvotable=$(jq -r "$UNVOTABLE_IDS"' | join(", ")' "$ledger")
  [ -z "$unvotable" ] || echo "::warning::disputed finding(s) $unvotable carry no usable argument" \
    "or id and were not put to a vote; close them with /resolve" >&2
  if [ -z "$ids" ]; then
    # Only for the case it describes: a dispute that could not be asked about was named just above.
    [ -n "$unvotable" ] || echo 'no disputed finding needs a decision comment'
    return 0
  fi

  # Against the newest comment per finding rather than the whole history, which is the same key the
  # tally reads on: an author who returns to an argument an earlier comment already carried has to be
  # asked again, because the reactions counted are the ones on the newest comment and not that one's.
  have=$(open_votes | jq -c "$NEWEST"' | [.[] | "\(.finding) \(.arg)"]')

  body=$(mktemp)
  trap 'rm -f "$body"' RETURN
  for finding in $ids; do
    title=$(jq -r --arg id "$finding" 'map(select(.id == $id)) | first | .title // $id' "$ledger")
    argument=$(jq -r --arg id "$finding" 'map(select(.id == $id)) | first | .author_argument' "$ledger")
    # Keyed on the argument rather than the finding alone: a vote answers the argument it was cast
    # about, so an author who offers a different one gets a fresh comment and a fresh tally instead
    # of being refused on an earlier verdict nobody would see applied.
    # ponytail: the key is a checksum of a sentence a model regenerates every round, so a paraphrase
    # of an unchanged argument strands the reactions already on it and asks the same dispute again.
    # The guidelines require the sentence carried forward verbatim; if that proves unreliable, the
    # review has to emit a stable id alongside the argument and the key becomes that.
    arg=$(printf '%s' "$argument" | cksum | cut -d' ' -f1)
    jq -ne --argjson have "$have" --arg key "$finding $arg" '$have | index($key) == null' > /dev/null \
      || continue
    {
      printf '%s%s arg=%s -->\n' "$MARKER" "$finding" "$arg"
      printf '### :raising_hand: Decision needed — %s\n\n' "$finding"
      printf '**%s**\n\n' "$title"
      printf "The author's argument: %s\n\n" "$argument"
      printf 'React to this comment and the next `/review` applies the answer:\n\n'
      printf -- '- :+1: accept the argument and leave the code as it is — the finding closes\n'
      printf -- '- :-1: ask for the change anyway — the finding stays open\n\n'
      printf 'The two reactions already here were left by the bot so that either answer is one '
      printf 'click, and neither of them counts. Only reactions from someone with write access to '
      printf 'this repository do, and an even split, or no vote, leaves the finding open and this '
      printf 'comment standing. Move your reaction to change your mind while the vote is open — '
      printf 'once a `/review` has settled this dispute, whether by closing the finding or by '
      printf 'refusing the argument, this comment stops counting and moving a reaction on it '
      printf 'changes nothing. The same goes once the author makes a different case: the argument '
      printf 'above stops being the one in question, and the newest "Decision needed" comment for '
      printf 'this finding is the live vote.\n'
    } > "$body"

    comment=$(jq -Rs '{body: .}' < "$body" \
      | gh api --method POST "repos/$REPO/issues/$PR_NUMBER/comments" --input - --jq '.id')
    # Seeded so a decision is one click rather than a trip through the reaction picker, and so the
    # two options being counted are the two on show.
    gh api --method POST "repos/$REPO/issues/comments/$comment/reactions" -f content='+1' > /dev/null
    gh api --method POST "repos/$REPO/issues/comments/$comment/reactions" -f content='-1' > /dev/null
    echo "put $finding to a vote in comment $comment"
  done
}

read_votes() {
  local out=$1 ledger=$2 comments=${3:-} live='{}' id argument votes tmp vote comment finding url
  local login level reads=0 gated=true

  # What every open dispute is currently arguing, keyed the way `post` keyed the comment it asked in.
  while read -r id; do
    argument=$(jq -r --arg id "$id" 'map(select(.id == $id)) | first | .author_argument' "$ledger")
    live=$(jq -c --arg id "$id" --arg a "$(printf '%s' "$argument" | cksum | cut -d' ' -f1)" \
      '.[$id] = $a' <<< "$live")
  done < <(jq -r '.[] | '"$VOTABLE"' | .id' "$ledger")

  votes=$(open_votes "$comments" | jq -c "$NEWEST")
  # An empty ledger beside a decision comment is a ledger that could not be read, not a PR where every
  # dispute has been settled — gating on it would discard every vote in silence, which is the one
  # failure this cannot afford, so it says which happened and counts them. `gated` carries that to the
  # consumer, in the file rather than only in the log: a vote counted without the gate may be answering
  # an argument the lost ledger would have shown was settled rounds ago, so it is reported, not applied.
  if [ "$(jq 'length' "$ledger")" -eq 0 ] && [ "$(jq 'length' <<< "$votes")" -gt 0 ]; then
    echo "::warning::no findings in $ledger; counting every vote on the PR without checking its argument" >&2
    gated=false
  else
    votes=$(jq -c --argjson live "$live" "$LIVE" <<< "$votes")
  fi

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN
  : > "$tmp/reactions.ndjson"
  echo '{}' > "$tmp/permissions.json"

  # The bot's own seeded reactions are excluded here rather than by permission: the token posting them
  # is the repository's, so asking whether it can push would count both votes on every finding.
  while read -r vote; do
    comment=$(jq -r '.comment' <<< "$vote")
    finding=$(jq -r '.finding' <<< "$vote")
    url=$(jq -r '.url' <<< "$vote")
    gh api "repos/$REPO/issues/comments/$comment/reactions" --paginate --jq '.[]' \
      | jq -c --arg f "$finding" --arg u "$url" '
          select(.user.type != "Bot" and (.content == "+1" or .content == "-1"))
          | {finding: $f, url: $u, login: .user.login, content}' >> "$tmp/reactions.ndjson"
  done < <(jq -c '.[]' <<< "$votes")

  # One lookup per distinct reactor rather than per reaction: the same maintainer votes on every
  # dispute the PR has.
  while read -r login; do
    level=$(permission_of "$login")
    [ "$level" = unknown ] || reads=$((reads + 1))
    jq --arg l "$login" --arg p "$level" '.[$l] = $p' \
      "$tmp/permissions.json" > "$tmp/permissions.next"
    mv "$tmp/permissions.next" "$tmp/permissions.json"
  done < <(jq -rs '[.[].login] | unique | .[]' "$tmp/reactions.ndjson")

  # People voted and not one lookup answered: that is the token, not the voters. Reporting `pending`
  # here is the failure this cannot afford, because it reads exactly like nobody having clicked —
  # every vote on the PR silently discarded, with only a warning in a log nobody opens.
  if [ -s "$tmp/reactions.ndjson" ] && [ "$reads" -eq 0 ]; then
    echo "::error::no reactor's permission could be read on $REPO; every vote would be discarded" >&2
    return 1
  fi

  jq -s --argjson votes "$votes" --argjson gated "$gated" \
    --argjson permissions "$(cat "$tmp/permissions.json")" '
    [.[] | . + {permission: ($permissions[.login] // "unknown")}] as $reactions
    | [$votes[]
       | . as $v
       | {id: $v.finding, url: $v.url, gated: $gated}
         + ([$reactions[] | select(.finding == $v.finding)] | '"$TALLY"')]
  ' "$tmp/reactions.ndjson" > "$out"
  jq -r '.[] | "\(.id): \(.verdict)\(if .gated then "" else " (ungated)" end)"
    + " (up: \(.up | join(",")) down: \(.down | join(",")))"' "$out"
}

self_check() {
  local failures=0

  check() {
    local name=$1 input=$2 expected=$3 expr=${4:-$TALLY} live=${5:-null} got
    got=$(jq -c --argjson live "$live" "$expr" <<< "$input")
    if [ "$got" = "$expected" ]; then
      echo "  ok    $name"
    else
      echo "  FAIL  $name"
      echo "        expected $expected"
      echo "        got      $got"
      failures=$((failures + 1))
    fi
  }

  check 'nobody reacted' '[]' '{"up":[],"down":[],"verdict":"pending"}'
  check 'one admin accepts' \
    '[{"login":"a","content":"+1","permission":"admin"}]' \
    '{"up":["a"],"down":[],"verdict":"accept"}'
  check 'one write-access maintainer rejects' \
    '[{"login":"a","content":"-1","permission":"write"}]' \
    '{"up":[],"down":["a"],"verdict":"reject"}'
  # The case the whole gate exists for: a passer-by's click is not a decision.
  check 'a reactor without push access decides nothing' \
    '[{"login":"a","content":"+1","permission":"read"},{"login":"b","content":"-1","permission":"none"}]' \
    '{"up":[],"down":[],"verdict":"pending"}'
  check 'an unreadable permission is not a vote' \
    '[{"login":"a","content":"+1","permission":"unknown"}]' \
    '{"up":[],"down":[],"verdict":"pending"}'
  check 'an even split stays open' \
    '[{"login":"a","content":"+1","permission":"admin"},{"login":"b","content":"-1","permission":"write"}]' \
    '{"up":["a"],"down":["b"],"verdict":"tie"}'
  # Reacting both ways is one maintainer saying nothing, not one vote each way deciding it.
  check 'the same maintainer both ways is a tie' \
    '[{"login":"a","content":"+1","permission":"admin"},{"login":"a","content":"-1","permission":"admin"}]' \
    '{"up":["a"],"down":["a"],"verdict":"tie"}'
  check 'a majority carries it' \
    '[{"login":"a","content":"+1","permission":"admin"},{"login":"b","content":"+1","permission":"write"},{"login":"c","content":"-1","permission":"admin"}]' \
    '{"up":["a","b"],"down":["c"],"verdict":"accept"}'
  # Reactions other than the two on offer are noise, whoever left them.
  check 'other reactions are not votes' \
    '[{"login":"a","content":"eyes","permission":"admin"},{"login":"b","content":"rocket","permission":"admin"}]' \
    '{"up":[],"down":[],"verdict":"pending"}'

  # A second argument on the same finding is a second comment, and the vote that answered the first
  # one is not an answer to it.
  check 'the newest comment for a finding is the live vote' \
    '[{"finding":"1.1","comment":10},{"finding":"1.2","comment":15},{"finding":"1.1","comment":22}]' \
    '[{"finding":"1.1","comment":22},{"finding":"1.2","comment":15}]' \
    "$NEWEST"
  check 'a finding voted on once keeps its only comment' \
    '[{"finding":"1.1","comment":10}]' \
    '[{"finding":"1.1","comment":10}]' \
    "$NEWEST"

  # A vote can only ask "do you accept this argument?", so a dispute that has none is not votable —
  # whether the field is missing or empty, since the ledger is written by a model.
  check 'only a dispute carrying an argument is votable' \
    '[{"id":"1.1","status":"disputed","author_argument":"stable in practice"},
      {"id":"1.2","status":"disputed","author_argument":""},
      {"id":"1.3","status":"disputed"},
      {"id":"1.4","status":"open","author_argument":"never asked"}]' \
    '["1.1"]' \
    '[.[] | '"$VOTABLE"' | .id]'

  # And what the same ledger leaves unasked, which is what the log has to name: the two filters refuse
  # for different reasons and the reader they were going to send to a ballot cannot tell either way.
  check 'a dispute post cannot ask about is reported rather than dropped' \
    '[{"id":"1.1","status":"disputed","author_argument":"stable in practice"},
      {"id":"1.2","status":"disputed","author_argument":""},
      {"id":"bogus","status":"disputed","author_argument":"carries one"},
      {"id":"1.4","status":"open","author_argument":"never asked"}]' \
    '["1.2","bogus"]' \
    "$UNVOTABLE_IDS"

  # The two ways a comment stops being a live vote: the argument moved on, or the dispute was settled.
  check 'a comment asking about a superseded argument is not a live vote' \
    '[{"finding":"1.1","arg":"111"},{"finding":"1.2","arg":"999"}]' \
    '[{"finding":"1.1","arg":"111"}]' \
    "$LIVE" '{"1.1":"111","1.2":"222"}'
  check 'a settled dispute leaves no live vote' \
    '[{"finding":"1.1","arg":"111"}]' '[]' "$LIVE" '{}'

  if [ "$failures" -gt 0 ]; then
    echo "$failures case(s) failed"
    exit 1
  fi
  echo "all cases passed"
}

case "${1:-}" in
  --self-check) self_check ;;
  post)
    if [ $# -ne 2 ]; then
      echo "usage: review-decisions.sh post <ledger-file>" >&2
      exit 1
    fi
    post "$2"
    ;;
  read)
    if [ $# -lt 3 ] || [ $# -gt 4 ]; then
      echo "usage: review-decisions.sh read <output-file> <ledger-file> [comments-file]" >&2
      exit 1
    fi
    read_votes "$2" "$3" "${4:-}"
    ;;
  *)
    echo 'usage: review-decisions.sh post <ledger-file>' \
      '| read <output-file> <ledger-file> [comments-file] | --self-check' >&2
    exit 1
    ;;
esac
