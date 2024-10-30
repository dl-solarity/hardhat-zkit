ARG NODE_VERSION=20.0.0

FROM node:${NODE_VERSION}-alpine

ARG RUN_COMMAND=test-local
ENV RUN_COMMAND=$RUN_COMMAND

WORKDIR /hardhat-zkit

COPY . .

RUN npm install

RUN npm run ${RUN_COMMAND}
