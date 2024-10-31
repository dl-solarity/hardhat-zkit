ARG NODE_VERSION=20

FROM node:${NODE_VERSION}

WORKDIR /hardhat-zkit

COPY . .

RUN npm install

ARG RUN_TESTS=true

RUN if [ "$RUN_TESTS" = "true" ]; then npm run test-local; fi
