#!/bin/bash

set -e

echo "== RS OS Runtime Deploy =="

cd /opt/rsos/runtime-api

echo "[1/5] Building image..."
sudo docker build -t rsos-runtime-api .

echo "[2/5] Stopping old container..."
sudo docker stop rsos-runtime-api || true
sudo docker rm rsos-runtime-api || true

echo "[3/5] Starting new container..."
sudo docker run -d \
  --name rsos-runtime-api \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --network rsos_default \
  rsos-runtime-api

echo "[4/5] Waiting for startup..."
sleep 5

echo "[5/5] Health check..."
curl http://127.0.0.1:8080/health

echo
echo "Deploy complete."
