FROM node:13-buster

MAINTAINER nikita@mygento.net

ENV NODE_ENV=production
WORKDIR /app

COPY package.json .

RUN yarn install --production

COPY . .

EXPOSE 3000
CMD ["yarn", "run", "start"]