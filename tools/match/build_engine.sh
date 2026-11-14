#!/usr/bin/env bash
# Build the Node wasm engine at a git ref into tools/match/engines/<name>/.
#   tools/match/build_engine.sh <git-ref> <name>
#   tools/match/build_engine.sh WORKTREE <name>   # current working tree (uncommitted changes included)
set -euo pipefail
ref="$1"; name="$2"
root="$(git rev-parse --show-toplevel)"
out="$root/tools/match/engines/$name"
rm -rf "$out"
if [ "$ref" = "WORKTREE" ]; then
  src="$root"
else
  src="$root/tools/match/engines/.src-$name"
  git -C "$root" worktree remove --force "$src" 2>/dev/null || rm -rf "$src"
  git -C "$root" worktree add --detach -q "$src" "$ref"
fi
wasm-pack build "$src/crates/shatrunz-wasm" --target nodejs --release --no-opt --out-dir "$out" >/dev/null 2>&1
rm -f "$out/.gitignore"
if [ "$ref" != "WORKTREE" ]; then git -C "$root" worktree remove --force "$src"; fi
echo "built $name from $ref -> $out ($(git -C "$root" rev-parse --short "${ref/WORKTREE/HEAD}"))"
