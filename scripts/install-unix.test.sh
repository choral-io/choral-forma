#!/usr/bin/env sh
set -eu

repository_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
test_root="$(mktemp -d)"
cleanup() {
  rm -rf "$test_root"
}
trap cleanup EXIT INT TERM

fixture_root="$test_root/fixture"
fake_bin="$test_root/fake-bin"
install_dir="$test_root/install"
package_root="$fixture_root/forma-macos-arm64"
mkdir -p "$fake_bin" "$package_root/bin"

cat > "$package_root/bin/forma" <<'SCRIPT'
#!/usr/bin/env sh
if [ "${1:-}" != "--version" ]; then
  exit 1
fi
printf '%s\n' "forma 9.9.9"
SCRIPT
chmod +x "$package_root/bin/forma"

(
  cd "$fixture_root"
  tar -czf forma-macos-arm64.tar.gz forma-macos-arm64
  shasum -a 256 forma-macos-arm64.tar.gz > forma-macos-arm64.tar.gz.sha256
)

cat > "$fake_bin/uname" <<'SCRIPT'
#!/usr/bin/env sh
case "${1:-}" in
  -s) printf '%s\n' "Darwin" ;;
  -m) printf '%s\n' "arm64" ;;
  *) exit 1 ;;
esac
SCRIPT
chmod +x "$fake_bin/uname"

cat > "$fake_bin/gh" <<'SCRIPT'
#!/usr/bin/env sh
if [ "${1:-}" = "auth" ] && [ "${2:-}" = "status" ]; then
  exit 0
fi
destination=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--dir" ]; then
    shift
    destination="$1"
  fi
  shift
done
test -n "$destination"
cp "$FORMA_INSTALL_TEST_FIXTURE/forma-macos-arm64.tar.gz" "$destination/"
cp "$FORMA_INSTALL_TEST_FIXTURE/forma-macos-arm64.tar.gz.sha256" "$destination/"
SCRIPT
chmod +x "$fake_bin/gh"

PATH="$fake_bin:$PATH" \
FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
FORMA_INSTALL_DIR="$install_dir" \
FORMA_INSTALL_REPO="choral-io/choral-forma" \
sh "$repository_root/install.sh" v9.9.9

if FORMA_INSTALL_REPO="../choral-forma" sh "$repository_root/install.sh" latest >/dev/null 2>&1; then
  printf '%s\n' "The Unix installer accepted an invalid repository identity." >&2
  exit 1
fi

test "$("$install_dir/forma" --version)" = "forma 9.9.9"
node -e '
const fs = require("node:fs");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (
  receipt.schemaVersion !== 1 ||
  receipt.manager !== "forma-install-script" ||
  receipt.repository !== "choral-io/choral-forma" ||
  receipt.installedVersion !== "9.9.9" ||
  Object.hasOwn(receipt, "pendingUpdate")
) {
  throw new Error(`unexpected installation receipt: ${JSON.stringify(receipt)}`);
}
' "$install_dir/forma.install.json"

printf '%s\n' "Unix installer tests passed."
