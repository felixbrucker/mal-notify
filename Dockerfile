FROM node:18-alpine
RUN yarn set version stable

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml /app/
RUN yarn install
COPY . /app
RUN yarn build
ENV NODE_ENV=production

CMD ["yarn", "start"]
