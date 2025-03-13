#!/usr/bin/env bash
set -e

echo "=== Installing snapd and kubectl ==="
sudo apt update
sudo apt install -y snapd
sudo snap install kubectl --classic

echo "=== Checking kubectl version ==="
kubectl version --client

echo "=== Done! You can now run 'kubectl apply -f deployment.yaml' and 'kubectl apply -f service.yaml'."
