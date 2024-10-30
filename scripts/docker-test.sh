#!/usr/bin/env bash

echo "Running tests on node 18.0.0"
docker build --build-arg NODE_VERSION=18.0.0 -t hardhat-zkit-test-runner-node18 --progress=plain --no-cache .

echo "Running tests on node 20.0.0"
docker build --build-arg NODE_VERSION=20.0.0 -t hardhat-zkit-test-runner-node20 --progress=plain --no-cache .

echo "Removing Docker images"
docker rmi hardhat-zkit-test-runner-node18 hardhat-zkit-test-runner-node20 --force
