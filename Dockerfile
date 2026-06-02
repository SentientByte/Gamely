# Build and run in a single stage to handle native modules (better-sqlite3)
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install deps first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DB_PATH=/data/game.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data

EXPOSE 3000

CMD ["npm", "start"]
