FROM node:18-alpine

WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn install
COPY . /app
RUN yarn build
ENV NODE_ENV=production

CMD ["yarn", "start"]