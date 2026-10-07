FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund

COPY worker.mjs ./worker.mjs

ENV NODE_ENV=production

CMD ["node", "worker.mjs"]
