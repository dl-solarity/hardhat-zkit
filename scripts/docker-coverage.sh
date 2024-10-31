#!/usr/bin/env bash

docker build --build-arg RUN_TESTS=false -t hardhat-zkit --progress=plain --no-cache .
docker run --rm -v $(pwd)/coverage:/hardhat-zkit/coverage hardhat-zkit npm run coverage-local
docker rmi hardhat-zkit --force
