#!/usr/bin/env bash
# Forbidden strings (Guide Appendix F.4). RIPGREP overrides the ripgrep binary.
set -euo pipefail
cd "$(dirname "$0")/.."            # src/features/food
rg_bin=${RIPGREP:-rg}
# Without this, a missing ripgrep would read as "no match" and the check would pass.
command -v "$rg_bin" >/dev/null || { echo "compliance-grep: $rg_bin is not installed" >&2; exit 2; }
fail=0
forbid() {  # pattern, path, label, [the one file that may contain it]
  local status=0
  local globs=(-g '!**/tests/fixtures/**' -g '!**/*.md' -g '!scripts/compliance-grep.sh')
  [[ -z "${4:-}" ]] || globs+=(-g "!$4")
  "$rg_bin" -n --hidden "${globs[@]}" "$1" "$2" || status=$?
  case $status in
    0) echo "FORBIDDEN ($3)"; fail=1 ;;
    1) ;;
    *) echo "compliance-grep: ripgrep failed ($3)" >&2; fail=1 ;;
  esac
}
# The exempt files are tests that need the string to show that it is refused.
forbid 'maps\.googleapis\.com|places\.googleapis\.com|maps\.google\.'       .       'Google Maps/Places, R1'
forbid 'search\.list|/youtube/v3/search|search\(\s*part='                    workers 'YouTube search, R2' '**/tests/unit/test_harness_strict.py'
forbid 'upload\.wikimedia\.org'                                              api     'Commons hotlink, R4' '**/tests/contract/mocks.test.ts'
forbid '(IMGPROXY_KEY|IMGPROXY_SALT|S3_SECRET_KEY|ADMIN_PASSWORD|RPC_SECRET):-' .     'secret default, R10'
exit "$fail"
