ARG NODE_VERSION=20

FROM node:${NODE_VERSION} AS base
WORKDIR /hardhat-zkit

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json /temp/dev/
RUN cd /temp/dev && npm ci

FROM base AS dev
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENTRYPOINT ["npm", "run"]
