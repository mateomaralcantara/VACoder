FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY services/cloud-worker ./services/cloud-worker
ENV NODE_ENV=production
CMD ["node", "services/cloud-worker/worker.mjs"]
