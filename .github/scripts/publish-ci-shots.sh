#!/usr/bin/env bash
set -euo pipefail

shots_dir="${1:?publish directory required}"
commit_message="${2:?commit message required}"
log_file="${3:-}"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_SERVER_URL:?GITHUB_SERVER_URL is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

auth=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\r\n')
echo "::add-mask::$auth"

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

run_push() {
  git -C "$stage" init --initial-branch=ci-shots
  cp -R "$shots_dir"/. "$stage"/
  git -C "$stage" add -- .
  git -C "$stage" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -m "$commit_message"
  GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraheader \
    GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $auth" \
    git -C "$stage" push --force "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY.git" HEAD:refs/heads/ci-shots
}

if [ -n "$log_file" ]; then
  mkdir -p "$(dirname "$log_file")"
  run_push 2>&1 | tee "$log_file"
else
  run_push
fi
