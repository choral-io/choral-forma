#!/usr/bin/env sh
set -eu

REPO="${FORMA_INSTALL_REPO:-choral-io/choral-forma}"
VERSION="${1:-latest}"
INSTALL_DIR="${FORMA_INSTALL_DIR:-$HOME/.local/bin}"

case "$REPO" in
  */*)
    repo_owner="${REPO%%/*}"
    repo_name="${REPO#*/}"
    ;;
  *)
    echo "invalid GitHub repository identity: $REPO" >&2
    exit 1
    ;;
esac
case "$repo_owner" in
  "" | "." | ".." | *[!A-Za-z0-9._-]*)
    echo "invalid GitHub repository identity: $REPO" >&2
    exit 1
    ;;
esac
case "$repo_name" in
  "" | "." | ".." | */* | *[!A-Za-z0-9._-]*)
    echo "invalid GitHub repository identity: $REPO" >&2
    exit 1
    ;;
esac

case "$(uname -s)" in
  Darwin) os="macos" ;;
  Linux) os="linux" ;;
  *)
    echo "unsupported operating system: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *)
    echo "unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

asset="forma-${os}-${arch}.tar.gz"
base_url="https://github.com/${REPO}/releases"
if [ "$VERSION" = "latest" ]; then
  download_url="${base_url}/latest/download/${asset}"
  checksum_url="${base_url}/latest/download/${asset}.sha256"
else
  download_url="${base_url}/download/${VERSION}/${asset}"
  checksum_url="${base_url}/download/${VERSION}/${asset}.sha256"
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256_tool="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  sha256_tool="shasum"
elif command -v openssl >/dev/null 2>&1; then
  sha256_tool="openssl"
else
  echo "no supported SHA-256 tool found; install sha256sum, shasum, or OpenSSL and retry" >&2
  exit 1
fi

verify_sha256() {
  checksum_file="$1"
  asset_file="$2"

  case "$sha256_tool" in
    sha256sum)
      sha256sum -c "$checksum_file"
      ;;
    shasum)
      shasum -a 256 -c "$checksum_file"
      ;;
    openssl)
      IFS=' ' read -r expected_checksum _ < "$checksum_file"
      if [ "${#expected_checksum}" -ne 64 ]; then
        echo "invalid SHA-256 checksum file: $checksum_file" >&2
        return 1
      fi
      case "$expected_checksum" in
        *[!0-9A-Fa-f]*)
          echo "invalid SHA-256 checksum in $checksum_file" >&2
          return 1
          ;;
      esac

      actual_checksum="$(openssl dgst -sha256 -r "$asset_file")"
      actual_checksum="${actual_checksum%% *}"
      if [ "$actual_checksum" != "$expected_checksum" ]; then
        echo "SHA-256 checksum verification failed for $asset_file" >&2
        return 1
      fi
      printf '%s\n' "$asset_file: OK"
      ;;
  esac
}

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

echo "Downloading ${asset} from ${REPO} ${VERSION}"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  if [ "$VERSION" = "latest" ]; then
    gh release download --repo "$REPO" --pattern "$asset" --pattern "$asset.sha256" --dir "$tmp_dir"
  else
    gh release download "$VERSION" --repo "$REPO" --pattern "$asset" --pattern "$asset.sha256" --dir "$tmp_dir"
  fi
else
  curl -fsSL "$download_url" -o "$tmp_dir/$asset"
  curl -fsSL "$checksum_url" -o "$tmp_dir/$asset.sha256"
fi

(
  cd "$tmp_dir"
  verify_sha256 "$asset.sha256" "$asset"
  tar -xzf "$asset"
)

mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp_dir/forma-${os}-${arch}/bin/forma" "$INSTALL_DIR/forma"

version_output="$("$INSTALL_DIR/forma" --version)"
case "$version_output" in
  "forma "*) installed_version="${version_output#forma }" ;;
  *)
    echo "installed Forma returned an unexpected version: $version_output" >&2
    exit 1
    ;;
esac
case "$installed_version" in
  "" | *[!0-9A-Za-z.+-]*)
    echo "installed Forma returned an invalid version: $installed_version" >&2
    exit 1
    ;;
esac

echo "Installed forma to $INSTALL_DIR/forma"
echo "Ensure $INSTALL_DIR is on PATH before running forma."
