#!/bin/sh
# Explicitly invoked after GitHub CLI authentication. Private draft candidate only.
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
cd "$repo_root"
assets=${1:?Pass the prepared release-artifacts directory}
case "$assets" in /*) ;; *) assets=$(CDPATH= cd -- "$assets" && pwd -P) ;; esac
artifact="$assets/dsh-project-threads-wave1-spike-0.0.0-final01.5.tgz"
command -v gh >/dev/null
gh auth status --hostname github.com
test -z "$(git status --porcelain)"
test "$(git rev-list --count --all)" = 1
test "$(git rev-parse HEAD)" = "$(git rev-parse final01-candidate^{commit})"
python3 -c 'import json; assert json.load(open("RELEASE_MANIFEST.json"))["validation"]["finalReadyForPrivateDraft"] is True'
python3 tools/release/scan-security.py --history --package "$artifact" >/dev/null
(cd "$assets" && shasum -a 256 -c SHA256SUMS.txt)
owner=$(gh api user --jq .login)
if gh repo view "$owner/dsh-projects" >/dev/null 2>&1; then
  echo 'Target repository already exists. Stop and verify its visibility, contents and authorization.' >&2
  exit 1
fi
gh repo create "$owner/dsh-projects" --private --source . --remote origin --push \
  --description 'A local-first Claude Projects-style project and thread workspace plugin for DeepSeek Harness.'
test "$(gh repo view "$owner/dsh-projects" --json visibility --jq .visibility)" = PRIVATE
test "$(git ls-remote origin refs/heads/main | cut -f1)" = "$(git rev-parse HEAD)"
git push origin final01-candidate
gh release create final01-candidate "$artifact" "$artifact.sha256" "$assets/RELEASE_NOTES.md" \
  --repo "$owner/dsh-projects" --draft --prerelease --latest=false \
  --title 'FINAL-01 candidate (0.0.0-final01.5)' --notes-file RELEASE_NOTES.md
gh repo view "$owner/dsh-projects" --json url,visibility
gh release view final01-candidate --repo "$owner/dsh-projects" --json url,isDraft,isPrerelease,tagName,assets
