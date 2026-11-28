#!/usr/bin/env bash
# A throwaway Garage + imgproxy for the media tests: the real services of docker-compose.yml under
# their own project name, random secrets and random loopback ports. Used by the Python and Vitest
# suites and by scripts/tests/garage-bootstrap.test.sh.
#
#   test-media-stack.sh up <project> [--garage-only]   starts, bootstraps, prints NAME=value lines
#   test-media-stack.sh garage <project> <args...>     runs the garage CLI in that stack
#   test-media-stack.sh config <project>               prints the compose configuration as JSON
#   test-media-stack.sh down <project>                 removes containers, network and volumes
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/lib/stack.sh
reexec_in_wsl scripts/test-media-stack.sh "$@"

action=${1:?usage: test-media-stack.sh up|garage|config|down <project>}
require_test_project food-media-test- "${2:?project name}"
shift 2

url_of() { echo "http://127.0.0.1:$(port_of "$1" "$2")"; } # service, container port

case $action in
  up)
    # Port 0: Docker picks a free one.
    write_stack_env FOOD_S3_PORT=0 FOOD_GARAGE_ADMIN_PORT=0 FOOD_IMGPROXY_PORT=0
    compose up -d garage >&2
    wait_for 60 garage compose exec -T garage /garage status
    if [[ "${1:-}" != --garage-only ]]; then
      keys=$(S3_BUCKET=$(setting S3_BUCKET) GARAGE="bash scripts/test-media-stack.sh garage $project" \
        bash scripts/garage-bootstrap.sh)
      while IFS='=' read -r name value; do
        sed -i "s|^$name=.*|$name=$value|" "$env_file"
      done <<<"$keys"
      compose up -d imgproxy >&2
      wait_for 60 imgproxy curl -fsS "$(url_of imgproxy 8080)/health"
      echo "IMGPROXY_BASE_URL=$(url_of imgproxy 8080)"
    fi
    echo "S3_ENDPOINT=$(url_of garage 3900)"
    for name in S3_BUCKET S3_REGION S3_ACCESS_KEY S3_SECRET_KEY S3_IMGPROXY_ACCESS_KEY \
      S3_IMGPROXY_SECRET_KEY IMGPROXY_KEY IMGPROXY_SALT; do
      echo "$name=$(setting "$name")"
    done
    ;;
  garage) compose exec -T garage /garage "$@" ;;
  config) compose config --format json ;;
  down) stack_down ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
