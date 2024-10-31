#!/usr/bin/env bash

docker build -t hardhat-zkit --progress=plain --no-cache .
docker rmi hardhat-zkit --force
