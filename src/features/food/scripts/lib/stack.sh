# shellcheck shell=bash
# What the scripts that drive Docker Compose share. Source it with the feature root as the working
# directory.

# Git Bash on Windows, with Docker only inside WSL.
docker_only_in_wsl() { ! command -v docker >/dev/null 2>&1 && command -v wsl.exe >/dev/null 2>&1; }

# The working directory as WSL sees it.
wsl_working_dir() {
  local windows_dir drive
  windows_dir=$(pwd -W) # C:/dev/...
  drive=${windows_dir:0:1}
  echo "/mnt/${drive,,}${windows_dir:2}"
}

# Where Docker is only inside WSL, runs the script there instead and does not return. Ports are
# reachable on localhost.
reexec_in_wsl() { # script path relative to the feature root, its arguments...
  docker_only_in_wsl || return 0
  local script=$1
  shift
  MSYS_NO_PATHCONV=1 exec wsl.exe -d "${FOOD_WSL_DISTRO:-Ubuntu}" -- \
    bash "$(wsl_working_dir)/$script" "$@"
}

# --- Throwaway test stacks: the services of docker-compose.yml under their own project name. ---
# require_test_project comes first: the other functions use the $project and $env_file it sets.

# `down -v` deletes volumes, so only names made for tests are accepted.
require_test_project() { # name prefix, project name
  [[ "$2" =~ ^$1[a-z0-9-]+$ ]] || { echo "project must start with $1" >&2; exit 2; }
  project=$2
  env_file="/tmp/$project.env"
}

compose() {
  # env -i: an exported variable of the caller must not override the throwaway values.
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} \
    docker compose -p "$project" --env-file "$env_file" -f docker-compose.yml "$@"
}

setting() { sed -n "s/^$1=//p" "$env_file"; }

# The host port Docker published for a service's port.
port_of() { # service, container port
  local address
  address=$(compose port "$1" "$2")
  echo "${address##*:}"
}

wait_for() { # tries (one a second), service, command...
  local tries=$1 service=$2
  shift 2
  for _ in $(seq 1 "$tries"); do
    "$@" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "$(basename "$0" .sh): $service did not become ready" >&2
  compose logs --tail 60 "$service" >&2
  return 1
}

# Writes $env_file with random secrets. Compose interpolates the whole of docker-compose.yml, so this
# gives a value to every variable it requires, including those of services a stack never starts. A
# new required variable belongs here.
write_stack_env() { # further NAME=value lines of this stack
  (
    umask 077 # set before the redirection below creates the file
    {
      for name in IMGPROXY_KEY IMGPROXY_SALT GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN POSTGRES_PASSWORD \
        FOOD_API_DB_PASSWORD FOOD_WORKER_DB_PASSWORD DIRECTUS_DB_PASSWORD DIRECTUS_SECRET \
        DIRECTUS_ADMIN_PASSWORD FOOD_INVALIDATE_TOKEN; do
        echo "$name=$(openssl rand -hex 32)"
      done
      echo "DIRECTUS_ADMIN_EMAIL=admin@example.com"
      echo "S3_REGION=food-test-1" # not the dev value: a hard-coded region breaks the signatures
      echo "S3_BUCKET=food-media"
      # Garage creates its keys itself: a stack that starts it puts them here afterwards.
      for name in S3_ACCESS_KEY S3_SECRET_KEY S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY; do
        echo "$name=not-yet-created"
      done
      printf '%s\n' "$@"
    } >"$env_file"
  )
}

stack_down() { # further `compose down` options
  [[ -f "$env_file" ]] || return 0
  compose down -v --remove-orphans "$@" >&2
  rm -f "$env_file"
}
