FROM node:18-alpine
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml /app/
RUN pnpm install
COPY . /app
RUN pnpm run build
ENV NODE_ENV=production

CMD ["pnpm", "start"]
