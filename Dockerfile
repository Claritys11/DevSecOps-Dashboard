# syntax=docker/dockerfile:1.7
# One image runs the web app, the monitor worker, and serves the agent binaries.

FROM golang:1.24-alpine AS agent
WORKDIR /src
COPY agent/go.mod ./
COPY agent/ ./
ARG AGENT_VERSION=dev
RUN for arch in amd64 arm64; do \
      CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags="-s -w" \
        -o /out/devsecops-agent-linux-$arch ./cmd/agent; \
    done

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl tini
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/package.json /app/tsconfig.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/agent/install.sh ./agent/install.sh
COPY --from=agent --chown=node:node /out/ ./agent/dist/
RUN chmod +x ./scripts/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
