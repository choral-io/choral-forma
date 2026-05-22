#!/usr/bin/env sh
set -eu

REPO="${FORMA_INSTALL_REPO:-choral-io/choral-forma}"
VERSION="${1:-latest}"
INSTALL_DIR="${FORMA_INSTALL_DIR:-$HOME/.local/bin}"

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

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

echo "Downloading ${asset} from ${REPO} ${VERSION}"
curl -fsSL "$download_url" -o "$tmp_dir/$asset"
curl -fsSL "$checksum_url" -o "$tmp_dir/$asset.sha256"

(
  cd "$tmp_dir"
  shasum -a 256 -c "$asset.sha256"
  tar -xzf "$asset"
)

mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp_dir/forma-${os}-${arch}/bin/forma" "$INSTALL_DIR/forma"

echo "Installed forma to $INSTALL_DIR/forma"
echo "Ensure $INSTALL_DIR is on PATH before running forma."
