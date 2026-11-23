#!/usr/bin/env bash
#
# Writes a PR's diff to `pr.diff`, and again under `pr-diff/` as one numbered file per changed file
# with an `INDEX.tsv`, so a reviewer can read a large PR piece by piece instead of all at once.
#
# The diff comes from git, not `gh pr diff`: the API refuses one above 20,000 lines or 1 MB. The two
# commits are fetched into a scratch repository, so no PR head code lands in the trusted checkout.
#
# Usage: fetch-pr-diff.sh <repo> <pr-number> <head-sha>     (needs GITHUB_TOKEN for `gh`)

set -euo pipefail

repo=$1
pr_number=$2
head_sha=$3

pr=$(gh api "repos/$repo/pulls/$pr_number")
base_sha=$(jq -r .base.sha <<< "$pr")
# From the API because the checkout is shallow, where `git merge-base` can be wrong or missing.
merge_base=$(gh api "repos/$repo/compare/$base_sha...$head_sha" --jq .merge_base_commit.sha)

# Commits whose subject starts or ends with `[drop]` are carried over from a stacked base PR and
# reviewed there, so the diff starts after the last of those leading the history, and
# `dropped-commits.txt` lists what was cut. The label is the author's word, so it is honoured only
# from someone with write access, and not past a merge, which would pull the base branch's own
# changes into a diff that no longer starts at it.
author=$(jq -r .user.login <<< "$pr")
permission=$(gh api "repos/$repo/collaborators/$author/permission" --jq .permission 2>/dev/null) || permission=unknown
commits=$(gh api --paginate "repos/$repo/pulls/$pr_number/commits" \
  --jq '.[] | "\(.sha)\t\(.parents | length)\t\(.commit.message | split("\n")[0])"')
: > dropped-commits.txt
if [[ $permission == admin || $permission == write ]] && ! awk -F'\t' '$2 > 1 { found = 1 } END { exit !found }' <<< "$commits"; then
  awk -F'\t' '$3 !~ /^\[drop\]|\[drop\]$/ { done = 1 } !done { print $1 "\t" $3 }' <<< "$commits" > dropped-commits.txt
fi
diff_base=$(tail -n 1 dropped-commits.txt | cut -f1)
diff_base=${diff_base:-$merge_base}
echo "Left out $(wc -l < dropped-commits.txt | tr -d ' ') [drop] commits (author permission: $permission)"

objects=$(mktemp -d)
git init -q "$objects"
git -C "$objects" fetch -q --depth 1 "https://github.com/$repo" "$diff_base" "$head_sha"

git -C "$objects" diff "$diff_base" "$head_sha" > pr.diff

# Numbered rather than named after the path, which is the PR author's text.
rm -rf pr-diff
mkdir pr-diff
# A file that becomes a symlink, or the reverse, is a deletion and a creation under one repeated header.
awk '/^diff --git / { if ($0 != last) { if (out) close(out); out = sprintf("pr-diff/%04d.diff", ++n) } last = $0 }
     out { print > out }' pr.diff
git -C "$objects" diff --numstat "$diff_base" "$head_sha" \
  | awk 'BEGIN { print "piece\tadded\tdeleted\tpath" } { printf "pr-diff/%04d.diff\t%s\n", NR, $0 }' > pr-diff/INDEX.tsv

# Both come out of git in the same order, so a count mismatch means the index names the wrong files.
pieces=$(find pr-diff -name '*.diff' | wc -l)
indexed=$(( $(wc -l < pr-diff/INDEX.tsv) - 1 ))
[ "$pieces" -eq "$indexed" ] || { echo "::error::split $pieces diff pieces but indexed $indexed"; exit 1; }

echo "Diff size: $(wc -l < pr.diff) lines in $pieces files"
