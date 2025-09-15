# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# ---- Runtime image ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN mkdir -p /data && chown -R app:app /data

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Runtime env
ENV NODE_ENV=production
# Point LevelDB to a persistent location
ENV DB_PATH=/data/chaindata

# Ports:
# - HTTP API (Express): PORT (default 3001)
# - P2P WebSocket:      P2P_PORT (default 5001)
EXPOSE 3001 5001

# Healthcheck 
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:"+(process.env.PORT||3001)+"/blocks").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

USER app
CMD ["npm", "run", "start"]
