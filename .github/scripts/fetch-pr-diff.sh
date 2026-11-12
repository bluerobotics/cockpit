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

base_sha=$(gh api "repos/$repo/pulls/$pr_number" --jq .base.sha)
# From the API because the checkout is shallow, where `git merge-base` can be wrong or missing.
merge_base=$(gh api "repos/$repo/compare/$base_sha...$head_sha" --jq .merge_base_commit.sha)

objects=$(mktemp -d)
git init -q "$objects"
git -C "$objects" fetch -q --depth 1 "https://github.com/$repo" "$merge_base" "$head_sha"

git -C "$objects" diff "$merge_base" "$head_sha" > pr.diff

# Numbered rather than named after the path, which is the PR author's text.
rm -rf pr-diff
mkdir pr-diff
# A file that becomes a symlink, or the reverse, is a deletion and a creation under one repeated header.
awk '/^diff --git / { if ($0 != last) { if (out) close(out); out = sprintf("pr-diff/%04d.diff", ++n) } last = $0 }
     out { print > out }' pr.diff
git -C "$objects" diff --numstat "$merge_base" "$head_sha" \
  | awk 'BEGIN { print "piece\tadded\tdeleted\tpath" } { printf "pr-diff/%04d.diff\t%s\n", NR, $0 }' > pr-diff/INDEX.tsv

# Both come out of git in the same order, so a count mismatch means the index names the wrong files.
pieces=$(find pr-diff -name '*.diff' | wc -l)
indexed=$(( $(wc -l < pr-diff/INDEX.tsv) - 1 ))
[ "$pieces" -eq "$indexed" ] || { echo "::error::split $pieces diff pieces but indexed $indexed"; exit 1; }

echo "Diff size: $(wc -l < pr.diff) lines in $pieces files"
