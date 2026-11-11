#!/usr/bin/env bash
# Builds the site and publishes it to https://portfolio.banadiyabhai.online
#
#   pnpm deploy:live
#
# The site is served by Caddy on avi-server (the machine behind
# stella.banadiyabhai.online) from /srv/portfolio. That folder is root-owned
# and outside Stella's home, so her site sync never touches it.
# Needs: gcloud logged in with access to the `divyarudra` project.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=divyarudra
ZONE=asia-south1-a
HOST=Abhinav@avi-server
TARGET=/srv/portfolio

pnpm build
tarball=$(mktemp --suffix=.tgz)
trap 'rm -f "$tarball"' EXIT
tar -czf "$tarball" -C dist .
echo "uploading $(du -h "$tarball" | cut -f1)…"
gcloud compute scp "$tarball" "$HOST:/tmp/portfolio-dist.tgz" --project "$PROJECT" --zone "$ZONE" --quiet

# Unpack next to the live folder, then swap it in, so visitors never see a half-copied site.
gcloud compute ssh "$HOST" --project "$PROJECT" --zone "$ZONE" --quiet --command 'bash -s' <<EOF
set -e
sudo rm -rf $TARGET.new && sudo mkdir -p $TARGET.new
sudo tar -xzf /tmp/portfolio-dist.tgz -C $TARGET.new </dev/null
sudo chown -R root:root $TARGET.new && sudo chmod -R u=rwX,go=rX $TARGET.new
rm -f /tmp/portfolio-dist.tgz
if [ -d $TARGET ]; then sudo rm -rf $TARGET.old && sudo mv $TARGET $TARGET.old; fi
sudo mv $TARGET.new $TARGET && sudo rm -rf $TARGET.old
echo "live files: \$(sudo find $TARGET -type f | wc -l)"
EOF
echo "published: https://portfolio.banadiyabhai.online"
