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

if command -v sha256sum >/dev/null 2>&1; then
  host_checksum_kind="sha256sum"
  host_checksum_command="$(command -v sha256sum)"
elif command -v shasum >/dev/null 2>&1; then
  host_checksum_kind="shasum"
  host_checksum_command="$(command -v shasum)"
else
  printf '%s\n' "Unix installer tests require sha256sum or shasum." >&2
  exit 1
fi

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
  case "$host_checksum_kind" in
    sha256sum) "$host_checksum_command" forma-macos-arm64.tar.gz > forma-macos-arm64.tar.gz.sha256 ;;
    shasum) "$host_checksum_command" -a 256 forma-macos-arm64.tar.gz > forma-macos-arm64.tar.gz.sha256 ;;
  esac
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

cat > "$fake_bin/sha256sum" <<'SCRIPT'
#!/usr/bin/env sh
test "$#" -eq 2
test "$1" = "-c"
case "$FORMA_INSTALL_TEST_CHECKSUM_KIND" in
  sha256sum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" -c "$2" ;;
  shasum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" -a 256 -c "$2" ;;
  *) exit 1 ;;
esac
SCRIPT
chmod +x "$fake_bin/sha256sum"

cat > "$fake_bin/shasum" <<'SCRIPT'
#!/usr/bin/env sh
printf '%s\n' "The Unix installer used shasum even though sha256sum was available." >&2
exit 99
SCRIPT
chmod +x "$fake_bin/shasum"

cat > "$fake_bin/shasum-only" <<'SCRIPT'
#!/usr/bin/env sh
test "$#" -eq 4
test "$1" = "-a"
test "$2" = "256"
test "$3" = "-c"
case "$FORMA_INSTALL_TEST_CHECKSUM_KIND" in
  sha256sum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" -c "$4" ;;
  shasum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" -a 256 -c "$4" ;;
  *) exit 1 ;;
esac
SCRIPT
chmod +x "$fake_bin/shasum-only"

cat > "$fake_bin/openssl-only" <<'SCRIPT'
#!/usr/bin/env sh
test "$#" -eq 4
test "$1" = "dgst"
test "$2" = "-sha256"
test "$3" = "-r"
case "$FORMA_INSTALL_TEST_CHECKSUM_KIND" in
  sha256sum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" "$4" ;;
  shasum) exec "$FORMA_INSTALL_TEST_CHECKSUM_COMMAND" -a 256 "$4" ;;
  *) exit 1 ;;
esac
SCRIPT
chmod +x "$fake_bin/openssl-only"

link_command() {
  command_name="$1"
  destination="$2"
  command_path="$(command -v "$command_name")"
  test -n "$command_path"
  ln -s "$command_path" "$destination/$command_name"
}

make_restricted_path() {
  destination="$1"
  mkdir -p "$destination"
  for command_name in env sh mktemp rm tar gzip mkdir install cp; do
    link_command "$command_name" "$destination"
  done
  ln -s "$fake_bin/uname" "$destination/uname"
  ln -s "$fake_bin/gh" "$destination/gh"
}

PATH="$fake_bin:$PATH" \
FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
FORMA_INSTALL_TEST_CHECKSUM_KIND="$host_checksum_kind" \
FORMA_INSTALL_TEST_CHECKSUM_COMMAND="$host_checksum_command" \
FORMA_INSTALL_DIR="$install_dir" \
FORMA_INSTALL_REPO="choral-io/choral-forma" \
sh "$repository_root/install.sh" v9.9.9

if FORMA_INSTALL_REPO="../choral-forma" sh "$repository_root/install.sh" latest >/dev/null 2>&1; then
  printf '%s\n' "The Unix installer accepted an invalid repository identity." >&2
  exit 1
fi

test "$("$install_dir/forma" --version)" = "forma 9.9.9"
test ! -e "$install_dir/forma.install.json"

printf '%s\n' '{"legacy":true}' > "$install_dir/forma.install.json"
PATH="$fake_bin:$PATH" \
FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
FORMA_INSTALL_TEST_CHECKSUM_KIND="$host_checksum_kind" \
FORMA_INSTALL_TEST_CHECKSUM_COMMAND="$host_checksum_command" \
FORMA_INSTALL_DIR="$install_dir" \
FORMA_INSTALL_REPO="choral-io/choral-forma" \
sh "$repository_root/install.sh" v9.9.9
test "$(cat "$install_dir/forma.install.json")" = '{"legacy":true}'

shasum_path="$test_root/shasum-path"
shasum_install_dir="$test_root/shasum-install"
make_restricted_path "$shasum_path"
ln -s "$fake_bin/shasum-only" "$shasum_path/shasum"
PATH="$shasum_path" \
FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
FORMA_INSTALL_TEST_CHECKSUM_KIND="$host_checksum_kind" \
FORMA_INSTALL_TEST_CHECKSUM_COMMAND="$host_checksum_command" \
FORMA_INSTALL_DIR="$shasum_install_dir" \
FORMA_INSTALL_REPO="choral-io/choral-forma" \
/bin/sh "$repository_root/install.sh" v9.9.9
test "$("$shasum_install_dir/forma" --version)" = "forma 9.9.9"

openssl_path="$test_root/openssl-path"
openssl_install_dir="$test_root/openssl-install"
make_restricted_path "$openssl_path"
ln -s "$fake_bin/openssl-only" "$openssl_path/openssl"
PATH="$openssl_path" \
FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
FORMA_INSTALL_TEST_CHECKSUM_KIND="$host_checksum_kind" \
FORMA_INSTALL_TEST_CHECKSUM_COMMAND="$host_checksum_command" \
FORMA_INSTALL_DIR="$openssl_install_dir" \
FORMA_INSTALL_REPO="choral-io/choral-forma" \
/bin/sh "$repository_root/install.sh" v9.9.9
test "$("$openssl_install_dir/forma" --version)" = "forma 9.9.9"

no_checksum_path="$test_root/no-checksum-path"
no_checksum_output="$test_root/no-checksum-output.txt"
make_restricted_path "$no_checksum_path"
if PATH="$no_checksum_path" \
  FORMA_INSTALL_TEST_FIXTURE="$fixture_root" \
  FORMA_INSTALL_TEST_CHECKSUM_KIND="$host_checksum_kind" \
  FORMA_INSTALL_TEST_CHECKSUM_COMMAND="$host_checksum_command" \
  FORMA_INSTALL_DIR="$test_root/no-checksum-install" \
  FORMA_INSTALL_REPO="choral-io/choral-forma" \
  /bin/sh "$repository_root/install.sh" v9.9.9 >"$no_checksum_output" 2>&1; then
  printf '%s\n' "The Unix installer continued without a supported SHA-256 tool." >&2
  exit 1
fi
grep -F "no supported SHA-256 tool found" "$no_checksum_output" >/dev/null
if grep -F "Downloading" "$no_checksum_output" >/dev/null; then
  printf '%s\n' "The Unix installer downloaded assets before checking for a SHA-256 tool." >&2
  exit 1
fi

printf '%s\n' "Unix installer tests passed."
