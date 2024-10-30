FROM node:lts

WORKDIR /hardhat-zkit

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "run", "test:local"]
