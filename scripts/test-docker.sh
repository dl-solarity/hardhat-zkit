#!/usr/bin/env bash

docker build -t hardhat-zkit --progress=plain .
docker run --rm hardhat-zkit test-local
