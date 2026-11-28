#!/usr/bin/env bash
# Slice 2.9: Garage bootstrap is idempotent and least-privilege. Needs Docker (on Windows, in WSL)
# and curl 7.75+. Run: bun run test:scripts
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
source scripts/lib/stack.sh
reexec_in_wsl scripts/tests/garage-bootstrap.test.sh # the whole test runs there

project="food-media-test-bootstrap-$$"
work=$(mktemp -d)
trap 'bash scripts/test-media-stack.sh down "$project" >/dev/null 2>&1; rm -rf "$work"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; failures=$((failures + 1)); }

stack=$(bash scripts/test-media-stack.sh up "$project" --garage-only 2>"$work/up.log") || {
  cat "$work/up.log"
  exit 1
}
value() { sed -n "s/^$1=//p" <<<"$2"; }
endpoint=$(value S3_ENDPOINT "$stack")
region=$(value S3_REGION "$stack")
bucket=$(value S3_BUCKET "$stack")

garage() { bash scripts/test-media-stack.sh garage "$project" "$@" 2>/dev/null; }
bootstrap() {
  S3_BUCKET=$bucket GARAGE="bash scripts/test-media-stack.sh garage $project" \
    bash scripts/garage-bootstrap.sh
}

first=$(bootstrap 2>"$work/first.log")
status=$?
if [[ $status -eq 0 ]]; then pass "c1 the first run succeeds"; else fail "c1 first run: exit $status"; cat "$work/first.log"; fi

second=$(bootstrap 2>"$work/second.log")
status=$?
if [[ $status -eq 0 ]]; then pass "c2 the second run succeeds"; else fail "c2 second run: exit $status"; tail -5 "$work/second.log"; fi
if [[ -z "$second" ]]; then pass "c2 secrets are printed once only"; else fail "c2 the second run printed to stdout"; fi

buckets=$(garage bucket list | awk 'listing && NF { print $1 } /^List of buckets:/ { listing = 1 }')
if [[ "$buckets" == "$bucket" ]]; then pass "c3 exactly one bucket: $bucket"; else fail "c3 buckets: $buckets"; fi
names=$(garage key list | awk '$1 ~ /^GK/ { print $2 }' | sort | tr '\n' ' ')
if [[ "$names" == "food-imgproxy food-worker " ]]; then pass "c3 one key of each name"; else fail "c3 keys: $names"; fi

# s3 <ID variable> <secret variable> <curl arguments>: prints the HTTP status, leaves the body in
# $work/body.
s3() {
  local id secret
  id=$(value "$1" "$first")
  secret=$(value "$2" "$first")
  shift 2
  curl -s -o "$work/body" -w '%{http_code}' --aws-sigv4 "aws:amz:$region:s3" --user "$id:$secret" \
    -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" "$@"
}
object="$endpoint/$bucket/photos/food/bootstrap-test.txt"
echo "from the worker" >"$work/object"

code=$(s3 S3_ACCESS_KEY S3_SECRET_KEY -T "$work/object" "$object")
if [[ $code == 200 ]]; then pass "c4 food-worker can PUT"; else fail "c4 worker PUT: $code $(cat "$work/body")"; fi

code=$(s3 S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY -T "$work/object" "$object")
if [[ $code == 403 ]] && grep -q '<Code>AccessDenied</Code>' "$work/body"; then
  pass "c4 food-imgproxy cannot PUT"
else
  fail "c4 imgproxy PUT: $code $(cat "$work/body")"
fi

code=$(s3 S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY "$object")
if [[ $code == 200 ]] && cmp -s "$work/body" "$work/object"; then
  pass "c4 food-imgproxy can GET"
else
  fail "c4 imgproxy GET: $code"
fi

exit $((failures > 0))
