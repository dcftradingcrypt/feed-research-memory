# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim
ARG VERSION
ARG REVISION
LABEL org.opencontainers.image.title="feed-research-memory" \
      org.opencontainers.image.description="One-shot RSS/Atom research-memory CLI for DKG Working Memory" \
      org.opencontainers.image.source="https://github.com/dcftradingcrypt/feed-research-memory" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json LICENSE ./
COPY --chown=node:node src ./src
USER node:node
ENTRYPOINT ["node", "/app/src/cli.mjs"]
CMD ["--help"]
