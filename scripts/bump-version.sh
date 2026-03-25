#!/usr/bin/env bash
set -euo pipefail

bump_type="${1:-}"
shift || true
skip_tag=false

if [ -z "${bump_type}" ]; then
  echo "Usage: $0 <patch|minor|major> [--no-tag]"
  exit 1
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-tag)
      skip_tag=true
      ;;
    *)
      echo "Unsupported option: $1"
      echo "Usage: $0 <patch|minor|major> [--no-tag]"
      exit 1
      ;;
  esac
  shift
done

case "${bump_type}" in
  patch|minor|major) ;;
  *)
    echo "Unsupported bump type: ${bump_type}"
    exit 1
    ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean before version bump."
  git --no-pager status --short
  exit 1
fi

increment_version() {
  local version="$1"
  local bump="$2"
  local major minor patch

  IFS='.' read -r major minor patch <<EOF2
${version}
EOF2

  if [ -z "${major:-}" ] || [ -z "${minor:-}" ] || [ -z "${patch:-}" ]; then
    echo "Unsupported version format: ${version}"
    exit 1
  fi

  case "${bump}" in
    patch)
      patch=$((patch + 1))
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    *)
      echo "Unsupported bump type: ${bump}"
      exit 1
      ;;
  esac

  printf "%s.%s.%s" "${major}" "${minor}" "${patch}"
}

current_version="$(node -p "require('./package.json').version")"
next_version="$(increment_version "${current_version}" "${bump_type}")"

while git rev-parse --verify --quiet "refs/tags/v${next_version}" >/dev/null; do
  echo "Tag v${next_version} already exists; bumping ${bump_type} again."
  next_version="$(increment_version "${next_version}" "${bump_type}")"
done

if [ "${skip_tag}" = true ]; then
  npm version "${next_version}" --no-git-tag-version
else
  npm version "${next_version}" -m "chore(release): bump version to %s"
fi
