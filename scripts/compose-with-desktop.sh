#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=docker_desktop_bootstrap.inc.sh
source "$HERE/docker_desktop_bootstrap.inc.sh"

if ! docker_desktop_bootstrap; then
  docker_desktop_fail_help
  exit 1
fi

exec docker compose "$@"
