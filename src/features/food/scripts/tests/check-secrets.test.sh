#!/usr/bin/env bash
# Repository secret hygiene checks (Guide Ãƒâ€šÃ‚Â§6.3 Slice 0A.4). Run: bun run test:scripts
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
export MSYS_NO_PATHCONV=1

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; failures=$((failures + 1)); }

# Native docker, else the WSL distro that hosts the local stack. env -i empties the environment except
# for the NAME=value pairs given; --env-file /dev/null stops compose reading a developer's .env.
compose_with_env() {
  if command -v docker >/dev/null 2>&1; then
    env -i PATH="$PATH" "$@" docker compose --env-file /dev/null -f docker-compose.yml config -q
  else
    wsl.exe -d Ubuntu -- env -i "$@" /usr/bin/docker compose --env-file /dev/null -f docker-compose.yml config -q
  fi
}

# c1: compose fails closed. Compose reports only one missing variable, in random order, so naming is
# checked by omitting one variable at a time while all others hold dummy values.
if compose_with_env >/dev/null 2>&1; then
  fail "c1 compose config succeeds with an empty environment"
else
  pass "c1 compose config fails with an empty environment"
fi

required=(IMGPROXY_KEY IMGPROXY_SALT S3_REGION S3_BUCKET S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY
  DIRECTUS_SECRET DIRECTUS_ADMIN_EMAIL DIRECTUS_ADMIN_PASSWORD GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN
  POSTGRES_PASSWORD FOOD_INVALIDATE_TOKEN DIRECTUS_DB_PASSWORD
  FOOD_API_DB_PASSWORD)

for omitted in "${required[@]}"; do
  others=()
  for name in "${required[@]}"; do
    [[ "$name" == "$omitted" ]] || others+=("$name=dummy")
  done
  err=$(compose_with_env "${others[@]}" 2>&1)
  status=$?
  if [[ $status -ne 0 && "$err" == *"$omitted"* ]]; then
    pass "c1 compose requires $omitted"
  else
    fail "c1 compose does not require $omitted: $err"
  fi
done

# c2: gitleaks over the working tree = tracked plus untracked-but-not-ignored files, so local .env
# files, data/ and dependencies are out of scope.
gitleaks_bin=${GITLEAKS_BIN:-$(command -v gitleaks || command -v gitleaks.exe)}
if [[ -z "$gitleaks_bin" ]]; then
  # winget installs outside the PATH of shells that were already open (Git Bash and WSL paths).
  for candidate in /c/Users/*/AppData/Local/Microsoft/WinGet/Packages/Gitleaks*/gitleaks.exe     /mnt/c/Users/*/AppData/Local/Microsoft/WinGet/Packages/Gitleaks*/gitleaks.exe; do
    [[ -x "$candidate" ]] && gitleaks_bin=$candidate && break
  done
fi

if [[ -z "$gitleaks_bin" ]]; then
  fail "c2 gitleaks is not installed (or set GITLEAKS_BIN)"
else
  scanned=0
  leaky=()
  while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue
    scanned=$((scanned + 1))
    "$gitleaks_bin" detect --no-git --no-banner --redact --source "$file" </dev/null >/dev/null 2>&1 || leaky+=("$file")
  done < <(git ls-files -z --cached --others --exclude-standard)
  if [[ $scanned -eq 0 ]]; then
    fail "c2 no files found to scan"
  elif [[ ${#leaky[@]} -gt 0 ]]; then
    fail "c2 gitleaks findings (or scan errors) in: ${leaky[*]}"
  else
    pass "c2 gitleaks reports 0 findings in $scanned files"
  fi
fi

# c3: Garage takes both secrets from the environment, never from the committed config.
if grep -nE '^[[:space:]]*(rpc_secret|admin_token)[[:space:]]*=' docker-compose.yml >/dev/null; then
  fail "c3 the Garage configuration contains an rpc_secret or admin_token literal"
else
  pass "c3 the Garage configuration holds no secret literals"
fi

exit $((failures > 0))
