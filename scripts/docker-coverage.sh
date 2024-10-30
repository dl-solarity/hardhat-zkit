#!/usr/bin/env bash

echo "Running coverage on node 20.0.0"
docker build --build-arg RUN_COMMAND=coverage-local -t hardhat-zkit-coverage-runner --progress=plain --no-cache .

echo "Removing Docker image"
docker rmi hardhat-zkit-coverage-runner --force
