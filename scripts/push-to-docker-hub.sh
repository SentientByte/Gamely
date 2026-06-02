#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DOCKER_HUB_USERNAME=yourname ./scripts/push-to-docker-hub.sh
#   DOCKER_HUB_USERNAME=yourname VERSION=2.0.0 ./scripts/push-to-docker-hub.sh

IMAGE_NAME="gamely"
VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")}"

if [[ -z "${DOCKER_HUB_USERNAME:-}" ]]; then
  echo "Error: DOCKER_HUB_USERNAME is required."
  echo "Usage: DOCKER_HUB_USERNAME=yourname ./scripts/push-to-docker-hub.sh"
  exit 1
fi

FULL_IMAGE="${DOCKER_HUB_USERNAME}/${IMAGE_NAME}"

echo "=> Building ${FULL_IMAGE}:${VERSION} ..."
docker build \
  --tag "${FULL_IMAGE}:${VERSION}" \
  --tag "${FULL_IMAGE}:latest" \
  .

echo "=> Pushing ${FULL_IMAGE}:${VERSION} ..."
docker push "${FULL_IMAGE}:${VERSION}"
docker push "${FULL_IMAGE}:latest"

echo ""
echo "Done! Image available at:"
echo "  docker pull ${FULL_IMAGE}:${VERSION}"
echo "  docker pull ${FULL_IMAGE}:latest"
