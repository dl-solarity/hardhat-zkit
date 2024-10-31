#!/usr/bin/env bash

docker build -t hardhat-zkit --progress=plain .
docker run --rm -v $(pwd)/coverage:/hardhat-zkit/coverage hardhat-zkit coverage-local
