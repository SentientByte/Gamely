#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/push-to-dockerhub.sh <dockerhub-username> [tag]
#   e.g. ./scripts/push-to-dockerhub.sh myuser
#   e.g. ./scripts/push-to-dockerhub.sh myuser v1.2.0

DOCKERHUB_USER="${1:-}"
TAG="${2:-latest}"
IMAGE="gamely"

if [[ -z "$DOCKERHUB_USER" ]]; then
  echo "Error: Docker Hub username required."
  echo "Usage: $0 <dockerhub-username> [tag]"
  exit 1
fi

FULL_IMAGE="$DOCKERHUB_USER/$IMAGE:$TAG"

echo "Building $FULL_IMAGE ..."
docker build -t "$FULL_IMAGE" .

echo "Also tagging as $DOCKERHUB_USER/$IMAGE:latest ..."
docker tag "$FULL_IMAGE" "$DOCKERHUB_USER/$IMAGE:latest"

echo "Logging in to Docker Hub (enter your password when prompted) ..."
docker login -u "$DOCKERHUB_USER"

echo "Pushing $FULL_IMAGE ..."
docker push "$FULL_IMAGE"

if [[ "$TAG" != "latest" ]]; then
  echo "Pushing $DOCKERHUB_USER/$IMAGE:latest ..."
  docker push "$DOCKERHUB_USER/$IMAGE:latest"
fi

echo ""
echo "Done! Image pushed:"
echo "  docker pull $FULL_IMAGE"
echo ""
echo "Run with:"
echo "  docker run -d -p 3000:3000 -v gamely_data:/data $FULL_IMAGE"
